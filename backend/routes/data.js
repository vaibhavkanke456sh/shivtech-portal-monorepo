import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import Client from '../models/Client.js';
import Task from '../models/Task.js';
import Service from '../models/Service.js';
import ServiceGroup from '../models/ServiceGroup.js';
import * as serviceController from '../controllers/serviceController.js';
import FundTransfer from '../models/FundTransfer.js';
import AepsEntry from '../models/AepsEntry.js';
import MobileBalance from '../models/MobileBalance.js';
import BankCashAeps from '../models/BankCashAeps.js';
import SalesEntry from '../models/SalesEntry.js';
import OnlineReceivedCashGiven from '../models/OnlineReceivedCashGiven.js';
import User from '../models/User.js';
import TaskGroup from '../models/TaskGroup.js';
import PaymentCollect from '../models/PaymentCollect.js';

const router = express.Router();

// --- Simple SSE setup for realtime task updates ---
const taskSseClients = new Set();
const broadcastTaskEvent = (eventName, payload) => {
  const data = JSON.stringify({ type: eventName, ...payload });
  for (const res of taskSseClients) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {}
  }
};

// --- Group payment helpers ---
// Payments are applied only to tasks the user selects (in order).
// When a task's paid amount reaches Final Charges, that task is fully paid
// and drops from unpaid — other tasks stay unpaid until selected.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Fill selected tasks in order: pay each task's unpaid until money runs out.
 * tasksInOrder: mongoose task docs in the order chosen by the user.
 * Returns { allocations: [{ task, amount, fullyPaid }], leftover }
 */
const planSequentialAllocation = (tasksInOrder, paymentAmount) => {
  let remaining = round2(paymentAmount);
  const allocations = [];

  for (const t of tasksInOrder) {
    if (remaining <= 0.001) break;
    const unpaid = round2(
      Math.max(
        0,
        t.unpaidAmount != null
          ? Number(t.unpaidAmount)
          : Number(t.finalCharges || 0) - Number(t.amountCollected || 0)
      )
    );
    if (unpaid <= 0) continue;
    const add = round2(Math.min(unpaid, remaining));
    if (add <= 0) continue;
    const newCollected = round2(Number(t.amountCollected || 0) + add);
    const finalCharges = round2(t.finalCharges);
    allocations.push({
      task: t,
      amount: add,
      fullyPaid: newCollected >= finalCharges - 0.001
    });
    remaining = round2(remaining - add);
  }

  return { allocations, leftover: remaining };
};

/** Apply explicit per-task amounts (from sequential plan or client). */
const applyAllocationsToTasks = async (allocations, meta = {}) => {
  const {
    paymentMode = 'cash',
    paymentRemarks = '',
    isInitialPayment = false,
    userId = null
  } = meta;

  const updatedTasks = [];
  for (const row of allocations) {
    const add = round2(row.amount);
    if (add <= 0) continue;
    const t = row.task;
    const finalCharges = round2(t.finalCharges);
    const newCollected = round2(Math.min(finalCharges, Number(t.amountCollected || 0) + add));
    const newUnpaid = round2(Math.max(finalCharges - newCollected, 0));

    const updated = await Task.findByIdAndUpdate(
      t._id,
      {
        amountCollected: newCollected,
        unpaidAmount: newUnpaid,
        updatedBy: userId || t.updatedBy,
        $push: {
          paymentHistory: {
            amount: add,
            paymentMode,
            paymentRemarks,
            paidAt: new Date(),
            isInitialPayment: !!isInitialPayment
          }
        }
      },
      { new: true }
    )
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email');

    if (updated) {
      updatedTasks.push(updated);
      broadcastTaskEvent('task_updated', { task: updated });
    }
  }
  return updatedTasks;
};

/** Find tasks linked to a group (handles ObjectId vs string groupId storage). */
const findTasksForGroup = async (groupId) => {
  const idStr = String(groupId);
  const tasks = await Task.find({
    isDeleted: { $ne: true },
    $or: [{ groupId: groupId }, { groupId: idStr }]
  }).sort({ createdAt: 1 });
  return tasks;
};

/**
 * Only when the group is fully paid: mark every linked task fully paid.
 * Does NOT redistribute partial payments (user chooses which tasks get money).
 */
