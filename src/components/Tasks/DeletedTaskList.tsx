import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';

interface Props { token: string; }

const DeletedTaskList: React.FC<Props> = ({ token }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      } catch (e:any) {
        setError(e.message || 'Failed to load deleted tasks');
      }
    })();
  }, [token]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-4">Deleted Tasks</h2>
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Task</th>
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Deleted At</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t._id} className="hover:bg-gray-50">
              <td className="px-3 py-2">{t.taskName}</td>
              <td className="px-3 py-2">{t.customerName}</td>
              <td className="px-3 py-2">{t.status}</td>
              <td className="px-3 py-2">{t.deletedAt ? new Date(t.deletedAt).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <div className="text-gray-500 text-sm mt-3">No deleted tasks.</div>}
    </div>
  );
};

export default DeletedTaskList;


