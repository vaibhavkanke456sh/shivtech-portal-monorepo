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
      // Keep in-memory task in sync for subsequent discount/cash steps
      t.amountCollected = newCollected;
      t.unpaidAmount = newUnpaid;
      t.finalCharges = finalCharges;
      updatedTasks.push(updated);
      broadcastTaskEvent('task_updated', { task: updated });
    }
  }
  return updatedTasks;
};

/**
 * Apply discount to one task (reduces finalCharges; does NOT increase amountCollected).
 */
const applyDiscountToSingleTask = async (t, discountAmt, meta = {}) => {
  const { paymentRemarks = '', userId = null } = meta;
  const d = round2(discountAmt);
  if (d <= 0) return null;

  const unpaid = round2(
    Math.max(
      0,
      t.unpaidAmount != null
        ? Number(t.unpaidAmount)
        : Number(t.finalCharges || 0) - Number(t.amountCollected || 0)
    )
  );
  const apply = round2(Math.min(unpaid, d));
  if (apply <= 0) return null;

  const newFinal = round2(Math.max(Number(t.finalCharges || 0) - apply, 0));
  const collected = round2(Number(t.amountCollected || 0));
  const newUnpaid = round2(Math.max(newFinal - collected, 0));
  const newDiscountTotal = round2(Number(t.discountAmount || 0) + apply);
  const taskLabel = t.taskName || t.serialNo || '';

  const updated = await Task.findByIdAndUpdate(
    t._id,
    {
      finalCharges: newFinal,
      unpaidAmount: newUnpaid,
      discountAmount: newDiscountTotal,
      updatedBy: userId || t.updatedBy,
      $push: {
        paymentHistory: {
          amount: apply,
          paymentMode: 'discount',
          paymentRemarks: paymentRemarks
            ? `Discount${taskLabel ? ` on ${taskLabel}` : ''}: ${paymentRemarks}`
            : taskLabel
              ? `Customer discount on: ${taskLabel}`
              : 'Customer discount on remaining payment',
          paidAt: new Date(),
          isInitialPayment: false
        }
      }
    },
    { new: true }
  )
    .populate('createdBy', 'username email')
    .populate('updatedBy', 'username email');

  t.finalCharges = newFinal;
  t.unpaidAmount = newUnpaid;
  t.discountAmount = newDiscountTotal;
  t.amountCollected = collected;

  if (updated) broadcastTaskEvent('task_updated', { task: updated });
  return { task: t, amount: apply, fullyPaid: newUnpaid <= 0.001, updated };
};

/**
 * Apply discount sequentially to selected tasks (same fill order as cash).
 * Reduces finalCharges and unpaid; does NOT increase amountCollected / bank balances.
 * Returns { allocations, leftover, appliedTotal }
 */
const planAndApplyDiscountToTasks = async (tasksInOrder, discountAmount, meta = {}) => {
  let remaining = round2(discountAmount);
  const allocations = [];
  const updatedTasks = [];

  for (const t of tasksInOrder) {
    if (remaining <= 0.001) break;
    const row = await applyDiscountToSingleTask(t, remaining, meta);
    if (!row) continue;
    allocations.push({ task: row.task, amount: row.amount, fullyPaid: row.fullyPaid });
    remaining = round2(remaining - row.amount);
    if (row.updated) updatedTasks.push(row.updated);
  }

  return {
    allocations,
    leftover: remaining,
    appliedTotal: round2(discountAmount - remaining),
    updatedTasks
  };
};

/**
 * Apply exact per-task discount amounts: [{ task, amount }].
 * Returns { allocations, leftover, appliedTotal }
 */
