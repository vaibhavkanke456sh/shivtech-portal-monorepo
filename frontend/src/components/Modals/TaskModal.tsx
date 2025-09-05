import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Task, Service } from '../../types';
import { generateTaskSerial, getTodayDate } from '../../utils/formatters';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'>) => void;
  services: Service[];
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, services }) => {
  const [formData, setFormData] = useState({
    serialNo: '',
    date: getTodayDate(),
    taskName: '',
    customerName: '',
    customerType: 'new' as 'new' | 'old',
    serviceDeliveryDate: '',
    amount: 0,
    paymentMode: 'cash' as 'cash' | 'bank' | 'upi' | 'wallet',
    amountCollected: 0,
    unpaidAmount: 0,
    assignedTo: '',
    priority: 'normal' as 'icu' | 'urgent' | 'normal'
  });

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        serialNo: generateTaskSerial(),
        date: getTodayDate()
      }));
    }
  }, [isOpen]);

  useEffect(() => {
    const selectedService = services.find(s => s.id === formData.taskName);
    const amount = selectedService ? selectedService.amount : 0;
    const unpaidAmount = Math.max(amount - formData.amountCollected, 0);
    
    setFormData(prev => ({
      ...prev,
      amount,
      unpaidAmount
    }));
  }, [formData.taskName, formData.amountCollected, services]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const task: Omit<Task, 'id'> = {
      ...formData,
      serviceDeliveryDate: formData.serviceDeliveryDate || undefined,
      assignedTo: formData.assignedTo || undefined,
      status: formData.assignedTo ? 'assigned' : 'unassigned'
    };
    
    onSave(task);
    onClose();
    
    // Reset form
    setFormData({
      serialNo: '',
      date: getTodayDate(),
      taskName: '',
      customerName: '',
      customerType: 'new',
      serviceDeliveryDate: '',
      amount: 0,
      paymentMode: 'cash',
      amountCollected: 0,
      unpaidAmount: 0,
      assignedTo: '',
      priority: 'normal'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Add New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Serial No.
              </label>
              <input
                type="text"
                value={formData.serialNo}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Name
              </label>
              <select
                value={formData.taskName}
                onChange={(e) => setFormData(prev => ({ ...prev, taskName: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select Task</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="customerType"
                    value="new"
                    checked={formData.customerType === 'new'}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerType: e.target.value as 'new' | 'old' }))}
                    className="mr-2"
                  />
                  New
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="customerType"
                    value="old"
                    checked={formData.customerType === 'old'}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerType: e.target.value as 'new' | 'old' }))}
                    className="mr-2"
                  />
                  Old
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Delivery Date
              </label>
              <input
                type="date"
                value={formData.serviceDeliveryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, serviceDeliveryDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                value={formData.amount}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Mode
              </label>
              <select
                value={formData.paymentMode}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentMode: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="upi">UPI</option>
                <option value="wallet">Wallet/App</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Collected
              </label>
              <input
                type="number"
                value={formData.amountCollected}
                onChange={(e) => setFormData(prev => ({ ...prev, amountCollected: Number(e.target.value) }))}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unpaid Amount
              </label>
              <input
                type="number"
                value={formData.unpaidAmount}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign Task
              </label>
              <select
                value={formData.assignedTo}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select Staff</option>
                <option value="vaibhav">vaibhav</option>
                <option value="omkar">omkar</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="icu">ICU Case</option>
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;