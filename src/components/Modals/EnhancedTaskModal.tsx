import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { Task, Service, Employee, UploadedDocument } from '../../types';
import { generateTaskSerial, getTodayDate } from '../../utils/formatters';

interface EnhancedTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'>) => void;
  services: Service[];
  employees: Employee[];
  savedTasks: string[];
  existingCustomers: string[];
  onAddService: (serviceName: string) => void;
  onAddEmployee: (employeeName: string) => void;
  editingTask?: Task | null;
}

const EnhancedTaskModal: React.FC<EnhancedTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  services, 
  employees,
  savedTasks,
  existingCustomers,
  onAddService,
  onAddEmployee,
  editingTask
}) => {
  // State for new service and employee input
  const [newServiceName, setNewServiceName] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  // Add new service handler
  const handleAddServiceClick = () => {
    if (newServiceName.trim()) {
      onAddService(newServiceName.trim());
      setNewServiceName('');
    }
  };

  // Add new employee handler
  const handleAddEmployeeClick = () => {
    if (newEmployeeName.trim()) {
      onAddEmployee(newEmployeeName.trim());
      setNewEmployeeName('');
    }
  };
  const [formData, setFormData] = useState({
    serialNo: '',
    date: getTodayDate(),
    taskName: '',
    customerName: '',
    customerType: 'new' as 'new' | 'old',
    serviceDeliveryDate: '',
    taskType: 'normal' as 'do-now' | 'urgent' | 'normal',
    assignedTo: '',
    serviceCharge: 0,
    finalCharges: 0,
    paymentMode: 'cash' as 'cash' | 'shop-qr' | 'personal-qr' | 'other',
    paymentRemarks: '',
    amountCollected: 0,
    unpaidAmount: 0,
    documentDetails: '',
    uploadedDocuments: [] as UploadedDocument[],
    remarks: ''
  });

  const [taskSuggestions, setTaskSuggestions] = useState<string[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [showTaskSuggestions, setShowTaskSuggestions] = useState(false);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        // Pre-fill form with editing task data
        setFormData({
          serialNo: editingTask.serialNo,
          date: editingTask.date,
          taskName: editingTask.taskName,
          customerName: editingTask.customerName,
          customerType: editingTask.customerType || 'new',
          serviceDeliveryDate: editingTask.serviceDeliveryDate,
          taskType: editingTask.taskType,
          assignedTo: editingTask.assignedTo,
          serviceCharge: editingTask.serviceCharge || 0,
          finalCharges: editingTask.finalCharges || 0,
          paymentMode: editingTask.paymentMode || 'cash',
          paymentRemarks: editingTask.paymentRemarks || '',
          amountCollected: editingTask.amountCollected || 0,
          unpaidAmount: editingTask.unpaidAmount || 0,
          documentDetails: editingTask.documentDetails || '',
          uploadedDocuments: editingTask.uploadedDocuments || [],
          remarks: editingTask.remarks || ''
        });
      } else {
        // Initialize with default values for new task
        setFormData(prev => ({
          ...prev,
          serialNo: generateTaskSerial(),
          date: getTodayDate()
        }));
      }
    }
  }, [isOpen, editingTask]);

  useEffect(() => {
    const unpaidAmount = Math.max(formData.finalCharges - formData.amountCollected, 0);
    setFormData(prev => ({
      ...prev,
      unpaidAmount
    }));
  }, [formData.finalCharges, formData.amountCollected]);

  useEffect(() => {
    const matchingService = services.find(s => s.name.toLowerCase() === formData.taskName.toLowerCase());
    if (matchingService) {
      setFormData(prev => ({
        ...prev,
        serviceCharge: matchingService.amount,
        finalCharges: prev.finalCharges || matchingService.amount
      }));
    }
  }, [formData.taskName, services]);

  const handleTaskNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, taskName: value }));
    
    if (value.length > 0) {
      const suggestions = savedTasks.filter(task => 
        task.toLowerCase().includes(value.toLowerCase())
      );
      setTaskSuggestions(suggestions);
      setShowTaskSuggestions(true);
    } else {
      setShowTaskSuggestions(false);
    }
  };

  const handleCustomerNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, customerName: value }));
    
    if (value.length > 0) {
      const suggestions = existingCustomers.filter(customer => 
        customer.toLowerCase().includes(value.toLowerCase())
      );
      setCustomerSuggestions(suggestions);
      setShowCustomerSuggestions(true);
    } else {
      setShowCustomerSuggestions(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newDocuments: UploadedDocument[] = files.map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      file,
      uploadedAt: new Date().toISOString()
    }));
    
    setFormData(prev => ({
      ...prev,
      uploadedDocuments: [...prev.uploadedDocuments, ...newDocuments]
    }));
  };

  const removeDocument = (documentId: string) => {
    setFormData(prev => ({
      ...prev,
      uploadedDocuments: prev.uploadedDocuments.filter(doc => doc.id !== documentId)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const task: Omit<Task, 'id'> = {
      ...formData,
      serviceDeliveryDate: formData.serviceDeliveryDate || undefined,
      assignedTo: formData.assignedTo || undefined,
      paymentRemarks: formData.paymentMode === 'other' ? formData.paymentRemarks : undefined,
      documentDetails: formData.documentDetails || undefined,
      uploadedDocuments: formData.uploadedDocuments.length > 0 ? formData.uploadedDocuments : undefined,
      remarks: formData.remarks || undefined,
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
      taskType: 'normal',
      assignedTo: '',
      serviceCharge: 0,
      finalCharges: 0,
      paymentMode: 'cash',
      paymentRemarks: '',
      amountCollected: 0,
      unpaidAmount: 0,
      documentDetails: '',
      uploadedDocuments: [],
      remarks: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Add New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Task Serial No */}
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

            {/* Date */}
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

            {/* Task Name with Autocomplete and Add Service */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Name (Service)
              </label>
              <input
                type="text"
                value={formData.taskName}
                onChange={(e) => handleTaskNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowTaskSuggestions(false), 200)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Type to search services..."
                list="service-suggestions"
              />
              <datalist id="service-suggestions">
                {services.map(service => (
                  <option key={service.id} value={service.name} />
                ))}
              </datalist>
              {showTaskSuggestions && taskSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {taskSuggestions.map((task, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, taskName: task }));
                        setShowTaskSuggestions(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                    >
                      {task}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newServiceName}
                  onChange={e => setNewServiceName(e.target.value)}
                  placeholder="Add new service name"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded"
                />
                <button
                  type="button"
                  onClick={handleAddServiceClick}
                  className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                >
                  Add Service
                </button>
              </div>
            </div>

            {/* Customer Name with Autocomplete */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => handleCustomerNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Type to search customers..."
              />
              {showCustomerSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {customerSuggestions.map((customer, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, customerName: customer, customerType: 'old' }));
                        setShowCustomerSuggestions(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                    >
                      {customer}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Type
              </label>
              <div className="flex gap-4 pt-2">
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

            {/* Service Delivery Date */}
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

            {/* Task Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Type
              </label>
              <select
                value={formData.taskType}
                onChange={(e) => setFormData(prev => ({ ...prev, taskType: e.target.value as 'do-now' | 'urgent' | 'normal' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="do-now">Do Now</option>
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
              </select>
            </div>

            {/* Assign To with Add Employee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To
              </label>
              <select
                value={formData.assignedTo}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Don't assign now</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.name}>
                    {employee.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newEmployeeName}
                  onChange={e => setNewEmployeeName(e.target.value)}
                  placeholder="Add new employee name"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded"
                />
                <button
                  type="button"
                  onClick={handleAddEmployeeClick}
                  className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                >
                  Add Employee
                </button>
              </div>
            </div>

            {/* Service Charge */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Charge
              </label>
              <input
                type="number"
                value={formData.serviceCharge}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>

            {/* Final Charges */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Final Charges
              </label>
              <input
                type="number"
                value={formData.finalCharges}
                onChange={(e) => setFormData(prev => ({ ...prev, finalCharges: Number(e.target.value) }))}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Mode
              </label>
              <select
                value={formData.paymentMode}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentMode: e.target.value as 'cash' | 'shop-qr' | 'personal-qr' | 'other' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="cash">Cash</option>
                <option value="shop-qr">Shop QR</option>
                <option value="personal-qr">Personal QR</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Payment Remarks (only if Other is selected) */}
            {formData.paymentMode === 'other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Remarks
                </label>
                <input
                  type="text"
                  value={formData.paymentRemarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentRemarks: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter payment details..."
                />
              </div>
            )}

            {/* Amount Paid */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Paid
              </label>
              <input
                type="number"
                value={formData.amountCollected}
                onChange={(e) => setFormData(prev => ({ ...prev, amountCollected: Number(e.target.value) }))}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Amount Unpaid */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Unpaid
              </label>
              <input
                type="number"
                value={formData.unpaidAmount}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>
          </div>

          {/* Document Details */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Details
            </label>
            <input
              type="text"
              value={formData.documentDetails}
              onChange={(e) => setFormData(prev => ({ ...prev, documentDetails: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Where documents are stored..."
            />
          </div>

          {/* Upload Documents */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload Documents
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center gap-2 cursor-pointer text-gray-600 hover:text-gray-800"
              >
                <Upload size={20} />
                Click to upload documents
              </label>
              
              {formData.uploadedDocuments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {formData.uploadedDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm text-gray-700">{doc.name}</span>
                      <button
                        type="button"
                        onClick={() => removeDocument(doc.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Additional notes..."
            />
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

export default EnhancedTaskModal;