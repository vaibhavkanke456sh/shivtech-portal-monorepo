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
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface Props { token: string; role: 'user' | 'admin' | 'developer'; }

const ReportsDashboard: React.FC<Props> = ({ token, role }) => {
  const [start, setStart] = useState<string>(() => new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0,10));
  const [end, setEnd] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taskSummary, setTaskSummary] = useState<any>(null);
  const [profitExpenses, setProfitExpenses] = useState<any>(null);
  const [salesRanking, setSalesRanking] = useState<any>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchAll = async () => {
    try {
      setLoading(true); setError(null);
      const qs = `?start=${start}&end=${end}`;
      const [tRes, peRes, sRes] = await Promise.all([
        apiFetch(`/api/reports/tasks-summary${qs}`, { headers }),
        apiFetch(`/api/reports/profit-expenses${qs}`, { headers }),
        apiFetch(`/api/reports/sales-ranking${qs}`, { headers })
      ]);
      const [t, pe, s] = await Promise.all([tRes.json(), peRes.json(), sRes.json()]);
      if (!tRes.ok || !t?.success) throw new Error(t?.message || 'Tasks summary failed');
      if (!peRes.ok || !pe?.success) throw new Error(pe?.message || 'Profit & expenses failed');
      if (!sRes.ok || !s?.success) throw new Error(s?.message || 'Sales ranking failed');
      setTaskSummary(t.data);
      setProfitExpenses(pe.data);
      setSalesRanking(s.data);
    } catch (e:any) {
      setError(e.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [start, end]);

  // Heartbeat every 15 minutes
  useEffect(() => {
    if (role !== 'admin' && role !== 'developer') return;
    const send = () => {
      apiFetch('/api/reports/heartbeat', { method: 'POST', headers });
    };
    send();
    const id = setInterval(send, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [headers, role]);

  if (role !== 'admin' && role !== 'developer') {
    return <div className="p-6"><div className="text-red-600">Access denied. Reports are for Admins and Web Developers.</div></div>;
  }

  const pieData = useMemo(() => ({
    labels: ['New', 'Ongoing', 'Unassigned', 'Assigned', 'Completed'],
    datasets: [{
      label: 'Tasks',
      data: taskSummary ? [taskSummary.newTasks, taskSummary.ongoing, taskSummary.unassigned, taskSummary.assigned, taskSummary.completed] : [0,0,0,0,0],
      backgroundColor: ['#6366f1','#f59e0b','#ef4444','#3b82f6','#10b981']
    }]
  }), [taskSummary]);

  const pieOptions: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  }), []);

  const salesLabels = useMemo(() => (salesRanking?.byDepartment || []).map((d:any) => d._id), [salesRanking]);
  const salesValues = useMemo(() => (salesRanking?.byDepartment || []).map((d:any) => d.total), [salesRanking]);
  const salesPie = useMemo(() => ({ labels: salesLabels, datasets: [{ data: salesValues, backgroundColor: ['#06b6d4','#f97316','#84cc16','#a78bfa','#f43f5e','#22c55e'] }] }), [salesLabels, salesValues]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium">Start</label>
          <input type="date" value={start} onChange={e=>setStart(e.target.value)} className="px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">End</label>
          <input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="px-3 py-2 border rounded" />
        </div>
        <button onClick={fetchAll} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Refresh</button>
        {loading && <span className="text-sm text-gray-500">Loading…</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-2">Task Summary</h3>
          <div style={{ height: 260 }}>
            <Pie data={pieData} options={pieOptions} />
          </div>
          {taskSummary && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>New: <b>{taskSummary.newTasks}</b></div>
              <div>Ongoing: <b>{taskSummary.ongoing}</b></div>
              <div>Unassigned: <b>{taskSummary.unassigned}</b></div>
              <div>Assigned: <b>{taskSummary.assigned}</b></div>
              <div>Completed: <b>{taskSummary.completed}</b></div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-2">Sales by Department</h3>
          <Pie data={salesPie} />
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-2">Profit & Expenses</h3>
        {profitExpenses ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-emerald-50 rounded">Total Profit: <b>₹{profitExpenses.totalProfit.toFixed(2)}</b></div>
            <div className="p-3 bg-rose-50 rounded">Total Expenses: <b>₹{profitExpenses.totalExpenses.toFixed(2)}</b></div>
            <div className="p-3 bg-indigo-50 rounded">Top Dept: <b>{(salesRanking?.byDepartment?.[0]?._id) || '—'}</b></div>
          </div>
        ) : <div className="text-sm text-gray-500">No data</div>}
      </div>
    </div>
  );
};

export default ReportsDashboard;


