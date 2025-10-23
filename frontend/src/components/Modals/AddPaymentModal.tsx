import React, { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import { Task } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskId: string, receivedAmount: number, paymentMode: string, paymentRemarks?: string) => void;
  task: Task | null;
}

const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  task
}) => {
  const [formData, setFormData] = useState({
    receivedAmount: 0,
    paymentMode: 'cash' as 'cash' | 'shop-qr' | 'personal-qr' | 'other',
    paymentRemarks: ''
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && task) {
      setFormData({
        receivedAmount: task.unpaidAmount, // Default to full unpaid amount
        paymentMode: 'cash',
        paymentRemarks: ''
      });
      setError('');
    }
  }, [isOpen, task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!task) return;

    // Validation
    if (formData.receivedAmount <= 0) {
      setError('Received amount must be greater than 0');
      return;
    }

    if (formData.receivedAmount > task.unpaidAmount) {
      setError(`Received amount cannot be more than unpaid amount (${formatCurrency(task.unpaidAmount)})`);
      return;
    }

    onSubmit(
      task.id,
      formData.receivedAmount,
      formData.paymentMode
    );
    onClose();
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
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
              <div><strong>Serial No:</strong> {task.serialNo}</div>
              <div><strong>Date:</strong> {formatDate(task.date)}</div>
              <div><strong>Service:</strong> {task.taskName}</div>
              <div><strong>Customer:</strong> {task.customerName}</div>
              <div><strong>Total Amount:</strong> {formatCurrency(task.finalCharges)}</div>
              <div><strong>Already Paid:</strong> {formatCurrency(task.amountCollected)}</div>
              <div className="text-red-600"><strong>Unpaid Amount:</strong> {formatCurrency(task.unpaidAmount)}</div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="space-y-4">
            {/* Received Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Received Amount *
              </label>
              <input
                type="number"
                value={formData.receivedAmount}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  receivedAmount: parseFloat(e.target.value) || 0 
                }))}
                min="0.01"
                max={task.unpaidAmount}
                step="0.01"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter received amount"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {formatCurrency(task.unpaidAmount)}
              </p>
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Mode *
              </label>
              <select
                value={formData.paymentMode}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  paymentMode: e.target.value as typeof prev.paymentMode 
                }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="cash">Cash</option>
                <option value="shop-qr">Shop QR</option>
                <option value="personal-qr">Personal QR (Vaibhav)</option>
              </select>
            </div>

            {/* Remaining Amount (calculated) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remaining Unpaid After This Payment
              </label>
              <div className="bg-gray-50 px-3 py-2 rounded-lg text-gray-700">
                {formatCurrency(Math.max(task.unpaidAmount - formData.receivedAmount, 0))}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Action Buttons */}
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
              Add Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPaymentModal;