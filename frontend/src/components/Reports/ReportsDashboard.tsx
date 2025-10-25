import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/api';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Download, Search, DollarSign, TrendingUp, Users, FileText, PieChart, BarChart3 } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

interface Props { token: string; role: 'user' | 'admin' | 'developer'; }

const DateRangeFilter: React.FC<{
  start: string;
  end: string;
  onStartChange: (val: string) => void;
  onEndChange: (val: string) => void;
  onRefresh: () => void;
}> = ({ start, end, onStartChange, onEndChange, onRefresh }) => (
  <div className="flex flex-wrap items-end gap-4 mb-6">
    <div>
      <label className="block text-sm font-medium mb-1 text-gray-700">Start Date</label>
      <input
        type="date"
        value={start}
        onChange={(e) => onStartChange(e.target.value)}
        className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
    <div>
      <label className="block text-sm font-medium mb-1 text-gray-700">End Date</label>
      <input
        type="date"
        value={end}
        onChange={(e) => onEndChange(e.target.value)}
        className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
    <button
      onClick={onRefresh}
      className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
    >
      Refresh
    </button>
  </div>
);

const ReportsDashboard: React.FC<Props> = ({ token, role }) => {
  const [activeTab, setActiveTab] = useState('financial');
  const [start, setStart] = useState<string>(() => new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0,10));
  const [end, setEnd] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profitLoss, setProfitLoss] = useState<any>(null);
  const [salesByService, setSalesByService] = useState<any[]>([]);
  const [salesByStaff, setSalesByStaff] = useState<any[]>([]);
  const [accountsReceivable, setAccountsReceivable] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);
  const [taskStatus, setTaskStatus] = useState<any[]>([]);
  const [clientActivity, setClientActivity] = useState<any>(null);
  const [clientLedger, setClientLedger] = useState<any>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchFinancialReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = `?start=${start}&end=${end}`;
      
      const [plRes, svcRes, staffRes, arRes, bsRes] = await Promise.all([
        apiFetch(`/api/reports/profit-loss${qs}`, { headers }),
        apiFetch(`/api/reports/sales-by-service${qs}`, { headers }),
        apiFetch(`/api/reports/sales-by-staff${qs}`, { headers }),
        apiFetch(`/api/reports/accounts-receivable`, { headers }),
        apiFetch(`/api/reports/balance-sheet`, { headers })
      ]);

      const [pl, svc, staff, ar, bs] = await Promise.all([
        plRes.json(), svcRes.json(), staffRes.json(), arRes.json(), bsRes.json()
      ]);

      if (pl.success) setProfitLoss(pl.data);
      if (svc.success) setSalesByService(svc.data);
      if (staff.success) setSalesByStaff(staff.data);
      if (ar.success) setAccountsReceivable(ar.data);
      if (bs.success) setBalanceSheet(bs.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load financial reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = `?start=${start}&end=${end}`;
      
      const [perfRes, statusRes] = await Promise.all([
        apiFetch(`/api/reports/staff-performance${qs}`, { headers }),
        apiFetch(`/api/reports/task-status`, { headers })
      ]);

      const [perf, status] = await Promise.all([perfRes.json(), statusRes.json()]);

      if (perf.success) setStaffPerformance(perf.data);
      if (status.success) setTaskStatus(status.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load task reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = `?start=${start}&end=${end}`;
      
      const actRes = await apiFetch(`/api/reports/client-activity${qs}`, { headers });
      const act = await actRes.json();

      if (act.success) setClientActivity(act.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load client reports');
    } finally {
      setLoading(false);
    }
  };

  const searchClientLedger = async () => {
    if (!clientSearchTerm.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const res = await apiFetch(`/api/reports/client-ledger?search=${encodeURIComponent(clientSearchTerm)}`, { headers });
      const data = await res.json();

      if (data.success) setClientLedger(data.data);
    } catch (e: any) {
      setError(e.message || 'Failed to search client ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'financial') fetchFinancialReports();
    else if (activeTab === 'tasks') fetchTaskReports();
    else if (activeTab === 'clients') fetchClientReports();
  }, [activeTab, start, end]);

  if (role !== 'admin' && role !== 'developer') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Access denied. Reports are for Admins and Web Developers only.
        </div>
      </div>
    );
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'financial', label: 'Financial Reports', icon: DollarSign },
    { id: 'tasks', label: 'Task & Productivity', icon: FileText },
    { id: 'clients', label: 'Client Reports', icon: Users }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Reports Dashboard</h1>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && <div className="text-center py-4 text-gray-500">Loading reports...</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

      {activeTab === 'financial' && (
        <div className="space-y-6">
          <DateRangeFilter
            start={start}
            end={end}
            onStartChange={setStart}
            onEndChange={setEnd}
            onRefresh={fetchFinancialReports}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Total Revenue</h3>
                <TrendingUp className="w-6 h-6" />
              </div>
              <p className="text-3xl font-bold">₹{profitLoss?.totalRevenue?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Total Expenses</h3>
                <DollarSign className="w-6 h-6" />
              </div>
              <p className="text-3xl font-bold">₹{profitLoss?.totalExpenses?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Net Profit</h3>
                <PieChart className="w-6 h-6" />
              </div>
              <p className="text-3xl font-bold">₹{profitLoss?.netProfit?.toFixed(2) || '0.00'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Sales by Service</h3>
                <button
                  onClick={() => exportToCSV(salesByService, 'sales-by-service')}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
              {salesByService.length > 0 ? (
                <>
                  <div style={{ height: 300 }}>
                    <Pie
                      data={{
                        labels: salesByService.slice(0, 6).map(s => s.serviceName),
                        datasets: [{
                          data: salesByService.slice(0, 6).map(s => s.totalRevenue),
                          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
                        }]
                      }}
                      options={{ responsive: true, maintainAspectRatio: false }}
                    />
                  </div>
                  <div className="mt-4 max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2">Service</th>
                          <th className="text-right px-3 py-2">Sales</th>
                          <th className="text-right px-3 py-2">Revenue</th>
                          <th className="text-right px-3 py-2">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesByService.map((s, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{s.serviceName}</td>
                            <td className="text-right px-3 py-2">{s.numberOfSales}</td>
                            <td className="text-right px-3 py-2">₹{s.totalRevenue.toFixed(2)}</td>
                            <td className="text-right px-3 py-2">₹{s.totalProfit.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">No service sales data available</p>
              )}
            </div>

            <div className="bg-white rounded-lg border p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Sales by Staff</h3>
                <button
                  onClick={() => exportToCSV(salesByStaff, 'sales-by-staff')}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
              {salesByStaff.length > 0 ? (
                <>
                  <div style={{ height: 300 }}>
                    <Bar
                      data={{
                        labels: salesByStaff.map(s => s.staffName),
                        datasets: [{
                          label: 'Revenue',
                          data: salesByStaff.map(s => s.totalRevenue),
                          backgroundColor: '#10b981'
                        }]
                      }}
                      options={{ responsive: true, maintainAspectRatio: false }}
                    />
                  </div>
                  <div className="mt-4 max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2">Staff</th>
                          <th className="text-right px-3 py-2">Tasks</th>
                          <th className="text-right px-3 py-2">Revenue</th>
                          <th className="text-right px-3 py-2">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesByStaff.map((s, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{s.staffName}</td>
                            <td className="text-right px-3 py-2">{s.tasksCompleted}</td>
                            <td className="text-right px-3 py-2">₹{s.totalRevenue.toFixed(2)}</td>
                            <td className="text-right px-3 py-2">₹{s.totalProfit.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">No staff sales data available</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Accounts Receivable (Unpaid)</h3>
              <button
                onClick={() => exportToCSV(accountsReceivable?.unpaidTasks || [], 'accounts-receivable')}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-amber-50 p-4 rounded">
                <p className="text-sm text-gray-600">Total Unpaid Amount</p>
                <p className="text-2xl font-bold text-amber-600">
                  ₹{accountsReceivable?.totalUnpaid?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded">
                <p className="text-sm text-gray-600">From Tasks</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{accountsReceivable?.totalUnpaidFromTasks?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded">
                <p className="text-sm text-gray-600">Collect From</p>
                <p className="text-2xl font-bold text-orange-600">
                  ₹{accountsReceivable?.totalCollectFrom?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Customer</th>
                    <th className="text-left px-3 py-2">Task</th>
                    <th className="text-right px-3 py-2">Unpaid Amount</th>
                    <th className="text-right px-3 py-2">Date</th>
                    <th className="text-right px-3 py-2">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsReceivable?.unpaidTasks?.map((task: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">{task.customerName}</td>
                      <td className="px-3 py-2">{task.taskName}</td>
                      <td className="text-right px-3 py-2 font-semibold text-red-600">
                        ₹{task.unpaidAmount.toFixed(2)}
                      </td>
                      <td className="text-right px-3 py-2">{task.date}</td>
                      <td className="text-right px-3 py-2">{task.serviceDeliveryDate || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6 shadow">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Balance Sheet / Ledger</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {balanceSheet.map((acc, i) => (
                <div key={i} className={`p-4 rounded-lg border-2 ${acc.balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-sm text-gray-600 font-medium">{acc.account}</p>
                  <p className={`text-2xl font-bold ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{acc.balance.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <DateRangeFilter
            start={start}
            end={end}
            onStartChange={setStart}
            onEndChange={setEnd}
            onRefresh={fetchTaskReports}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Task Status Distribution</h3>
                <button
                  onClick={() => exportToCSV(taskStatus, 'task-status')}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
              {taskStatus.length > 0 ? (
                <div style={{ height: 300 }}>
                  <Pie
                    data={{
                      labels: taskStatus.map(s => s.status),
                      datasets: [{
                        data: taskStatus.map(s => s.count),
                        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No task status data available</p>
              )}
            </div>

            <div className="bg-white rounded-lg border p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Staff Performance</h3>
                <button
                  onClick={() => exportToCSV(staffPerformance, 'staff-performance')}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Staff</th>
                      <th className="text-right px-3 py-2">Assigned</th>
                      <th className="text-right px-3 py-2">Completed</th>
                      <th className="text-right px-3 py-2">Pending</th>
                      <th className="text-right px-3 py-2">Avg Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPerformance.map((staff, i) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{staff.staffName}</td>
                        <td className="text-right px-3 py-2">{staff.tasksAssigned}</td>
                        <td className="text-right px-3 py-2 text-green-600">{staff.tasksCompleted}</td>
                        <td className="text-right px-3 py-2 text-amber-600">{staff.tasksPending}</td>
                        <td className="text-right px-3 py-2">{staff.averageCompletionTime.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="space-y-6">
          <DateRangeFilter
            start={start}
            end={end}
            onStartChange={setStart}
            onEndChange={setEnd}
            onRefresh={fetchClientReports}
          />

          <div className="bg-white rounded-lg border p-6 shadow">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Client Activity: New vs Old</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                <h4 className="text-lg font-semibold text-blue-700 mb-3">New Clients</h4>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Number of Clients: <span className="font-bold text-blue-600">{clientActivity?.newClients?.count || 0}</span></p>
                  <p className="text-sm text-gray-600">Services Availed: <span className="font-bold text-blue-600">{clientActivity?.newClients?.servicesAvailed || 0}</span></p>
                  <p className="text-sm text-gray-600">Total Revenue: <span className="font-bold text-blue-600">₹{clientActivity?.newClients?.totalRevenue?.toFixed(2) || '0.00'}</span></p>
                </div>
              </div>
              <div className="bg-green-50 p-6 rounded-lg border-2 border-green-200">
                <h4 className="text-lg font-semibold text-green-700 mb-3">Old Clients</h4>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Number of Clients: <span className="font-bold text-green-600">{clientActivity?.oldClients?.count || 0}</span></p>
                  <p className="text-sm text-gray-600">Services Availed: <span className="font-bold text-green-600">{clientActivity?.oldClients?.servicesAvailed || 0}</span></p>
                  <p className="text-sm text-gray-600">Total Revenue: <span className="font-bold text-green-600">₹{clientActivity?.oldClients?.totalRevenue?.toFixed(2) || '0.00'}</span></p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6 shadow">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Client Ledger Search</h3>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                placeholder="Enter client name..."
                className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onKeyDown={(e) => e.key === 'Enter' && searchClientLedger()}
              />
              <button
                onClick={searchClientLedger}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
              >
                <Search className="w-4 h-4" /> Search
              </button>
            </div>

            {clientLedger && (
              <div>
                <div className="mb-4 p-4 bg-gray-50 rounded">
                  <h4 className="font-semibold text-lg mb-2">{clientLedger.customerName}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">Total Tasks</p>
                      <p className="font-bold text-lg">{clientLedger.summary.totalTasks}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Charges</p>
                      <p className="font-bold text-lg">₹{clientLedger.summary.totalCharges.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Payments</p>
                      <p className="font-bold text-lg text-green-600">₹{clientLedger.summary.totalPayments.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Unpaid</p>
                      <p className="font-bold text-lg text-red-600">₹{clientLedger.summary.totalUnpaid.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Task</th>
                        <th className="text-right px-3 py-2">Date</th>
                        <th className="text-right px-3 py-2">Charges</th>
                        <th className="text-right px-3 py-2">Paid</th>
                        <th className="text-right px-3 py-2">Unpaid</th>
                        <th className="text-right px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientLedger.tasks.map((task: any, i: number) => (
                        <tr key={i} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2">{task.taskName}</td>
                          <td className="text-right px-3 py-2">{task.date}</td>
                          <td className="text-right px-3 py-2">₹{task.finalCharges.toFixed(2)}</td>
                          <td className="text-right px-3 py-2 text-green-600">₹{task.amountCollected.toFixed(2)}</td>
                          <td className="text-right px-3 py-2 text-red-600">₹{task.unpaidAmount.toFixed(2)}</td>
                          <td className="text-right px-3 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              task.status === 'completed' ? 'bg-green-100 text-green-700' :
                              task.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {task.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsDashboard;