const applyExplicitDiscountAllocations = async (pairs, meta = {}) => {
  const allocations = [];
  const updatedTasks = [];
  let requested = 0;
  let applied = 0;

  for (const { task, amount } of pairs) {
    const want = round2(amount);
    if (want <= 0 || !task) continue;
    requested = round2(requested + want);
    const row = await applyDiscountToSingleTask(task, want, meta);
    if (!row) continue;
    applied = round2(applied + row.amount);
    allocations.push({ task: row.task, amount: row.amount, fullyPaid: row.fullyPaid });
    if (row.updated) updatedTasks.push(row.updated);
  }

  return {
    allocations,
    leftover: round2(Math.max(0, requested - applied)),
    appliedTotal: applied,
    updatedTasks
  };
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
 * Cash-only sum of payment history.
 * CRITICAL: discount entries must NOT count as paid cash — discount already
 * reduced finalCharges. Counting them again falsely marks group fully paid
 * (e.g. ₹500 cash + ₹50 discount → histSum 550 treated as money received).
 */
const sumCashHistory = (history = []) => {
  if (!Array.isArray(history) || !history.length) return 0;
  return round2(
    history.reduce((s, p) => {
      if ((p.paymentMode || '') === 'discount') return s;
      return s + (Number(p.amount) || 0);
    }, 0)
  );
};

const sumDiscountHistory = (history = []) => {
  if (!Array.isArray(history) || !history.length) return 0;
  return round2(
    history.reduce((s, p) => {
      if ((p.paymentMode || '') !== 'discount') return s;
      return s + (Number(p.amount) || 0);
    }, 0)
  );
};

/**
 * Only when the group is fully paid *by task cash*: mark every linked task fully paid.
 * Does NOT redistribute partial payments (user chooses which tasks get money).
 *
 * Source of truth = linked tasks ONLY (never group.paymentHistory):
 *   totalAmount     = sum(finalCharges)     // after discounts
 *   totalPaid       = sum(amountCollected)  // cash only
 *   discountAmount  = sum(task.discountAmount)
 *   remaining       = totalAmount - totalPaid
 *
 * Stale group.paymentHistory must NOT re-mark a group fully paid after the user
 * deletes task payment/discount rows (that was the ₹500+₹50 / delete bug).
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

  // Task-level truth only
  const totalAmountFromTasks = round2(tasks.reduce((s, t) => s + (Number(t.finalCharges) || 0), 0));
  const totalPaidFromTasks = round2(tasks.reduce((s, t) => s + (Number(t.amountCollected) || 0), 0));
  const discountFromTasks = round2(tasks.reduce((s, t) => s + (Number(t.discountAmount) || 0), 0));
  const sumTaskUnpaid = round2(
    tasks.reduce((s, t) => s + Math.max(0, Number(t.unpaidAmount) || 0), 0)
  );
  const anyTaskUnpaid = sumTaskUnpaid > 0.01;

  let totalAmount =
    totalAmountFromTasks > 0 ? totalAmountFromTasks : round2(Number(group.totalAmount) || 0);
  let totalPaid = totalPaidFromTasks;
  let remainingAmount = round2(Math.max(totalAmount - totalPaid, 0));
  const discountAmount = discountFromTasks;

  // Fully paid only when tasks' cash covers tasks' final charges
  const treatAsFullyPaid =
    force ||
    remainingAmount <= 0.01 ||
    (totalAmount > 0 && totalPaid + 0.01 >= totalAmount);

  // Always keep group summary fields aligned with tasks (including discount reset to 0)
  const needsSync =
    Math.abs((group.totalAmount || 0) - totalAmount) > 0.01 ||
    Math.abs((group.totalPaid || 0) - totalPaid) > 0.01 ||
    Math.abs((group.remainingAmount || 0) - remainingAmount) > 0.01 ||
    Math.abs((group.discountAmount || 0) - discountAmount) > 0.01;

  if (!treatAsFullyPaid) {
    if (needsSync) {
      group = await TaskGroup.findByIdAndUpdate(
        group._id,
        {
          totalAmount,
          totalPaid,
          remainingAmount,
          discountAmount,
          updatedBy: options.userId || undefined
        },
        { new: true }
      );
    }

    return {
      group,
      tasks,
      repaired: needsSync,
      tasksUpdated: 0,
      reason: 'not-fully-paid',
      debug: {
        totalAmount,
        totalPaid,
        discountAmount,
        remainingAmount,
        anyTaskUnpaid,
        sumTaskUnpaid,
        taskCount: tasks.length
      }
    };
  }

  // Normalize group to fully paid from task truth
  remainingAmount = 0;
  totalPaid = totalAmount;

  if (
    Math.abs((group.totalAmount || 0) - totalAmount) > 0.01 ||
    Math.abs((group.totalPaid || 0) - totalPaid) > 0.01 ||
    Math.abs((group.remainingAmount || 0) - remainingAmount) > 0.01 ||
    Math.abs((group.discountAmount || 0) - discountAmount) > 0.01
  ) {
    group = await TaskGroup.findByIdAndUpdate(
      group._id,
      {
        totalAmount,
        totalPaid,
        remainingAmount,
        discountAmount
      },
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
    debug: { totalAmount, totalPaid, discountAmount, taskCount: tasks.length, sumTaskUnpaid }
  };
};

/**
 * Legacy fix: money recorded on the group (totalPaid / paymentHistory) but never
 * applied to individual tasks (equal-split bug / missing taskIds).
 * Applies the orphan amount sequentially to unpaid tasks (oldest first).
 * If group is fully paid, settles every task completely.
 */
const syncOrphanedGroupPaymentsToTasks = async (group) => {
  const tasks = await findTasksForGroup(group._id);
  if (!tasks.length) {
    return { repaired: false, tasksUpdated: 0, orphan: 0, reason: 'no-tasks' };
  }

  // Cash only — discount must not inflate "paid" / orphan math
  const histSum = sumCashHistory(group.paymentHistory);
  const totalPaid = round2(Math.max(Number(group.totalPaid) || 0, histSum));
  const totalAmountFromTasks = round2(tasks.reduce((s, t) => s + (Number(t.finalCharges) || 0), 0));
  const totalAmount = round2(
    totalAmountFromTasks > 0
      ? totalAmountFromTasks
      : Math.max(Number(group.totalAmount) || 0, 0)
  );
  const sumCollected = round2(tasks.reduce((s, t) => s + (Number(t.amountCollected) || 0), 0));
  const orphan = round2(Math.max(totalPaid - sumCollected, 0));
  const storedRemaining = Number(group.remainingAmount);
  const fullyPaid =
    (totalAmount > 0 && sumCollected + 0.01 >= totalAmount) ||
    (totalAmount > 0 && totalPaid + 0.01 >= totalAmount && orphan <= 0.01) ||
    (Number.isFinite(storedRemaining) &&
      storedRemaining <= 0.01 &&
      totalAmount > 0 &&
      sumCollected + 0.01 >= totalAmount);

  // Fully paid group → every task paid in full
  if (fullyPaid) {
    const settled = await settleFullyPaidGroupTasks(group, { force: true });
    return {
      repaired: settled.repaired,
      tasksUpdated: settled.tasksUpdated || 0,
      orphan,
      reason: settled.repaired ? 'settled-full' : 'already-clean'
    };
  }

  // Partial group payment never applied to tasks
  if (orphan <= 0.01) {
    return { repaired: false, tasksUpdated: 0, orphan: 0, reason: 'no-orphan' };
  }

  // Refresh task unpaid for allocation
  const fresh = await findTasksForGroup(group._id);
  const unpaidOrdered = fresh
    .filter((t) => round2(t.unpaidAmount) > 0.01)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  if (!unpaidOrdered.length) {
    return { repaired: false, tasksUpdated: 0, orphan, reason: 'no-unpaid-tasks' };
  }

  const plan = planSequentialAllocation(unpaidOrdered, orphan);
  if (!plan.allocations.length) {
    return { repaired: false, tasksUpdated: 0, orphan, reason: 'alloc-empty' };
  }

  const updated = await applyAllocationsToTasks(plan.allocations, {
    paymentMode: group.paymentMode || 'cash',
    paymentRemarks: 'Legacy sync: group payment applied to tasks',
    isInitialPayment: false,
    userId: null
  });

  return {
    repaired: updated.length > 0,
    tasksUpdated: updated.length,
    orphan,
    applied: round2(plan.allocations.reduce((s, a) => s + a.amount, 0)),
    leftover: plan.leftover,
    reason: 'orphan-synced'
  };
};

/**
 * Scan groups + unpaid grouped tasks and settle fully paid ones.
 * Also syncs orphaned group-level payments onto tasks (legacy bug).
 */
export const runFullGroupPaymentRepair = async () => {
  const stats = {
    groupsChecked: 0,
    groupsRepaired: 0,
    tasksUpdated: 0,
    unpaidGroupedTasksFound: 0,
    groupsWithUnpaidTasks: 0,
    orphansSynced: 0,
    orphanAmountApplied: 0,
    skippedNotFullyPaid: 0,
    skippedNoTasks: 0,
    skippedAlreadyClean: 0,
    sampleSkipped: [],
    sampleOrphans: []
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
      // 1) Fully paid groups → zero all task unpaid
      const unpaidCount = unpaidByGroup.get(String(group._id)) || 0;
      const force =
        unpaidCount > 0 &&
        Number.isFinite(Number(group.remainingAmount)) &&
        Number(group.remainingAmount) <= 0.01;

      const result = await settleFullyPaidGroupTasks(group, { force });
      if (result.repaired) {
        stats.groupsRepaired += 1;
        stats.tasksUpdated += result.tasksUpdated || 0;
        continue;
      }

      // 2) Partial payments sitting on group only → push onto tasks (legacy)
      const orphanResult = await syncOrphanedGroupPaymentsToTasks(group);
      if (orphanResult.repaired) {
        stats.groupsRepaired += 1;
        stats.tasksUpdated += orphanResult.tasksUpdated || 0;
        stats.orphansSynced += 1;
        stats.orphanAmountApplied = round2(
          stats.orphanAmountApplied + (orphanResult.applied || orphanResult.orphan || 0)
        );
        if (stats.sampleOrphans.length < 5) {
          stats.sampleOrphans.push({
            groupId: String(group._id).slice(-8),
            orphan: orphanResult.orphan,
            applied: orphanResult.applied,
            reason: orphanResult.reason
          });
        }
        continue;
      }

      if (result.reason === 'not-fully-paid') {
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

  // Last pass: any remaining unpaid tasks on fully paid groups
  const stillUnpaid = await Task.find({
    isDeleted: { $ne: true },
    unpaidAmount: { $gt: 0.01 },
    groupId: { $ne: null, $exists: true }
  });

  for (const t of stillUnpaid) {
    try {
      const group = await TaskGroup.findById(t.groupId);
      if (!group) continue;
      // Recompute from all linked tasks — never treat discount history as cash
      const linked = await findTasksForGroup(group._id);
      const totalAmount = round2(linked.reduce((s, x) => s + (Number(x.finalCharges) || 0), 0));
      const totalPaid = round2(linked.reduce((s, x) => s + (Number(x.amountCollected) || 0), 0));
      const remaining = round2(Math.max(totalAmount - totalPaid, 0));
      const fullyPaid = totalAmount > 0 && remaining <= 0.01;

      if (!fullyPaid) continue;

      const finalCharges = round2(t.finalCharges);
      await Task.findByIdAndUpdate(t._id, {
        amountCollected: finalCharges,
        unpaidAmount: 0,
        isGrouped: true
      });
      stats.tasksUpdated += 1;
    } catch (err) {
      console.error(`Direct task settle failed for ${t._id}:`, err.message);
    }
  }

  // Refresh unpaid count after repairs
  stats.unpaidGroupedTasksFound = await Task.countDocuments({
    isDeleted: { $ne: true },
    unpaidAmount: { $gt: 0.01 },
    $or: [{ isGrouped: true }, { groupId: { $ne: null, $exists: true } }]
  });

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

/** Sum cash vs discount in payment history */
const sumHistoryParts = (history = []) => {
  let cash = 0;
  let discount = 0;
  for (const h of history) {
    const a = round2(h.amount);
    if ((h.paymentMode || '') === 'discount') discount = round2(discount + a);
    else cash = round2(cash + a);
  }
  return { cash, discount };
};

/**
 * Original bill before discounts currently recorded in history:
 * finalCharges has already been reduced by those discounts.
 */
const originalFinalFromTask = (task) => {
  const { discount } = sumHistoryParts(task.paymentHistory || []);
  return round2(Number(task.finalCharges || 0) + discount);
};

/**
 * After history mutation, recompute amountCollected / finalCharges / unpaid / discountAmount.
 * originalFinal = bill before any discounts in the (new) history set.
 *
 * options.autoTrimCash: when increasing discount leaves cash > new final charges,
 * reduce newest cash history rows so cash fits (and return cashTrimmed for bank reverse).
 */
const applyHistoryRecompute = (task, originalFinal, options = {}) => {
  const { autoTrimCash = false } = options;
  let { cash, discount } = sumHistoryParts(task.paymentHistory || []);
  let finalCharges = round2(Math.max(originalFinal - discount, 0));
  const cashTrimmed = []; // [{ amount, paymentMode }] excess cash removed

  if (cash > finalCharges + 0.001) {
    if (!autoTrimCash) {
      const maxDiscountWithCurrentCash = round2(Math.max(originalFinal - cash, 0));
      return {
        error:
          `Cash collected (₹${cash}) would exceed final charges after discount (₹${finalCharges}). ` +
          `With this cash, max discount is ₹${maxDiscountWithCurrentCash}. ` +
          `Reduce a cash entry first, or lower the discount.`
      };
    }

    // Trim cash from newest non-discount entries until cash <= finalCharges
    let excess = round2(cash - finalCharges);
    const hist = Array.isArray(task.paymentHistory) ? [...task.paymentHistory] : [];
    // Walk from end (newest) to start
    for (let i = hist.length - 1; i >= 0 && excess > 0.001; i--) {
      const h = hist[i];
      if ((h.paymentMode || '') === 'discount') continue;
      const amt = round2(h.amount);
      if (amt <= 0) continue;
      const cut = round2(Math.min(amt, excess));
      if (cut <= 0) continue;
      const mode = h.paymentMode || 'cash';
      cashTrimmed.push({ amount: cut, paymentMode: mode });
      const left = round2(amt - cut);
      if (left <= 0.001) {
        hist.splice(i, 1);
      } else {
        h.amount = left;
      }
      excess = round2(excess - cut);
    }

    task.paymentHistory = hist;
    task.markModified('paymentHistory');
    ({ cash, discount } = sumHistoryParts(hist));
    finalCharges = round2(Math.max(originalFinal - discount, 0));

    if (cash > finalCharges + 0.001) {
      return {
        error: `Could not fit cash (₹${cash}) under final charges (₹${finalCharges}) after discount`
      };
    }
  }

  task.finalCharges = finalCharges;
  task.amountCollected = cash;
  task.discountAmount = discount;
  task.unpaidAmount = round2(Math.max(finalCharges - cash, 0));
  return { cash, discount, finalCharges, cashTrimmed };
};

/**
 * Align one task's amountCollected / finalCharges / unpaid / discountAmount
 * with its own paymentHistory (cash vs discount).
 * Fixes force-settled tasks that still show Paid after history was deleted.
 */
const recomputeTaskFromItsHistory = async (taskDoc, userId = null) => {
  if (!taskDoc?._id) return taskDoc;
  const history = Array.isArray(taskDoc.paymentHistory) ? taskDoc.paymentHistory : [];
  const { cash, discount } = sumHistoryParts(history);
  // Bill before discounts currently on this task
  const originalFinal = round2(Number(taskDoc.finalCharges || 0) + discount);
  // If force-settled above history (collected > cash), trust history cash only
  const finalCharges = round2(Math.max(originalFinal - discount, 0));
  const amountCollected = cash;
  const unpaidAmount = round2(Math.max(finalCharges - amountCollected, 0));
  const discountAmount = discount;

  const drifted =
    Math.abs(round2(taskDoc.finalCharges) - finalCharges) > 0.01 ||
    Math.abs(round2(taskDoc.amountCollected) - amountCollected) > 0.01 ||
    Math.abs(round2(taskDoc.unpaidAmount) - unpaidAmount) > 0.01 ||
    Math.abs(round2(taskDoc.discountAmount || 0) - discountAmount) > 0.01;

  if (!drifted) return taskDoc;

  const updated = await Task.findByIdAndUpdate(
    taskDoc._id,
    {
      finalCharges,
      amountCollected,
      unpaidAmount,
      discountAmount,
      updatedBy: userId || undefined
    },
    { new: true }
  );
  if (updated) broadcastTaskEvent('task_updated', { task: updated });
  return updated || taskDoc;
};

/**
 * Recompute group totals + rebuild group.paymentHistory from linked tasks.
 * Tasks are source of truth after edit/delete/add of cash or discount rows.
 *
 * remainingAmount = sum(task.unpaidAmount)  [= totalAmount - totalPaid when fields consistent]
 * discountAmount  = sum(task.discountAmount)  (can go back to 0)
 */
const syncGroupTotalsFromTasks = async (groupId, userId = null) => {
  if (!groupId) return { group: null, tasks: [] };
  const group = await TaskGroup.findById(groupId);
  if (!group) return { group: null, tasks: [] };
  let groupTasks = await findTasksForGroup(group._id);

  // Align each task to its own payment history first
  const realigned = [];
  for (const t of groupTasks) {
    realigned.push(await recomputeTaskFromItsHistory(t, userId));
  }
  groupTasks = realigned;

  // Refresh from DB so we have latest paymentHistory + fields
  groupTasks = await findTasksForGroup(group._id);

  const totalAmount = round2(groupTasks.reduce((s, t) => s + (Number(t.finalCharges) || 0), 0));
  const totalPaid = round2(groupTasks.reduce((s, t) => s + (Number(t.amountCollected) || 0), 0));
  // Prefer sum of per-task unpaid (source of remaining balance UI)
  const remainingFromUnpaid = round2(
    groupTasks.reduce((s, t) => s + Math.max(0, Number(t.unpaidAmount) || 0), 0)
  );
  const remainingFromTotals = round2(Math.max(totalAmount - totalPaid, 0));
  // If fields drifted, force unpaid to match totals on each task below; store consistent remaining
  let remainingAmount = remainingFromUnpaid;
  if (Math.abs(remainingFromUnpaid - remainingFromTotals) > 0.02) {
    // Heal per-task unpaid from final - collected
    for (const t of groupTasks) {
      const fc = round2(t.finalCharges);
      const ac = round2(t.amountCollected);
      const up = round2(Math.max(fc - ac, 0));
      if (Math.abs(round2(t.unpaidAmount) - up) > 0.01) {
        await Task.findByIdAndUpdate(t._id, { unpaidAmount: up });
        t.unpaidAmount = up;
      }
    }
    remainingAmount = round2(
      groupTasks.reduce((s, t) => s + Math.max(0, Number(t.unpaidAmount) || 0), 0)
    );
  }

  const discountAmount = round2(
    groupTasks.reduce((s, t) => s + (Number(t.discountAmount) || 0), 0)
  );

  // Rebuild group history from task histories (stays in sync after edit/delete)
  const paymentHistory = [];
  for (const t of groupTasks) {
    const label = t.serialNo || t.taskName || '';
    for (const h of t.paymentHistory || []) {
      const mode = h.paymentMode || 'cash';
      let remarks = h.paymentRemarks || '';
      if (!remarks && label) {
        remarks = mode === 'discount' ? `Discount on ${label}` : `Payment on ${label}`;
      }
      paymentHistory.push({
        amount: round2(h.amount),
        paymentMode: mode,
        paymentRemarks: remarks,
        paidAt: h.paidAt || new Date(),
        isInitialPayment: !!h.isInitialPayment
      });
    }
  }
  paymentHistory.sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt));

  let updated = await TaskGroup.findByIdAndUpdate(
    group._id,
    {
      totalAmount,
      totalPaid,
      remainingAmount,
      discountAmount,
      paymentHistory,
      updatedBy: userId || undefined
    },
    { new: true }
  );

  // Only force leftover unpaid→paid when every task is fully cash-paid
  if (remainingAmount <= 0.01 && totalAmount > 0 && totalPaid + 0.01 >= totalAmount) {
    const settled = await settleFullyPaidGroupTasks(updated);
    updated = settled.group;
    groupTasks = settled.tasks?.length ? settled.tasks : await findTasksForGroup(group._id);
  } else {
    groupTasks = await findTasksForGroup(group._id);
  }

  const populatedTasks = await Task.find({ _id: { $in: groupTasks.map((t) => t._id) } })
    .populate('createdBy', 'username email')
    .populate('updatedBy', 'username email')
    .sort({ createdAt: 1 });

  return { group: updated, tasks: populatedTasks };
};

const findPaymentHistoryEntry = (task, entryId) => {
  const history = task.paymentHistory || [];
  const entry = history.id(entryId);
  if (entry) return entry;
  // Fallback: match by string id
  return history.find((h) => String(h._id) === String(entryId)) || null;
};

// Edit a cash or discount entry in task payment history
router.put('/tasks/:id/payment-history/:entryId', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const entry = findPaymentHistoryEntry(task, req.params.entryId);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Payment entry not found' });
    }

    const originalFinal = originalFinalFromTask(task);
    const oldAmount = round2(entry.amount);
    const oldMode = entry.paymentMode || 'cash';
    const isDiscount = oldMode === 'discount';

    const newAmount = round2(
      req.body.amount != null ? req.body.amount : oldAmount
    );
    if (newAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    let newMode = oldMode;
    if (!isDiscount && req.body.paymentMode) {
      const allowed = ['cash', 'shop-qr', 'personal-qr', 'other'];
      if (!allowed.includes(req.body.paymentMode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment mode (cannot change discount to cash here)'
        });
      }
      newMode = req.body.paymentMode;
    }
    // Discount entries stay discount; cash cannot become discount via edit
    if (isDiscount) newMode = 'discount';

    entry.amount = newAmount;
    entry.paymentMode = newMode;
    if (req.body.paymentRemarks != null) {
      entry.paymentRemarks = String(req.body.paymentRemarks);
    }
    task.markModified('paymentHistory');

    // Increasing discount may require auto-reducing cash so cash ≤ new final charges
    const recomputed = applyHistoryRecompute(task, originalFinal, {
      autoTrimCash: isDiscount
    });
    if (recomputed.error) {
      return res.status(400).json({ success: false, message: recomputed.error });
    }

    task.updatedBy = req.user?._id;
    await task.save();

    let populated = await Task.findById(task._id)
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email');

    let groupDoc = null;
    let groupTasks = null;
    if (populated.groupId) {
      try {
        const synced = await syncGroupTotalsFromTasks(populated.groupId, req.user?._id);
        groupDoc = synced.group;
        groupTasks = synced.tasks;
        // Prefer refreshed version of this task from group list
        if (groupTasks?.length) {
          const refreshed = groupTasks.find((t) => String(t._id) === String(populated._id));
          if (refreshed) populated = refreshed;
        }
      } catch (e) {
        console.error('Group sync after payment edit:', e);
      }
    }

    broadcastTaskEvent('task_payment_edited', { task: populated });

    // Bank balance: reverse any auto-trimmed cash; for cash edits use remove old + add new
    let balanceAdjust = null;
    if (isDiscount) {
      const trimmed = recomputed.cashTrimmed || [];
      if (trimmed.length) {
        const byMode = {};
        for (const row of trimmed) {
          const m = row.paymentMode || 'cash';
          byMode[m] = round2((byMode[m] || 0) + row.amount);
        }
        balanceAdjust = {
          removeMany: Object.entries(byMode).map(([paymentMode, amount]) => ({
            paymentMode,
            amount
          }))
        };
      }
    } else {
      balanceAdjust = {
        remove: { amount: oldAmount, paymentMode: oldMode },
        add: { amount: newAmount, paymentMode: newMode }
      };
    }

    const trimTotal = round2(
      (recomputed.cashTrimmed || []).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    );
    let message = isDiscount
      ? `Discount entry updated to ₹${newAmount}`
      : `Payment entry updated to ₹${newAmount}`;
    if (trimTotal > 0.001) {
      message += `. Cash reduced by ₹${trimTotal} so it fits final charges after discount (₹${recomputed.finalCharges})`;
    }
    if (groupDoc) {
      message += `. Group remaining: ₹${round2(groupDoc.remainingAmount)}`;
    }

    res.json({
      success: true,
      data: {
        task: populated,
        ...(groupDoc ? { group: groupDoc } : {}),
        ...(groupTasks ? { groupTasks } : {}),
        balanceAdjust,
        cashTrimmed: recomputed.cashTrimmed || []
      },
      message
    });
  } catch (error) {
    console.error('Error editing payment history:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Remove a cash or discount entry from task payment history
router.delete('/tasks/:id/payment-history/:entryId', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const entry = findPaymentHistoryEntry(task, req.params.entryId);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Payment entry not found' });
    }

    const originalFinal = originalFinalFromTask(task);
    const oldAmount = round2(entry.amount);
    const oldMode = entry.paymentMode || 'cash';
    const isDiscount = oldMode === 'discount';
    const entryIdStr = String(req.params.entryId);

    // Remove from array first so recompute does not count this entry
    task.paymentHistory = (task.paymentHistory || []).filter(
      (h) => String(h._id) !== entryIdStr
    );
    task.markModified('paymentHistory');

    const recomputed = applyHistoryRecompute(task, originalFinal);
    if (recomputed.error) {
      return res.status(400).json({ success: false, message: recomputed.error });
    }

    task.updatedBy = req.user?._id;
    await task.save();

    let populated = await Task.findById(task._id)
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email');

    let groupDoc = null;
    let groupTasks = null;
    if (populated.groupId) {
      try {
        const synced = await syncGroupTotalsFromTasks(populated.groupId, req.user?._id);
        groupDoc = synced.group;
        groupTasks = synced.tasks;
        if (groupTasks?.length) {
          const refreshed = groupTasks.find((t) => String(t._id) === String(populated._id));
          if (refreshed) populated = refreshed;
        }
      } catch (e) {
        console.error('Group sync after payment delete:', e);
      }
    }

    broadcastTaskEvent('task_payment_removed', { task: populated });

    res.json({
      success: true,
      data: {
        task: populated,
        ...(groupDoc ? { group: groupDoc } : {}),
        ...(groupTasks ? { groupTasks } : {}),
        balanceAdjust: isDiscount
          ? null
          : { remove: { amount: oldAmount, paymentMode: oldMode } }
      },
      message: isDiscount
        ? `Discount of ₹${oldAmount} removed`
        : `Payment of ₹${oldAmount} removed`
    });
  } catch (error) {
    console.error('Error deleting payment history:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Add remaining payment to a task (optional discount when customer asks)
// Logic: discount reduces finalCharges; cash received increases amountCollected.
// unpaid after = finalCharges - discount - (amountCollected + received)
// Cash only credits balances; discount does not.
router.put('/tasks/:id/add-payment', async (req, res) => {
  try {
    const receivedAmount = round2(req.body.receivedAmount);
    const discountAmount = round2(req.body.discountAmount || 0);
    const { paymentMode, paymentRemarks } = req.body;

    if ((!receivedAmount || receivedAmount <= 0) && (!discountAmount || discountAmount <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a received amount and/or a discount greater than 0'
      });
    }

    if (discountAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount cannot be negative'
      });
    }

    const currentTask = await Task.findById(req.params.id);
    if (!currentTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const unpaid = round2(
      currentTask.unpaidAmount != null
        ? Number(currentTask.unpaidAmount)
        : Math.max(Number(currentTask.finalCharges || 0) - Number(currentTask.amountCollected || 0), 0)
    );

    if (unpaid <= 0.001) {
      return res.status(400).json({
        success: false,
        message: 'Task is already fully paid'
      });
    }

    if (discountAmount > unpaid + 0.001) {
      return res.status(400).json({
        success: false,
        message: `Discount cannot exceed unpaid amount (${unpaid})`
      });
    }

    const maxReceivable = round2(Math.max(unpaid - discountAmount, 0));
    if (receivedAmount > maxReceivable + 0.001) {
      return res.status(400).json({
        success: false,
        message:
          discountAmount > 0
            ? `After ₹${discountAmount} discount, max receivable is ₹${maxReceivable}`
            : `Received amount cannot be more than unpaid amount (${unpaid})`
      });
    }

    const newFinalCharges = round2(Math.max(Number(currentTask.finalCharges || 0) - discountAmount, 0));
    const newAmountCollected = round2(Number(currentTask.amountCollected || 0) + receivedAmount);
    const newUnpaidAmount = round2(Math.max(newFinalCharges - newAmountCollected, 0));
    const newDiscountTotal = round2(Number(currentTask.discountAmount || 0) + discountAmount);

    // Must not collect more than the discounted final charges
    if (newAmountCollected > newFinalCharges + 0.001) {
      return res.status(400).json({
        success: false,
        message: 'Payment would exceed final charges after discount'
      });
    }

    const historyEntries = [];
    if (discountAmount > 0.001) {
      historyEntries.push({
        amount: discountAmount,
        paymentMode: 'discount',
        paymentRemarks: paymentRemarks
          ? `Discount: ${paymentRemarks}`
          : 'Customer discount on remaining payment',
        paidAt: new Date(),
        isInitialPayment: false
      });
    }
    if (receivedAmount > 0.001) {
      historyEntries.push({
        amount: receivedAmount,
        paymentMode: paymentMode || 'cash',
        paymentRemarks: paymentRemarks || '',
        paidAt: new Date(),
        isInitialPayment: false
      });
    }

    const updates = {
      finalCharges: newFinalCharges,
      amountCollected: newAmountCollected,
      unpaidAmount: newUnpaidAmount,
      discountAmount: newDiscountTotal,
      updatedBy: req.user?._id
    };
    if (historyEntries.length === 1) {
      updates.$push = { paymentHistory: historyEntries[0] };
    } else if (historyEntries.length > 1) {
      updates.$push = { paymentHistory: { $each: historyEntries } };
    }

    let task = await Task.findOneAndUpdate({ _id: req.params.id }, updates, { new: true })
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email');

    // Rebuild group remaining/total/discount/history from all tasks (single source of truth)
    let groupDoc = null;
    let groupTasks = null;
    if (task?.groupId) {
      try {
        const synced = await syncGroupTotalsFromTasks(task.groupId, req.user?._id);
        groupDoc = synced.group;
        groupTasks = synced.tasks;
        if (groupTasks?.length) {
          const refreshed = groupTasks.find((t) => String(t._id) === String(task._id));
          if (refreshed) task = refreshed;
        }
      } catch (syncErr) {
        console.error('Group sync after single-task payment:', syncErr);
      }
    }

    broadcastTaskEvent('task_payment_added', { task });

    const parts = [];
    if (receivedAmount > 0) parts.push(`Payment of ₹${receivedAmount}`);
    if (discountAmount > 0) parts.push(`discount of ₹${discountAmount}`);
    const actionText = parts.join(' + ');
    const groupRem =
      groupDoc != null ? ` Group remaining: ₹${round2(groupDoc.remainingAmount)}.` : '';
    res.json({
      success: true,
      data: {
        task,
        ...(groupDoc ? { group: groupDoc } : {}),
        ...(groupTasks ? { groupTasks } : {})
      },
      message: `${actionText} applied successfully. ${
        (task.unpaidAmount || 0) > 0.01
          ? `Task unpaid: ₹${round2(task.unpaidAmount)}.`
          : 'Task is now fully paid!'
      }${groupRem}`
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

    // Rebuild group from tasks' payment history (source of truth).
    // Always recompute remaining = sum(unpaid) so discount edits update remaining.
    const synced = await syncGroupTotalsFromTasks(group._id, req.user?._id);
    group = synced.group || group;
    const populated = synced.tasks || [];

    res.json({
      success: true,
      data: { group, tasks: populated },
      message: 'Group payment totals re-synced from tasks'
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
 * Optional discount when customer asks on remaining collection.
 * Body:
 *   receivedAmount, discountAmount?, paymentMode, paymentRemarks
 *   taskIds: string[]  — ordered list for cash fill
 *   discountTaskIds?: string[]  — ordered list for sequential discount fill
 *   discountAllocations?: [{ taskId, amount }] — exact per-task discount (preferred UI)
 *   OR allocations: [{ taskId, amount }] — explicit cash amounts (optional override)
 *
 * Discount is applied first (reduces finalCharges / group totalAmount), then cash.
 * Only cash increases totalPaid / bank balances.
 */
router.put('/task-groups/:id/add-payment', async (req, res) => {
  try {
    const {
      paymentMode,
      paymentRemarks,
      taskIds,
      discountTaskIds,
      discountAllocations: clientDiscountAllocations,
      allocations: clientAllocations
    } = req.body;
    const amount = round2(req.body.receivedAmount);
    // Prefer sum of explicit per-task discounts when provided
    let discountAmount = round2(req.body.discountAmount || 0);
    if (Array.isArray(clientDiscountAllocations) && clientDiscountAllocations.length > 0) {
      const sumDisc = round2(
        clientDiscountAllocations.reduce((s, r) => s + (Number(r.amount) || 0), 0)
      );
      if (sumDisc > 0) discountAmount = sumDisc;
    }

    if ((!amount || amount <= 0) && (!discountAmount || discountAmount <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a received amount and/or a discount greater than 0'
      });
    }

    if (discountAmount < 0) {
      return res.status(400).json({ success: false, message: 'Discount cannot be negative' });
    }

    let group = await TaskGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    // Sync group remaining from history if needed (does not reassign partial task paid)
    const pre = await settleFullyPaidGroupTasks(group);
    group = pre.group;

    const groupRemaining = round2(group.remainingAmount);
    const settlementTotal = round2(amount + discountAmount);

    if (settlementTotal > groupRemaining + 0.001) {
      return res.status(400).json({
        success: false,
        message: `Cash + discount (₹${settlementTotal}) cannot exceed remaining balance (₹${groupRemaining})`
      });
    }

    if (discountAmount > groupRemaining + 0.001) {
      return res.status(400).json({
        success: false,
        message: `Discount cannot exceed remaining balance (₹${groupRemaining})`
      });
    }

    const maxCash = round2(Math.max(groupRemaining - discountAmount, 0));
    if (amount > maxCash + 0.001) {
      return res.status(400).json({
        success: false,
        message:
          discountAmount > 0
            ? `After ₹${discountAmount} discount, max receivable is ₹${maxCash}`
            : `Amount cannot exceed remaining balance (${groupRemaining})`
      });
    }

    const groupTasks = await findTasksForGroup(req.params.id);
    const taskById = new Map(groupTasks.map((t) => [String(t._id), t]));

    const resolveOrdered = (idList) => {
      const ordered = [];
      for (const id of idList) {
        const t = taskById.get(String(id));
        if (!t) {
          return { error: `Task not in group: ${id}` };
        }
        ordered.push(t);
      }
      return { ordered };
    };

    // Cash targets (taskIds or allocations)
    const cashIds = Array.isArray(taskIds) ? taskIds.map(String) : [];
    let cashOrdered = [];
    if (cashIds.length) {
      const r = resolveOrdered(cashIds);
      if (r.error) return res.status(400).json({ success: false, message: r.error });
      cashOrdered = r.ordered;
    } else if (Array.isArray(clientAllocations) && clientAllocations.length > 0) {
      for (const row of clientAllocations) {
        const t = taskById.get(String(row.taskId));
        if (!t) {
          return res.status(400).json({ success: false, message: `Task not in group: ${row.taskId}` });
        }
        if (!cashOrdered.find((x) => String(x._id) === String(t._id))) cashOrdered.push(t);
      }
    }

    // Explicit per-task discounts from Linked Tasks table: [{ taskId, amount }]
    const explicitDiscountPairs = [];
    if (Array.isArray(clientDiscountAllocations) && clientDiscountAllocations.length > 0) {
      for (const row of clientDiscountAllocations) {
        const want = round2(row.amount);
        if (want <= 0) continue;
        const t = taskById.get(String(row.taskId));
        if (!t) {
          return res.status(400).json({
            success: false,
            message: `Discount task not in group: ${row.taskId}`
          });
        }
        explicitDiscountPairs.push({ task: t, amount: want });
      }
    }

    // Sequential discount targets (legacy / fallback)
    const explicitDiscountIds = Array.isArray(discountTaskIds)
      ? discountTaskIds.map(String)
      : [];
    let discountOrdered = [];
    if (discountAmount > 0.001 && !explicitDiscountPairs.length) {
      const dIds = explicitDiscountIds.length
        ? explicitDiscountIds
        : cashIds.length
          ? cashIds
          : cashOrdered.map((t) => String(t._id));
      if (!dIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Enter discount ₹ on the task row(s) customer asked discount for'
        });
      }
      const r = resolveOrdered(dIds);
      if (r.error) return res.status(400).json({ success: false, message: r.error });
      discountOrdered = r.ordered;
    }

    if (amount > 0.001 && !cashOrdered.length) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one task to apply cash/QR payment to'
      });
    }

    if (amount <= 0 && discountAmount <= 0.001) {
      return res.status(400).json({
        success: false,
        message: 'Enter a received amount and/or a discount greater than 0'
      });
    }

    // Dry-run working state for all involved tasks (cash ∪ discount)
    const simById = new Map();
    const ensureSim = (t) => {
      const id = String(t._id);
      let row = simById.get(id);
      if (!row) {
        row = {
          task: t,
          unpaid: round2(
            Math.max(
              0,
              t.unpaidAmount != null
                ? Number(t.unpaidAmount)
                : Number(t.finalCharges || 0) - Number(t.amountCollected || 0)
            )
          ),
          finalCharges: round2(t.finalCharges),
          amountCollected: round2(t.amountCollected || 0)
        };
        simById.set(id, row);
      }
      return row;
    };
    for (const p of explicitDiscountPairs) ensureSim(p.task);
    for (const t of discountOrdered) ensureSim(t);
    for (const t of cashOrdered) ensureSim(t);

    // Preview discount fill
    let remDisc = 0;
    const discountPlanPreview = [];
    if (discountAmount > 0.001) {
      if (explicitDiscountPairs.length) {
        for (const { task, amount: want } of explicitDiscountPairs) {
          const row = ensureSim(task);
          if (want > row.unpaid + 0.001) {
            return res.status(400).json({
              success: false,
              message: `Discount for ${task.serialNo || task.taskName} (₹${want}) exceeds unpaid (₹${row.unpaid})`
            });
          }
          if (row.unpaid <= 0) {
            return res.status(400).json({
              success: false,
              message: `Task ${task.serialNo || task.taskName} has no unpaid for discount`
            });
          }
          const d = round2(Math.min(row.unpaid, want));
          if (d <= 0) continue;
          row.finalCharges = round2(Math.max(row.finalCharges - d, 0));
          row.unpaid = round2(Math.max(row.finalCharges - row.amountCollected, 0));
          discountPlanPreview.push({ task: row.task, amount: d, fullyPaid: row.unpaid <= 0.001 });
        }
      } else {
        remDisc = discountAmount;
        for (const t of discountOrdered) {
          if (remDisc <= 0.001) break;
          const row = ensureSim(t);
          if (row.unpaid <= 0) continue;
          const d = round2(Math.min(row.unpaid, remDisc));
          if (d <= 0) continue;
          row.finalCharges = round2(Math.max(row.finalCharges - d, 0));
          row.unpaid = round2(Math.max(row.finalCharges - row.amountCollected, 0));
          discountPlanPreview.push({ task: row.task, amount: d, fullyPaid: row.unpaid <= 0.001 });
          remDisc = round2(remDisc - d);
        }
        if (remDisc > 0.01) {
          return res.status(400).json({
            success: false,
            message: `₹${remDisc} discount still unallocated. Enter discount on more task rows.`,
            data: { leftover: remDisc }
          });
        }
      }
      if (!discountPlanPreview.length) {
        return res.status(400).json({
          success: false,
          message: 'No unpaid balance for discount. Enter discount ₹ on unpaid task rows.'
        });
      }
    }

    // Preview cash fill on post-discount unpaid — only on cashOrdered
    let planAllocations = [];
    let leftover = 0;
    if (amount > 0.001) {
      if (Array.isArray(clientAllocations) && clientAllocations.length > 0) {
        let remaining = amount;
        for (const row of clientAllocations) {
          const taskDoc = taskById.get(String(row.taskId));
          if (!taskDoc) {
            return res.status(400).json({ success: false, message: `Task not in group: ${row.taskId}` });
          }
          const s = ensureSim(taskDoc);
          const want = round2(row.amount);
          if (want <= 0) continue;
          if (s.unpaid <= 0) {
            return res.status(400).json({
              success: false,
              message: `Task ${s.task.serialNo || s.task.taskName} is already fully paid after discount`
            });
          }
          if (want > s.unpaid + 0.001) {
            return res.status(400).json({
              success: false,
              message: `Amount for ${s.task.serialNo || s.task.taskName} exceeds its unpaid after discount (${s.unpaid})`
            });
          }
          if (want > remaining + 0.001) {
            return res.status(400).json({
              success: false,
              message: 'Task allocations exceed received amount'
            });
          }
          planAllocations.push({
            task: s.task,
            amount: want,
            fullyPaid: round2(s.amountCollected + want) >= s.finalCharges - 0.001
          });
          s.amountCollected = round2(s.amountCollected + want);
          s.unpaid = round2(Math.max(s.finalCharges - s.amountCollected, 0));
          remaining = round2(remaining - want);
        }
        leftover = remaining;
      } else {
        let remCash = amount;
        for (const t of cashOrdered) {
          if (remCash <= 0.001) break;
          const row = ensureSim(t);
          if (row.unpaid <= 0) continue;
          const add = round2(Math.min(row.unpaid, remCash));
          if (add <= 0) continue;
          const newCollected = round2(row.amountCollected + add);
          planAllocations.push({
            task: row.task,
            amount: add,
            fullyPaid: newCollected >= row.finalCharges - 0.001
          });
          row.amountCollected = newCollected;
          row.unpaid = round2(Math.max(row.finalCharges - newCollected, 0));
          remCash = round2(remCash - add);
        }
        leftover = remCash;
      }

      if (!planAllocations.length) {
        return res.status(400).json({
          success: false,
          message: 'No unpaid balance on selected cash tasks. Tick other unpaid tasks.'
        });
      }

      if (leftover > 0.01) {
        return res.status(400).json({
          success: false,
          message: `₹${leftover} still unallocated. Tick more cash tasks to apply the remaining amount.`,
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
    }

    // All validated — apply discount then cash for real
    let discountAllocations = [];
    let discountApplied = 0;
    if (discountAmount > 0.001) {
      const meta = {
        paymentRemarks: paymentRemarks || '',
        userId: req.user?._id
      };
      if (explicitDiscountPairs.length) {
        const dPlan = await applyExplicitDiscountAllocations(explicitDiscountPairs, meta);
        discountAllocations = dPlan.allocations;
        discountApplied = dPlan.appliedTotal;
      } else {
        const discountNames = discountOrdered
          .map((t) => t.taskName || t.serialNo)
          .filter(Boolean)
          .join(', ');
        const dPlan = await planAndApplyDiscountToTasks(discountOrdered, discountAmount, {
          paymentRemarks: paymentRemarks
            ? `${paymentRemarks}${discountNames ? ` [on: ${discountNames}]` : ''}`
            : discountNames
              ? `Customer discount on: ${discountNames}`
              : '',
          userId: req.user?._id
        });
        discountAllocations = dPlan.allocations;
        discountApplied = dPlan.appliedTotal;
      }
    }

    if (amount > 0.001 && planAllocations.length) {
      // Refresh task unpaid/final from DB after discount before applying cash
      const cashTaskIds = planAllocations.map((a) => a.task._id);
      const refreshed = await Task.find({ _id: { $in: cashTaskIds } });
      const refreshedById = new Map(refreshed.map((t) => [String(t._id), t]));
      planAllocations = planAllocations.map((a) => {
        const t = refreshedById.get(String(a.task._id)) || a.task;
        return { ...a, task: t };
      });

      await applyAllocationsToTasks(planAllocations, {
        paymentMode: paymentMode || 'cash',
        paymentRemarks: paymentRemarks || '',
        isInitialPayment: false,
        userId: req.user?._id
      });
    }

    const appliedCash = round2(planAllocations.reduce((s, a) => s + a.amount, 0));

    // Rebuild group totals + history + remaining from all tasks (single source of truth)
    const synced = await syncGroupTotalsFromTasks(req.params.id, req.user?._id);
    const updatedGroup = synced.group;
    const populatedTasks = synced.tasks || [];
    const newRemaining = round2(updatedGroup?.remainingAmount || 0);

    const fullyPaidFromCash = planAllocations
      .filter((a) => a.fullyPaid)
      .map((a) => a.task.taskName || a.task.serialNo);
    const fullyPaidFromDiscount = discountAllocations
      .filter((a) => a.fullyPaid)
      .map((a) => a.task.taskName || a.task.serialNo);
    const paidNames = [...new Set([...fullyPaidFromCash, ...fullyPaidFromDiscount])].join(', ');

    const parts = [];
    if (appliedCash > 0) parts.push(`₹${appliedCash} cash`);
    if (discountApplied > 0) parts.push(`₹${discountApplied} discount`);
    const actionText = parts.join(' + ');

    res.json({
      success: true,
      data: {
        group: updatedGroup,
        tasks: populatedTasks,
        applied: planAllocations.map((a) => ({
          taskId: a.task._id,
          serialNo: a.task.serialNo,
          taskName: a.task.taskName,
          amount: a.amount,
          fullyPaid: a.fullyPaid,
          type: 'cash'
        })),
        discountApplied: discountAllocations.map((a) => ({
          taskId: a.task._id,
          serialNo: a.task.serialNo,
          taskName: a.task.taskName,
          amount: a.amount,
          fullyPaid: a.fullyPaid,
          type: 'discount'
        }))
      },
      message:
        newRemaining > 0.01
          ? `Applied ${actionText} to selected tasks.${paidNames ? ` Fully paid: ${paidNames}.` : ''} Group remaining: ₹${updatedGroup.remainingAmount}`
          : `Group fully paid. Applied ${actionText} to selected tasks.`
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