const settleFullyPaidGroupTasks = async (groupDoc, options = {}) => {
  const force = !!options.force;
  if (!groupDoc?._id) {
    return { group: groupDoc, tasks: [], repaired: false, tasksUpdated: 0, reason: 'no-group' };
  }

  let group = groupDoc;
  const tasks = await findTasksForGroup(group._id);
  if (!tasks.length) {
    return { group, tasks: [], repaired: false, tasksUpdated: 0, reason: 'no-tasks' };
  }

  const totalAmountFromTasks = round2(tasks.reduce((s, t) => s + (Number(t.finalCharges) || 0), 0));
  const totalAmount = round2(
    Math.max(Number(group.totalAmount) || 0, totalAmountFromTasks || 0)
  );

  let histSum = 0;
  if (Array.isArray(group.paymentHistory) && group.paymentHistory.length > 0) {
    histSum = round2(group.paymentHistory.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  }

  let totalPaid = round2(group.totalPaid || 0);
  if (histSum > 0) {
    // Prefer payment history as source of truth when present
    totalPaid = Math.max(totalPaid, histSum);
  }
  totalPaid = round2(totalPaid);

  const storedRemaining = Number(group.remainingAmount);
  const storedRemainingNum = Number.isFinite(storedRemaining) ? round2(storedRemaining) : null;

  // Computed remaining from totals (do not cap totalPaid down before this check)
  let remainingAmount = totalAmount > 0 ? round2(Math.max(totalAmount - totalPaid, 0)) : null;

  const anyTaskUnpaid = tasks.some((t) => round2(t.unpaidAmount) > 0.01);
  const sumTaskUnpaid = round2(tasks.reduce((s, t) => s + Math.max(0, Number(t.unpaidAmount) || 0), 0));

  // Fully paid if any of these hold
  const treatAsFullyPaid =
    force ||
    (storedRemainingNum !== null && storedRemainingNum <= 0.01) ||
    (remainingAmount !== null && remainingAmount <= 0.01) ||
    (totalAmount > 0 && totalPaid + 0.01 >= totalAmount) ||
    (totalAmountFromTasks > 0 && totalPaid + 0.01 >= totalAmountFromTasks) ||
    (histSum > 0 && totalAmount > 0 && histSum + 0.01 >= totalAmount) ||
    // UI showed Fully Paid but task unpaid left: remaining field 0 OR paid covers total
    (anyTaskUnpaid && storedRemainingNum !== null && storedRemainingNum <= 0.01);

  if (!treatAsFullyPaid) {
    return {
      group,
      tasks,
      repaired: false,
      tasksUpdated: 0,
      reason: 'not-fully-paid',
      debug: {
        totalAmount,
        totalPaid,
        histSum,
        storedRemaining: storedRemainingNum,
        remainingAmount,
        anyTaskUnpaid,
        sumTaskUnpaid,
        taskCount: tasks.length
      }
    };
  }

  // Normalize group to fully paid
  remainingAmount = 0;
  if (totalAmount > 0) totalPaid = totalAmount;

  if (
    Math.abs((group.totalAmount || 0) - totalAmount) > 0.01 ||
    Math.abs((group.totalPaid || 0) - totalPaid) > 0.01 ||
    Math.abs((group.remainingAmount || 0) - remainingAmount) > 0.01
  ) {
    group = await TaskGroup.findByIdAndUpdate(
      group._id,
      { totalAmount, totalPaid, remainingAmount },
      { new: true }
    );
  }

  let repaired = false;
  let tasksUpdated = 0;
  const updatedTasks = [];
  for (const t of tasks) {
    const finalCharges = round2(t.finalCharges);
    const needsFix =
      Math.abs(round2(t.amountCollected) - finalCharges) > 0.01 ||
      Math.abs(round2(t.unpaidAmount)) > 0.01;

    if (needsFix) {
      repaired = true;
      tasksUpdated += 1;
      const updated = await Task.findByIdAndUpdate(
        t._id,
        {
          amountCollected: finalCharges,
          unpaidAmount: 0,
          isGrouped: true,
          groupId: group._id
        },
        { new: true }
      )
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username email');
      updatedTasks.push(updated);
      broadcastTaskEvent('task_updated', { task: updated });
    } else {
      updatedTasks.push(t);
    }
  }

  return {
    group,
    tasks: updatedTasks,
    repaired,
    tasksUpdated,
    reason: repaired ? 'settled' : 'already-clean',
    debug: { totalAmount, totalPaid, taskCount: tasks.length, sumTaskUnpaid }
  };
};

/**
 * Scan groups + unpaid grouped tasks and settle fully paid ones.
 * Also returns diagnostics so /health can show why nothing was repaired.
 */
export const runFullGroupPaymentRepair = async () => {
  const stats = {
    groupsChecked: 0,
    groupsRepaired: 0,
    tasksUpdated: 0,
    unpaidGroupedTasksFound: 0,
    groupsWithUnpaidTasks: 0,
    skippedNotFullyPaid: 0,
    skippedNoTasks: 0,
    skippedAlreadyClean: 0,
    sampleSkipped: []
  };

  // Count unpaid tasks that look grouped (isGrouped flag OR has groupId)
  const unpaidGroupedTasks = await Task.find({
    isDeleted: { $ne: true },
    unpaidAmount: { $gt: 0.01 },
    $or: [{ isGrouped: true }, { groupId: { $ne: null, $exists: true } }]
  }).select('_id groupId unpaidAmount finalCharges serialNo taskName');

  stats.unpaidGroupedTasksFound = unpaidGroupedTasks.length;

  const [allGroups] = await Promise.all([TaskGroup.find({}).lean(false)]);
  const byId = new Map(allGroups.map((g) => [String(g._id), g]));

  // Include every groupId referenced by unpaid tasks
  for (const t of unpaidGroupedTasks) {
    if (!t.groupId) continue;
    const id = String(t.groupId);
    if (!byId.has(id)) {
      const g = await TaskGroup.findById(t.groupId);
      if (g) byId.set(id, g);
    }
  }

  // Track groups that still have unpaid child tasks
  const unpaidByGroup = new Map();
  for (const t of unpaidGroupedTasks) {
    if (!t.groupId) continue;
    const id = String(t.groupId);
    unpaidByGroup.set(id, (unpaidByGroup.get(id) || 0) + 1);
  }
  stats.groupsWithUnpaidTasks = unpaidByGroup.size;

  for (const group of byId.values()) {
    stats.groupsChecked += 1;
    try {
      // Force settle when this group still has unpaid tasks AND remaining is ~0
      const unpaidCount = unpaidByGroup.get(String(group._id)) || 0;
      const force =
        unpaidCount > 0 &&
        Number.isFinite(Number(group.remainingAmount)) &&
        Number(group.remainingAmount) <= 0.01;

      const result = await settleFullyPaidGroupTasks(group, { force });
      if (result.repaired) {
        stats.groupsRepaired += 1;
        stats.tasksUpdated += result.tasksUpdated || 0;
      } else if (result.reason === 'not-fully-paid') {
        stats.skippedNotFullyPaid += 1;
        if (stats.sampleSkipped.length < 5 && unpaidCount > 0) {
          stats.sampleSkipped.push({
            groupId: String(group._id).slice(-8),
            unpaidTasks: unpaidCount,
            ...result.debug
          });
        }
      } else if (result.reason === 'no-tasks') {
        stats.skippedNoTasks += 1;
      } else if (result.reason === 'already-clean') {
        stats.skippedAlreadyClean += 1;
      }
    } catch (err) {
      console.error(`Group payment repair failed for ${group._id}:`, err.message);
    }
  }

  // Last pass: any remaining unpaid grouped tasks whose group is fully paid
  const stillUnpaid = await Task.find({
    isDeleted: { $ne: true },
    unpaidAmount: { $gt: 0.01 },
    groupId: { $ne: null, $exists: true }
  });

  for (const t of stillUnpaid) {
    try {
      const group = await TaskGroup.findById(t.groupId);
      if (!group) continue;
      const remaining = Number(group.remainingAmount);
      const histSum = Array.isArray(group.paymentHistory)
        ? round2(group.paymentHistory.reduce((s, p) => s + (Number(p.amount) || 0), 0))
        : 0;
      const totalAmount = round2(Math.max(Number(group.totalAmount) || 0, 0));
      const totalPaid = round2(Math.max(Number(group.totalPaid) || 0, histSum));
      const fullyPaid =
        (Number.isFinite(remaining) && remaining <= 0.01) ||
        (totalAmount > 0 && totalPaid + 0.01 >= totalAmount);

      if (!fullyPaid) continue;

      const finalCharges = round2(t.finalCharges);
      await Task.findByIdAndUpdate(t._id, {
        amountCollected: finalCharges,
        unpaidAmount: 0,
        isGrouped: true
      });
      stats.tasksUpdated += 1;
      // count group once
    } catch (err) {
      console.error(`Direct task settle failed for ${t._id}:`, err.message);
    }
  }

  // Recount groups repaired from direct pass if we only updated tasks
  if (stats.tasksUpdated > 0 && stats.groupsRepaired === 0 && unpaidByGroup.size > 0) {
    stats.groupsRepaired = Math.min(unpaidByGroup.size, stats.tasksUpdated);
  }

  return stats;
};

/** @deprecated name kept for GET /tasks — returns groupsRepaired count */
const repairFullyPaidGroupTaskUnpaid = async () => {
  const stats = await runFullGroupPaymentRepair();
  return stats.groupsRepaired;
};

// Authenticate SSE via query token (EventSource cannot set Authorization headers)
router.get('/realtime/tasks', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).end();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('_id isActive');
    if (!user || !user.isActive) return res.status(401).end();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Add to clients and remove on close
    taskSseClients.add(res);
    req.on('close', () => {
      taskSseClients.delete(res);
    });

    // Initial comment to open stream
    res.write(': connected\n\n');

    // Heartbeat every 25s
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch {}
    }, 25000);
    req.on('close', () => clearInterval(heartbeat));
  } catch {
    return res.status(401).end();
  }
});

