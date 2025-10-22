import React from 'react';
import { Task } from '../../types';

interface TaskOverviewProps {
  tasks: Task[];
  onFilterChange: (filter: string) => void;
  activeFilter: string;
}

const TaskOverview: React.FC<TaskOverviewProps> = ({ tasks, onFilterChange, activeFilter }) => {
  const getTaskCounts = () => {
    return {
      unassigned: tasks.filter(t => t.status === 'unassigned').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      ongoing: tasks.filter(t => t.status === 'ongoing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      doNow: tasks.filter(t => t.taskType === 'do-now').length,
      urgent: tasks.filter(t => t.taskType === 'urgent' && t.status !== 'completed').length,
      delivered: tasks.filter(t => t.status === 'service-delivered').length,
      unpaid: tasks.filter(t => t.unpaidAmount > 0).length
    };
  };

  const counts = getTaskCounts();

  const taskCards = [
    { 
      key: 'unassigned', 
      label: 'Unassigned Tasks', 
      count: counts.unassigned, 
      color: 'bg-gray-100 text-gray-800 border-gray-300' 
    },
    { 
      key: 'assigned', 
      label: 'Assigned Tasks', 
      count: counts.assigned, 
      color: 'bg-blue-100 text-blue-800 border-blue-300' 
    },
    { 
      key: 'ongoing', 
      label: 'Ongoing Tasks', 
      count: counts.ongoing, 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300' 
    },
    { 
      key: 'completed', 
      label: 'Completed Tasks', 
      count: counts.completed, 
      color: 'bg-green-100 text-green-800 border-green-300' 
    },
    { 
      key: 'do-now', 
      label: 'Do Now Tasks', 
      count: counts.doNow, 
      color: 'bg-red-500 text-white border-red-600' 
    },
    { 
      key: 'urgent', 
      label: 'Urgent Tasks', 
      count: counts.urgent, 
      color: 'bg-red-200 text-red-800 border-red-400' 
    },
    { 
      key: 'delivered', 
      label: 'Service Delivered', 
      count: counts.delivered, 
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300' 
    },
    { 
      key: 'unpaid', 
      label: 'Unpaid Tasks', 
      count: counts.unpaid, 
      color: 'bg-orange-100 text-orange-800 border-orange-300' 
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
      {taskCards.map((card) => (
        <button
          key={card.key}
          onClick={() => onFilterChange(card.key)}
          className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-105 ${
            activeFilter === card.key 
              ? 'ring-2 ring-emerald-500 ring-offset-2' 
              : ''
          } ${card.color}`}
        >
          <div className="text-2xl font-bold">{card.count}</div>
          <div className="text-sm font-medium mt-1">{card.label}</div>
        </button>
      ))}
    </div>
  );
};

export default TaskOverview;