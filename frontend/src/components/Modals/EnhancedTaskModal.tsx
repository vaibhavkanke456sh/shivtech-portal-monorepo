import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, Plus, Layers } from 'lucide-react';
import { Task, Service, ServiceGroup, Employee, UploadedDocument } from '../../types';
import { generateTaskSerial, getTodayDate } from '../../utils/formatters';

interface TaskFormData {
  serialNo: string;
  date: string;
  taskName: string;
  customerName: string;
  customerType: 'new' | 'old';
  serviceDeliveryDate: string;
  taskType: 'do-now' | 'urgent' | 'normal';
  assignedTo: string;
  serviceCharge: number;
  finalCharges: number;
  costOfService: number;
  profit: number;
  paymentMode: 'cash' | 'shop-qr' | 'personal-qr' | 'other';
  paymentRemarks: string;
  amountCollected: number;
  unpaidAmount: number;
  documentDetails: string;
  uploadedDocuments: UploadedDocument[];
  remarks: string;
}

interface GroupPaymentData {
  amountCollected: number;
  paymentMode: 'cash' | 'shop-qr' | 'personal-qr' | 'other';
  paymentRemarks: string;
}

interface EnhancedTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'>) => void;
  onSaveGrouped?: (tasks: Omit<Task, 'id'>[], groupPayment: GroupPaymentData | null) => void;
  services: Service[];
  serviceGroups: ServiceGroup[];
  employees: Employee[];
  savedTasks: string[];
  existingCustomers: string[];
  onAddService: () => void;
  onAddEmployee: (employeeName: string) => void;
  editingTask?: Task | null;
}

const emptyTaskForm = (): TaskFormData => ({
  serialNo: generateTaskSerial(),
  date: getTodayDate(),
  taskName: '',
  customerName: '',
  customerType: 'new',
  serviceDeliveryDate: '',
  taskType: 'normal',
  assignedTo: '',
  serviceCharge: 0,
  finalCharges: 0,
  costOfService: 0,
  profit: 0,
  paymentMode: 'cash',
  paymentRemarks: '',
  amountCollected: 0,
  unpaidAmount: 0,
  documentDetails: '',
  uploadedDocuments: [],
  remarks: ''
});

