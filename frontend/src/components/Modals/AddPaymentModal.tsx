import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, Percent } from 'lucide-react';
import { Task } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    taskId: string,
    receivedAmount: number,
    paymentMode: string,
    paymentRemarks?: string,
    discountAmount?: number
  ) => void;
  task: Task | null;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  task
}) => {
  const [formData, setFormData] = useState({
    receivedAmount: 0,
    discountAmount: 0,
    applyDiscount: false,
    paymentMode: 'cash' as 'cash' | 'shop-qr' | 'personal-qr' | 'other',
    paymentRemarks: ''
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && task) {
      setFormData({
        receivedAmount: task.unpaidAmount,
        discountAmount: 0,
        applyDiscount: false,
        paymentMode: 'cash',
        paymentRemarks: ''
      });
      setError('');
    }
  }, [isOpen, task]);

  const unpaid = task ? round2(task.unpaidAmount) : 0;
  const discount = formData.applyDiscount ? round2(formData.discountAmount) : 0;
  const maxReceivable = round2(Math.max(unpaid - discount, 0));
  const remainingAfter = round2(Math.max(unpaid - discount - round2(formData.receivedAmount), 0));
  const newFinalCharges = task ? round2(Math.max(task.finalCharges - discount, 0)) : 0;

  // Keep received amount within max when discount changes
  useEffect(() => {
    if (!formData.applyDiscount) return;
    if (formData.receivedAmount > maxReceivable + 0.001) {
      setFormData((prev) => ({ ...prev, receivedAmount: maxReceivable }));
    }
  }, [formData.applyDiscount, formData.discountAmount, maxReceivable, formData.receivedAmount]);

  const summary = useMemo(
    () => ({
      discount,
      maxReceivable,
      remainingAfter,
      newFinalCharges
    }),
    [discount, maxReceivable, remainingAfter, newFinalCharges]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    const received = round2(formData.receivedAmount);
    const disc = formData.applyDiscount ? round2(formData.discountAmount) : 0;

    if (received <= 0 && disc <= 0) {
      setError('Enter a received amount and/or a discount greater than 0');
      return;
    }

    if (disc < 0) {
      setError('Discount cannot be negative');
      return;
    }

    if (disc > unpaid + 0.001) {
      setError(`Discount cannot exceed unpaid amount (${formatCurrency(unpaid)})`);
      return;
    }

    const maxRecv = round2(Math.max(unpaid - disc, 0));
    if (received > maxRecv + 0.001) {
      setError(
        disc > 0
          ? `After ${formatCurrency(disc)} discount, max receivable is ${formatCurrency(maxRecv)}`
          : `Received amount cannot be more than unpaid amount (${formatCurrency(unpaid)})`
      );
      return;
    }

    onSubmit(task.id, received, formData.paymentMode, formData.paymentRemarks || undefined, disc);
    onClose();
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="text-emerald-600" size={24} />
            Add Remaining Payment
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Task Details (Read-only) */}
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Task Details</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <div>
                <strong>Serial No:</strong> {task.serialNo}
              </div>
              <div>
                <strong>Date:</strong> {formatDate(task.date)}
              </div>
              <div>
                <strong>Service:</strong> {task.taskName}
              </div>
              <div>
                <strong>Customer:</strong> {task.customerName}
              </div>
              <div>
                <strong>Amount (no discount):</strong>{' '}
                {formatCurrency(
                  (Number(task.finalCharges) || 0) + (Number(task.discountAmount) || 0)
                )}
              </div>
              <div>
                <strong>After discount:</strong> {formatCurrency(task.finalCharges)}
              </div>
              {(task.discountAmount || 0) > 0 && (
                <div className="text-amber-700">
                  <strong>Discount given:</strong> −{formatCurrency(task.discountAmount || 0)}
                </div>
              )}
              <div>
                <strong>Already Paid:</strong> {formatCurrency(task.amountCollected)}
              </div>
              <div className="text-red-600">
                <strong>Unpaid Amount:</strong> {formatCurrency(task.unpaidAmount)}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Discount option */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.applyDiscount}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData((prev) => ({
                      ...prev,
                      applyDiscount: checked,
                      discountAmount: checked ? prev.discountAmount : 0,
                      // Default cash to full unpaid when turning discount off
                      receivedAmount: checked
                        ? Math.max(prev.receivedAmount, 0)
                        : unpaid
                    }));
                    setError('');
                  }}
                  className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <Percent size={16} className="text-amber-700" />
                <span className="text-sm font-medium text-amber-900">
                  Customer asked for discount
                </span>
              </label>

              {formData.applyDiscount && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-amber-900 mb-1">
                    Discount Amount *
                  </label>
                  <input
                    type="number"
                    value={formData.discountAmount || ''}
                    onChange={(e) => {
                      const d = parseFloat(e.target.value) || 0;
                      const clamped = Math.min(Math.max(d, 0), unpaid);
                      const maxRecv = round2(Math.max(unpaid - clamped, 0));
                      setFormData((prev) => ({
                        ...prev,
                        discountAmount: clamped,
                        // Auto-adjust cash so discount + cash clears remaining when possible
                        receivedAmount:
                          prev.receivedAmount > maxRecv ? maxRecv : prev.receivedAmount
                      }));
                      setError('');
                    }}
                    min="0"
                    max={unpaid}
                    step="0.01"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                    placeholder="Enter discount amount"
                  />
                  <p className="text-xs text-amber-800 mt-1">
                    Max discount: {formatCurrency(unpaid)}. Discount reduces final charges (not
                    added to cash/QR balances).
                  </p>
                  {discount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          receivedAmount: maxReceivable
                        }));
                        setError('');
                      }}
                      className="mt-2 text-xs font-medium text-amber-900 underline hover:text-amber-700"
                    >
                      Set cash to full remaining after discount (
                      {formatCurrency(summary.maxReceivable)})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Received Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Received Amount {discount > 0 ? '(cash/QR after discount)' : '*'}
              </label>
              <input
                type="number"
                value={formData.receivedAmount || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    receivedAmount: parseFloat(e.target.value) || 0
                  }))
                }
                min="0"
                max={maxReceivable}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter received amount"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {formatCurrency(maxReceivable)}
                {discount > 0 ? ' (after discount)' : ''}
              </p>
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
              <select
                value={formData.paymentMode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    paymentMode: e.target.value as typeof prev.paymentMode
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={round2(formData.receivedAmount) <= 0}
              >
                <option value="cash">Cash</option>
                <option value="shop-qr">Shop QR</option>
                <option value="personal-qr">Personal QR (Vaibhav)</option>
              </select>
              {round2(formData.receivedAmount) <= 0 && discount > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Discount only — no cash/QR mode needed.
                </p>
              )}
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks {discount > 0 ? '(optional note for discount/payment)' : ''}
              </label>
              <input
                type="text"
                value={formData.paymentRemarks}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, paymentRemarks: e.target.value }))
                }
                placeholder={discount > 0 ? 'e.g. Regular customer discount' : 'Optional note...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-50 px-3 py-3 rounded-lg text-sm space-y-1.5 text-gray-700">
              {discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span className="font-medium text-amber-700">
                      − {formatCurrency(summary.discount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>New final charges</span>
                    <span className="font-medium">{formatCurrency(summary.newFinalCharges)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>Cash / QR received</span>
                <span className="font-medium text-emerald-700">
                  {formatCurrency(round2(formData.receivedAmount))}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5 mt-1">
                <span className="font-medium">Remaining unpaid after this</span>
                <span
                  className={`font-semibold ${
                    summary.remainingAfter > 0.01 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(summary.remainingAfter)}
                  {summary.remainingAfter <= 0.01 ? ' (Fully paid)' : ''}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <DollarSign size={16} />
              {discount > 0 ? 'Apply Payment + Discount' : 'Add Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPaymentModal;
