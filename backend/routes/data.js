import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import Client from '../models/Client.js';
import Task from '../models/Task.js';
import Service from '../models/Service.js';
import FundTransfer from '../models/FundTransfer.js';
import AepsEntry from '../models/AepsEntry.js';
import MobileBalance from '../models/MobileBalance.js';
import BankCashAeps from '../models/BankCashAeps.js';
import SalesEntry from '../models/SalesEntry.js';
import User from '../models/User.js';

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
router.get('/services', async (req, res) => {
  const services = await Service.find({ owner: req.user._id, isDeleted: false }).sort({ createdAt: -1 });
  res.json({ success: true, data: { services } });
});

router.post('/services', async (req, res) => {
  const payload = { name: req.body?.name?.trim(), amount: Number(req.body?.amount) || 0, owner: req.user._id };
  const service = await Service.create(payload);
  res.status(201).json({ success: true, data: { service } });
});

router.put('/services/:id', async (req, res) => {
  const updates = { ...req.body };
  if (typeof updates.name === 'string') updates.name = updates.name.trim();
  if (typeof updates.amount !== 'undefined') updates.amount = Number(updates.amount) || 0;
  const service = await Service.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, updates, { new: true });
  res.json({ success: true, data: { service } });
});

router.delete('/services/:id', async (req, res) => {
  await Service.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { isDeleted: true, deletedAt: new Date() }, { new: true });
  res.json({ success: true });
});

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
  const tasks = await Task.find({ isDeleted: false }).populate('createdBy', 'username email').populate('updatedBy', 'username email').sort({ createdAt: -1 });
  res.json({ success: true, data: { tasks } });
});

router.post('/tasks', async (req, res) => {
  const payload = { ...req.body };
  // Audit: createdBy and updatedBy
  payload.createdBy = req.user?._id;
  payload.updatedBy = req.user?._id;
  if (payload.status === 'completed' && !payload.completedAt) payload.completedAt = new Date();
  if (payload.status !== 'completed') payload.completedAt = null;
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
    const [fundTransfers, aepsEntries, mobileBalances, bankCashAeps, salesEntries] = await Promise.all([
      FundTransfer.find(baseFilter).sort({ createdAt: -1 }),
      AepsEntry.find(baseFilter).sort({ createdAt: -1 }),
      MobileBalance.find(baseFilter).sort({ createdAt: -1 }),
      BankCashAeps.find(baseFilter).sort({ createdAt: -1 }),
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
          senderName: entry.senderName,
          receiverName: entry.receiverName,
          amount: entry.amount,
          transferType: entry.transferType,
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
          aepsIdName: entry.aepsIdName,
          amount: entry.amount,
          commissionAmount: entry.commissionAmount,
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
    const { entryType, type, data, ...entryData } = req.body;
    // Handle both 'entryType' and 'type' for backward compatibility
    const actualType = entryType || type;
    // Use 'data' field if provided, otherwise use the rest of the body
    const actualData = data || entryData;
    
    // Convert string numbers to actual numbers based on entry type
    let processedData = { ...actualData };
    
    if (actualType === 'AEPS') {
      processedData.amount = parseFloat(processedData.amount || '0');
      processedData.commissionAmount = parseFloat(processedData.commissionAmount || '0');
    } else if (actualType === 'ADD FUND TRANSFER ENTRY') {
      processedData.amount = parseFloat(processedData.amount || '0');
      processedData.commissionAmount = parseFloat(processedData.commissionAmount || '0');
    } else if (actualType === 'MOBILE_BALANCE' || actualType === 'BANK_CASH_AEPS') {
      processedData.amount = parseFloat(processedData.amount || '0');
    }
    
    const payload = { ...processedData, owner: req.user._id };
    
    let entry;
    switch (actualType) {
      case 'ADD FUND TRANSFER ENTRY':
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
    
    res.json({ success: true, data: { entry } });
  } catch (error) {
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


