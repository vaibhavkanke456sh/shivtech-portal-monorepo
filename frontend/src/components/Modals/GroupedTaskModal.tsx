import React, { useState, useEffect, useMemo } from 'react';
import { X, Layers, DollarSign, User, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Task, TaskGroup } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { apiFetch } from '../../utils/api';

interface GroupedTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string | null;
  authToken: string | null;
  onTasksUpdated: (updatedTasks: Task[]) => void;
}

const statusColors: Record<string, string> = {
  unassigned: 'bg-gray-100 text-gray-700',
  assigned: 'bg-blue-100 text-blue-700',
  ongoing: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  'service-delivered': 'bg-emerald-100 text-emerald-700'
};

const statusIcons: Record<string, React.ReactNode> = {
  unassigned: <AlertCircle size={12} />,
  assigned: <User size={12} />,
  ongoing: <Clock size={12} />,
  completed: <CheckCircle size={12} />,
  'service-delivered': <CheckCircle size={12} />
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

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
  costOfService: t.costOfService || 0,
  profit: t.profit || 0,
  paymentMode: t.paymentMode || 'cash',
  paymentRemarks: t.paymentRemarks || '',
  amountCollected: t.amountCollected || 0,
  unpaidAmount: t.unpaidAmount || 0,
  paymentHistory: t.paymentHistory || [],
  documentDetails: t.documentDetails || '',
  remarks: t.remarks || '',
  status: t.status || 'unassigned',
  groupId: t.groupId,
  isGrouped: t.isGrouped || true,
  createdByName: typeof t.createdBy === 'object' ? t.createdBy?.username || t.createdBy?.email || '' : '',
  updatedByName: typeof t.updatedBy === 'object' ? t.updatedBy?.username || t.updatedBy?.email || '' : ''
});

/** Preview how payment fills selected tasks in order */
function previewAllocation(selectedTasks: Task[], paymentAmount: number) {
  let remaining = round2(paymentAmount);
  const rows: {
    task: Task;
    apply: number;
    afterPaid: number;
    afterUnpaid: number;
    fullyPaid: boolean;
  }[] = [];

  for (const task of selectedTasks) {
    if (remaining <= 0.001) {
      rows.push({
        task,
        apply: 0,
        afterPaid: task.amountCollected,
        afterUnpaid: task.unpaidAmount,
        fullyPaid: task.unpaidAmount <= 0
      });
      continue;
    }
    const unpaid = round2(Math.max(0, task.unpaidAmount));
    if (unpaid <= 0) {
      rows.push({
        task,
        apply: 0,
        afterPaid: task.amountCollected,
        afterUnpaid: 0,
        fullyPaid: true
      });
      continue;
    }
    const apply = round2(Math.min(unpaid, remaining));
    const afterPaid = round2(task.amountCollected + apply);
    const afterUnpaid = round2(Math.max(task.finalCharges - afterPaid, 0));
    rows.push({
      task,
      apply,
      afterPaid,
      afterUnpaid,
      fullyPaid: afterUnpaid <= 0.001
    });
    remaining = round2(remaining - apply);
  }

  return { rows, leftover: remaining };
}

