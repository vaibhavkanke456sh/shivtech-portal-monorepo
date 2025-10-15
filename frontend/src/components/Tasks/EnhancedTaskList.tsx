import React, { useState } from 'react';
import { Task, Service, Employee } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Edit, UserPlus, Eye } from 'lucide-react';

interface EnhancedTaskListProps {
  tasks: Task[];
  services: Service[];
  employees: Employee[];
  title: string;
  filter?: (task: Task) => boolean;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
}

const EnhancedTaskList: React.FC<EnhancedTaskListProps> = ({ 
  tasks, 
  services, 
  employees, 
  title, 
  filter, 
  onTaskUpdate,
  onTaskEdit,
  onTaskDelete
}) => {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');

  // Apply base filter first, then date and assignedTo filters
  let filteredTasks = filter ? tasks.filter(filter) : tasks;
  
  // Apply date filter
  if (dateFilter) {
    filteredTasks = filteredTasks.filter(task => task.date === dateFilter);
  }
  
  // Apply assigned to filter
  if (assignedToFilter) {
    if (assignedToFilter === 'unassigned') {
      filteredTasks = filteredTasks.filter(task => !task.assignedTo || task.assignedTo === '');
    } else {
      filteredTasks = filteredTasks.filter(task => task.assignedTo === assignedToFilter);
    }
  }
  
  

  const getServiceName = (serviceId: string) => {
    const service = services.find(s => s.name === serviceId);
    return service ? service.name : serviceId;
  };



  const getTaskTypeBadge = (taskType: string) => {
    const typeColors = {
      'do-now': 'bg-red-500 text-white',
      'urgent': 'bg-red-200 text-red-800',
      'normal': 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[taskType as keyof typeof typeColors] || typeColors.normal}`}>
        {taskType === 'do-now' ? 'DO NOW' : taskType.toUpperCase()}
      </span>
    );
  };

  const handleTaskSelect = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleBulkAssign = () => {
    if (bulkAssignTo && selectedTasks.length > 0) {
      selectedTasks.forEach(taskId => {
        onTaskUpdate(taskId, { 
          assignedTo: bulkAssignTo, 
          status: 'assigned' 
        });
      });
      setSelectedTasks([]);
      setBulkAssignTo('');
    }
  };

  const handleStatusChange = (taskId: string, newStatus: Task['status']) => {
    onTaskUpdate(taskId, { status: newStatus });
  };

  const toggleDetails = (taskId: string) => {
    const newState = { ...expandedTasks, [taskId]: !expandedTasks[taskId] };
    setExpandedTasks(newState);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">{filteredTasks.length} tasks found</p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Date:</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Assigned To:</label>
              <select
                value={assignedToFilter}
                onChange={(e) => setAssignedToFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All</option>
                <option value="unassigned">Unassigned</option>
                <option value="vaibhav">vaibhav</option>
                <option value="omkar">omkar</option>
              </select>
            </div>
            
            {(dateFilter || assignedToFilter) && (
              <button
                onClick={() => {
                  setDateFilter('');
                  setAssignedToFilter('');
                }}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const map: Record<string, boolean> = {};
                filteredTasks.forEach(t => { map[t.id] = true; });
                setExpandedTasks(map);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
            >
              Expand all
            </button>
            <button
              onClick={() => setExpandedTasks({})}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
            >
              Collapse all
            </button>
            {selectedTasks.length > 0 && (
              <>
                <select
                  value={bulkAssignTo}
                  onChange={(e) => setBulkAssignTo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select Employee</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.name}>
                      {employee.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={!bulkAssignTo}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 text-sm"
                >
                  <UserPlus size={16} />
                  Assign ({selectedTasks.length})
                </button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTasks(filteredTasks.map(t => t.id));
                    } else {
                      setSelectedTasks([]);
                    }
                  }}
                  checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Task Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Audit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTasks.map((task) => (
              <React.Fragment key={task.id}>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.id)}
                    onChange={() => handleTaskSelect(task.id)}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{task.serialNo}</div>
                    <div className="text-sm text-gray-500">{getServiceName(task.taskName)}</div>
                    <div className="text-xs text-gray-400">{formatDate(task.date)}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{task.customerName}</div>
                    <div className="text-sm text-gray-500 capitalize">{task.customerType} customer</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(task.finalCharges)}</div>
                    <div className="text-sm text-gray-500">
                      Paid: {formatCurrency(task.amountCollected)}
                    </div>
                    {task.unpaidAmount > 0 && (
                      <div className="text-sm text-red-600">
                        Unpaid: {formatCurrency(task.unpaidAmount)}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getTaskTypeBadge(task.taskType)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={['service-delivered','ongoing','completed','assigned','unassigned'].includes(task.status) ? task.status : 'unassigned'}
                    onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="unassigned">Unassigned</option>
                    <option value="assigned">Assigned</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="service-delivered">Service Delivered</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {task.status === 'unassigned' ? (
                    <span className="text-sm text-gray-500">Unassigned</span>
                  ) : (
                    <select
                      value={task.assignedTo || ''}
                      onChange={(e) => onTaskUpdate(task.id, { 
                        assignedTo: e.target.value || undefined,
                        status: e.target.value ? 'assigned' : 'unassigned'
                      })}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="">Unassigned</option>
                      {employees.map(employee => (
                        <option key={employee.id} value={employee.name}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                  <div>
                    {(task.createdByName || task.createdById) && (
                      <div>
                        Created by: <span className="font-medium">{task.createdByName || task.createdById}</span>
                      </div>
                    )}
                    {(task.updatedByName || task.updatedById) && (task.updatedById !== task.createdById) && (
                      <div>
                        Updated by: <span className="font-medium">{task.updatedByName || task.updatedById}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                                         <button
                       onClick={() => onTaskEdit(task)}
                       className="text-blue-600 hover:text-blue-800 p-1"
                       title="Edit Task"
                     >
                       <Edit size={16} />
                     </button>
                     <button
                       onClick={() => {
                         console.log('Eye button clicked for task:', task.id, task.customerName);
                         toggleDetails(task.id);
                       }}
                       className="bg-red-500 text-white px-2 py-1 rounded"
                       title={expandedTasks[task.id] ? 'Hide Details' : 'Show Details'}
                     >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => onTaskDelete(task.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Task"
                    >
                      &#128465;
                    </button>
                  </div>
                </td>
              </tr>
                             {expandedTasks[task.id] && (
                <tr>
                  <td className="px-6 py-4 bg-gray-50" colSpan={9}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                      <div><span className="font-medium">Serial No:</span> {task.serialNo ? task.serialNo : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Date:</span> {task.date ? formatDate(task.date) : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Service:</span> {task.taskName ? getServiceName(task.taskName) : <span className="text-red-500">No data</span>} {task.taskName && <span className="text-gray-400">({task.taskName})</span>}</div>
                      <div><span className="font-medium">Customer Name:</span> {task.customerName ? task.customerName : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Customer Type:</span> {task.customerType ? task.customerType : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Service Delivery Date:</span> {task.serviceDeliveryDate ? task.serviceDeliveryDate : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Task Type:</span> {task.taskType ? task.taskType : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Assigned To:</span> {task.assignedTo ? task.assignedTo : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Service Charge:</span> {task.serviceCharge ? formatCurrency(task.serviceCharge) : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Final Charges:</span> {task.finalCharges ? formatCurrency(task.finalCharges) : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Payment Mode:</span> {task.paymentMode ? task.paymentMode : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Payment Remarks:</span> {task.paymentRemarks ? task.paymentRemarks : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Amount Collected:</span> {task.amountCollected ? formatCurrency(task.amountCollected) : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Unpaid Amount:</span> {task.unpaidAmount ? formatCurrency(task.unpaidAmount) : <span className="text-red-500">No data</span>}</div>
                      <div className="md:col-span-2"><span className="font-medium">Document Details:</span> {task.documentDetails ? task.documentDetails : <span className="text-red-500">No data</span>}</div>
                      {task.uploadedDocuments && task.uploadedDocuments.length > 0 && (
                        <div className="md:col-span-2">
                          <div className="font-medium">Uploaded Documents:</div>
                          <ul className="list-disc list-inside text-gray-600">
                            {task.uploadedDocuments.map((doc: { id?: string; name: string; url?: string }, idx: number) => (
                              <li key={doc.id || idx}>{doc.name}{doc.url ? ` - ${doc.url}` : ''}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="md:col-span-2"><span className="font-medium">Remarks:</span> {task.remarks ? task.remarks : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Status:</span> {task.status ? task.status : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Created By:</span> {(task.createdByName || task.createdById) ? (task.createdByName || task.createdById) : <span className="text-red-500">No data</span>}</div>
                      <div><span className="font-medium">Updated By:</span> {(task.updatedByName || task.updatedById) ? (task.updatedByName || task.updatedById) : <span className="text-red-500">No data</span>}</div>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {filteredTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No tasks found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedTaskList;