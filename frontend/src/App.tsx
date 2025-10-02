

import ClientList from './components/Client/ClientList';
import Sales from './components/Sales/Sales';
import type { DashboardEntry } from './components/Sales/Sales';

import { useEffect, useState, useRef } from 'react';
import Sidebar from './components/Layout/Sidebar';
import AdminPanel from './components/Admin/AdminPanel';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import ReportsDashboard from './components/Reports/ReportsDashboard';
import EnhancedTaskModal from './components/Modals/EnhancedTaskModal';
// import ClientModal from './components/Modals/ClientModal';
import TaskOverview from './components/Tasks/TaskOverview';
import TaskList from './components/Tasks/TaskList';
import EnhancedTaskList from './components/Tasks/EnhancedTaskList';
import DeletedTaskList from './components/Tasks/DeletedTaskList';
import Placeholder from './components/Placeholder';
import Tools from './components/Tools/Tools';
import { dashboardData, mockTasks, mockClients } from './data/mockData';
import { Task, Client } from './types';
import { apiFetch } from './utils/api';

function App() {
  // Handler to update Vaibhav, Omkar, Uma balances for Fund Transfer, and add commission to Cash/SHOP QR
  const handleFundTransferBalanceUpdate = (
    account: 'vaibhav' | 'omkar' | 'uma' | 'shopaccounts' | 'cash',
    amount: number,
    commissionType?: 'cash' | 'online',
    commissionAmount?: number
  ) => {
    setBankBalances(prev => {
      const updated = { ...prev };
      if (account === 'shopaccounts') {
        updated.bank -= amount;
      } else if (account === 'cash') {
        updated.cash += Math.abs(amount);
      } else {
        updated[account] -= amount;
      }
      // Add commission to Cash or SHOP QR
      if (commissionType && commissionAmount && commissionAmount > 0) {
        if (commissionType === 'cash') {
          updated.cash += commissionAmount;
        } else if (commissionType === 'online') {
          updated.shopqr += commissionAmount;
        }
      }
      return updated;
    });
  };

  // Handler to update Mobile Balances
  const handleMobileBalanceUpdate = (
    companyName: string,
    operationType: 'add' | 'remove',
    amount: number
  ) => {
    setMobileBalances(prev => {
      const updated = { ...prev };
      const adjustedAmount = operationType === 'add' ? amount : -amount;
      
      switch (companyName.toLowerCase()) {
        case 'airtel':
          updated.airtel += adjustedAmount;
          break;
        case 'jio':
          updated.jio += adjustedAmount;
          break;
        case 'bsnl':
          updated.bsnl += adjustedAmount;
          break;
        case 'vodafone':
          updated.vodafone += adjustedAmount;
          break;
      }
      return updated;
    });
  };

  // Handler to update Bank/Cash/AEPS Balances
  const handleBankCashAepsUpdate = (
    companyName: string,
    operationType: 'add' | 'remove',
    amount: number
  ) => {
    setBankBalances(prev => {
      const updated = { ...prev };
      const adjustedAmount = operationType === 'add' ? amount : -amount;
      
      switch (companyName.toLowerCase()) {
        case 'bank':
          updated.bank += adjustedAmount;
          break;
        case 'cash':
          updated.cash += adjustedAmount;
          break;
        case 'redmil':
          updated.redmil += adjustedAmount;
          break;
        case 'spicemoney':
          updated.spicemoney += adjustedAmount;
          break;
        case 'airtel payment bank':
          updated.airtelpmt += adjustedAmount;
          break;
        case 'collect from vaibhav':
          updated.vaibhav += adjustedAmount;
          break;
        case 'collect from omkar':
          updated.omkar += adjustedAmount;
          break;
        case 'collect from uma':
          updated.uma += adjustedAmount;
          break;
        case 'shop qr':
          updated.shopqr += adjustedAmount;
          break;
      }
      return updated;
    });
  };

  // Function to calculate balances from sales entries
  const calculateBalancesFromEntries = (entries: any[]) => {
    console.log('🔄 calculateBalancesFromEntries called with', entries.length, 'entries');
    console.log('📋 Entries details:', entries);
    
    const newMobileBalances = {
      paytm: 0,
      phonepe: 0,
      googlePay: 0,
      airtel: 0,
      jio: 0,
      bsnl: 0,
      vodafone: 0
    };

    const newBankBalances = {
      sbi: 0,
      hdfc: 0,
      icici: 0,
      bank: 0,
      cash: 0,
      redmil: 0,
      spicemoney: 0,
      airtelpmt: 0,
      vaibhav: 0,
      omkar: 0,
      uma: 0,
      shopqr: 0
    };

    entries.forEach((entry: any) => {
      console.log(`🔍 Processing entry:`, entry.type || entry.entryType, entry);
      const amount = parseFloat(entry.amount || '0');
      const isAdd = entry.operationType === 'add';
      const adjustedAmount = isAdd ? amount : -amount;

      if (entry.type === 'MOBILE_BALANCE' || entry.entryType === 'MOBILE_BALANCE') {
        const company = (entry.companyName || '').toLowerCase();
        switch (company) {
          case 'airtel':
            newMobileBalances.airtel += adjustedAmount;
            break;
          case 'jio':
            newMobileBalances.jio += adjustedAmount;
            break;
          case 'bsnl':
            newMobileBalances.bsnl += adjustedAmount;
            break;
          case 'vodafone':
            newMobileBalances.vodafone += adjustedAmount;
            break;
        }
      } else if (entry.type === 'BANK_CASH_AEPS' || entry.entryType === 'BANK_CASH_AEPS') {
        const company = (entry.companyName || '').toLowerCase();
        switch (company) {
          case 'bank':
            newBankBalances.bank += adjustedAmount;
            break;
          case 'cash':
            newBankBalances.cash += adjustedAmount;
            break;
          case 'redmil':
            newBankBalances.redmil += adjustedAmount;
            break;
          case 'spicemoney':
            newBankBalances.spicemoney += adjustedAmount;
            break;
          case 'airtel payment bank':
            newBankBalances.airtelpmt += adjustedAmount;
            break;
          case 'collect from vaibhav':
            newBankBalances.vaibhav += adjustedAmount;
            break;
          case 'collect from omkar':
            newBankBalances.omkar += adjustedAmount;
            break;
          case 'collect from uma':
            newBankBalances.uma += adjustedAmount;
            break;
          case 'shop qr':
            newBankBalances.shopqr += adjustedAmount;
            break;
        }
      } else if (entry.type === 'ADD_FUND_TRANSFER_ENTRY' || entry.entryType === 'ADD_FUND_TRANSFER_ENTRY' || entry.type === 'ADD FUND TRANSFER ENTRY' || entry.entryType === 'ADD FUND TRANSFER ENTRY') {
        console.log('🎯 Processing fund transfer entry:', entry);
        console.log('Found fund transfer entry with transferredFrom:', entry.transferredFrom, 'amount:', entry.amount);
        // Handle fund transfer entries - deduct from the source account
        const transferredFrom = entry.transferredFrom || '';
        const commissionAmount = parseFloat(entry.commissionAmount || '0');
        const commissionType = entry.commissionType || '';
        
        // Deduct transfer amount from source account
        switch (transferredFrom) {
          case 'Vaibhav':
            newBankBalances.vaibhav -= amount;
            break;
          case 'Omkar':
            newBankBalances.omkar -= amount;
            break;
          case 'Uma':
            newBankBalances.uma -= amount;
            break;
          case 'Shop Accounts':
            newBankBalances.bank -= amount;
            break;
        }
        
        // Add commission to appropriate account
        if (commissionAmount > 0) {
          if (commissionType.toLowerCase() === 'cash') {
            newBankBalances.cash += commissionAmount;
          } else if (commissionType.toLowerCase() === 'online') {
            newBankBalances.shopqr += commissionAmount;
          }
        }
        
        // If cash was received and added to Gala, add to cash
        if (entry.cashReceived === 'Yes' && entry.addedInGala === 'Yes') {
          newBankBalances.cash += amount;
        }
      }
    });

    console.log('Final calculated bank balances:', newBankBalances);
    console.log('Final calculated mobile balances:', newMobileBalances);
    console.log('🏦 Setting bank balances from calculateBalancesFromEntries');
    setMobileBalances(newMobileBalances);
    setBankBalances(newBankBalances);
  };

  // Persisted dashboard entries for Sales
  const [dashboardEntries, setDashboardEntries] = useState<DashboardEntry[]>([]);
  // Edit client handler (persist)
  const handleEditClient = async (updatedClient: Client) => {
    try {
      const res = await apiFetch(`/api/data/clients/${updatedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ name: updatedClient.name, phone: updatedClient.phone })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to update client');
      const c = json.data.client;
      const mapped: Client = { id: c._id, name: c.name, phone: c.phone || '', createdAt: new Date(c.createdAt).toISOString().split('T')[0] };
      setClients((prev: Client[]) => prev.map((c: Client) => c.id === mapped.id ? mapped : c));
    } catch {}
  };

  // Delete client handler (persist)
  const handleDeleteClient = async (clientId: string) => {
    try {
      await apiFetch(`/api/data/clients/${clientId}`, {
        method: 'DELETE',
        headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }
      });
    } catch {}
    setClients((prev: Client[]) => prev.filter((c: Client) => c.id !== clientId));
  };
  // ...existing state declarations...



  // Dynamic services and employees
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState(dashboardData.employees);
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  // Remove isClientModalOpen, use ClientList's modal instead
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loginType, setLoginType] = useState<'user' | 'admin' | 'developer'>('user');
  const [identifier, setIdentifier] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [resetNewPasswordInput, setResetNewPasswordInput] = useState('');
  const [forgotPreviewUrl, setForgotPreviewUrl] = useState<string | null>(null);
  const [forgotResetUrl, setForgotResetUrl] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState('all');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const sseRef = useRef<EventSource | null>(null);
  const sseReconnectTimeoutRef = useRef<any>(null);
  const sseBackoffRef = useRef<number>(1000);

  // Add a new service (persist)
  const handleAddService = async (serviceName: string) => {
    const exists = services.some(s => s.name.toLowerCase() === serviceName.toLowerCase());
    if (exists) return;
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await apiFetch('/api/data/services', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: serviceName, amount: 0 })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to add service');
      const s = json.data.service;
      setServices(prev => [{ id: s._id, name: s.name, amount: s.amount || 0 }, ...prev]);
    } catch {
      // fallback local add if backend fails
      setServices(prev => [{ id: Date.now().toString(), name: serviceName, amount: 0 }, ...prev]);
    }
  };

  // Add a new employee
  const handleAddEmployee = (employeeName: string) => {
    if (!employees.some(e => e.name.toLowerCase() === employeeName.toLowerCase())) {
      setEmployees(prev => [...prev, { id: Date.now().toString(), name: employeeName }]);
    }
  };

  // Delete a task by id (persist)
  const handleTaskDelete = async (taskId: string) => {
    try {
      await apiFetch(`/api/data/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }
      });
    } catch {}
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }

  // AEPS/Bank balances state
  const [bankBalances, setBankBalances] = useState({
    sbi: 0,
    hdfc: 0,
    icici: 0,
    bank: 0,
    cash: 0,
    redmil: 0,
    spicemoney: 0,
    airtelpmt: 0,
    vaibhav: 0,
    omkar: 0,
    uma: 0,
    shopqr: 0
  });

  // Mobile balances state
  const [mobileBalances, setMobileBalances] = useState({
    paytm: 0,
    phonepe: 0,
    googlePay: 0,
    airtel: 0,
    jio: 0,
    bsnl: 0,
    vodafone: 0
  });

  const dashboardStats = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    ongoingTasks: tasks.filter(t => t.status === 'ongoing').length,
    assignedTasks: tasks.filter(t => t.status === 'assigned').length,
    unassignedTasks: tasks.filter(t => t.status === 'unassigned').length,
    urgentTasks: tasks.filter(t => t.taskType === 'urgent' && t.status !== 'completed').length,
    doNowTasks: tasks.filter(t => t.taskType === 'do-now' && t.status !== 'completed').length,
    totalClients: clients.length,
    totalEmployees: employees.length,
    totalServices: services.length,
    totalRevenue: tasks.reduce((sum, t) => sum + (t.finalCharges || 0), 0),
    totalCollected: tasks.reduce((sum, t) => sum + (t.amountCollected || 0), 0),
    totalUnpaid: tasks.reduce((sum, t) => sum + (t.unpaidAmount || 0), 0),
    statusCounts: {
      completed: tasks.filter(t => t.status === 'completed').length,
      ongoing: tasks.filter(t => t.status === 'ongoing').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      unassigned: tasks.filter(t => t.status === 'unassigned').length,
      SDT: tasks.filter(t => t.status === 'service-delivered').length,
      CTT: tasks.filter(t => t.status === 'completed').length,
      OGT: tasks.filter(t => t.status === 'ongoing').length,
      AST: tasks.filter(t => t.status === 'assigned').length,
      UAT: tasks.filter(t => t.status === 'unassigned').length,
      UGT: tasks.filter(t => t.taskType === 'urgent').length,
      IMT: tasks.filter(t => t.taskType === 'do-now' && t.status !== 'completed').length,
      URT: tasks.filter(t => t.taskType === 'urgent' && t.status !== 'completed').length
    },
    mobileBalances,
    bankBalances,
    today: {
      tasks: 0,
      revenue: 0,
      sales: 0,
      profit: 0,
      expense: 0
    },
    chartSalesProfit: [],
    chartLabels: [],
    savedTasks: [],
    services,
    employees
  };

  // Handler to update AEPS/Bank balances from Sales
  // Enhanced AEPS balance update: also handle payout deduction for Vaibhav, Omkar, Uma
  const handleAepsBalanceUpdate = (aepsIdType: string, amount: number, payoutInfo?: { transferredFrom?: string; cashFromGala?: boolean; withdrawnFromId?: boolean; commissionType?: string; commissionAmount?: number }) => {
    console.log('💰 handleAepsBalanceUpdate called with:', aepsIdType, amount, payoutInfo);
    setBankBalances(prev => {
      const updated = { ...prev };
      if (aepsIdType === 'Redmil') updated.redmil += amount;
      if (aepsIdType === 'Spicemoney') updated.spicemoney += amount;
      if (aepsIdType === 'Airtel Payment Bank') updated.airtelpmt += amount;
      // If payout is Online and transferredFrom is Vaibhav/Omkar/Uma, subtract from that
      if (payoutInfo && payoutInfo.transferredFrom && amount > 0) {
        const tf = payoutInfo.transferredFrom;
        if (tf === 'Vaibhav') updated.vaibhav -= amount;
        if (tf === 'Omkar') updated.omkar -= amount;
        if (tf === 'Uma') updated.uma -= amount;
      }
      // If payout is Cash from Gala, subtract from cash
      if (payoutInfo && payoutInfo.cashFromGala && amount > 0) {
        updated.cash -= amount;
      }
      // If payout is Withdrawn from ID, subtract from the selected AEPS ID
      if (payoutInfo && payoutInfo.withdrawnFromId && amount > 0) {
        if (aepsIdType === 'Redmil') updated.redmil -= amount;
        if (aepsIdType === 'Spicemoney') updated.spicemoney -= amount;
        if (aepsIdType === 'Airtel Payment Bank') updated.airtelpmt -= amount;
      }
      // Add commission amount to Cash or SHOP QR
      if (payoutInfo && payoutInfo.commissionType && payoutInfo.commissionAmount && payoutInfo.commissionAmount > 0) {
        if (payoutInfo.commissionType === 'Cash') {
          updated.cash += payoutInfo.commissionAmount;
        } else if (payoutInfo.commissionType === 'Online') {
          updated.shopqr += payoutInfo.commissionAmount;
        }
      }
      return updated;
    });
  };

  const getScreenTitle = (screen: string): string => {
    const titles: { [key: string]: string } = {
      dashboard: 'Dashboard',
      'task-add': 'Add New Task',
      'task-all': 'All Tasks',
      sales: 'Sales',
      balances: 'Balances',
      client: 'Client Management',
      report: 'Reports',
      loginlinks: 'Login Links',
      tools: 'Tools',
      services: 'Services',
      tutorials: 'Tutorials'
    };
    return titles[screen] || screen;
  };

  const handleSaveTask = async (taskData: Omit<Task, 'id'>) => {
    try {
      if (editingTask) {
        const res = await apiFetch(`/api/data/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
          body: JSON.stringify(taskData)
        });
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to update task');
        const t = json.data.task;
        const mapped: Task = {
          id: t._id,
          serialNo: t.serialNo || '',
          date: t.date,
          taskName: t.taskName,
          customerName: t.customerName,
          customerType: t.customerType,
          serviceDeliveryDate: t.serviceDeliveryDate || '',
          taskType: t.taskType,
          assignedTo: t.assignedTo || '',
          serviceCharge: t.serviceCharge || 0,
          finalCharges: t.finalCharges || 0,
          paymentMode: t.paymentMode || 'cash',
          paymentRemarks: t.paymentRemarks || '',
          amountCollected: t.amountCollected || 0,
          unpaidAmount: t.unpaidAmount || 0,
          documentDetails: t.documentDetails || '',
          uploadedDocuments: [],
          remarks: t.remarks || '',
          status: t.status || 'unassigned',
          createdById: t.createdBy || '',
          updatedById: t.updatedBy || ''
        };
        setTasks(prev => prev.map(task => task.id === mapped.id ? mapped : task));
        setEditingTask(null);
      } else {
        const res = await apiFetch('/api/data/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
          body: JSON.stringify(taskData)
        });
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to create task');
        const t = json.data.task;
        const mapped: Task = {
          id: t._id,
          serialNo: t.serialNo || '',
          date: t.date,
          taskName: t.taskName,
          customerName: t.customerName,
          customerType: t.customerType,
          serviceDeliveryDate: t.serviceDeliveryDate || '',
          taskType: t.taskType,
          assignedTo: t.assignedTo || '',
          serviceCharge: t.serviceCharge || 0,
          finalCharges: t.finalCharges || 0,
          paymentMode: t.paymentMode || 'cash',
          paymentRemarks: t.paymentRemarks || '',
          amountCollected: t.amountCollected || 0,
          unpaidAmount: t.unpaidAmount || 0,
          documentDetails: t.documentDetails || '',
          uploadedDocuments: [],
          remarks: t.remarks || '',
          status: t.status || 'unassigned',
          createdById: t.createdBy || '',
          updatedById: t.updatedBy || ''
        };
        setTasks(prev => [mapped, ...prev]);
        // If new customer, ensure a client exists
        if (taskData.customerType === 'new') {
          const exists = clients.some(c => c.name === taskData.customerName);
          if (!exists) {
            await handleSaveClient({ name: taskData.customerName, phone: '' });
          }
        }
      }
    } catch {}
  };

  const handleSaveClient = async (clientData: Omit<Client, 'id' | 'createdAt'>) => {
    try {
      const res = await apiFetch('/api/data/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(clientData)
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to save client');
      const c = json.data.client;
      const mapped: Client = { id: c._id, name: c.name, phone: c.phone || '', createdAt: new Date(c.createdAt).toISOString().split('T')[0] };
      setClients(prev => [mapped, ...prev]);
    } catch {}
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await apiFetch(`/api/data/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(updates)
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success && json?.data?.task) {
        const t = json.data.task;
        const mapped: Task = {
          id: t._id,
          serialNo: t.serialNo || '',
          date: t.date,
          taskName: t.taskName,
          customerName: t.customerName,
          customerType: t.customerType,
          serviceDeliveryDate: t.serviceDeliveryDate || '',
          taskType: t.taskType,
          assignedTo: t.assignedTo || '',
          serviceCharge: t.serviceCharge || 0,
          finalCharges: t.finalCharges || 0,
          paymentMode: t.paymentMode || 'cash',
          paymentRemarks: t.paymentRemarks || '',
          amountCollected: t.amountCollected || 0,
          unpaidAmount: t.unpaidAmount || 0,
          documentDetails: t.documentDetails || '',
          uploadedDocuments: [],
          remarks: t.remarks || '',
          status: t.status
        };
        setTasks(prev => prev.map(task => task.id === mapped.id ? mapped : task));
        return;
      }
    } catch {}
    // fallback local update
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, ...updates } : task));
  };

  const handleTaskEdit = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuthToken(null);
    localStorage.removeItem('dsam_token');
    // Reset user-specific data on logout
    setServices([]);
    setEmployees(dashboardData.employees);
    setTasks([]);
    setClients([]);
  };

  // Helper to call backend with Authorization header
  const apiRequest = async (path: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await apiFetch(path, {
      ...options,
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { res, data } as const;
  };

  // Session restore on mount and load server-side data
  useEffect(() => {
    console.log('useEffect running - loading initial data');
    const token = localStorage.getItem('dsam_token');
    if (!token) return;
    (async () => {
      try {
        setAuthToken(token);
        const res = await apiFetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          localStorage.removeItem('dsam_token');
          setAuthToken(null);
          return;
        }
        const json = await res.json();
        const role = json?.data?.user?.role as 'user' | 'admin' | 'web_developer' | undefined;
        if (role) {
          setIsLoggedIn(true);
          setLoginType(role === 'web_developer' ? 'developer' : role);
          try {
            const headers: any = { Authorization: `Bearer ${token}` };
            const [clientsRes, tasksRes, fundRes, servicesRes] = await Promise.all([
              apiFetch('/api/data/clients', { headers }),
              apiFetch('/api/data/tasks', { headers }),
              apiFetch('/api/data/sales-entries', { headers }),
              apiFetch('/api/data/services', { headers })
            ]);
            const clientsJson = await clientsRes.json();
            const tasksJson = await tasksRes.json();
            const fundJson = await fundRes.json();
            const servicesJson = await servicesRes.json();
            const mapClient = (c: any): Client => ({ id: c._id, name: c.name, phone: c.phone || '', createdAt: new Date(c.createdAt).toISOString().split('T')[0] });
            const mapTask = (t: any): Task => ({
              id: t._id,
              serialNo: t.serialNo || '',
              date: t.date,
              taskName: t.taskName,
              customerName: t.customerName,
              customerType: t.customerType,
              serviceDeliveryDate: t.serviceDeliveryDate || '',
              taskType: t.taskType,
              assignedTo: t.assignedTo || '',
              serviceCharge: t.serviceCharge || 0,
              finalCharges: t.finalCharges || 0,
              paymentMode: t.paymentMode || 'cash',
              paymentRemarks: t.paymentRemarks || '',
              amountCollected: t.amountCollected || 0,
              unpaidAmount: t.unpaidAmount || 0,
              documentDetails: t.documentDetails || '',
              uploadedDocuments: t.uploadedDocuments || [],
              remarks: t.remarks || '',
              status: t.status || 'unassigned',
              createdById: typeof t.createdBy === 'object' ? (t.createdBy?._id || '') : (t.createdBy || ''),
              updatedById: typeof t.updatedBy === 'object' ? (t.updatedBy?._id || '') : (t.updatedBy || ''),
              createdByName: typeof t.createdBy === 'object' ? (t.createdBy?.username || t.createdBy?.email || '') : '',
              updatedByName: typeof t.updatedBy === 'object' ? (t.updatedBy?.username || t.updatedBy?.email || '') : ''
            });
            if (clientsJson?.success) setClients((clientsJson.data.clients || []).map(mapClient));
            if (tasksJson?.success) setTasks((tasksJson.data.tasks || []).map(mapTask));
            if (servicesJson?.success) setServices((servicesJson.data.services || []).map((s:any)=>({ id: s._id, name: s.name, amount: s.amount || 0 })));
            if (fundJson?.success) {
              const entries = (fundJson.data.entries || []) as any[];
              console.log('Fetched entries from backend:', entries);
              console.log('Fund transfer entries:', entries.filter(e => e.type === 'ADD FUND TRANSFER ENTRY'));
              const mappedEntries: DashboardEntry[] = entries.map((e: any) => {
                if (e.type === 'ADD FUND TRANSFER ENTRY') {
                  return {
                    type: 'ADD FUND TRANSFER ENTRY',
                    customerName: e.customerName,
                    customerNumber: e.customerNumber,
                    beneficiaryName: e.beneficiaryName,
                    beneficiaryNumber: e.beneficiaryNumber,
                    applicationName: e.applicationName,
                    transferredFrom: e.transferredFrom,
                    transferredFromRemark: e.transferredFromRemark || '',
                    amount: String(e.amount ?? ''),
                    cashReceived: e.cashReceived,
                    addedInGala: e.addedInGala,
                    addedInGalaRemark: e.addedInGalaRemark || '',
                    commissionType: e.commissionType,
                    commissionAmount: String(e.commissionAmount ?? ''),
                    commissionRemark: e.commissionRemark || ''
                  };
                } else if (e.type === 'AEPS') {
                  return {
                    type: 'AEPS',
                    aepsIdType: e.aepsIdType || '',
                    aepsIdName: e.aepsIdName || '',
                    amount: String(e.amount ?? ''),
                    givenToCustomer: e.givenToCustomer || '',
                    givenToCustomerRemark: e.givenToCustomerRemark || '',
                    givenToCustomerOther: e.givenToCustomerOther || '',
                    withdrawnType: e.withdrawnType || '',
                    commissionType: e.commissionType || '',
                    commissionAmount: String(e.commissionAmount ?? ''),
                    commissionRemark: e.commissionRemark || ''
                  };
                } else {
                  return {
                    type: e.type || 'Other',
                    amount: String(e.amount ?? '')
                  };
                }
              });
              // Removed setting dashboardEntries to avoid duplicates; balances are recalculated from fetched entries
              console.log('Calling calculateBalancesFromEntries with entries:', entries);
              calculateBalancesFromEntries(entries);
            }
          } catch {}

          // Start realtime subscription via SSE
          const startSSE = (tk: string) => {
            if (sseRef.current) {
              try { sseRef.current.close(); } catch {}
              sseRef.current = null;
            }
            const ev = new EventSource(`${(import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'}/api/data/realtime/tasks?token=${tk}`);
            sseRef.current = ev;
            ev.onmessage = (msg) => {
              try {
                const payload = JSON.parse(msg.data);
                if (payload.type === 'task_created' && payload.task) {
                  const t = payload.task;
                  const mapped: Task = {
                    id: t._id,
                    serialNo: t.serialNo || '',
                    date: t.date,
                    taskName: t.taskName,
                    customerName: t.customerName,
                    customerType: t.customerType,
                    serviceDeliveryDate: t.serviceDeliveryDate || '',
                    taskType: t.taskType,
                    assignedTo: t.assignedTo || '',
                    serviceCharge: t.serviceCharge || 0,
                    finalCharges: t.finalCharges || 0,
                    paymentMode: t.paymentMode || 'cash',
                    paymentRemarks: t.paymentRemarks || '',
                    amountCollected: t.amountCollected || 0,
                    unpaidAmount: t.unpaidAmount || 0,
                    documentDetails: t.documentDetails || '',
                    uploadedDocuments: t.uploadedDocuments || [],
                    remarks: t.remarks || '',
                    status: t.status || 'unassigned',
                    createdById: typeof t.createdBy === 'object' ? (t.createdBy?._id || '') : (t.createdBy || ''),
                    updatedById: typeof t.updatedBy === 'object' ? (t.updatedBy?._id || '') : (t.updatedBy || ''),
                    createdByName: typeof t.createdBy === 'object' ? (t.createdBy?.username || t.createdBy?.email || '') : '',
                    updatedByName: typeof t.updatedBy === 'object' ? (t.updatedBy?.username || t.updatedBy?.email || '') : ''
                  };
                  setTasks(prev => {
                    if (prev.some(x => x.id === mapped.id)) return prev;
                    return [mapped, ...prev];
                  });
                }
                if (payload.type === 'task_updated' && payload.task) {
                  const t = payload.task;
                  const mapped: Task = {
                    id: t._id,
                    serialNo: t.serialNo || '',
                    date: t.date,
                    taskName: t.taskName,
                    customerName: t.customerName,
                    customerType: t.customerType,
                    serviceDeliveryDate: t.serviceDeliveryDate || '',
                    taskType: t.taskType,
                    assignedTo: t.assignedTo || '',
                    serviceCharge: t.serviceCharge || 0,
                    finalCharges: t.finalCharges || 0,
                    paymentMode: t.paymentMode || 'cash',
                    paymentRemarks: t.paymentRemarks || '',
                    amountCollected: t.amountCollected || 0,
                    unpaidAmount: t.unpaidAmount || 0,
                    documentDetails: t.documentDetails || '',
                    uploadedDocuments: t.uploadedDocuments || [],
                    remarks: t.remarks || '',
                    status: t.status || 'unassigned',
                    createdById: typeof t.createdBy === 'object' ? (t.createdBy?._id || '') : (t.createdBy || ''),
                    updatedById: typeof t.updatedBy === 'object' ? (t.updatedBy?._id || '') : (t.updatedBy || ''),
                    createdByName: typeof t.createdBy === 'object' ? (t.createdBy?.username || t.createdBy?.email || '') : '',
                    updatedByName: typeof t.updatedBy === 'object' ? (t.updatedBy?.username || t.updatedBy?.email || '') : ''
                  };
                  setTasks(prev => prev.map(x => x.id === mapped.id ? mapped : x));
                }
                if (payload.type === 'task_deleted' && payload.id) {
                  setTasks(prev => prev.filter(x => x.id !== payload.id));
                }
              } catch {}
            };
            ev.onerror = () => {
              try { ev.close(); } catch {}
              sseRef.current = null;
              // backoff reconnect
              const delay = sseBackoffRef.current;
              sseBackoffRef.current = Math.min(delay * 2, 30000);
              clearTimeout(sseReconnectTimeoutRef.current);
              sseReconnectTimeoutRef.current = setTimeout(() => startSSE(tk), delay);
            };
            // reset backoff once open message/comment received
            ev.onopen = () => {
              sseBackoffRef.current = 1000;
            };
          };
          try { startSSE(token); } catch {}
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Load initial data after interactive login when authToken becomes available
  useEffect(() => {
    if (!authToken || !isLoggedIn) return;
    (async () => {
      try {
        const headers: any = { Authorization: `Bearer ${authToken}` };
        const [clientsRes, tasksRes, servicesRes] = await Promise.all([
          apiFetch('/api/data/clients', { headers }),
          apiFetch('/api/data/tasks', { headers }),
          apiFetch('/api/data/services', { headers })
        ]);
        const clientsJson = await clientsRes.json().catch(() => ({} as any));
        const tasksJson = await tasksRes.json().catch(() => ({} as any));
        const servicesJson = await servicesRes.json().catch(() => ({} as any));
        const mapClient = (c: any): Client => ({ id: c._id, name: c.name, phone: c.phone || '', createdAt: new Date(c.createdAt).toISOString().split('T')[0] });
        const mapTask = (t: any): Task => ({
          id: t._id,
          serialNo: t.serialNo || '',
          date: t.date,
          taskName: t.taskName,
          customerName: t.customerName,
          customerType: t.customerType,
          serviceDeliveryDate: t.serviceDeliveryDate || '',
          taskType: t.taskType,
          assignedTo: t.assignedTo || '',
          serviceCharge: t.serviceCharge || 0,
          finalCharges: t.finalCharges || 0,
          paymentMode: t.paymentMode || 'cash',
          paymentRemarks: t.paymentRemarks || '',
          amountCollected: t.amountCollected || 0,
          unpaidAmount: t.unpaidAmount || 0,
          documentDetails: t.documentDetails || '',
          uploadedDocuments: t.uploadedDocuments || [],
          remarks: t.remarks || '',
          status: t.status || 'unassigned',
          createdById: typeof t.createdBy === 'object' ? (t.createdBy?._id || '') : (t.createdBy || ''),
          updatedById: typeof t.updatedBy === 'object' ? (t.updatedBy?._id || '') : (t.updatedBy || ''),
          createdByName: typeof t.createdBy === 'object' ? (t.createdBy?.username || t.createdBy?.email || '') : '',
          updatedByName: typeof t.updatedBy === 'object' ? (t.updatedBy?.username || t.updatedBy?.email || '') : ''
        });
        if (clientsJson?.success) setClients((clientsJson.data.clients || []).map(mapClient));
        if (tasksJson?.success) {
          const loadedTasks = (tasksJson.data.tasks || []).map(mapTask);
          console.log('Loaded tasks from database:', loadedTasks);
          setTasks(loadedTasks);
        }
        if (servicesJson?.success) setServices((servicesJson.data.services || []).map((s:any)=>({ id: s._id, name: s.name, amount: s.amount || 0 })));
      } catch {}

      // Start realtime subscription via SSE for interactive login path too
      const startSSE = (tk: string) => {
        if (sseRef.current) {
          try { sseRef.current.close(); } catch {}
          sseRef.current = null;
        }
        const ev = new EventSource(`${(import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'}/api/data/realtime/tasks?token=${tk}`);
        sseRef.current = ev;
        ev.onmessage = (msg) => {
          try {
            const payload = JSON.parse(msg.data);
            if (payload.type === 'task_created' && payload.task) {
              const t = payload.task;
              const mapped: Task = {
                id: t._id,
                serialNo: t.serialNo || '',
                date: t.date,
                taskName: t.taskName,
                customerName: t.customerName,
                customerType: t.customerType,
                serviceDeliveryDate: t.serviceDeliveryDate || '',
                taskType: t.taskType,
                assignedTo: t.assignedTo || '',
                serviceCharge: t.serviceCharge || 0,
                finalCharges: t.finalCharges || 0,
                paymentMode: t.paymentMode || 'cash',
                paymentRemarks: t.paymentRemarks || '',
                amountCollected: t.amountCollected || 0,
                unpaidAmount: t.unpaidAmount || 0,
                documentDetails: t.documentDetails || '',
                uploadedDocuments: t.uploadedDocuments || [],
                remarks: t.remarks || '',
                status: t.status || 'unassigned',
                createdById: typeof t.createdBy === 'object' ? (t.createdBy?._id || '') : (t.createdBy || ''),
                updatedById: typeof t.updatedBy === 'object' ? (t.updatedBy?._id || '') : (t.updatedBy || ''),
                createdByName: typeof t.createdBy === 'object' ? (t.createdBy?.username || t.createdBy?.email || '') : '',
                updatedByName: typeof t.updatedBy === 'object' ? (t.updatedBy?.username || t.updatedBy?.email || '') : ''
              };
              setTasks(prev => {
                if (prev.some(x => x.id === mapped.id)) return prev;
                return [mapped, ...prev];
              });
            }
            if (payload.type === 'task_updated' && payload.task) {
              const t = payload.task;
              const mapped: Task = {
                id: t._id,
                serialNo: t.serialNo || '',
                date: t.date,
                taskName: t.taskName,
                customerName: t.customerName,
                customerType: t.customerType,
                serviceDeliveryDate: t.serviceDeliveryDate || '',
                taskType: t.taskType,
                assignedTo: t.assignedTo || '',
                serviceCharge: t.serviceCharge || 0,
                finalCharges: t.finalCharges || 0,
                paymentMode: t.paymentMode || 'cash',
                paymentRemarks: t.paymentRemarks || '',
                amountCollected: t.amountCollected || 0,
                unpaidAmount: t.unpaidAmount || 0,
                documentDetails: t.documentDetails || '',
                uploadedDocuments: t.uploadedDocuments || [],
                remarks: t.remarks || '',
                status: t.status || 'unassigned',
                createdById: typeof t.createdBy === 'object' ? (t.createdBy?._id || '') : (t.createdBy || ''),
                updatedById: typeof t.updatedBy === 'object' ? (t.updatedBy?._id || '') : (t.updatedBy || ''),
                createdByName: typeof t.createdBy === 'object' ? (t.createdBy?.username || t.createdBy?.email || '') : '',
                updatedByName: typeof t.updatedBy === 'object' ? (t.updatedBy?.username || t.updatedBy?.email || '') : ''
              };
              setTasks(prev => prev.map(x => x.id === mapped.id ? mapped : x));
            }
            if (payload.type === 'task_deleted' && payload.id) {
              setTasks(prev => prev.filter(x => x.id !== payload.id));
            }
          } catch {}
        };
        ev.onerror = () => {
          try { ev.close(); } catch {}
          sseRef.current = null;
          const delay = sseBackoffRef.current;
          sseBackoffRef.current = Math.min(delay * 2, 30000);
          clearTimeout(sseReconnectTimeoutRef.current);
          sseReconnectTimeoutRef.current = setTimeout(() => startSSE(tk), delay);
        };
        ev.onopen = () => { sseBackoffRef.current = 1000; };
      };
      try { startSSE(authToken); } catch {}
    })();
  }, [authToken, isLoggedIn]);

  // Detect reset token in URL and show reset form
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('token');
      if (tokenFromUrl) {
        setShowForgot(true);
        setResetTokenInput(tokenFromUrl);
      }
    } catch {}
  }, []);

  const getTaskFilter = (filterType: string) => {
    switch (filterType) {
      case 'unassigned':
        return (task: Task) => task.status === 'unassigned';
      case 'assigned':
        return (task: Task) => task.status === 'assigned';
      case 'ongoing':
        return (task: Task) => task.status === 'ongoing';
      case 'completed':
        return (task: Task) => task.status === 'completed';
      case 'service-delivered':
        return (task: Task) => task.status === 'service-delivered';
      case 'do-now':
        return (task: Task) => task.taskType === 'do-now' && task.status !== 'completed';
      case 'urgent':
        return (task: Task) => task.taskType === 'urgent' && task.status !== 'completed';
      case 'delivered':
        return (task: Task) => task.status === 'service-delivered';
      default:
        return undefined;
    }
  };

  // Unify all add client actions to ClientList
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  
  // Handle status card clicks to redirect to task list
  const handleStatusCardClick = (status: string) => {
    // Map dashboard status values to TaskOverview filter keys
    const statusMapping: Record<string, string> = {
      'service-delivered': 'delivered'
    };
    
    const mappedStatus = statusMapping[status] || status;
    setActiveScreen('task-all');
    setTaskFilter(mappedStatus);
  };
  const renderScreen = () => {
    switch (activeScreen) {
      case 'account':
        return (
          <div className="max-w-xl mx-auto space-y-6">
            <h2 className="text-2xl font-semibold mb-4">Account Security</h2>
            <div className="rounded-lg border p-4 space-y-4 bg-white">
              <h3 className="font-medium">Change Password (OTP)</h3>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    try {
                      setAccountMessage(null);
                      setAccountError(null);
                      const { res, data } = await apiRequest('/api/auth/request-otp', {
                        method: 'POST',
                        body: JSON.stringify({ purpose: 'change_password' })
                      });
                      if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to send OTP');
                      setAccountMessage('OTP sent to your email. It expires in 5 minutes.');
                    } catch (err: any) {
                      setAccountError(err.message || 'Failed to send OTP');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                >
                  Request OTP
                </button>
                <div>
                  <label className="block text-sm font-medium mb-1">Current Password</label>
                  <input type="password" value={currentPasswordInput} onChange={e => setCurrentPasswordInput(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="Enter current password" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">New Password</label>
                  <input type="password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="Enter new password" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">OTP</label>
                  <input type="text" value={otpInput} onChange={e => setOtpInput(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="6-digit OTP" />
                </div>
                <button
                  onClick={async () => {
                    try {
                      setAccountMessage(null);
                      setAccountError(null);
                      const { res, data } = await apiRequest('/api/auth/change-password', {
                        method: 'PUT',
                        body: JSON.stringify({ currentPassword: currentPasswordInput, newPassword: newPasswordInput, otp: otpInput })
                      });
                      if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to change password');
                      setAccountMessage('Password changed successfully.');
                      setCurrentPasswordInput('');
                      setNewPasswordInput('');
                      setOtpInput('');
                    } catch (err: any) {
                      setAccountError(err.message || 'Failed to change password');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Change Password
                </button>
                {accountMessage && <div className="text-emerald-700 text-sm">{accountMessage}</div>}
                {accountError && <div className="text-red-600 text-sm">{accountError}</div>}
              </div>
            </div>
          </div>
        );
      case 'admin-panel':
        return (
          <AdminPanel token={authToken || ''} role={loginType} />
        );
      case 'client':
        return (
          <ClientList
            clients={clients}
            tasks={tasks}
            onAdd={handleSaveClient}
            onEdit={handleEditClient}
            onDelete={handleDeleteClient}
            showAddModal={showAddClientModal}
            setShowAddModal={setShowAddClientModal}
          />
        );
      case 'dashboard':
        return (
          <Dashboard 
            data={{
              ...dashboardStats
            }}
            onAddTask={() => setIsTaskModalOpen(true)} 
            onAddClient={() => {
              setActiveScreen('client');
              setShowAddClientModal(true);
            }}
            onStatusCardClick={handleStatusCardClick}
          />
        );
      case 'sales':
        return (
      <Sales
        token={authToken || ''}
        onAepsBalanceUpdate={handleAepsBalanceUpdate}
        onFundTransferBalanceUpdate={handleFundTransferBalanceUpdate}
        onMobileBalanceUpdate={handleMobileBalanceUpdate}
        onBankCashAepsUpdate={handleBankCashAepsUpdate}
        onBalanceRecalculation={calculateBalancesFromEntries}
        dashboardEntries={dashboardEntries}
        setDashboardEntries={setDashboardEntries}
      />
        );
      case 'report':
        return (
          <ReportsDashboard token={authToken || ''} role={loginType} />
        );
      case 'tools':
        return (
          <Tools />
        );
      case 'task-add':
        return (
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="mb-6 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              Add New Task
            </button>
            <button
              onClick={() => {
                setActiveScreen('client');
                setShowAddClientModal(true);
              }}
              className="mb-6 ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add New Client
            </button>
            <EnhancedTaskList 
              tasks={tasks}
              services={services}
              employees={employees}
              title="Recent Tasks"
              onTaskUpdate={handleTaskUpdate}
              onTaskEdit={handleTaskEdit}
              onTaskDelete={handleTaskDelete}
            />
          </div>
        );
      case 'task-all':
        return (
          <div>
            <TaskOverview 
              tasks={tasks}
              onFilterChange={setTaskFilter}
              activeFilter={taskFilter}
            />
            <button
              onClick={() => {
                setActiveScreen('client');
                setShowAddClientModal(true);
              }}
              className="mb-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add New Client
            </button>
            <EnhancedTaskList 
              tasks={tasks}
              services={services}
              employees={employees}
              title={taskFilter === 'all' ? 'All Tasks' : `Filtered Tasks (${taskFilter})`}
              filter={getTaskFilter(taskFilter)}
              onTaskUpdate={handleTaskUpdate}
              onTaskEdit={handleTaskEdit}
              onTaskDelete={handleTaskDelete}
            />
          </div>
        );
      case 'task-deleted':
        return (
          <DeletedTaskList token={authToken || ''} />
        );
      default:
        return <Placeholder title={getScreenTitle(activeScreen)} />;
    }
  };

  if (!isLoggedIn) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          background: `
            radial-gradient(3px 3px at 25% 25%,rgba(255,255,255,.2) 0,transparent 100%),
            radial-gradient(3px 3px at 75% 75%,rgba(255,255,255,.15) 0,transparent 100%),
            radial-gradient(2px 2px at 50% 10%,rgba(255,255,255,.1) 0,transparent 100%),
            radial-gradient(2px 2px at 10% 90%,rgba(255,255,255,.12) 0,transparent 100%),
            radial-gradient(4px 4px at 90% 40%,rgba(255,255,255,.08) 0,transparent 100%),
            radial-gradient(3px 3px at 40% 60%,rgba(255,255,255,.1) 0,transparent 100%),
            linear-gradient(135deg, #667eea 0%, #764ba2 22%, #f093fb 42%, #f5576c 62%, #4facfe 82%, #00f2fe 100%)
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: 'auto,auto,auto,auto,auto,auto,cover',
          animation: 'gradientShift 12s ease-in-out infinite'
        }}
      >
        <style>
          {`
            @keyframes gradientShift {
              0%, 100% {
                background:
                  radial-gradient(3px 3px at 25% 25%,rgba(255,255,255,.2) 0,transparent 100%),
                  radial-gradient(3px 3px at 75% 75%,rgba(255,255,255,.15) 0,transparent 100%),
                  radial-gradient(2px 2px at 50% 10%,rgba(255,255,255,.1) 0,transparent 100%),
                  radial-gradient(2px 2px at 10% 90%,rgba(255,255,255,.12) 0,transparent 100%),
                  radial-gradient(4px 4px at 90% 40%,rgba(255,255,255,.08) 0,transparent 100%),
                  radial-gradient(3px 3px at 40% 60%,rgba(255,255,255,.1) 0,transparent 100%),
                  linear-gradient(135deg, #667eea 0%, #764ba2 22%, #f093fb 42%, #f5576c 62%, #4facfe 82%, #00f2fe 100%);
              }
              25% {
                background:
                  radial-gradient(3px 3px at 75% 25%,rgba(255,255,255,.2) 0,transparent 100%),
                  radial-gradient(3px 3px at 25% 75%,rgba(255,255,255,.15) 0,transparent 100%),
                  radial-gradient(2px 2px at 10% 50%,rgba(255,255,255,.1) 0,transparent 100%),
                  radial-gradient(2px 2px at 90% 10%,rgba(255,255,255,.12) 0,transparent 100%),
                  radial-gradient(4px 4px at 40% 90%,rgba(255,255,255,.08) 0,transparent 100%),
                  radial-gradient(3px 3px at 60% 40%,rgba(255,255,255,.1) 0,transparent 100%),
                  linear-gradient(225deg, #667eea 0%, #764ba2 22%, #f093fb 42%, #f5576c 62%, #4facfe 82%, #00f2fe 100%);
              }
              50% {
                background:
                  radial-gradient(3px 3px at 50% 50%,rgba(255,255,255,.2) 0,transparent 100%),
                  radial-gradient(3px 3px at 10% 10%,rgba(255,255,255,.15) 0,transparent 100%),
                  radial-gradient(2px 2px at 90% 90%,rgba(255,255,255,.1) 0,transparent 100%),
                  radial-gradient(2px 2px at 30% 70%,rgba(255,255,255,.12) 0,transparent 100%),
                  radial-gradient(4px 4px at 70% 30%,rgba(255,255,255,.08) 0,transparent 100%),
                  radial-gradient(3px 3px at 80% 20%,rgba(255,255,255,.1) 0,transparent 100%),
                  linear-gradient(315deg, #667eea 0%, #764ba2 22%, #f093fb 42%, #f5576c 62%, #4facfe 82%, #00f2fe 100%);
              }
              75% {
                background:
                  radial-gradient(3px 3px at 80% 80%,rgba(255,255,255,.2) 0,transparent 100%),
                  radial-gradient(3px 3px at 20% 20%,rgba(255,255,255,.15) 0,transparent 100%),
                  radial-gradient(2px 2px at 60% 40%,rgba(255,255,255,.1) 0,transparent 100%),
                  radial-gradient(2px 2px at 40% 60%,rgba(255,255,255,.12) 0,transparent 100%),
                  radial-gradient(4px 4px at 10% 30%,rgba(255,255,255,.08) 0,transparent 100%),
                  radial-gradient(3px 3px at 90% 70%,rgba(255,255,255,.1) 0,transparent 100%),
                  linear-gradient(45deg, #667eea 0%, #764ba2 22%, #f093fb 42%, #f5576c 62%, #4facfe 82%, #00f2fe 100%);
              }
            }
            
            @keyframes welcomeAnimation {
              0% {
                opacity: 0;
                transform: translateY(-30px) scale(0.8);
                text-shadow: 0 0 20px rgba(255,255,255,0.5);
              }
              50% {
                opacity: 0.8;
                transform: translateY(-5px) scale(1.05);
                text-shadow: 0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(102, 126, 234, 0.6);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
                text-shadow: 0 0 15px rgba(255,255,255,0.6), 0 0 40px rgba(102, 126, 234, 0.4);
              }
            }
            
            @keyframes poweredAnimation {
              0% {
                opacity: 0;
                transform: translateX(-20px);
              }
              60% {
                opacity: 0;
                transform: translateX(-20px);
              }
              100% {
                opacity: 1;
                transform: translateX(0);
              }
            }
            
            .animate-welcome {
              animation: welcomeAnimation 2s ease-out forwards;
            }
            
            .animate-powered {
              animation: poweredAnimation 2.5s ease-out forwards;
            }
          `}
        </style>
        <div className="absolute top-8 left-8">
          <h1 className="text-3xl font-bold text-white mb-2 animate-welcome">DSAM PORTAL</h1>
          <span className="text-white/85 text-sm animate-powered">~ Powered by ShivTech ~</span>
        </div>
        
        {/* Login Type Selector - Top Right */}
        <div className="absolute top-8 right-8 flex gap-3">
          <button 
            className={`px-4 py-2 backdrop-blur-sm border rounded-lg text-white text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
              loginType === 'user' 
                ? 'bg-gradient-to-r from-purple-500/80 to-pink-500/80 border-white/50 shadow-lg' 
                : 'bg-white/20 border-white/30 hover:bg-white/30'
            }`}
            onClick={() => setLoginType('user')}
          >
            👤 User Login
          </button>
          <button 
            className={`px-4 py-2 backdrop-blur-sm border rounded-lg text-white text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
              loginType === 'admin' 
                ? 'bg-gradient-to-r from-purple-500/80 to-pink-500/80 border-white/50 shadow-lg' 
                : 'bg-white/20 border-white/30 hover:bg-white/30'
            }`}
            onClick={() => setLoginType('admin')}
          >
            👨‍💼 Admin Login
          </button>
          <button 
            className={`px-4 py-2 backdrop-blur-sm border rounded-lg text-white text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
              loginType === 'developer' 
                ? 'bg-gradient-to-r from-purple-500/80 to-pink-500/80 border-white/50 shadow-lg' 
                : 'bg-white/20 border-white/30 hover:bg-white/30'
            }`}
            onClick={() => setLoginType('developer')}
          >
            👨‍💻 Web Developer Login
          </button>
        </div>
        <div className="bg-white/15 backdrop-blur-2xl border border-white/30 p-8 rounded-3xl shadow-2xl max-w-md w-full relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                    <div className="relative z-10">
            <h2 className="text-2xl font-bold text-center mb-6 text-white">
              {loginType === 'user' ? '👤 User Login' : loginType === 'admin' ? '👨‍💼 Admin Login' : '👨‍💻 Developer Login'}
            </h2>
            {!showForgot && (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoginError(null);
              try {
                const res = await apiFetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ identifier, password: passwordInput, expectedRole: (loginType === 'developer' ? 'web_developer' : loginType) })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                  throw new Error(data.message || 'Login failed');
                }
                const token: string = data.data.token;
                const role: 'user' | 'admin' | 'web_developer' = data.data.user.role;
                setAuthToken(token);
                localStorage.setItem('dsam_token', token);
                setIsLoggedIn(true);
                setLoginType(role === 'web_developer' ? 'developer' : role);
              } catch (err: any) {
                setLoginError(err.message || 'Login failed');
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">
                    {loginType === 'user' ? 'User ID / Email' : loginType === 'admin' ? 'Admin ID / Email' : 'Developer ID / Email'}
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-full text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:outline-none transition-all"
                    placeholder={loginType === 'developer' ? 'Shivowner_4567 or email' : 'Enter username or email'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-full text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:outline-none transition-all"
                    placeholder="Enter password"
                  />
                </div>
                {loginError && (
                  <div className="text-red-200 text-sm">{loginError}</div>
                )}
                                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full hover:from-purple-600 hover:to-pink-600 transition-all font-semibold text-lg shadow-lg transform hover:scale-105"
                  >
                    {loginType === 'user' ? 'User Login' : loginType === 'admin' ? 'Admin Login' : 'Developer Login'}
                  </button>
                  <div className="text-center text-white/80 text-sm">
                    <button type="button" className="underline mt-2" onClick={() => setShowForgot(true)}>Forgot password?</button>
                  </div>
              </div>
            </form>
            )}
            {showForgot && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Forgot / Reset Password</h3>
                <div className="rounded-lg bg-white/15 border border-white/25 p-4 space-y-3">
                  <label className="block text-sm font-medium text-white/90">Your Email</label>
                  <input type="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-full text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:outline-none transition-all" placeholder="you@example.com" />
                  <button
                    onClick={async ()=>{
                      try {
                        setForgotError(null); setForgotMessage(null); setForgotPreviewUrl(null); setForgotResetUrl(null);
                        const res = await apiFetch('/api/auth/forgot-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: forgotEmail })
                        });
                        const data = await res.json();
                        if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to send reset email');
                        const previewUrl: string | undefined = data?.data?.previewUrl;
                        const resetUrl: string | undefined = data?.data?.resetUrl;
                        setForgotMessage('If the email exists, a reset link has been sent. Check your inbox.');
                        if (previewUrl) setForgotPreviewUrl(previewUrl);
                        if (resetUrl) {
                          setForgotResetUrl(resetUrl);
                          try {
                            const url = new URL(resetUrl);
                            const t = url.searchParams.get('token');
                            if (t) setResetTokenInput(t);
                          } catch {}
                        }
                      } catch (e:any) {
                        setForgotError(e.message || 'Failed to send reset email');
                      }
                    }}
                    className="w-full py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                  >
                    Send reset email
                  </button>
                  {forgotMessage && <div className="text-emerald-200 text-sm">{forgotMessage}</div>}
                  {forgotPreviewUrl && (
                    <div className="text-emerald-200 text-sm break-words">
                      Dev email preview: <a className="underline" href={forgotPreviewUrl} target="_blank" rel="noreferrer">Open preview</a>
                    </div>
                  )}
                  {forgotResetUrl && (
                    <div className="text-emerald-200 text-sm break-words">
                      Dev reset URL: <a className="underline" href={forgotResetUrl} target="_blank" rel="noreferrer">{forgotResetUrl}</a>
                    </div>
                  )}
                  {forgotError && <div className="text-red-200 text-sm">{forgotError}</div>}
                </div>
                <div className="rounded-lg bg-white/15 border border-white/25 p-4 space-y-3">
                  <div className="text-white/90 text-sm">Have a reset token? Paste it below to set a new password.</div>
                  <input type="text" value={resetTokenInput} onChange={e=>setResetTokenInput(e.target.value)} className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-full text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:outline-none transition-all" placeholder="Reset token" />
                  <input type="password" value={resetNewPasswordInput} onChange={e=>setResetNewPasswordInput(e.target.value)} className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-full text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:outline-none transition-all" placeholder="New password" />
                  <button
                    onClick={async ()=>{
                      try {
                        setForgotError(null); setForgotMessage(null);
                        const res = await apiFetch('/api/auth/reset-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ token: resetTokenInput, newPassword: resetNewPasswordInput })
                        });
                        const data = await res.json();
                        if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to reset password');
                        setForgotMessage('Password reset successfully. You can now log in with your new password.');
                        setResetNewPasswordInput('');
                      } catch (e:any) {
                        setForgotError(e.message || 'Failed to reset password');
                      }
                    }}
                    className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Reset password
                  </button>
                  <div className="text-center text-white/80 text-sm">
                    <button type="button" className="underline mt-1" onClick={() => setShowForgot(false)}>Back to login</button>
                  </div>
                </div>
              </div>
            )}
          <div className="mt-6 text-center text-sm text-white/80">
            <span className="text-white/90">Defaults:</span>
            <div className="text-white/80 mt-1">
              <button
                type="button"
                className="underline mr-3"
                onClick={() => { setLoginType('developer'); setIdentifier('Shivowner_4567'); setPasswordInput('LifeQWER#$123'); }}
              >Fill Web Developer defaults</button>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar activeScreen={activeScreen} onScreenChange={setActiveScreen} userRole={loginType} />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6">
          <Header 
            title="DSAM PORTAL ~ Powered By SHIVTECH"
            onAddClient={() => {
              setActiveScreen('client');
              setShowAddClientModal(true);
            }}
            onAddTask={() => setIsTaskModalOpen(true)}
            onLogout={handleLogout}
          />
          <main>
            {renderScreen()}
          </main>
        </div>
      </div>
      <EnhancedTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        services={services}
        employees={employees}
        savedTasks={dashboardData.savedTasks}
        existingCustomers={clients.map(c => c.name)}
        onAddService={handleAddService}
        onAddEmployee={handleAddEmployee}
      />
    </div>
  );
}

export default App;
