import React, { useState, useEffect, useMemo } from 'react';
import { X, Layers, DollarSign, User, CheckCircle, Clock, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { Task, TaskGroup, PaymentHistoryEntry } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { apiFetch } from '../../utils/api';
import EditPaymentEntryModal, { PaymentEntryEditPayload } from './EditPaymentEntryModal';

interface GroupedTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string | null;
  authToken: string | null;
  onTasksUpdated: (updatedTasks: Task[]) => void;
  /** Credit dashboard cash/QR only for real money received (not discount). */
  onCashReceived?: (amount: number, paymentMode: string) => void;
  onEditPaymentEntry?: (
    taskId: string,
    entryId: string,
    updates: PaymentEntryEditPayload
  ) => Promise<void>;
  onDeletePaymentEntry?: (taskId: string, entryId: string) => Promise<boolean | void>;
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

/** Bill before any discount on this task */
const originalAmountOf = (task: Task) =>
  round2((Number(task.finalCharges) || 0) + (Number(task.discountAmount) || 0));

/** Bill after discount (= finalCharges) */
const afterDiscountOf = (task: Task) => round2(Number(task.finalCharges) || 0);

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
  discountAmount: t.discountAmount || 0,
  paymentHistory: (t.paymentHistory || []).map((h: any) => ({
    id: h._id ? String(h._id) : h.id,
    amount: h.amount || 0,
    paymentMode: h.paymentMode || 'cash',
    paymentRemarks: h.paymentRemarks || '',
    paidAt: h.paidAt || '',
    isInitialPayment: !!h.isInitialPayment
  })),
  documentDetails: t.documentDetails || '',
  remarks: t.remarks || '',
  status: t.status || 'unassigned',
  groupId: t.groupId,
  isGrouped: t.isGrouped || true,
  createdByName: typeof t.createdBy === 'object' ? t.createdBy?.username || t.createdBy?.email || '' : '',
  updatedByName: typeof t.updatedBy === 'object' ? t.updatedBy?.username || t.updatedBy?.email || '' : ''
});

/**
 * Preview: apply per-task discount amounts first, then fill cash on selected tasks (order).
 * discountByTaskId = { [taskId]: amount } entered on Linked Tasks rows.
 */
function previewAllocation(
  allTasks: Task[],
  cashTaskIdsInOrder: string[],
  paymentAmount: number,
  discountByTaskId: Record<string, number>
) {
  let remCash = round2(paymentAmount);
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  type Work = {
    task: Task;
    unpaid: number;
    finalCharges: number;
    amountCollected: number;
    discountApply: number;
    cashApply: number;
  };
  const byId = new Map<string, Work>();

  const ensure = (task: Task): Work => {
    let w = byId.get(task.id);
    if (!w) {
      w = {
        task,
        unpaid: round2(Math.max(0, task.unpaidAmount)),
        finalCharges: round2(task.finalCharges),
        amountCollected: round2(task.amountCollected || 0),
        discountApply: 0,
        cashApply: 0
      };
      byId.set(task.id, w);
    }
    return w;
  };

  // 1) Exact discount per task (from Linked Tasks table)
  let totalDiscount = 0;
  let discountOverflow = 0;
  for (const [taskId, raw] of Object.entries(discountByTaskId)) {
    const want = round2(raw);
    if (want <= 0) continue;
    const task = taskMap.get(taskId);
    if (!task) continue;
    const w = ensure(task);
    const d = round2(Math.min(w.unpaid, want));
    discountOverflow = round2(discountOverflow + Math.max(0, want - d));
    if (d <= 0) continue;
    w.discountApply = d;
    w.finalCharges = round2(Math.max(w.finalCharges - d, 0));
    w.unpaid = round2(Math.max(w.finalCharges - w.amountCollected, 0));
    totalDiscount = round2(totalDiscount + d);
  }

  // 2) Cash fill on selected tasks (order)
  for (const id of cashTaskIdsInOrder) {
    if (remCash <= 0.001) break;
    const task = taskMap.get(id);
    if (!task) continue;
    const w = ensure(task);
    if (w.unpaid <= 0) continue;
    const add = round2(Math.min(w.unpaid, remCash));
    if (add <= 0) continue;
    w.cashApply = add;
    w.amountCollected = round2(w.amountCollected + add);
    w.unpaid = round2(Math.max(w.finalCharges - w.amountCollected, 0));
    remCash = round2(remCash - add);
  }

  const rows = Array.from(byId.values()).map((w) => {
    const afterPaid = round2(w.amountCollected);
    const afterUnpaid = round2(Math.max(w.finalCharges - afterPaid, 0));
    return {
      task: w.task,
      apply: w.cashApply,
      discountApply: w.discountApply,
      afterPaid,
      afterUnpaid,
      fullyPaid: afterUnpaid <= 0.001
    };
  });

  return {
    rows,
    leftover: remCash,
    leftoverDiscount: discountOverflow,
    totalCash: round2(paymentAmount - remCash),
    totalDiscount
  };
}

