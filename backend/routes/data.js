import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import Client from '../models/Client.js';
import Task from '../models/Task.js';
import Service from '../models/Service.js';
import FundTransfer from '../models/FundTransfer.js';
import AepsEntry from '../models/AepsEntry.js';
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

export default router;