router.use(authenticateToken);

// Clients
router.get('/clients', async (req, res) => {
  const clients = await Client.find({}).sort({ createdAt: -1 });
  res.json({ success: true, data: { clients } });
});

// Services
router.get('/services', serviceController.getServices);
router.post('/services', serviceController.createService);
router.put('/services/:id', serviceController.updateService);
router.delete('/services/:id', serviceController.deleteService);

// Service Groups
router.get('/service-groups', serviceController.getServiceGroups);
router.post('/service-groups', serviceController.createServiceGroup);
router.put('/service-groups/:id', serviceController.updateServiceGroup);
router.delete('/service-groups/:id', serviceController.deleteServiceGroup);

router.post('/clients', async (req, res) => {
  const client = await Client.create(req.body);
  res.status(201).json({ success: true, data: { client } });
});

router.put('/clients/:id', async (req, res) => {
  const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: { client } });
});

router.delete('/clients/:id', async (req, res) => {
  await Client.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Tasks
router.get('/tasks', async (req, res) => {
  try {
    // Fully paid groups must not leave tasks stuck in Unpaid (legacy bug repair)
    const fixed = await repairFullyPaidGroupTaskUnpaid();
    if (fixed > 0) {
      console.log(`🔧 Auto-repaired ${fixed} fully paid group(s) with stuck unpaid tasks`);
    }
  } catch (err) {
    console.error('Group payment repair failed (continuing):', err);
  }
  const tasks = await Task.find({ isDeleted: false }).populate('createdBy', 'username email').populate('updatedBy', 'username email').sort({ sortOrder: -1, createdAt: -1 });
  res.json({ success: true, data: { tasks } });
});

router.post('/tasks', async (req, res) => {
  const payload = { ...req.body };
  // Audit: createdBy and updatedBy
  payload.createdBy = req.user?._id;
  payload.updatedBy = req.user?._id;
  if (payload.status === 'completed' && !payload.completedAt) payload.completedAt = new Date();
  if (payload.status !== 'completed') payload.completedAt = null;
  
  // If initial payment was made, add it to payment history
  if (payload.amountCollected > 0) {
    payload.paymentHistory = [{
      amount: payload.amountCollected,
      paymentMode: payload.paymentMode || 'cash',
      paymentRemarks: payload.paymentRemarks || '',
      paidAt: new Date(),
      isInitialPayment: true
    }];
  }
  
  const task = await Task.create(payload);
  const populated = await Task.findById(task._id).populate('createdBy', 'username email').populate('updatedBy', 'username email');
  // Broadcast create
  broadcastTaskEvent('task_created', { task: populated });
  res.status(201).json({ success: true, data: { task: populated } });
});

router.put('/tasks/:id', async (req, res) => {
  const updates = { ...req.body };
  if (typeof updates.status === 'string') {
    if (updates.status === 'completed') {
      updates.completedAt = updates.completedAt ? new Date(updates.completedAt) : new Date();
    } else {
      updates.completedAt = null;
    }
  }
  // Audit: updatedBy
  updates.updatedBy = req.user?._id;
  const task = await Task.findOneAndUpdate({ _id: req.params.id }, updates, { new: true }).populate('createdBy', 'username email').populate('updatedBy', 'username email');
  // Broadcast update
  broadcastTaskEvent('task_updated', { task });
  res.json({ success: true, data: { task } });
});

router.delete('/tasks/:id', async (req, res) => {
  const updated = await Task.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true, deletedAt: new Date(), updatedBy: req.user?._id }, { new: true });
  // Broadcast delete (soft delete)
  broadcastTaskEvent('task_deleted', { id: req.params.id });
  res.json({ success: true });
});

router.get('/tasks-deleted', async (req, res) => {
  const tasks = await Task.find({ isDeleted: true }).sort({ deletedAt: -1 });
  res.json({ success: true, data: { tasks } });
});

// Restore a soft-deleted task
router.put('/tasks/:id/restore', async (req, res) => {
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id },
    { isDeleted: false, deletedAt: null, updatedBy: req.user?._id },
    { new: true }
  ).populate('createdBy', 'username email').populate('updatedBy', 'username email');
  // Broadcast restore as an update so clients refresh lists
  broadcastTaskEvent('task_restored', { task });
  res.json({ success: true, data: { task } });
});

