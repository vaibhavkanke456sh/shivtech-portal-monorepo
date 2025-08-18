import React, { useState } from 'react';
import { Task, Service, Employee } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Edit, Eye, UserPlus } from 'lucide-react';

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
  const [bulkAssignTo, setBulkAssignTo] = useState('');

  const filteredTasks = filter ? tasks.filter(filter) : tasks;

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">{filteredTasks.length} tasks found</p>
          </div>
          
          {selectedTasks.length > 0 && (
            <div className="flex items-center gap-3">
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
            </div>
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
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50">
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
                    value={['pending','ongoing','completed','assigned','unassigned'].includes(task.status) ? task.status : 'unassigned'}
                    onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="unassigned">Unassigned</option>
                    <option value="assigned">Assigned</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
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
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTaskEdit(task)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit Task"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="text-gray-600 hover:text-gray-800"
                      title="View Details"
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