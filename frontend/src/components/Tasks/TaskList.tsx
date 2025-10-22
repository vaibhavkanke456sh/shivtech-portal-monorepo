import React, { useState } from 'react';
import { Task, Service } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface TaskListProps {
  tasks: Task[];
  services: Service[];
  title: string;
  filter?: (task: Task) => boolean;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, services, title, filter }) => {
  const filteredTasks = filter ? tasks.filter(filter) : tasks;
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Debug logging - Updated for deployment
  // console.log('TaskList received tasks:', tasks);
  // console.log('Filtered tasks:', filteredTasks);

  const toggleDetails = (taskId: string) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const getServiceName = (serviceName: string) => {
    // taskName contains the service name directly, not the service ID
    return serviceName;
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'service-delivered': 'bg-emerald-100 text-emerald-800',
      ongoing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      assigned: 'bg-purple-100 text-purple-800',
      unassigned: 'bg-gray-100 text-gray-800'
    };

    const displayText = status === 'service-delivered' ? 'Service Delivered' : status.charAt(0).toUpperCase() + status.slice(1);
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || statusColors.unassigned}`}>
        {displayText}
      </span>
    );
  };

  const getPriorityBadge = (taskType: string) => {
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">{filteredTasks.length} tasks found</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
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
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
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
              <React.Fragment key={task.id}>
                <tr className="hover:bg-gray-50">
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
                        Collected: {formatCurrency(task.amountCollected)}
                      </div>
                      {task.unpaidAmount > 0 && (
                        <div className="text-sm text-red-600">
                          Unpaid: {formatCurrency(task.unpaidAmount)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(task.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getPriorityBadge(task.taskType)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {task.assignedTo || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          console.log('Eye button clicked for task:', task.id, task.customerName);
                          alert('Eye button clicked! Task: ' + task.customerName);
                          toggleDetails(task.id);
                        }}
                        className="bg-red-500 text-white px-2 py-1 rounded"
                        title={expandedTasks[task.id] ? 'Hide Details' : 'Show Details'}
                      >
                        👁️ EYE
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedTasks[task.id] && (
                  <tr>
                    <td className="px-6 py-4 bg-gray-50" colSpan={7}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                        <div><span className="font-medium">Serial No:</span> {task.serialNo ? task.serialNo : <span className="text-red-500">No data</span>}</div>
                        <div><span className="font-medium">Date:</span> {task.date ? formatDate(task.date) : <span className="text-red-500">No data</span>}</div>
                        <div><span className="font-medium">Service:</span> {task.taskName ? getServiceName(task.taskName) : <span className="text-red-500">No data</span>}</div>
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

export default TaskList;