const EnhancedTaskModal: React.FC<EnhancedTaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveGrouped,
  services,
  serviceGroups,
  employees,
  savedTasks,
  existingCustomers,
  onAddService,
  onAddEmployee,
  editingTask
}) => {
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [isGroupedMode, setIsGroupedMode] = useState(false);
  const [taskForms, setTaskForms] = useState<TaskFormData[]>([emptyTaskForm()]);
  const [useGroupPayment, setUseGroupPayment] = useState(false);
  const [groupPayment, setGroupPayment] = useState<GroupPaymentData>({
    amountCollected: 0,
    paymentMode: 'cash',
    paymentRemarks: ''
  });
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [showTaskSuggestions, setShowTaskSuggestions] = useState<number | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState<number | null>(null);

  const handleAddEmployeeClick = () => {
    if (newEmployeeName.trim()) {
      onAddEmployee(newEmployeeName.trim());
      setNewEmployeeName('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setIsGroupedMode(false);
        setTaskForms([{
          serialNo: editingTask.serialNo || '',
          date: editingTask.date || getTodayDate(),
          taskName: editingTask.taskName || '',
          customerName: editingTask.customerName || '',
          customerType: editingTask.customerType || 'new',
          serviceDeliveryDate: editingTask.serviceDeliveryDate || '',
          taskType: editingTask.taskType || 'normal',
          assignedTo: editingTask.assignedTo || '',
          serviceCharge: editingTask.serviceCharge || 0,
          finalCharges: editingTask.finalCharges || 0,
          costOfService: editingTask.costOfService || 0,
          profit: editingTask.profit || 0,
          paymentMode: editingTask.paymentMode || 'cash',
          paymentRemarks: editingTask.paymentRemarks || '',
          amountCollected: editingTask.amountCollected || 0,
          unpaidAmount: editingTask.unpaidAmount || 0,
          documentDetails: editingTask.documentDetails || '',
          uploadedDocuments: editingTask.uploadedDocuments || [],
          remarks: editingTask.remarks || ''
        }]);
      } else {
        setIsGroupedMode(false);
        setTaskForms([emptyTaskForm()]);
        setUseGroupPayment(false);
        setGroupPayment({ amountCollected: 0, paymentMode: 'cash', paymentRemarks: '' });
      }
    }
  }, [isOpen, editingTask]);

  const updateTaskForm = (index: number, updates: Partial<TaskFormData>) => {
    setTaskForms(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      const f = updated[index];
      updated[index].unpaidAmount = Math.max(f.finalCharges - f.amountCollected, 0);
      updated[index].profit = f.finalCharges - f.costOfService;
      return updated;
    });
  };

  const handleTaskNameChange = (index: number, value: string) => {
    updateTaskForm(index, { taskName: value });
    
    // Auto-fill logic
    const matchingService = (services || []).find(s => (s.name || '').toLowerCase() === value.toLowerCase());
    if (matchingService) {
      updateTaskForm(index, {
        taskName: matchingService.name,
        serviceCharge: matchingService.defaultCharge || 0,
        finalCharges: matchingService.defaultCharge || 0,
        costOfService: matchingService.serviceCost || 0,
        profit: (matchingService.defaultCharge || 0) - (matchingService.serviceCost || 0)
      });
    }
    
    if (value.length > 0) {
      setShowTaskSuggestions(index);
    } else {
      setShowTaskSuggestions(null);
    }
  };

  // Group services by their group name
  const groupedServices = (serviceGroups || []).map(group => {
    if (!group) return null;
    return {
      groupName: group.name || 'Unnamed Group',
      services: (services || []).filter(s => {
        if (!s) return false;
        const gId = typeof s.groupId === 'string' ? s.groupId : s.groupId?._id;
        return gId === group._id;
      })
    };
  }).filter(g => g && g.services.length > 0) as { groupName: string; services: Service[] }[];

  // Also handle services without a valid group
  const ungroupedServices = (services || []).filter(s => {
    if (!s) return false;
    const gId = typeof s.groupId === 'string' ? s.groupId : s.groupId?._id;
    return !gId || !(serviceGroups || []).some(g => g && g._id === gId);
  });

  if (ungroupedServices.length > 0) {
    groupedServices.push({
      groupName: 'Other Services',
      services: ungroupedServices
    });
  }

  const handleCustomerNameChange = (index: number, value: string) => {
    const updates: Partial<TaskFormData> = { customerName: value };
    if (isGroupedMode && index > 0) {
      // In grouped mode, sync customer name across all tasks from the first form
    }
    updateTaskForm(index, updates);
    if (index === 0 && isGroupedMode) {
      setTaskForms(prev => prev.map((f, i) => i === 0 ? f : { ...f, customerName: value }));
    }
    if (value.length > 0) {
      setCustomerSuggestions(existingCustomers.filter(c => c.toLowerCase().includes(value.toLowerCase())));
      setShowCustomerSuggestions(index);
    } else {
      setShowCustomerSuggestions(null);
    }
  };

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newDocs: UploadedDocument[] = files.map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      file,
      uploadedAt: new Date().toISOString()
    }));
    updateTaskForm(index, { uploadedDocuments: [...taskForms[index].uploadedDocuments, ...newDocs] });
  };

  const removeDocument = (taskIndex: number, docId: string) => {
    updateTaskForm(taskIndex, {
      uploadedDocuments: taskForms[taskIndex].uploadedDocuments.filter(d => d.id !== docId)
    });
  };

  const addMoreTask = () => {
    const first = taskForms[0];
    const newTask = emptyTaskForm();
    newTask.customerName = first.customerName;
    newTask.customerType = first.customerType;
    newTask.documentDetails = first.documentDetails;
    newTask.date = first.date;
    setTaskForms(prev => [...prev, newTask]);
    setIsGroupedMode(true);
  };

  const removeTask = (index: number) => {
    if (taskForms.length <= 1) return;
    setTaskForms(prev => prev.filter((_, i) => i !== index));
    if (taskForms.length === 2) setIsGroupedMode(false);
  };

  const totalAmount = taskForms.reduce((sum, f) => sum + (f.finalCharges || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isGroupedMode && taskForms.length >= 2 && onSaveGrouped) {
      const tasks: Omit<Task, 'id'>[] = taskForms.map(f => ({
        ...f,
        serviceDeliveryDate: f.serviceDeliveryDate || undefined,
        assignedTo: f.assignedTo || undefined,
        documentDetails: f.documentDetails || undefined,
        uploadedDocuments: f.uploadedDocuments.length > 0 ? f.uploadedDocuments : undefined,
        remarks: f.remarks || undefined,
        status: (f.assignedTo ? 'assigned' : 'unassigned') as Task['status'],
        costOfService: f.costOfService,
        profit: f.profit
      }));
      onSaveGrouped(tasks, useGroupPayment ? groupPayment : null);
    } else {
      const f = taskForms[0];
      const task: Omit<Task, 'id'> = {
        ...f,
        serviceDeliveryDate: f.serviceDeliveryDate || undefined,
        assignedTo: f.assignedTo || undefined,
        documentDetails: f.documentDetails || undefined,
        uploadedDocuments: f.uploadedDocuments.length > 0 ? f.uploadedDocuments : undefined,
        remarks: f.remarks || undefined,
        status: (f.assignedTo ? 'assigned' : 'unassigned') as Task['status']
      };
      onSave(task);
    }

    onClose();
    setTaskForms([emptyTaskForm()]);
    setIsGroupedMode(false);
    setUseGroupPayment(false);
    setGroupPayment({ amountCollected: 0, paymentMode: 'cash', paymentRemarks: '' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">
              {editingTask ? 'Edit Task' : isGroupedMode ? 'Add Grouped Tasks' : 'Add New Task'}
            </h2>
            {isGroupedMode && (
              <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                <Layers size={12} />
                GROUPED ({taskForms.length} tasks)
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {taskForms.map((formData, taskIndex) => (
            <div key={taskIndex} className={`${taskIndex > 0 ? 'mt-8 pt-8 border-t-2 border-purple-200' : ''}`}>
              {isGroupedMode && (
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm font-bold">
                      Task {taskIndex + 1}
                    </span>
                    {taskIndex === 0 && (
                      <span className="text-xs text-gray-500">Customer details shared across all tasks</span>
                    )}
                  </div>
                  {taskIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => removeTask(taskIndex)}
                      className="flex items-center gap-1 px-3 py-1 text-red-600 border border-red-300 rounded-lg text-sm hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Remove Task {taskIndex + 1}
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Serial No.</label>
                  <input
                    type="text"
                    value={formData.serialNo}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => updateTaskForm(taskIndex, { date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Name (Service)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.taskName}
                      onChange={(e) => handleTaskNameChange(taskIndex, e.target.value)}
                      onFocus={() => setShowTaskSuggestions(taskIndex)}
                      onBlur={() => setTimeout(() => setShowTaskSuggestions(null), 200)}
                      required
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Type to search services..."
                    />
                    {taskIndex === 0 && (
                      <button
                        type="button"
                        onClick={onAddService}
                        className="px-3 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-1"
                        title="Manage Services"
                      >
                        <Plus size={16} />
                        Add Service
                      </button>
                    )}
                  </div>
                  
                  {showTaskSuggestions === taskIndex && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                      {groupedServices.map((group, groupIdx) => {
                        const filteredGroupServices = group.services.filter(s => 
                          s.name.toLowerCase().includes(formData.taskName.toLowerCase())
                        );
                        
                        if (filteredGroupServices.length === 0) return null;

                        return (
                          <div key={groupIdx}>
                            <div className="px-3 py-2 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-y">
                              {group.groupName}
                            </div>
                            {filteredGroupServices.map((service) => (
                              <button
                                key={service._id}
                                type="button"
                                onClick={() => {
                                  handleTaskNameChange(taskIndex, service.name);
                                  setShowTaskSuggestions(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-emerald-50 flex justify-between items-center transition-colors"
                              >
                                <span className="font-medium text-gray-700">{service.name}</span>
                                <span className="text-xs text-emerald-600 font-semibold">₹{service.defaultCharge}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                      {services.length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                          No services found. Click "Add Service" to create one.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => handleCustomerNameChange(taskIndex, e.target.value)}
                    onBlur={() => setTimeout(() => setShowCustomerSuggestions(null), 200)}
                    required
                    disabled={isGroupedMode && taskIndex > 0}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${isGroupedMode && taskIndex > 0 ? 'bg-gray-50' : ''}`}
                    placeholder="Type to search customers..."
                  />
                  {showCustomerSuggestions === taskIndex && customerSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {customerSuggestions.map((customer, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (isGroupedMode) {
                              setTaskForms(prev => prev.map(f => ({ ...f, customerName: customer, customerType: 'old' })));
                            } else {
                              updateTaskForm(taskIndex, { customerName: customer, customerType: 'old' });
                            }
                            setShowCustomerSuggestions(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100"
                        >
                          {customer}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`customerType-${taskIndex}`}
                        value="new"
                        checked={formData.customerType === 'new'}
                        onChange={() => {
                          if (isGroupedMode) {
                            setTaskForms(prev => prev.map(f => ({ ...f, customerType: 'new' })));
                          } else {
                            updateTaskForm(taskIndex, { customerType: 'new' });
                          }
                        }}
                        disabled={isGroupedMode && taskIndex > 0}
                        className="mr-2"
                      />
                      New
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`customerType-${taskIndex}`}
                        value="old"
                        checked={formData.customerType === 'old'}
                        onChange={() => {
                          if (isGroupedMode) {
                            setTaskForms(prev => prev.map(f => ({ ...f, customerType: 'old' })));
                          } else {
                            updateTaskForm(taskIndex, { customerType: 'old' });
                          }
                        }}
                        disabled={isGroupedMode && taskIndex > 0}
                        className="mr-2"
                      />
                      Old
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Delivery Date</label>
                  <input
                    type="date"
                    value={formData.serviceDeliveryDate}
                    onChange={(e) => updateTaskForm(taskIndex, { serviceDeliveryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
                  <select
                    value={formData.taskType}
                    onChange={(e) => updateTaskForm(taskIndex, { taskType: e.target.value as TaskFormData['taskType'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="do-now">Do Now</option>
                    <option value="urgent">Urgent</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => updateTaskForm(taskIndex, { assignedTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Don't assign now</option>
                    {employees.map(employee => (
                      <option key={employee.id} value={employee.name}>{employee.name}</option>
                    ))}
                  </select>
                  {taskIndex === 0 && (
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
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Charge</label>
                  <input
                    type="number"
                    value={formData.serviceCharge}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Final Charges</label>
                  <input
                    type="number"
                    value={formData.finalCharges}
                    onChange={(e) => updateTaskForm(taskIndex, { finalCharges: Number(e.target.value) })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost of Service</label>
                  <input
                    type="number"
                    value={formData.costOfService}
                    onChange={(e) => updateTaskForm(taskIndex, { costOfService: Number(e.target.value) })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profit</label>
                  <input
                    type="number"
                    value={formData.profit}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>

                {!isGroupedMode || !useGroupPayment ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                      <select
                        value={formData.paymentMode}
                        onChange={(e) => updateTaskForm(taskIndex, { paymentMode: e.target.value as TaskFormData['paymentMode'] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="cash">Cash</option>
                        <option value="shop-qr">Shop QR</option>
                        <option value="personal-qr">Personal QR (Vaibhav)</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                      <input
                        type="number"
                        value={formData.amountCollected}
                        onChange={(e) => updateTaskForm(taskIndex, { amountCollected: Number(e.target.value) })}
                        min="0"
                        disabled={isGroupedMode && useGroupPayment}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount Unpaid</label>
                      <input
                        type="number"
                        value={formData.unpaidAmount}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Details</label>
                <input
                  type="text"
                  value={formData.documentDetails}
                  onChange={(e) => {
                    if (isGroupedMode && taskIndex === 0) {
                      setTaskForms(prev => prev.map(f => ({ ...f, documentDetails: e.target.value })));
                    } else {
                      updateTaskForm(taskIndex, { documentDetails: e.target.value });
                    }
                  }}
                  disabled={isGroupedMode && taskIndex > 0}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${isGroupedMode && taskIndex > 0 ? 'bg-gray-50' : ''}`}
                  placeholder="Where documents are stored..."
                />
                {isGroupedMode && taskIndex === 0 && (
                  <p className="text-xs text-gray-500 mt-1">Shared across all tasks in this group</p>
                )}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Documents</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileUpload(taskIndex, e)}
                    className="hidden"
                    id={`file-upload-${taskIndex}`}
                  />
                  <label
                    htmlFor={`file-upload-${taskIndex}`}
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
                            onClick={() => removeDocument(taskIndex, doc.id)}
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

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => updateTaskForm(taskIndex, { remarks: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          ))}

          {!editingTask && (
            <div className="mt-6">
              <button
                type="button"
                onClick={addMoreTask}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-purple-400 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium"
              >
                <Plus size={18} />
                Add More Task (Create Group)
              </button>
            </div>
          )}

          {isGroupedMode && (
            <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                  <Layers size={18} />
                  Combined Payment for All Tasks
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-purple-700">Total Amount: <strong>₹{totalAmount.toLocaleString()}</strong></span>
                </div>
              </div>

              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useGroupPayment}
                  onChange={(e) => setUseGroupPayment(e.target.checked)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm font-medium text-purple-700">
                  Collect combined payment for all tasks instead of per-task payment
                </span>
              </label>

              {useGroupPayment && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-1">Payment Mode</label>
                    <select
                      value={groupPayment.paymentMode}
                      onChange={(e) => setGroupPayment(prev => ({ ...prev, paymentMode: e.target.value as GroupPaymentData['paymentMode'] }))}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="shop-qr">Shop QR</option>
                      <option value="personal-qr">Personal QR (Vaibhav)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-1">
                      Amount Received (Total: ₹{totalAmount.toLocaleString()})
                    </label>
                    <input
                      type="number"
                      value={groupPayment.amountCollected}
                      onChange={(e) => setGroupPayment(prev => ({ ...prev, amountCollected: Number(e.target.value) }))}
                      min="0"
                      max={totalAmount}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-1">
                      Remaining: ₹{Math.max(totalAmount - groupPayment.amountCollected, 0).toLocaleString()}
                    </label>
                    <input
                      type="text"
                      value={groupPayment.paymentRemarks}
                      onChange={(e) => setGroupPayment(prev => ({ ...prev, paymentRemarks: e.target.value }))}
                      placeholder="Payment remarks..."
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
                <p className="text-sm text-purple-800 font-medium">Group Summary</p>
                <div className="flex gap-6 mt-1 text-sm text-purple-700">
                  <span>{taskForms.length} Services</span>
                  <span>Total: ₹{totalAmount.toLocaleString()}</span>
                  {useGroupPayment && <span>Paid: ₹{groupPayment.amountCollected.toLocaleString()}</span>}
                  {useGroupPayment && <span>Remaining: ₹{Math.max(totalAmount - groupPayment.amountCollected, 0).toLocaleString()}</span>}
                </div>
              </div>
            </div>
          )}

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
              className={`px-4 py-2 text-white rounded-lg transition-colors ${isGroupedMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              {editingTask ? 'Update Task' : isGroupedMode ? `Save ${taskForms.length} Grouped Tasks` : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnhancedTaskModal;
