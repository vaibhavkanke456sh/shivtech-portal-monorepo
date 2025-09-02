import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';

type DeletedTask = {
  _id: string;
  taskName: string;
  customerName: string;
  status: string;
  deletedAt?: string | null;
};

interface Props { token: string; }

const DeletedTaskList: React.FC<Props> = ({ token }) => {
  const [tasks, setTasks] = useState<DeletedTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await apiFetch('/api/data/tasks-deleted', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to load deleted tasks');
        setTasks(json.data.tasks || []);
      } catch (e: unknown) {
        const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message?: string }).message || '') : '';
        setError(msg || 'Failed to load deleted tasks');
      }
    })();
  }, [token]);

  const handleRestore = async (taskId: string) => {
    try {
      setRestoring(taskId);
      setError(null);
      // optimistic UI: remove from list immediately
      setTasks(prev => prev.filter(t => t._id !== taskId));
      let res = await apiFetch(`/api/data/tasks/${taskId}/restore`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (res.status === 404) {
        // Fallback for older backend: use generic update route to clear deletion flags
        res = await apiFetch(`/api/data/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ isDeleted: false, deletedAt: null })
        });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || 'Failed to restore task');
    } catch (e: unknown) {
      const message = typeof e === 'object' && e && 'message' in e ? String((e as { message?: string }).message || '') : '';
      setError(message);
      // reload list on error
      try {
        const res = await apiFetch('/api/data/tasks-deleted', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (json?.success) setTasks(json.data.tasks || []);
      } catch (reloadError: unknown) {
        const reloadMsg = typeof reloadError === 'object' && reloadError && 'message' in reloadError ? String((reloadError as { message?: string }).message || '') : '';
        setError(reloadMsg);
      }
    } finally {
      setRestoring(null);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (!fromDate && !toDate) return true;
    const d = t.deletedAt ? new Date(t.deletedAt) : null;
    if (!d) return false;
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0,0,0,0);
      if (d < start) return false;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23,59,59,999);
      if (d > end) return false;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Deleted Tasks</h2>
          <p className="text-sm text-gray-600">{filteredTasks.length} tasks</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          </div>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }} className="px-3 py-1 text-sm border rounded">Clear</button>
          )}
        </div>
      </div>
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Task</th>
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Deleted At</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.map(t => (
            <tr key={t._id} className="hover:bg-gray-50">
              <td className="px-3 py-2">{t.taskName}</td>
              <td className="px-3 py-2">{t.customerName}</td>
              <td className="px-3 py-2">{t.status}</td>
              <td className="px-3 py-2">{t.deletedAt ? new Date(t.deletedAt).toLocaleString() : '-'}</td>
              <td className="px-3 py-2">
                <button
                  onClick={() => handleRestore(t._id)}
                  disabled={restoring === t._id}
                  className="px-3 py-1 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {restoring === t._id ? 'Restoring...' : 'Restore'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredTasks.length === 0 && <div className="text-gray-500 text-sm mt-3">No deleted tasks.</div>}
    </div>
  );
};

export default DeletedTaskList;