const GroupedTaskModal: React.FC<GroupedTaskModalProps> = ({
  isOpen,
  onClose,
  groupId,
  authToken,
  onTasksUpdated
}) => {
  const [group, setGroup] = useState<TaskGroup | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'shop-qr' | 'personal-qr' | 'other'>('cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  /** Ordered selection: first ticked is filled first */
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const unpaidTasks = useMemo(
    () => tasks.filter((t) => (t.unpaidAmount || 0) > 0.001),
    [tasks]
  );

  const selectedTasksInOrder = useMemo(() => {
    const map = new Map(tasks.map((t) => [t.id, t]));
    return selectedTaskIds.map((id) => map.get(id)).filter(Boolean) as Task[];
  }, [selectedTaskIds, tasks]);

  const allocationPreview = useMemo(
    () => previewAllocation(selectedTasksInOrder, paymentAmount),
    [selectedTasksInOrder, paymentAmount]
  );

  const fetchGroupData = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/data/task-groups/${groupId}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        const g = json.data.group;
        setGroup({
          id: g._id,
          customerName: g.customerName,
          customerType: g.customerType,
          documentDetails: g.documentDetails || '',
          totalAmount: g.totalAmount || 0,
          totalPaid: g.totalPaid || 0,
          remainingAmount: g.remainingAmount || 0,
          paymentMode: g.paymentMode || 'cash',
          paymentNotes: g.paymentNotes || '',
          paymentHistory: g.paymentHistory || [],
          createdAt: g.createdAt,
          updatedAt: g.updatedAt
        });
        const mappedTasks: Task[] = (json.data.tasks || []).map(mapTask);
        setTasks(mappedTasks);
        // Keep only still-unpaid selections
        setSelectedTaskIds((prev) =>
          prev.filter((id) => mappedTasks.some((t) => t.id === id && t.unpaidAmount > 0.001))
        );
        if (mappedTasks.length) {
          onTasksUpdated(mappedTasks);
        }
      }
      // eslint-disable-next-line no-empty
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && groupId) {
      setPaymentAmount(0);
      setPaymentRemarks('');
      setPaymentError(null);
      setPaymentSuccess(null);
      setSelectedTaskIds([]);
      fetchGroupData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, groupId]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      if (prev.includes(taskId)) {
        return prev.filter((id) => id !== taskId);
      }
      return [...prev, taskId];
    });
    setPaymentError(null);
  };

  const selectAllUnpaid = () => {
    setSelectedTaskIds(unpaidTasks.map((t) => t.id));
    setPaymentError(null);
  };

  const clearSelection = () => {
    setSelectedTaskIds([]);
    setPaymentError(null);
  };

  const handleAddGroupPayment = async () => {
    if (!groupId || paymentAmount <= 0) return;

    if (selectedTaskIds.length === 0) {
      setPaymentError('Select at least one task to apply this payment to.');
      return;
    }

    if (allocationPreview.leftover > 0.01) {
      setPaymentError(
        `${formatCurrency(allocationPreview.leftover)} still left after selected tasks. Tick more tasks to use the remaining amount.`
      );
      return;
    }

    if (allocationPreview.rows.every((r) => r.apply <= 0)) {
      setPaymentError('Selected tasks have no unpaid balance. Choose other unpaid tasks.');
      return;
    }

    setSubmittingPayment(true);
    setPaymentError(null);
    setPaymentSuccess(null);
    try {
      const res = await apiFetch(`/api/data/task-groups/${groupId}/add-payment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          receivedAmount: paymentAmount,
          paymentMode,
          paymentRemarks,
          // Order matters: fill first selected fully, then next, etc.
          taskIds: selectedTaskIds
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const leftoverMsg =
          json?.data?.leftover != null
            ? ` ${formatCurrency(json.data.leftover)} still unallocated — tick more tasks.`
            : '';
        setPaymentError((json.message || 'Failed to add payment') + leftoverMsg);
      } else {
        setPaymentSuccess(json.message || 'Payment added successfully');
        setPaymentAmount(0);
        setPaymentRemarks('');
        setSelectedTaskIds([]);
        await fetchGroupData();
        if (json.data?.tasks) {
          onTasksUpdated(json.data.tasks.map(mapTask));
        }
      }
    } catch {
      setPaymentError('Network error. Please try again.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b bg-purple-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Layers size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-purple-900">Grouped Tasks Overview</h2>
              {group && <p className="text-sm text-purple-600">Customer: {group.customerName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading group data...</div>
        ) : group ? (
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-xl border">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Group ID</p>
                <p className="text-sm font-mono text-gray-700 truncate">{group.id.slice(-8).toUpperCase()}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Services</p>
                <p className="text-2xl font-bold text-gray-800">{tasks.length}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Total Amount</p>
                <p className="text-xl font-bold text-blue-800">{formatCurrency(group.totalAmount)}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-xs text-green-500 uppercase tracking-wide mb-1">Total Paid</p>
                <p className="text-xl font-bold text-green-800">{formatCurrency(group.totalPaid)}</p>
              </div>
              <div
                className={`p-4 rounded-xl border col-span-2 md:col-span-2 ${
                  group.remainingAmount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
                }`}
              >
                <p
                  className={`text-xs uppercase tracking-wide mb-1 ${
                    group.remainingAmount > 0 ? 'text-red-500' : 'text-green-500'
                  }`}
                >
                  Remaining Balance
                </p>
                <p
                  className={`text-2xl font-bold ${
                    group.remainingAmount > 0 ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  {formatCurrency(group.remainingAmount)}
                </p>
                {group.remainingAmount === 0 && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle size={12} /> Fully Paid
                  </p>
                )}
              </div>
              {group.documentDetails && (
                <div className="p-4 bg-gray-50 rounded-xl border col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Documents Location</p>
                  <p className="text-sm text-gray-700">{group.documentDetails}</p>
                </div>
              )}
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Layers size={16} />
                Linked Tasks ({tasks.length})
              </h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-gray-500">{task.serialNo}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{task.taskName}</p>
                          <p className="text-xs text-gray-500">{formatDate(task.date)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium w-fit ${
                              statusColors[task.status] || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {statusIcons[task.status]}
                            {task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('-', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {task.assignedTo || <span className="text-gray-400 italic">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {formatCurrency(task.finalCharges)}
                        </td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">
                          {formatCurrency(task.amountCollected)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              task.unpaidAmount > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'
                            }
                          >
                            {formatCurrency(task.unpaidAmount)}
                            {task.unpaidAmount <= 0 && (
                              <span className="ml-1 text-xs">(Paid)</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-gray-700">
                        Totals
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800">
                        {formatCurrency(group.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-700">
                        {formatCurrency(group.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {formatCurrency(group.remainingAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {group.remainingAmount > 0 && (
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-amber-900 flex items-center gap-2 mb-1">
                    <DollarSign size={18} />
                    Collect Group Payment
                  </h3>
                  <p className="text-sm text-amber-800">
                    Enter amount received, then <strong>tick which task(s)</strong> it should go to.
                    Money fills the first ticked task until Final Charges = Paid (then that task leaves
                    Unpaid). If amount is larger, tick the next task(s) for the rest.
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Group remaining: <strong>{formatCurrency(group.remainingAmount)}</strong>
                  </p>
                </div>

                {paymentError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {paymentError}
                  </div>
                )}
                {paymentSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                    {paymentSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-amber-800 mb-1">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                    >
                      <option value="cash">Cash</option>
                      <option value="shop-qr">Shop QR</option>
                      <option value="personal-qr">Personal QR (Vaibhav)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-800 mb-1">
                      Amount Received (max: {formatCurrency(group.remainingAmount)})
                    </label>
                    <input
                      type="number"
                      value={paymentAmount || ''}
                      onChange={(e) => {
                        setPaymentAmount(Number(e.target.value) || 0);
                        setPaymentError(null);
                      }}
                      min="0"
                      max={group.remainingAmount}
                      step="0.01"
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-800 mb-1">Payment Remarks</label>
                    <input
                      type="text"
                      value={paymentRemarks}
                      onChange={(e) => setPaymentRemarks(e.target.value)}
                      placeholder="Optional note..."
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>
                </div>

                {/* Task selection */}
                <div className="bg-white rounded-xl border border-amber-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h4 className="text-sm font-semibold text-gray-800">
                      Apply payment to which tasks? *
                    </h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllUnpaid}
                        className="text-xs px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 hover:bg-amber-200"
                      >
                        Select all unpaid
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Tick order = fill order. First selected task is paid first until complete, then the
                    next ticked task, and so on.
                  </p>

                  {unpaidTasks.length === 0 ? (
                    <p className="text-sm text-green-700">All tasks in this group are fully paid.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {unpaidTasks.map((task) => {
                        const selected = selectedTaskIds.includes(task.id);
                        const order = selected ? selectedTaskIds.indexOf(task.id) + 1 : null;
                        const previewRow = allocationPreview.rows.find((r) => r.task.id === task.id);

                        return (
                          <label
                            key={task.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selected
                                ? 'border-amber-400 bg-amber-50'
                                : 'border-gray-200 hover:border-amber-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleTask(task.id)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {order != null && (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                                    {order}
                                  </span>
                                )}
                                <span className="font-medium text-gray-900 text-sm">{task.taskName}</span>
                                <span className="font-mono text-xs text-gray-400">{task.serialNo}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-x-3">
                                <span>Final: {formatCurrency(task.finalCharges)}</span>
                                <span className="text-green-700">Paid: {formatCurrency(task.amountCollected)}</span>
                                <span className="text-red-600">Unpaid: {formatCurrency(task.unpaidAmount)}</span>
                              </div>
                              {selected && paymentAmount > 0 && previewRow && previewRow.apply > 0 && (
                                <div className="mt-1.5 text-xs">
                                  <span className="text-amber-900 font-medium">
                                    Will apply {formatCurrency(previewRow.apply)}
                                  </span>
                                  {previewRow.fullyPaid ? (
                                    <span className="ml-2 text-green-700 font-semibold">
                                      → Fully paid (removed from Unpaid)
                                    </span>
                                  ) : (
                                    <span className="ml-2 text-amber-700">
                                      → Still unpaid {formatCurrency(previewRow.afterUnpaid)}
                                    </span>
                                  )}
                                </div>
                              )}
                              {selected && paymentAmount > 0 && previewRow && previewRow.apply <= 0 && (
                                <div className="mt-1.5 text-xs text-gray-400">
                                  No money left for this task (earlier selections used the full amount)
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Allocation summary */}
                {paymentAmount > 0 && selectedTaskIds.length > 0 && (
                  <div className="bg-white rounded-lg border border-amber-200 p-3 text-sm">
                    <p className="font-medium text-gray-800 mb-2">Allocation preview</p>
                    <ul className="space-y-1 text-xs text-gray-700">
                      {allocationPreview.rows
                        .filter((r) => r.apply > 0)
                        .map((r) => (
                          <li key={r.task.id} className="flex justify-between gap-2">
                            <span>
                              {r.task.taskName}
                              {r.fullyPaid ? ' ✓ paid' : ''}
                            </span>
                            <span className="font-semibold text-amber-900">{formatCurrency(r.apply)}</span>
                          </li>
                        ))}
                    </ul>
                    {allocationPreview.leftover > 0.01 ? (
                      <p className="mt-2 text-red-600 font-medium text-xs">
                        Unallocated: {formatCurrency(allocationPreview.leftover)} — tick more tasks.
                      </p>
                    ) : (
                      <p className="mt-2 text-green-700 text-xs font-medium">
                        Full amount is allocated to the selected task(s).
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleAddGroupPayment}
                  disabled={
                    submittingPayment ||
                    paymentAmount <= 0 ||
                    paymentAmount > group.remainingAmount ||
                    selectedTaskIds.length === 0 ||
                    allocationPreview.leftover > 0.01
                  }
                  className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <DollarSign size={16} />
                  {submittingPayment ? 'Processing...' : 'Apply Payment to Selected Tasks'}
                </button>
              </div>
            )}

            {group.paymentHistory && group.paymentHistory.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-gray-700 mb-3">Group Payment History</h3>
                <div className="space-y-2">
                  {group.paymentHistory.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                    >
                      <div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            entry.isInitialPayment
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {entry.isInitialPayment ? 'Initial' : 'Additional'}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">{entry.paymentMode}</span>
                        {entry.paymentRemarks && (
                          <span className="ml-2 text-xs text-gray-400">— {entry.paymentRemarks}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-700">{formatCurrency(entry.amount)}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(entry.paidAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">Group not found.</div>
        )}
      </div>
    </div>
  );
};

export default GroupedTaskModal;
