import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import Task from '../models/Task.js';
import Expense from '../models/Expense.js';
import Sale from '../models/Sale.js';
import Activity from '../models/Activity.js';

const router = express.Router();
router.use(authenticateToken, requireRole(['admin', 'web_developer']));

// Helper to parse date range
const parseRange = (req) => {
  const { start, end } = req.query;
  const s = start ? new Date(start) : new Date(new Date().toDateString());
  const e = end ? new Date(end) : new Date();
  return { s, e };
};

// Task report
router.get('/tasks-summary', async (req, res) => {
  const { s, e } = parseRange(req);
  const matchCreated = { createdAt: { $gte: s, $lte: e } };
  const base = { isDeleted: false };
  const newTasks = await Task.countDocuments({ ...base, ...matchCreated });
  const ongoing = await Task.countDocuments({ ...base, status: 'ongoing', updatedAt: { $lte: e } });
  const unassigned = await Task.countDocuments({ ...base, status: 'unassigned', updatedAt: { $lte: e } });
  const assigned = await Task.countDocuments({ ...base, status: 'assigned', updatedAt: { $lte: e } });
  const completed = await Task.countDocuments({ ...base, completedAt: { $gte: s, $lte: e } });
  res.json({ success: true, data: { newTasks, ongoing, unassigned, assigned, completed } });
});

// Profit & Expenses summary
router.get('/profit-expenses', async (req, res) => {
  const { s, e } = parseRange(req);
  const [taskAgg, expenseAgg, saleAgg] = await Promise.all([
    Task.aggregate([
      { $match: { completedAt: { $gte: s, $lte: e } } },
      { $group: { _id: null, totalFinal: { $sum: { $ifNull: ['$finalCharges', 0] } }, totalCollected: { $sum: { $ifNull: ['$amountCollected', 0] } } } }
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: s, $lte: e } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } }
    ]),
    Sale.aggregate([
      { $match: { date: { $gte: s, $lte: e } } },
      { $group: { _id: '$department', total: { $sum: '$amount' } } }
    ])
  ]);
  const totalExpenses = expenseAgg.reduce((a, c) => a + (c.total || 0), 0);
  const profit = (taskAgg[0]?.totalFinal || 0) - totalExpenses;
  res.json({ success: true, data: { totalProfit: profit, totalExpenses, expensesByCategory: expenseAgg, salesByDepartment: saleAgg } });
});

// Sales ranking
router.get('/sales-ranking', async (req, res) => {
  const { s, e } = parseRange(req);
  const byDept = await Sale.aggregate([
    { $match: { date: { $gte: s, $lte: e } } },
    { $group: { _id: '$department', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } }
  ]);
  res.json({ success: true, data: { byDepartment: byDept } });
});

// Activity heartbeat
router.post('/heartbeat', async (req, res) => {
  await Activity.create({ userId: req.user._id, ts: new Date(), active: true });
  res.json({ success: true });
});

export default router;