// Add remaining payment to a task
router.put('/tasks/:id/add-payment', async (req, res) => {
  try {
    const { receivedAmount, paymentMode, paymentRemarks } = req.body;
    
    // Validation
    if (!receivedAmount || receivedAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Received amount must be greater than 0' 
      });
    }

    // Get the current task
    const currentTask = await Task.findById(req.params.id);
    if (!currentTask) {
      return res.status(404).json({ 
        success: false, 
        message: 'Task not found' 
      });
    }

    // Validate received amount doesn't exceed unpaid amount
    if (receivedAmount > currentTask.unpaidAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Received amount cannot be more than unpaid amount (${currentTask.unpaidAmount})` 
      });
    }

    // Calculate new amounts
    const newAmountCollected = currentTask.amountCollected + receivedAmount;
    const newUnpaidAmount = Math.max(currentTask.finalCharges - newAmountCollected, 0);

    // Add new payment to payment history
    const newPayment = {
      amount: receivedAmount,
      paymentMode: paymentMode || 'cash',
      paymentRemarks: paymentRemarks || '',
      paidAt: new Date(),
      isInitialPayment: false
    };

    // Prepare update data
    const updates = {
      amountCollected: newAmountCollected,
      unpaidAmount: newUnpaidAmount,
      updatedBy: req.user?._id,
      $push: { paymentHistory: newPayment }
    };

    // Update the task
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id },
      updates,
      { new: true }
    ).populate('createdBy', 'username email').populate('updatedBy', 'username email');

    // Broadcast update
    broadcastTaskEvent('task_payment_added', { task });
    
    res.json({ 
      success: true, 
      data: { task },
      message: `Payment of ${receivedAmount} added successfully. ${newUnpaidAmount > 0 ? `Remaining unpaid: ${newUnpaidAmount}` : 'Task is now fully paid!'}`
    });
  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Task Groups
router.get('/task-groups', async (req, res) => {
  try {
    const groups = await TaskGroup.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: { groups } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * One-shot repair for ALL fully paid groups with leftover task unpaid (legacy bug).
 * Registered before /:id routes. Idempotent — safe after every deploy.
 */
router.post('/task-groups/repair-fully-paid', async (req, res) => {
  try {
    const stats = await runFullGroupPaymentRepair();
    res.json({
      success: true,
      data: stats,
      message:
        stats.groupsRepaired > 0
          ? `Repaired ${stats.groupsRepaired} fully paid group(s), updated ${stats.tasksUpdated} task(s)`
          : `Checked ${stats.groupsChecked} group(s); nothing to repair`
    });
  } catch (error) {
    console.error('Error repairing fully paid groups:', error);
    res.status(500).json({ success: false, message: error.message || 'Repair failed' });
  }
});

router.get('/task-groups/:id', async (req, res) => {
  try {
    let group = await TaskGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    // If group is fully paid, clear unpaid on every linked task (legacy repair only)
    const settled = await settleFullyPaidGroupTasks(group);
    group = settled.group;

    const tasks = await Task.find({ groupId: req.params.id, isDeleted: false })
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: { group, tasks },
      message: settled.repaired ? 'Fully paid group tasks cleared from unpaid' : undefined
    });
  } catch (error) {
    console.error('Error fetching task group:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/task-groups', async (req, res) => {
  try {
    const { tasks: taskPayloads, groupPayment } = req.body;

    if (!taskPayloads || !Array.isArray(taskPayloads) || taskPayloads.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 tasks required for a group' });
    }

    const firstTask = taskPayloads[0];
    const totalAmount = round2(taskPayloads.reduce((sum, t) => sum + (Number(t.finalCharges) || 0), 0));
    const totalPaid = round2(
      groupPayment
        ? Number(groupPayment.amountCollected) || 0
        : taskPayloads.reduce((sum, t) => sum + (Number(t.amountCollected) || 0), 0)
    );
    const remainingAmount = round2(Math.max(totalAmount - totalPaid, 0));

    const paymentMode = groupPayment
      ? groupPayment.paymentMode || 'cash'
      : firstTask.paymentMode || 'cash';
    const paymentRemarks = groupPayment
      ? groupPayment.paymentRemarks || ''
      : '';

    const groupPaymentHistory = [];
    if (totalPaid > 0) {
      groupPaymentHistory.push({
        amount: totalPaid,
        paymentMode,
        paymentRemarks,
        paidAt: new Date(),
        isInitialPayment: true
      });
    }

    const group = await TaskGroup.create({
      customerName: firstTask.customerName,
      customerType: firstTask.customerType,
      documentDetails: firstTask.documentDetails || '',
      totalAmount,
      totalPaid,
      remainingAmount,
      paymentMode,
      paymentNotes: paymentRemarks,
      paymentHistory: groupPaymentHistory,
      createdBy: req.user?._id,
      updatedBy: req.user?._id
    });

    // Create tasks unpaid first, then fill selected tasks in order (or all tasks in list order)
    const createdTasks = [];
    for (const taskData of taskPayloads) {
      const finalCharges = round2(taskData.finalCharges);
      const payload = {
        ...taskData,
        finalCharges,
        groupId: group._id,
        isGrouped: true,
        createdBy: req.user?._id,
        updatedBy: req.user?._id
      };

      if (groupPayment) {
        // Payment is at group level — start each task unpaid, then allocate below by order
        payload.amountCollected = 0;
        payload.unpaidAmount = finalCharges;
        payload.paymentHistory = [];
        payload.paymentMode = paymentMode;
      } else {
        payload.amountCollected = round2(taskData.amountCollected || 0);
        payload.unpaidAmount = round2(
          taskData.unpaidAmount != null
            ? taskData.unpaidAmount
            : Math.max(finalCharges - payload.amountCollected, 0)
        );
        if (payload.amountCollected > 0) {
          payload.paymentHistory = [{
            amount: payload.amountCollected,
            paymentMode: payload.paymentMode || 'cash',
            paymentRemarks: payload.paymentRemarks || '',
            paidAt: new Date(),
            isInitialPayment: true
          }];
        }
      }

      if (payload.status === 'completed' && !payload.completedAt) payload.completedAt = new Date();
      if (payload.status !== 'completed') payload.completedAt = null;

      const task = await Task.create(payload);
      const populated = await Task.findById(task._id)
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username email');
      createdTasks.push(populated);
      broadcastTaskEvent('task_created', { task: populated });
    }

    // Initial group payment: fill tasks in creation order until amount is used
    let finalTasks = createdTasks;
    if (groupPayment && totalPaid > 0) {
      const plan = planSequentialAllocation(createdTasks, totalPaid);
      await applyAllocationsToTasks(plan.allocations, {
        paymentMode,
        paymentRemarks,
        isInitialPayment: true,
        userId: req.user?._id
      });
      if (remainingAmount <= 0.01) {
        await settleFullyPaidGroupTasks(group);
      }
      finalTasks = await Task.find({ groupId: group._id, isDeleted: false })
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username email');
    }

    const freshGroup = await TaskGroup.findById(group._id);
    res.status(201).json({ success: true, data: { group: freshGroup, tasks: finalTasks } });
  } catch (error) {
    console.error('Error creating task group:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Add group payment and apply only to selected tasks (in order).
 * Body:
 *   receivedAmount, paymentMode, paymentRemarks
 *   taskIds: string[]  — ordered list of task IDs to fill first → next
 *   OR allocations: [{ taskId, amount }] — explicit amounts (optional override)
 */
router.put('/task-groups/:id/add-payment', async (req, res) => {
  try {
    const { receivedAmount, paymentMode, paymentRemarks, taskIds, allocations: clientAllocations } = req.body;
    const amount = round2(receivedAmount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Received amount must be greater than 0' });
    }

    let group = await TaskGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    // Sync group remaining from history if needed (does not reassign partial task paid)
    const pre = await settleFullyPaidGroupTasks(group);
    group = pre.group;

    if (amount > round2(group.remainingAmount) + 0.001) {
      return res.status(400).json({
        success: false,
        message: `Amount cannot exceed remaining balance (${group.remainingAmount})`
      });
    }

    const groupTasks = await Task.find({ groupId: req.params.id, isDeleted: false }).sort({ createdAt: 1 });
    const taskById = new Map(groupTasks.map((t) => [String(t._id), t]));

    let planAllocations = [];
    let leftover = 0;

    if (Array.isArray(clientAllocations) && clientAllocations.length > 0) {
      // Explicit amounts from UI
      let remaining = amount;
      for (const row of clientAllocations) {
        const t = taskById.get(String(row.taskId));
        if (!t) {
          return res.status(400).json({ success: false, message: `Task not in group: ${row.taskId}` });
        }
        const want = round2(row.amount);
        if (want <= 0) continue;
        const unpaid = round2(Math.max(0, Number(t.unpaidAmount) || 0));
        if (unpaid <= 0) {
          return res.status(400).json({
            success: false,
            message: `Task ${t.serialNo || t.taskName} is already fully paid`
          });
        }
        if (want > unpaid + 0.001) {
          return res.status(400).json({
            success: false,
            message: `Amount for ${t.serialNo || t.taskName} exceeds its unpaid (${unpaid})`
          });
        }
        if (want > remaining + 0.001) {
          return res.status(400).json({
            success: false,
            message: 'Task allocations exceed received amount'
          });
        }
        planAllocations.push({
          task: t,
          amount: want,
          fullyPaid: round2(Number(t.amountCollected || 0) + want) >= round2(t.finalCharges) - 0.001
        });
        remaining = round2(remaining - want);
      }
      leftover = remaining;
    } else {
      // Ordered task IDs — fill unpaid sequentially
      const ids = Array.isArray(taskIds) ? taskIds.map(String) : [];
      if (!ids.length) {
        return res.status(400).json({
          success: false,
          message: 'Select at least one task to apply this payment to'
        });
      }

      const ordered = [];
      for (const id of ids) {
        const t = taskById.get(id);
        if (!t) {
          return res.status(400).json({ success: false, message: `Task not in group: ${id}` });
        }
        ordered.push(t);
      }

      const plan = planSequentialAllocation(ordered, amount);
      planAllocations = plan.allocations;
      leftover = plan.leftover;
    }

    if (!planAllocations.length) {
      return res.status(400).json({
        success: false,
        message: 'No unpaid balance on selected tasks. Tick other tasks that still need payment.'
      });
    }

    if (leftover > 0.01) {
      return res.status(400).json({
        success: false,
        message: `₹${leftover} still unallocated. Tick more tasks to apply the remaining amount.`,
        data: {
          leftover,
          preview: planAllocations.map((a) => ({
            taskId: a.task._id,
            serialNo: a.task.serialNo,
            taskName: a.task.taskName,
            amount: a.amount,
            fullyPaid: a.fullyPaid
          }))
        }
      });
    }

    const allocatedSum = round2(planAllocations.reduce((s, a) => s + a.amount, 0));
    // Only credit group with what was applied to tasks (should equal amount after leftover check)
    const appliedAmount = allocatedSum;

    const newTotalPaid = round2((group.totalPaid || 0) + appliedAmount);
    const newRemaining = round2(Math.max((group.totalAmount || 0) - newTotalPaid, 0));

    const newPayment = {
      amount: appliedAmount,
      paymentMode: paymentMode || 'cash',
      paymentRemarks: paymentRemarks || '',
      paidAt: new Date(),
      isInitialPayment: false
    };

    let updatedGroup = await TaskGroup.findByIdAndUpdate(
      req.params.id,
      {
        totalPaid: newTotalPaid,
        remainingAmount: newRemaining,
        updatedBy: req.user?._id,
        $push: { paymentHistory: newPayment }
      },
      { new: true }
    );

    await applyAllocationsToTasks(planAllocations, {
      paymentMode: paymentMode || 'cash',
      paymentRemarks: paymentRemarks || '',
      isInitialPayment: false,
      userId: req.user?._id
    });

    // If group is fully paid, settle any leftover task unpaid
    if (newRemaining <= 0.01) {
      const settled = await settleFullyPaidGroupTasks(updatedGroup);
      updatedGroup = settled.group;
    }

    const finalTasks = await Task.find({ groupId: req.params.id, isDeleted: false })
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .sort({ createdAt: 1 });

    const paidNames = planAllocations
      .filter((a) => a.fullyPaid)
      .map((a) => a.task.taskName || a.task.serialNo)
      .join(', ');

    res.json({
      success: true,
      data: {
        group: updatedGroup,
        tasks: finalTasks,
        applied: planAllocations.map((a) => ({
          taskId: a.task._id,
          serialNo: a.task.serialNo,
          taskName: a.task.taskName,
          amount: a.amount,
          fullyPaid: a.fullyPaid
        }))
      },
      message:
        newRemaining > 0.01
          ? `Applied ₹${appliedAmount} to selected tasks.${paidNames ? ` Fully paid: ${paidNames}.` : ''} Group remaining: ₹${updatedGroup.remainingAmount}`
          : `Group fully paid. Applied ₹${appliedAmount} to selected tasks.`
    });
  } catch (error) {
    console.error('Error adding group payment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Manual settle for one fully paid group
router.post('/task-groups/:id/reconcile', async (req, res) => {
  try {
    const group = await TaskGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const result = await settleFullyPaidGroupTasks(group);
    res.json({
      success: true,
      data: { group: result.group, tasks: result.tasks, tasksUpdated: result.tasksUpdated },
      message: result.repaired ? 'Fully paid tasks settled' : 'No changes needed (group not fully paid or already in sync)'
    });
  } catch (error) {
    console.error('Error reconciling task group:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Fund Transfers
router.get('/fund-transfers', async (req, res) => {
  const entries = await FundTransfer.find({ owner: req.user._id, isDeleted: false }).sort({ createdAt: -1 });
  res.json({ success: true, data: { entries } });
});

router.post('/fund-transfers', async (req, res) => {
  const payload = { ...req.body, owner: req.user._id };
  const entry = await FundTransfer.create(payload);
  res.status(201).json({ success: true, data: { entry } });
});

router.put('/fund-transfers/:id', async (req, res) => {
  const updates = { ...req.body };
  const entry = await FundTransfer.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, updates, { new: true });
  res.json({ success: true, data: { entry } });
});

router.delete('/fund-transfers/:id', async (req, res) => {
  await FundTransfer.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
  res.json({ success: true });
});

// AEPS Entries
router.get('/aeps-entries', async (req, res) => {
  const entries = await AepsEntry.find({ owner: req.user._id, isDeleted: false }).sort({ createdAt: -1 });
  res.json({ success: true, data: { entries } });
});

router.post('/aeps-entries', async (req, res) => {
  const payload = { ...req.body, owner: req.user._id };
  const entry = await AepsEntry.create(payload);
  res.status(201).json({ success: true, data: { entry } });
});

router.put('/aeps-entries/:id', async (req, res) => {
  const updates = { ...req.body };
  const entry = await AepsEntry.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, updates, { new: true });
  res.json({ success: true, data: { entry } });
});

router.delete('/aeps-entries/:id', async (req, res) => {
  await AepsEntry.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
  res.json({ success: true });
});

// Mobile Balances
router.get('/mobile-balances', async (req, res) => {
  const entries = await MobileBalance.find({ owner: req.user._id, isDeleted: false }).sort({ createdAt: -1 });
  res.json({ success: true, data: { entries } });
});

router.post('/mobile-balances', async (req, res) => {
  const payload = { ...req.body, owner: req.user._id };
  const entry = await MobileBalance.create(payload);
  res.status(201).json({ success: true, data: { entry } });
});

router.put('/mobile-balances/:id', async (req, res) => {
  const updates = { ...req.body };
  const entry = await MobileBalance.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, updates, { new: true });
  res.json({ success: true, data: { entry } });
});

router.delete('/mobile-balances/:id', async (req, res) => {
  await MobileBalance.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
  res.json({ success: true });
});

// Bank/Cash/AEPS Entries
router.get('/bank-cash-aeps', async (req, res) => {
  const entries = await BankCashAeps.find({ owner: req.user._id, isDeleted: false }).sort({ createdAt: -1 });
  res.json({ success: true, data: { entries } });
});

router.post('/bank-cash-aeps', async (req, res) => {
  const payload = { ...req.body, owner: req.user._id };
  const entry = await BankCashAeps.create(payload);
  res.status(201).json({ success: true, data: { entry } });
});

router.put('/bank-cash-aeps/:id', async (req, res) => {
  const updates = { ...req.body };
  const entry = await BankCashAeps.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, updates, { new: true });
  res.json({ success: true, data: { entry } });
});

router.delete('/bank-cash-aeps/:id', async (req, res) => {
  await BankCashAeps.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
  res.json({ success: true });
});

// ─── Payment Collect (money to collect from persons) ───
router.get('/payment-collects', async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { owner: req.user._id, isDeleted: false };
    if (status && ['pending', 'partial', 'received'].includes(status)) {
      filter.status = status;
    }
    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { personName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    const entries = await PaymentCollect.find(filter).sort({ createdAt: -1 });

    const summary = {
      totalEntries: entries.length,
      totalAmount: entries.reduce((s, e) => s + (e.totalAmount || 0), 0),
      totalReceived: entries.reduce((s, e) => s + (e.amountReceived || 0), 0),
      totalPending: entries.reduce((s, e) => s + (e.pendingAmount || 0), 0),
      pendingCount: entries.filter((e) => e.status === 'pending').length,
      partialCount: entries.filter((e) => e.status === 'partial').length,
      receivedCount: entries.filter((e) => e.status === 'received').length
    };

    res.json({ success: true, data: { entries, summary } });
  } catch (error) {
    console.error('Error fetching payment collects:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment collects' });
  }
});

router.post('/payment-collects', async (req, res) => {
  try {
    const { personName, phone, totalAmount, description, date, initialReceived, paymentMode, paymentRemarks } = req.body;

    if (!personName || !String(personName).trim()) {
      return res.status(400).json({ success: false, message: 'Person name is required' });
    }
    const total = Number(totalAmount);
    if (!total || total <= 0) {
      return res.status(400).json({ success: false, message: 'Total amount must be greater than 0' });
    }

    const received = Math.min(Math.max(Number(initialReceived) || 0, 0), total);
    const paymentHistory = [];
    if (received > 0) {
      paymentHistory.push({
        amount: received,
        paymentMode: paymentMode || 'cash',
        remarks: paymentRemarks || 'Initial payment',
        collectedAt: new Date()
      });
    }

    const entry = await PaymentCollect.create({
      personName: String(personName).trim(),
      phone: phone ? String(phone).trim() : '',
      totalAmount: total,
      amountReceived: received,
      description: description ? String(description).trim() : '',
      paymentHistory,
      date: date ? new Date(date) : new Date(),
      owner: req.user._id
    });

    res.status(201).json({ success: true, data: { entry }, message: 'Payment collect entry created' });
  } catch (error) {
    console.error('Error creating payment collect:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create entry' });
  }
});

router.put('/payment-collects/:id', async (req, res) => {
  try {
    const entry = await PaymentCollect.findOne({ _id: req.params.id, owner: req.user._id, isDeleted: false });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    const { personName, phone, totalAmount, description, date } = req.body;

    if (personName !== undefined) entry.personName = String(personName).trim();
    if (phone !== undefined) entry.phone = String(phone).trim();
    if (description !== undefined) entry.description = String(description).trim();
    if (date !== undefined) entry.date = new Date(date);
    if (totalAmount !== undefined) {
      const total = Number(totalAmount);
      if (!total || total <= 0) {
        return res.status(400).json({ success: false, message: 'Total amount must be greater than 0' });
      }
      if (total < entry.amountReceived) {
        return res.status(400).json({
          success: false,
          message: `Total amount cannot be less than already received (${entry.amountReceived})`
        });
      }
      entry.totalAmount = total;
    }

    await entry.save();
    res.json({ success: true, data: { entry }, message: 'Entry updated' });
  } catch (error) {
    console.error('Error updating payment collect:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update entry' });
  }
});

router.delete('/payment-collects/:id', async (req, res) => {
  try {
    const entry = await PaymentCollect.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    res.json({ success: true, message: 'Entry deleted' });
  } catch (error) {
    console.error('Error deleting payment collect:', error);
    res.status(500).json({ success: false, message: 'Failed to delete entry' });
  }
});

// Record a payment collection against an entry
router.post('/payment-collects/:id/payments', async (req, res) => {
  try {
    const entry = await PaymentCollect.findOne({ _id: req.params.id, owner: req.user._id, isDeleted: false });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    const amount = Number(req.body.amount);
    const paymentMode = req.body.paymentMode || 'cash';
    const remarks = req.body.remarks || '';
    const collectedAt = req.body.collectedAt ? new Date(req.body.collectedAt) : new Date();

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0' });
    }
    if (amount > entry.pendingAmount + 0.001) {
      return res.status(400).json({
        success: false,
        message: `Amount cannot exceed pending amount (${entry.pendingAmount})`
      });
    }

    entry.paymentHistory.push({ amount, paymentMode, remarks, collectedAt });
    entry.amountReceived = (entry.amountReceived || 0) + amount;
    await entry.save();

    res.json({
      success: true,
      data: { entry },
      message:
        entry.pendingAmount > 0
          ? `Payment of ${amount} recorded. Pending: ${entry.pendingAmount}`
          : `Payment of ${amount} recorded. Fully received!`
    });
  } catch (error) {
    console.error('Error recording payment collect payment:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to record payment' });
  }
});

// Unified Sales Entries - Get all entry types in one response
router.get('/sales-entries', async (req, res) => {
  try {
    const { dateFrom, dateTo, serviceType } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);
    
    const baseFilter = { owner: req.user._id, isDeleted: false };
    if (Object.keys(dateFilter).length > 0) {
      baseFilter.createdAt = dateFilter;
    }
    
    // Fetch all entry types
    const [fundTransfers, aepsEntries, mobileBalances, bankCashAeps, onlineReceivedCashGiven, salesEntries] = await Promise.all([
      FundTransfer.find(baseFilter).sort({ createdAt: -1 }),
      AepsEntry.find(baseFilter).sort({ createdAt: -1 }),
      MobileBalance.find(baseFilter).sort({ createdAt: -1 }),
      BankCashAeps.find(baseFilter).sort({ createdAt: -1 }),
      OnlineReceivedCashGiven.find(baseFilter).sort({ createdAt: -1 }),
      SalesEntry.find(baseFilter).sort({ createdAt: -1 })
    ]);
    
    // Transform to unified format
    const entries = [];
    
    // Fund Transfer entries
    fundTransfers.forEach(entry => {
      if (!serviceType || serviceType === 'ADD FUND TRANSFER ENTRY') {
        entries.push({
          _id: entry._id,
          type: 'ADD FUND TRANSFER ENTRY',
          customerName: entry.customerName,
          customerNumber: entry.customerNumber,
          beneficiaryName: entry.beneficiaryName,
          beneficiaryNumber: entry.beneficiaryNumber,
          applicationName: entry.applicationName,
          transferredFrom: entry.transferredFrom,
          transferredFromRemark: entry.transferredFromRemark,
          amount: entry.amount,
          cashReceived: entry.cashReceived,
          addedInGala: entry.addedInGala,
          addedInGalaRemark: entry.addedInGalaRemark,
          commissionType: entry.commissionType,
          commissionAmount: entry.commissionAmount,
          commissionRemark: entry.commissionRemark,
          timestamp: entry.createdAt,
          createdAt: entry.createdAt
        });
      }
    });
    
    // AEPS entries
    aepsEntries.forEach(entry => {
      if (!serviceType || serviceType === 'AEPS') {
        entries.push({
          _id: entry._id,
          type: 'AEPS',
          aepsIdType: entry.aepsIdType,
          aepsIdName: entry.aepsIdName,
          amount: entry.amount,
          givenToCustomer: entry.givenToCustomer,
          givenToCustomerRemark: entry.givenToCustomerRemark,
          givenToCustomerOther: entry.givenToCustomerOther,
          withdrawnType: entry.withdrawnType,
          paymentApplication: entry.paymentApplication,
          transferredFrom: entry.transferredFrom,
          transferredFromRemark: entry.transferredFromRemark,
          commissionType: entry.commissionType,
          commissionAmount: entry.commissionAmount,
          commissionRemark: entry.commissionRemark,
          date: entry.date,
          timestamp: entry.createdAt,
          createdAt: entry.createdAt
        });
      }
    });
    
    // Mobile Balance entries
    mobileBalances.forEach(entry => {
      if (!serviceType || serviceType === 'MOBILE_BALANCE') {
        entries.push({
          _id: entry._id,
          type: 'MOBILE_BALANCE',
          companyName: entry.companyName,
          operationType: entry.operationType,
          amount: entry.amount,
          reason: entry.reason,
          timestamp: entry.createdAt,
          createdAt: entry.createdAt
        });
      }
    });
    
    // Bank/Cash/AEPS entries
    bankCashAeps.forEach(entry => {
      if (!serviceType || serviceType === 'BANK_CASH_AEPS') {
        entries.push({
          _id: entry._id,
          type: 'BANK_CASH_AEPS',
          companyName: entry.companyName,
          operationType: entry.operationType,
          amount: entry.amount,
          reason: entry.reason,
          timestamp: entry.createdAt,
          createdAt: entry.createdAt
        });
      }
    });

    // Online Received Cash Given entries
    onlineReceivedCashGiven.forEach(entry => {
      if (!serviceType || serviceType === 'ONLINE_RECEIVED_CASH_GIVEN') {
        entries.push({
          _id: entry._id,
          type: 'ONLINE_RECEIVED_CASH_GIVEN',
          // Basic transaction details
          receivedOnlineAmount: entry.receivedOnlineAmount,
          cashGiven: entry.cashGiven,
          receivedOnlineFrom: entry.receivedOnlineFrom,
          accountHolder: entry.accountHolder || entry.receivedOnlineFrom, // Fallback for compatibility
          // Money distribution logic
          moneyDistributionType: entry.moneyDistributionType,
          // Single person scenario fields
          howMoneyGivenSingle: entry.howMoneyGivenSingle,
          howMoneyGivenSingleRemark: entry.howMoneyGivenSingleRemark,
          howMoneyGivenSinglePersonName: entry.howMoneyGivenSinglePersonName,
          // Two persons scenario fields
          firstPartMoneyGiven: entry.firstPartMoneyGiven,
          firstPartMoneyGivenRemark: entry.firstPartMoneyGivenRemark,
          firstPartMoneyGivenPersonName: entry.firstPartMoneyGivenPersonName,
          firstPartAmount: entry.firstPartAmount,
          remainingPartMoneyGiven: entry.remainingPartMoneyGiven,
          remainingPartMoneyGivenRemark: entry.remainingPartMoneyGivenRemark,
          remainingPartMoneyGivenPersonName: entry.remainingPartMoneyGivenPersonName,
          remainingPartAmount: entry.remainingPartAmount,
          // Additional fields
          senderName: entry.senderName,
          senderNumber: entry.senderNumber,
          receivedOnApplication: entry.receivedOnApplication,
          accountHolderRemark: entry.accountHolderRemark,
          commissionType: entry.commissionType,
          commissionAmount: entry.commissionAmount,
          commissionRemark: entry.commissionRemark,
          remarks: entry.remarks,
          timestamp: entry.createdAt,
          createdAt: entry.createdAt
        });
      }
    });

    // Sales entries (Recharge, Bill Payment, SIM Sold, etc.)
    salesEntries.forEach(entry => {
      if (!serviceType || serviceType === entry.entryType) {
        entries.push({
          _id: entry._id,
          type: entry.entryType,
          customerName: entry.customerName,
          customerNumber: entry.customerNumber,
          amount: entry.amount,
          quantity: entry.quantity,
          remarks: entry.remarks,
          timestamp: entry.createdAt,
          createdAt: entry.createdAt
        });
       }
     });
    
    // Sort by creation date (newest first)
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ success: true, data: { entries } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create unified sales entry
router.post('/sales-entries', async (req, res) => {
  try {
    console.log('POST /sales-entries - Request body:', JSON.stringify(req.body, null, 2));
    
    const { entryType, type, data, ...entryData } = req.body;
    // Handle both 'entryType' and 'type' for backward compatibility
    const actualType = entryType || type;
    // Use 'data' field if provided, otherwise use the rest of the body
    const actualData = data || entryData;
    
    console.log('Processed data:', { actualType, actualData });
    
    // Convert string numbers to actual numbers based on entry type
    let processedData = { ...actualData };
    
    if (actualType === 'AEPS') {
      processedData.amount = parseFloat(processedData.amount || '0');
      processedData.commissionAmount = parseFloat(processedData.commissionAmount || '0');
    } else if (actualType === 'ADD FUND TRANSFER ENTRY' || actualType === 'ADD_FUND_TRANSFER_ENTRY') {
      processedData.amount = parseFloat(processedData.amount || '0');
      processedData.commissionAmount = parseFloat(processedData.commissionAmount || '0');
    } else if (actualType === 'MOBILE_BALANCE' || actualType === 'BANK_CASH_AEPS') {
      processedData.amount = parseFloat(processedData.amount || '0');
    } else if (actualType === 'ONLINE_RECEIVED_CASH_GIVEN') {
      processedData.receivedOnlineAmount = parseFloat(processedData.receivedOnlineAmount || '0');
      processedData.cashGiven = parseFloat(processedData.cashGiven || '0');
      processedData.firstPartAmount = parseFloat(processedData.firstPartAmount || '0');
      processedData.remainingPartAmount = parseFloat(processedData.remainingPartAmount || '0');
      processedData.commissionAmount = parseFloat(processedData.commissionAmount || '0');
    }
    
    const payload = { ...processedData, owner: req.user._id };
    
    let entry;
    switch (actualType) {
      case 'ADD FUND TRANSFER ENTRY':
      case 'ADD_FUND_TRANSFER_ENTRY':
        entry = await FundTransfer.create(payload);
        break;
      case 'AEPS':
        entry = await AepsEntry.create(payload);
        break;
      case 'MOBILE_BALANCE':
        entry = await MobileBalance.create(payload);
        break;
      case 'BANK_CASH_AEPS':
        entry = await BankCashAeps.create(payload);
        break;
      case 'ONLINE_RECEIVED_CASH_GIVEN':
        console.log('Creating OnlineReceivedCashGiven with payload:', JSON.stringify(payload, null, 2));
        entry = await OnlineReceivedCashGiven.create(payload);
        console.log('Successfully created OnlineReceivedCashGiven entry:', entry._id);
        break;
      case 'RECHARGE_ENTRY':
      case 'BILL_PAYMENT_ENTRY':
      case 'SIM_SOLD':
      case 'XEROX':
      case 'PRINT':
      case 'PASSPORT_PHOTOS':
      case 'LAMINATIONS':
        payload.entryType = actualType;
        entry = await SalesEntry.create(payload);
        break;
      default:
        return res.status(400).json({ success: false, message: `Invalid entry type: ${actualType}` });
    }
    
    res.status(201).json({ success: true, data: { entry } });
  } catch (error) {
    console.error('Error creating sales entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update unified sales entry
router.put('/sales-entries/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const updates = { ...req.body };
    
    let entry;
    switch (type) {
      case 'ADD_FUND_TRANSFER_ENTRY':
      case 'ADD FUND TRANSFER ENTRY':
        entry = await FundTransfer.findOneAndUpdate({ _id: id, owner: req.user._id }, updates, { new: true });
        break;
      case 'AEPS':
        entry = await AepsEntry.findOneAndUpdate({ _id: id, owner: req.user._id }, updates, { new: true });
        break;
      case 'MOBILE_BALANCE':
        entry = await MobileBalance.findOneAndUpdate({ _id: id, owner: req.user._id }, updates, { new: true });
        break;
      case 'BANK_CASH_AEPS':
        entry = await BankCashAeps.findOneAndUpdate({ _id: id, owner: req.user._id }, updates, { new: true });
        break;
      case 'ONLINE_RECEIVED_CASH_GIVEN':
        entry = await OnlineReceivedCashGiven.findOneAndUpdate({ _id: id, owner: req.user._id }, updates, { new: true });
        break;
      case 'RECHARGE_ENTRY':
      case 'BILL_PAYMENT_ENTRY':
      case 'SIM_SOLD':
      case 'XEROX':
      case 'PRINT':
      case 'PASSPORT_PHOTOS':
      case 'LAMINATIONS':
        entry = await SalesEntry.findOneAndUpdate({ _id: id, owner: req.user._id }, updates, { new: true });
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid entry type' });
    }
    
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    
    res.status(201).json({ success: true, data: { entry } });
  } catch (error) {
    console.error('Error in POST /sales-entries:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete unified sales entry
router.delete('/sales-entries/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    
    let result;
    switch (type) {
      case 'ADD_FUND_TRANSFER_ENTRY':
      case 'ADD FUND TRANSFER ENTRY':
        result = await FundTransfer.findOneAndUpdate({ _id: id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
        break;
      case 'AEPS':
        result = await AepsEntry.findOneAndUpdate({ _id: id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
        break;
      case 'MOBILE_BALANCE':
        result = await MobileBalance.findOneAndUpdate({ _id: id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
        break;
      case 'BANK_CASH_AEPS':
        result = await BankCashAeps.findOneAndUpdate({ _id: id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
        break;
      case 'ONLINE_RECEIVED_CASH_GIVEN':
        result = await OnlineReceivedCashGiven.findOneAndUpdate({ _id: id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
        break;
      case 'RECHARGE_ENTRY':
      case 'BILL_PAYMENT_ENTRY':
      case 'SIM_SOLD':
      case 'XEROX':
      case 'PRINT':
      case 'PASSPORT_PHOTOS':
      case 'LAMINATIONS':
        result = await SalesEntry.findOneAndUpdate({ _id: id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid entry type' });
    }
    
    if (!result) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;