const GroupedTaskModal: React.FC<GroupedTaskModalProps> = ({
  isOpen,
  onClose,
  groupId,
  authToken,
  onTasksUpdated,
  onCashReceived,
  onEditPaymentEntry,
  onDeletePaymentEntry
}) => {
  const [group, setGroup] = useState<TaskGroup | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<{
    task: Task;
    entry: PaymentHistoryEntry;
  } | null>(null);
  const [historyBusyId, setHistoryBusyId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'shop-qr' | 'personal-qr' | 'other'>('cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  /** Cash targets (order = fill order) — checked in Linked Tasks table */
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  /** Per-task discount ₹ entered in Linked Tasks table */
  const [rowDiscount, setRowDiscount] = useState<Record<string, number>>({});

  const unpaidTasks = useMemo(
    () => tasks.filter((t) => (t.unpaidAmount || 0) > 0.001),
    [tasks]
  );

  const totalOriginalAmount = useMemo(
    () => round2(tasks.reduce((s, t) => s + originalAmountOf(t), 0)),
    [tasks]
  );

  const totalAfterDiscount = useMemo(
    () => round2(tasks.reduce((s, t) => s + afterDiscountOf(t), 0)),
    [tasks]
  );

  const totalDiscountGiven = useMemo(
    () => round2(tasks.reduce((s, t) => s + (Number(t.discountAmount) || 0), 0)),
    [tasks]
  );

  /** Always derive remaining from tasks so discount/cash edits update UI immediately */
  const remainingBalance = useMemo(
    () =>
      round2(tasks.reduce((s, t) => s + Math.max(0, Number(t.unpaidAmount) || 0), 0)),
    [tasks]
  );

  const totalPaidFromTasks = useMemo(
    () => round2(tasks.reduce((s, t) => s + (Number(t.amountCollected) || 0), 0)),
    [tasks]
  );

  const totalRowDiscount = useMemo(
    () => round2(Object.values(rowDiscount).reduce((s, n) => s + (Number(n) || 0), 0)),
    [rowDiscount]
  );

  const allocationPreview = useMemo(
    () => previewAllocation(tasks, selectedTaskIds, paymentAmount, rowDiscount),
    [tasks, selectedTaskIds, paymentAmount, rowDiscount]
  );

  const maxCashAfterDiscount = round2(
    Math.max(remainingBalance - totalRowDiscount, 0)
  );

  const isGroupFullyPaid = remainingBalance <= 0.01;

  // Keep cash within remaining after table discounts change
  useEffect(() => {
    if (paymentAmount > maxCashAfterDiscount + 0.001) {
      setPaymentAmount(maxCashAfterDiscount);
    }
  }, [maxCashAfterDiscount, paymentAmount]);

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
        const mappedTasks: Task[] = (json.data.tasks || []).map(mapTask);
        // Prefer remaining computed from tasks if API field is stale
        const unpaidSum = round2(
          mappedTasks.reduce((s, t) => s + Math.max(0, Number(t.unpaidAmount) || 0), 0)
        );
        setGroup({
          id: g._id,
          customerName: g.customerName,
          customerType: g.customerType,
          documentDetails: g.documentDetails || '',
          totalAmount: g.totalAmount || 0,
          totalPaid: g.totalPaid || 0,
          remainingAmount:
            Math.abs((g.remainingAmount || 0) - unpaidSum) > 0.02
              ? unpaidSum
              : g.remainingAmount || 0,
          discountAmount: g.discountAmount || 0,
          paymentMode: g.paymentMode || 'cash',
          paymentNotes: g.paymentNotes || '',
          paymentHistory: (g.paymentHistory || []).map((h: any) => ({
            id: h._id ? String(h._id) : h.id,
            amount: h.amount || 0,
            paymentMode: h.paymentMode || 'cash',
            paymentRemarks: h.paymentRemarks || '',
            paidAt: h.paidAt || '',
            isInitialPayment: !!h.isInitialPayment
          })),
          createdAt: g.createdAt,
          updatedAt: g.updatedAt
        });
        setTasks(mappedTasks);
        // Keep only still-unpaid selections / discounts
        setSelectedTaskIds((prev) =>
          prev.filter((id) => mappedTasks.some((t) => t.id === id && t.unpaidAmount > 0.001))
        );
        setRowDiscount((prev) => {
          const next: Record<string, number> = {};
          for (const [id, amt] of Object.entries(prev)) {
            const t = mappedTasks.find((x) => x.id === id);
            if (t && t.unpaidAmount > 0.001 && (amt || 0) > 0) {
              next[id] = Math.min(round2(amt), round2(t.unpaidAmount));
            }
          }
          return next;
        });
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
      setRowDiscount({});
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

  const setTaskDiscount = (taskId: string, unpaid: number, raw: number) => {
    const max = round2(Math.max(0, unpaid));
    const val = round2(Math.min(Math.max(raw || 0, 0), max));
    setRowDiscount((prev) => {
      const next = { ...prev };
      if (val <= 0) delete next[taskId];
      else next[taskId] = val;
      return next;
    });
    // Keep cash within new max after this discount total is recomputed on next render —
    // clamp here using approximate total
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
    if (!groupId) return;

    const cash = round2(paymentAmount);
    const disc = totalRowDiscount;
    const discountAllocations = Object.entries(rowDiscount)
      .map(([taskId, amount]) => ({ taskId, amount: round2(amount) }))
      .filter((r) => r.amount > 0);

    if (cash <= 0 && disc <= 0) {
      setPaymentError('Enter cash received and/or type discount ₹ on a task row.');
      return;
    }

    if (cash > 0 && selectedTaskIds.length === 0) {
      setPaymentError('Tick Cash on the task(s) where money should go.');
      return;
    }

    if (group && cash + disc > remainingBalance + 0.001) {
      setPaymentError(
        `Cash + discount cannot exceed group remaining (${formatCurrency(remainingBalance)}).`
      );
      return;
    }

    if (allocationPreview.leftoverDiscount > 0.01) {
      setPaymentError(
        `Discount too high on a task (over its unpaid by ${formatCurrency(allocationPreview.leftoverDiscount)}).`
      );
      return;
    }

    if (allocationPreview.leftover > 0.01) {
      setPaymentError(
        `${formatCurrency(allocationPreview.leftover)} cash left over — tick more tasks under Cash.`
      );
      return;
    }

    if (allocationPreview.rows.every((r) => r.apply <= 0 && r.discountApply <= 0)) {
      setPaymentError('Nothing to apply. Tick Cash and/or enter Discount ₹ on unpaid tasks.');
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
          receivedAmount: cash,
          discountAmount: disc,
          paymentMode,
          paymentRemarks,
          taskIds: cash > 0 ? selectedTaskIds : [],
          discountAllocations
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
        if (cash > 0 && onCashReceived) {
          onCashReceived(cash, paymentMode);
        }
        setPaymentAmount(0);
        setPaymentRemarks('');
        setSelectedTaskIds([]);
        setRowDiscount({});
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
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  Amount (no discount)
                </p>
                <p className="text-xl font-bold text-slate-800">
                  {formatCurrency(totalOriginalAmount)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">
                  After Discount
                </p>
                <p className="text-xl font-bold text-blue-800">
                  {formatCurrency(totalAfterDiscount || group.totalAmount)}
                </p>
                {totalDiscountGiven > 0 && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    −{formatCurrency(totalDiscountGiven)} discount
                  </p>
                )}
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-xs text-green-500 uppercase tracking-wide mb-1">Total Paid</p>
                <p className="text-xl font-bold text-green-800">
                  {formatCurrency(totalPaidFromTasks || group.totalPaid)}
                </p>
              </div>
              <div
                className={`p-4 rounded-xl border ${
                  !isGroupFullyPaid ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
                }`}
              >
                <p
                  className={`text-xs uppercase tracking-wide mb-1 ${
                    !isGroupFullyPaid ? 'text-red-500' : 'text-green-500'
                  }`}
                >
                  Remaining Balance
                </p>
                <p
                  className={`text-2xl font-bold ${
                    !isGroupFullyPaid ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  {formatCurrency(remainingBalance)}
                </p>
                {isGroupFullyPaid && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle size={12} /> Fully Paid
                  </p>
                )}
              </div>
              {(totalDiscountGiven > 0 || (group.discountAmount || 0) > 0) && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 col-span-2 md:col-span-2">
                  <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">
                    Total Discount Given
                  </p>
                  <p className="text-xl font-bold text-amber-800">
                    −{formatCurrency(totalDiscountGiven || group.discountAmount || 0)}
                  </p>
                </div>
              )}
              {group.documentDetails && (
                <div className="p-4 bg-gray-50 rounded-xl border col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Documents Location</p>
                  <p className="text-sm text-gray-700">{group.documentDetails}</p>
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Layers size={16} />
                  Linked Tasks ({tasks.length})
                </h3>
                {!isGroupFullyPaid && unpaidTasks.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllUnpaid}
                      className="text-xs px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                    >
                      Select all unpaid for cash
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Clear cash
                    </button>
                  </div>
                )}
              </div>
              {!isGroupFullyPaid && (
                <p className="text-sm text-gray-600 mb-2">
                  Tick <strong>Cash</strong> where money goes. Type <strong>Discount ₹</strong> on
                  the task customer asked discount for (leave 0 if none).
                </p>
              )}
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {!isGroupFullyPaid && (
                        <th className="px-3 py-3 text-center text-xs font-medium text-emerald-700 uppercase w-16">
                          Cash
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                        Amount
                        <span className="block font-normal normal-case text-[10px] text-slate-400">
                          no discount
                        </span>
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-blue-700 uppercase">
                        After disc.
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-amber-700 uppercase">
                        Discount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                      {!isGroupFullyPaid && (
                        <th className="px-3 py-3 text-right text-xs font-medium text-amber-700 uppercase min-w-[7.5rem]">
                          Add disc. ₹
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tasks.map((task) => {
                      const unpaid = (task.unpaidAmount || 0) > 0.001;
                      const cashOn = selectedTaskIds.includes(task.id);
                      const cashOrder = cashOn ? selectedTaskIds.indexOf(task.id) + 1 : null;
                      const discVal = rowDiscount[task.id] || 0;
                      const previewRow = allocationPreview.rows.find((r) => r.task.id === task.id);
                      const origAmt = originalAmountOf(task);
                      const afterAmt = afterDiscountOf(task);
                      const discGiven = round2(Number(task.discountAmount) || 0);

                      return (
                        <tr
                          key={task.id}
                          className={
                            cashOn || discVal > 0
                              ? discVal > 0
                                ? 'bg-amber-50/70'
                                : 'bg-emerald-50/50'
                              : 'hover:bg-gray-50'
                          }
                        >
                          {!isGroupFullyPaid && (
                            <td className="px-3 py-3 text-center align-middle">
                              {unpaid ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <input
                                    type="checkbox"
                                    checked={cashOn}
                                    onChange={() => toggleTask(task.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    title="Apply cash to this task"
                                  />
                                  {cashOrder != null && (
                                    <span className="text-[10px] font-bold text-emerald-700">
                                      #{cashOrder}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs text-gray-500">{task.serialNo}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{task.taskName}</p>
                            <p className="text-xs text-gray-500">{formatDate(task.date)}</p>
                            {previewRow &&
                              (previewRow.discountApply > 0 || previewRow.apply > 0) && (
                                <p className="text-xs mt-1 space-x-2">
                                  {previewRow.discountApply > 0 && (
                                    <span className="text-amber-700 font-medium">
                                      −{formatCurrency(previewRow.discountApply)} disc
                                    </span>
                                  )}
                                  {previewRow.apply > 0 && (
                                    <span className="text-emerald-700 font-medium">
                                      +{formatCurrency(previewRow.apply)} cash
                                    </span>
                                  )}
                                  {previewRow.fullyPaid && (
                                    <span className="text-green-700 font-semibold">✓ paid</span>
                                  )}
                                </p>
                              )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium w-fit ${
                                statusColors[task.status] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {statusIcons[task.status]}
                              {task.status.charAt(0).toUpperCase() +
                                task.status.slice(1).replace('-', ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-slate-800">
                            {formatCurrency(origAmt)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-blue-800">
                            {formatCurrency(afterAmt)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-amber-700">
                            {discGiven > 0 ? `−${formatCurrency(discGiven)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-green-700 font-medium">
                            {formatCurrency(task.amountCollected)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={
                                task.unpaidAmount > 0
                                  ? 'text-red-600 font-medium'
                                  : 'text-green-600 font-medium'
                              }
                            >
                              {formatCurrency(task.unpaidAmount)}
                              {task.unpaidAmount <= 0 && (
                                <span className="ml-1 text-xs">(Paid)</span>
                              )}
                            </span>
                          </td>
                          {!isGroupFullyPaid && (
                            <td className="px-3 py-3 text-right align-middle">
                              {unpaid ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={task.unpaidAmount}
                                  step="0.01"
                                  value={discVal || ''}
                                  onChange={(e) =>
                                    setTaskDiscount(
                                      task.id,
                                      task.unpaidAmount,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  placeholder="0"
                                  className="w-24 ml-auto block px-2 py-1.5 text-right border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white text-amber-900 font-medium"
                                  title={`Discount on ${task.taskName} (max ${task.unpaidAmount})`}
                                />
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td
                        colSpan={!isGroupFullyPaid ? 4 : 3}
                        className="px-4 py-3 text-gray-700"
                      >
                        Totals
                      </td>
                      <td className="px-3 py-3 text-right text-slate-800">
                        {formatCurrency(totalOriginalAmount)}
                      </td>
                      <td className="px-3 py-3 text-right text-blue-800">
                        {formatCurrency(totalAfterDiscount)}
                      </td>
                      <td className="px-3 py-3 text-right text-amber-800">
                        {totalDiscountGiven > 0
                          ? `−${formatCurrency(totalDiscountGiven)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-green-700">
                        {formatCurrency(totalPaidFromTasks || group.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {formatCurrency(remainingBalance)}
                      </td>
                      {!isGroupFullyPaid && (
                        <td className="px-3 py-3 text-right text-amber-800">
                          {totalRowDiscount > 0
                            ? `−${formatCurrency(totalRowDiscount)}`
                            : '—'}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {!isGroupFullyPaid && (
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-amber-900 flex items-center gap-2 mb-1">
                    <DollarSign size={18} />
                    Collect Payment
                  </h3>
                  <p className="text-sm text-amber-800">
                    Use the table above: tick Cash, type Discount ₹ on the right task(s). Then enter
                    cash received here and Apply.
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Group remaining: <strong>{formatCurrency(remainingBalance)}</strong>
                    {totalRowDiscount > 0 && (
                      <>
                        {' '}
                        · Discount total:{' '}
                        <strong className="text-amber-900">
                          −{formatCurrency(totalRowDiscount)}
                        </strong>
                      </>
                    )}
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
                    <label className="block text-sm font-medium text-amber-800 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                      disabled={paymentAmount <= 0 && totalRowDiscount > 0}
                    >
                      <option value="cash">Cash</option>
                      <option value="shop-qr">Shop QR</option>
                      <option value="personal-qr">Personal QR (Vaibhav)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-800 mb-1">
                      Amount Received (max: {formatCurrency(maxCashAfterDiscount)})
                    </label>
                    <input
                      type="number"
                      value={paymentAmount || ''}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        setPaymentAmount(Math.min(v, maxCashAfterDiscount));
                        setPaymentError(null);
                      }}
                      min="0"
                      max={maxCashAfterDiscount}
                      step="0.01"
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                      placeholder="0"
                    />
                    {totalRowDiscount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentAmount(maxCashAfterDiscount);
                          setPaymentError(null);
                        }}
                        className="mt-1 text-xs font-medium text-amber-900 underline"
                      >
                        Fill remaining after discount ({formatCurrency(maxCashAfterDiscount)})
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-800 mb-1">
                      Remarks
                    </label>
                    <input
                      type="text"
                      value={paymentRemarks}
                      onChange={(e) => setPaymentRemarks(e.target.value)}
                      placeholder="Optional note..."
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>
                </div>

                {(paymentAmount > 0 || totalRowDiscount > 0) && (
                  <div className="bg-white rounded-lg border border-amber-200 p-3 text-sm">
                    <p className="font-medium text-gray-800 mb-1">Will apply</p>
                    <ul className="space-y-1 text-xs text-gray-700">
                      {allocationPreview.rows
                        .filter((r) => r.apply > 0 || r.discountApply > 0)
                        .map((r) => (
                          <li key={r.task.id} className="flex justify-between gap-2">
                            <span>
                              {r.task.taskName}
                              {r.fullyPaid ? ' ✓' : ''}
                            </span>
                            <span className="font-semibold text-right">
                              {r.discountApply > 0 && (
                                <span className="text-amber-700">
                                  −{formatCurrency(r.discountApply)}
                                </span>
                              )}
                              {r.discountApply > 0 && r.apply > 0 ? ' + ' : ''}
                              {r.apply > 0 && (
                                <span className="text-emerald-800">
                                  {formatCurrency(r.apply)} cash
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                    </ul>
                    {allocationPreview.leftover > 0.01 && (
                      <p className="mt-2 text-red-600 text-xs font-medium">
                        Cash left over: {formatCurrency(allocationPreview.leftover)} — tick more
                        Cash boxes.
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleAddGroupPayment}
                  disabled={
                    submittingPayment ||
                    (paymentAmount <= 0 && totalRowDiscount <= 0) ||
                    paymentAmount + totalRowDiscount > remainingBalance + 0.001 ||
                    (paymentAmount > 0 && selectedTaskIds.length === 0) ||
                    allocationPreview.leftover > 0.01 ||
                    allocationPreview.leftoverDiscount > 0.01
                  }
                  className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <DollarSign size={16} />
                  {submittingPayment
                    ? 'Processing...'
                    : totalRowDiscount > 0
                      ? 'Apply Payment + Discount'
                      : 'Apply Payment'}
                </button>
              </div>
            )}

            {/* Per-task cash/discount entries — edit / remove here */}
            {tasks.some((t) => (t.paymentHistory || []).length > 0) && (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-gray-700 mb-2">
                  Task Payment &amp; Discount History
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Edit or remove cash / discount entries for each service. Totals update
                  automatically.
                </p>
                <div className="space-y-4">
                  {tasks
                    .filter((t) => (t.paymentHistory || []).length > 0)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-gray-200 overflow-hidden bg-white"
                      >
                        <div className="px-4 py-2 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-medium text-gray-800 text-sm">
                              {task.taskName}
                            </span>
                            <span className="ml-2 font-mono text-xs text-gray-400">
                              {task.serialNo}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Paid {formatCurrency(task.amountCollected)}
                            {(task.discountAmount || 0) > 0 && (
                              <span className="text-amber-700 ml-2">
                                · Disc −{formatCurrency(task.discountAmount || 0)}
                              </span>
                            )}
                            <span
                              className={
                                task.unpaidAmount > 0
                                  ? 'text-red-600 ml-2'
                                  : 'text-green-600 ml-2'
                              }
                            >
                              · Unpaid {formatCurrency(task.unpaidAmount)}
                            </span>
                          </div>
                        </div>
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Date</th>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                              <th className="px-3 py-2 text-left">Mode</th>
                              <th className="px-3 py-2 text-left">Remarks</th>
                              {(onEditPaymentEntry || onDeletePaymentEntry) && (
                                <th className="px-3 py-2 text-right">Actions</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(task.paymentHistory || []).map((payment, idx) => {
                              const entryKey = payment.id || `${task.id}-${idx}`;
                              const busy = historyBusyId === entryKey;
                              return (
                                <tr key={entryKey} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-xs text-gray-600">
                                    {formatDate(payment.paidAt)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {payment.paymentMode === 'discount' ? (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">
                                        Discount
                                      </span>
                                    ) : payment.isInitialPayment ? (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                                        Initial
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                                        Payment
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className={`px-3 py-2 text-right font-medium ${
                                      payment.paymentMode === 'discount'
                                        ? 'text-amber-700'
                                        : 'text-gray-800'
                                    }`}
                                  >
                                    {payment.paymentMode === 'discount' ? '−' : ''}
                                    {formatCurrency(payment.amount)}
                                  </td>
                                  <td className="px-3 py-2 text-xs capitalize text-gray-600">
                                    {payment.paymentMode === 'discount'
                                      ? 'Discount'
                                      : payment.paymentMode === 'personal-qr'
                                        ? 'Personal QR'
                                        : payment.paymentMode.replace('-', ' ')}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-500">
                                    {payment.paymentRemarks || '—'}
                                  </td>
                                  {(onEditPaymentEntry || onDeletePaymentEntry) && (
                                    <td className="px-3 py-2 text-right">
                                      <div className="inline-flex gap-1">
                                        {onEditPaymentEntry && payment.id && (
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                              setEditingPayment({ task, entry: payment })
                                            }
                                            className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                                            title="Edit"
                                          >
                                            <Pencil size={14} />
                                          </button>
                                        )}
                                        {onDeletePaymentEntry && payment.id && (
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={async () => {
                                              const kind =
                                                payment.paymentMode === 'discount'
                                                  ? 'discount'
                                                  : 'payment';
                                              if (
                                                !window.confirm(
                                                  `Remove this ${kind} of ${formatCurrency(payment.amount)} from ${task.taskName}?`
                                                )
                                              ) {
                                                return;
                                              }
                                              setHistoryBusyId(entryKey);
                                              try {
                                                await onDeletePaymentEntry(
                                                  task.id,
                                                  payment.id!
                                                );
                                                await fetchGroupData();
                                              } catch (e: any) {
                                                alert(e?.message || 'Failed to remove');
                                              } finally {
                                                setHistoryBusyId(null);
                                              }
                                            }}
                                            className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40"
                                            title="Remove"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                </div>
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
                            entry.paymentMode === 'discount'
                              ? 'bg-amber-100 text-amber-800'
                              : entry.isInitialPayment
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {entry.paymentMode === 'discount'
                            ? 'Discount'
                            : entry.isInitialPayment
                              ? 'Initial'
                              : 'Additional'}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">{entry.paymentMode}</span>
                        {entry.paymentRemarks && (
                          <span className="ml-2 text-xs text-gray-400">— {entry.paymentRemarks}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold ${
                            entry.paymentMode === 'discount' ? 'text-amber-700' : 'text-green-700'
                          }`}
                        >
                          {entry.paymentMode === 'discount' ? '−' : ''}
                          {formatCurrency(entry.amount)}
                          {entry.paymentMode === 'discount' ? (
                            <span className="block text-[10px] font-normal text-amber-600">
                              (not cash — reduces bill)
                            </span>
                          ) : null}
                        </p>
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

      {onEditPaymentEntry && (
        <EditPaymentEntryModal
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          entry={editingPayment?.entry || null}
          taskLabel={
            editingPayment
              ? `${editingPayment.task.taskName} (${editingPayment.task.serialNo})`
              : undefined
          }
          cashCollected={editingPayment?.task.amountCollected || 0}
          finalCharges={editingPayment?.task.finalCharges || 0}
          onSave={async (updates) => {
            if (!editingPayment?.entry.id) {
              throw new Error('Missing entry id — refresh and try again');
            }
            await onEditPaymentEntry(
              editingPayment.task.id,
              editingPayment.entry.id,
              updates
            );
            await fetchGroupData();
          }}
        />
      )}
    </div>
  );
};

export default GroupedTaskModal;
