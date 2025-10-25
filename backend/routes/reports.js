import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import Task from '../models/Task.js';
import Expense from '../models/Expense.js';
import Sale from '../models/Sale.js';
import Activity from '../models/Activity.js';
import BankCashAeps from '../models/BankCashAeps.js';
import Client from '../models/Client.js';
import Employee from '../models/Employee.js';
import SalesEntry from '../models/SalesEntry.js';

const router = express.Router();
router.use(authenticateToken, requireRole(['admin', 'web_developer']));

// Helper to parse date range
const parseRange = (req) => {
  const { start, end } = req.query;
  const s = start ? new Date(start) : new Date(new Date().toDateString());
  const e = end ? new Date(end) : new Date();
  e.setHours(23, 59, 59, 999);
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

router.get('/profit-loss', async (req, res) => {
  try {
    const { s, e } = parseRange(req);
    
    const completedTasks = await Task.find({ 
      completedAt: { $gte: s, $lte: e },
      isDeleted: false 
    });
    
    const totalRevenue = completedTasks.reduce((sum, task) => sum + (task.finalCharges || 0), 0);
    
    const expenses = await Expense.find({ date: { $gte: s, $lte: e } });
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
    const netProfit = totalRevenue - totalExpenses;
    
    const revenueByDate = {};
    completedTasks.forEach(task => {
      const date = new Date(task.completedAt).toISOString().split('T')[0];
      revenueByDate[date] = (revenueByDate[date] || 0) + (task.finalCharges || 0);
    });
    
    res.json({ 
      success: true, 
      data: { 
        totalRevenue, 
        totalExpenses, 
        netProfit,
        revenueByDate,
        expenseDetails: expenses.map(e => ({
          title: e.title,
          amount: e.amount,
          category: e.category,
          date: e.date
        }))
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sales-by-service', async (req, res) => {
  try {
    const { s, e } = parseRange(req);
    
    const tasks = await Task.find({ 
      completedAt: { $gte: s, $lte: e },
      isDeleted: false 
    });
    
    const serviceMap = {};
    tasks.forEach(task => {
      const serviceName = task.taskName || 'Unknown';
      if (!serviceMap[serviceName]) {
        serviceMap[serviceName] = {
          serviceName,
          numberOfSales: 0,
          totalRevenue: 0,
          totalProfit: 0
        };
      }
      serviceMap[serviceName].numberOfSales++;
      serviceMap[serviceName].totalRevenue += task.finalCharges || 0;
      serviceMap[serviceName].totalProfit += (task.finalCharges || 0) - (task.serviceCharge || 0);
    });
    
    const salesByService = Object.values(serviceMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    res.json({ success: true, data: salesByService });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sales-by-staff', async (req, res) => {
  try {
    const { s, e } = parseRange(req);
    
    const tasks = await Task.find({ 
      completedAt: { $gte: s, $lte: e },
      isDeleted: false 
    });
    
    const staffMap = {};
    tasks.forEach(task => {
      const staffName = task.assignedTo || 'Unassigned';
      if (!staffMap[staffName]) {
        staffMap[staffName] = {
          staffName,
          tasksCompleted: 0,
          totalRevenue: 0,
          totalProfit: 0
        };
      }
      staffMap[staffName].tasksCompleted++;
      staffMap[staffName].totalRevenue += task.finalCharges || 0;
      staffMap[staffName].totalProfit += (task.finalCharges || 0) - (task.serviceCharge || 0);
    });
    
    const salesByStaff = Object.values(staffMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    res.json({ success: true, data: salesByStaff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/accounts-receivable', async (req, res) => {
  try {
    const unpaidTasks = await Task.find({ 
      unpaidAmount: { $gt: 0 },
      isDeleted: false 
    }).sort({ date: -1 });
    
    const collectFromBalances = await BankCashAeps.aggregate([
      {
        $match: {
          companyName: { $in: ['Collect From Vaibhav', 'Collect From Omkar', 'Collect From Uma'] },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$companyName',
          balance: {
            $sum: {
              $cond: [
                { $eq: ['$operationType', 'add'] },
                '$amount',
                { $multiply: ['$amount', -1] }
              ]
            }
          }
        }
      }
    ]);
    
    const totalUnpaidFromTasks = unpaidTasks.reduce((sum, task) => sum + task.unpaidAmount, 0);
    const totalCollectFrom = collectFromBalances.reduce((sum, item) => sum + item.balance, 0);
    const totalUnpaid = totalUnpaidFromTasks + totalCollectFrom;
    
    res.json({ 
      success: true, 
      data: { 
        unpaidTasks: unpaidTasks.map(t => ({
          customerName: t.customerName,
          taskName: t.taskName,
          unpaidAmount: t.unpaidAmount,
          date: t.date,
          serviceDeliveryDate: t.serviceDeliveryDate
        })),
        collectFromBalances,
        totalUnpaidFromTasks,
        totalCollectFrom,
        totalUnpaid
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/balance-sheet', async (req, res) => {
  try {
    const balances = await BankCashAeps.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$companyName',
          balance: {
            $sum: {
              $cond: [
                { $eq: ['$operationType', 'add'] },
                '$amount',
                { $multiply: ['$amount', -1] }
              ]
            }
          }
        }
      }
    ]);
    
    const formattedBalances = balances.map(b => ({
      account: b._id,
      balance: b.balance
    }));
    
    res.json({ success: true, data: formattedBalances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/balance-transactions/:accountName', async (req, res) => {
  try {
    const { accountName } = req.params;
    const transactions = await BankCashAeps.find({
      companyName: accountName,
      isDeleted: false
    }).sort({ date: -1 }).limit(100);
    
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/staff-performance', async (req, res) => {
  try {
    const { s, e } = parseRange(req);
    const { staffName } = req.query;
    
    let filter = { isDeleted: false };
    if (staffName) {
      filter.assignedTo = staffName;
    }
    
    const allTasks = await Task.find(filter);
    const tasksInRange = allTasks.filter(t => {
      const taskDate = new Date(t.createdAt);
      return taskDate >= s && taskDate <= e;
    });
    
    const staffMap = {};
    tasksInRange.forEach(task => {
      const staff = task.assignedTo || 'Unassigned';
      if (!staffMap[staff]) {
        staffMap[staff] = {
          staffName: staff,
          tasksAssigned: 0,
          tasksCompleted: 0,
          tasksPending: 0,
          averageCompletionTime: 0,
          totalCompletionTime: 0,
          completedCount: 0
        };
      }
      staffMap[staff].tasksAssigned++;
      
      if (task.status === 'completed' && task.completedAt) {
        staffMap[staff].tasksCompleted++;
        const createdDate = new Date(task.createdAt);
        const completedDate = new Date(task.completedAt);
        const timeDiff = (completedDate - createdDate) / (1000 * 60 * 60 * 24);
        staffMap[staff].totalCompletionTime += timeDiff;
        staffMap[staff].completedCount++;
      } else if (['ongoing', 'assigned', 'unassigned', 'pending'].includes(task.status)) {
        staffMap[staff].tasksPending++;
      }
    });
    
    Object.values(staffMap).forEach(staff => {
      if (staff.completedCount > 0) {
        staff.averageCompletionTime = staff.totalCompletionTime / staff.completedCount;
      }
    });
    
    const performanceData = Object.values(staffMap);
    
    res.json({ success: true, data: performanceData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/task-status', async (req, res) => {
  try {
    const statusCounts = await Task.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const formattedCounts = statusCounts.map(s => ({
      status: s._id || 'unassigned',
      count: s.count
    }));
    
    res.json({ success: true, data: formattedCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/client-activity', async (req, res) => {
  try {
    const { s, e } = parseRange(req);
    
    const tasks = await Task.find({
      createdAt: { $gte: s, $lte: e },
      isDeleted: false
    });
    
    const newClients = tasks.filter(t => t.customerType === 'new');
    const oldClients = tasks.filter(t => t.customerType === 'old');
    
    const newClientRevenue = newClients.reduce((sum, t) => sum + (t.finalCharges || 0), 0);
    const oldClientRevenue = oldClients.reduce((sum, t) => sum + (t.finalCharges || 0), 0);
    
    const uniqueNewClients = new Set(newClients.map(t => t.customerName)).size;
    const uniqueOldClients = new Set(oldClients.map(t => t.customerName)).size;
    
    res.json({
      success: true,
      data: {
        newClients: {
          count: uniqueNewClients,
          servicesAvailed: newClients.length,
          totalRevenue: newClientRevenue
        },
        oldClients: {
          count: uniqueOldClients,
          servicesAvailed: oldClients.length,
          totalRevenue: oldClientRevenue
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/client-ledger', async (req, res) => {
  try {
    const { search } = req.query;
    
    if (!search) {
      return res.json({ success: true, data: null, message: 'Please provide a search term' });
    }
    
    const tasks = await Task.find({
      customerName: { $regex: search, $options: 'i' },
      isDeleted: false
    }).sort({ date: -1 });
    
    const totalPayments = tasks.reduce((sum, t) => sum + (t.amountCollected || 0), 0);
    const totalUnpaid = tasks.reduce((sum, t) => sum + (t.unpaidAmount || 0), 0);
    const totalCharges = tasks.reduce((sum, t) => sum + (t.finalCharges || 0), 0);
    
    res.json({
      success: true,
      data: {
        customerName: search,
        tasks: tasks.map(t => ({
          taskName: t.taskName,
          date: t.date,
          serviceDeliveryDate: t.serviceDeliveryDate,
          finalCharges: t.finalCharges,
          amountCollected: t.amountCollected,
          unpaidAmount: t.unpaidAmount,
          status: t.status,
          paymentHistory: t.paymentHistory
        })),
        summary: {
          totalTasks: tasks.length,
          totalCharges,
          totalPayments,
          totalUnpaid
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;


