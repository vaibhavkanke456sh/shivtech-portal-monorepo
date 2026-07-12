import React, { useEffect, useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { PaymentHistoryEntry } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export type PaymentEntryEditPayload = {
  amount: number;
  paymentMode: PaymentHistoryEntry['paymentMode'];
  paymentRemarks?: string;
};

interface EditPaymentEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: PaymentHistoryEntry | null;
  taskLabel?: string;
  /** Cash already on this task (for discount max / warning) */
  cashCollected?: number;
  /** Current final charges on the task */
  finalCharges?: number;
  onSave: (updates: PaymentEntryEditPayload) => void | Promise<void>;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const EditPaymentEntryModal: React.FC<EditPaymentEntryModalProps> = ({
  isOpen,
  onClose,
  entry,
  taskLabel,
  cashCollected = 0,
  finalCharges = 0,
  onSave
}) => {
  const isDiscount = entry?.paymentMode === 'discount';
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentHistoryEntry['paymentMode']>('cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Bill before this discount row: final + this discount amount
  const originalBill = isDiscount
    ? round2(finalCharges + round2(entry?.amount || 0))
    : finalCharges;
  // If we keep all cash, max discount is originalBill - cash
  const maxDiscountKeepCash = round2(Math.max(originalBill - cashCollected, 0));
  // Absolute max write-off (cash will auto-reduce)
  const maxDiscountAbsolute = originalBill;

  useEffect(() => {
    if (isOpen && entry) {
      setAmount(round2(entry.amount));
      setPaymentMode(entry.paymentMode || 'cash');
      setPaymentRemarks(entry.paymentRemarks || '');
      setError('');
      setSaving(false);
    }
  }, [isOpen, entry]);

  if (!isOpen || !entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = round2(amount);
    if (a <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    if (isDiscount && a > maxDiscountAbsolute + 0.001) {
      setError(
        `Discount cannot exceed original bill (${formatCurrency(maxDiscountAbsolute)})`
      );
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        amount: a,
        paymentMode: isDiscount ? 'discount' : paymentMode,
        paymentRemarks: paymentRemarks || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
      setSaving(false);
    }
  };

  const willTrimCash =
    isDiscount &&
    cashCollected > 0.001 &&
    round2(amount) > maxDiscountKeepCash + 0.001;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Pencil size={18} className={isDiscount ? 'text-amber-600' : 'text-emerald-600'} />
            {isDiscount ? 'Edit Discount' : 'Edit Payment'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {taskLabel && (
            <p className="text-sm text-gray-600">
              Task: <strong>{taskLabel}</strong>
            </p>
          )}
          <p className="text-xs text-gray-500">
            Current: {isDiscount ? '−' : ''}
            {formatCurrency(entry.amount)}
            {isDiscount ? ' discount' : ` (${entry.paymentMode})`}
          </p>
          {isDiscount && (
            <div className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 space-y-0.5">
              <p>
                Cash already collected: <strong>{formatCurrency(cashCollected)}</strong>
              </p>
              <p>
                Max discount without reducing cash:{' '}
                <strong>{formatCurrency(maxDiscountKeepCash)}</strong>
              </p>
              <p className="text-amber-800">
                Higher discount is allowed — excess cash will be reduced automatically.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isDiscount ? 'Discount Amount *' : 'Received Amount *'}
            </label>
            <input
              type="number"
              min="0.01"
              max={isDiscount ? maxDiscountAbsolute : undefined}
              step="0.01"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${
                isDiscount
                  ? 'border-amber-300 focus:ring-amber-500'
                  : 'border-gray-300 focus:ring-emerald-500'
              }`}
              required
            />
            {willTrimCash && (
              <p className="text-xs text-amber-700 mt-1">
                New final will be {formatCurrency(round2(Math.max(originalBill - amount, 0)))}.
                Cash will be reduced by about{' '}
                {formatCurrency(
                  round2(Math.max(cashCollected - Math.max(originalBill - amount, 0), 0))
                )}{' '}
                so it fits.
              </p>
            )}
          </div>

          {!isDiscount && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
              <select
                value={paymentMode}
                onChange={(e) =>
                  setPaymentMode(e.target.value as PaymentHistoryEntry['paymentMode'])
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="cash">Cash</option>
                <option value="shop-qr">Shop QR</option>
                <option value="personal-qr">Personal QR (Vaibhav)</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <input
              type="text"
              value={paymentRemarks}
              onChange={(e) => setPaymentRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Optional note..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 text-white rounded-lg disabled:bg-gray-400 ${
                isDiscount ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPaymentEntryModal;
