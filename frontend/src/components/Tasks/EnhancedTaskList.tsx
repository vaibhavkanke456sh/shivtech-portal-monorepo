import React, { useState } from 'react';
import { Task, Service, Employee } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Edit, UserPlus, Eye, DollarSign, Layers, GripVertical } from 'lucide-react';

interface EnhancedTaskListProps {
  tasks: Task[];
  services: Service[];
  employees: Employee[];
  title: string;
  filter?: (task: Task) => boolean;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onAddPayment?: (task: Task) => void;
  onViewGroup?: (groupId: string) => void;
}

const EnhancedTaskList: React.FC<EnhancedTaskListProps> = ({ 
  tasks, 
  services, 
  employees, 
  title, 
  filter, 
  onTaskUpdate,
  onTaskEdit,
  onTaskDelete,
  onAddPayment,
  onViewGroup
}) => {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropInsertAfter, setDropInsertAfter] = useState(false);
  const [bulkShiftAmount, setBulkShiftAmount] = useState(5);
  // Move feedback: green highlight at new position + golden line indicator for "from"
  // lasts 2 seconds
  const [moveHighlights, setMoveHighlights] = useState<Record<string, { 
    label: string; 
    fromIndex?: number; 
    expiresAt: number;
  }>>({});

  // Search is always performed against the *full* tasks list.
  // This ensures that searching for a service finds matches across *all* tasks
  // (unassigned, assigned, etc.), not just the current overview category.
  let baseList = tasks;
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    baseList = tasks.filter(task =>
      (task.customerName || '').toLowerCase().includes(term) ||
      (task.taskName || '').toLowerCase().includes(term)
    );
    // When actively searching, we deliberately ignore the overview category filter
    // (unassigned/assigned/etc.) so results come from the entire set.
  } else if (filter) {
    baseList = tasks.filter(filter);
  }

  let filteredTasks = baseList;
  
  // Debug logging (note: during search the overview filter is intentionally skipped above)
  if (tasks.length > 0) {
    console.log(`🔍 EnhancedTaskList "${title}" filtering:`, {
      totalTasks: tasks.length,
      afterSearchAndBase: filteredTasks.length,
      searchActive: !!searchTerm.trim(),
      overviewFilterActive: !!filter
    });
  }
  
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

  // Apply local status filter
  if (statusFilter) {
    filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
  }

  // Sort by custom sortOrder (higher = top), then by date desc
  filteredTasks = [...filteredTasks].sort((a, b) => {
    const va = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
    const vb = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
    if (va !== vb) return vb - va;
    return (b.date || '').localeCompare(a.date || '');
  });

  // Drag and drop reorder handlers
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, taskId: string) => {
    setDraggedId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, taskId: string) => {
    e.preventDefault();
    const isBlockDrag = draggedId && selectedTasks.length > 1 && selectedTasks.includes(draggedId);
    const isOverSelfBlock = isBlockDrag && selectedTasks.includes(taskId);
    if (draggedId && draggedId !== taskId && !isOverSelfBlock) {
      setDragOverId(taskId);
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDropInsertAfter(e.clientY > midY);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setDropInsertAfter(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedId;

    if (sourceId && sourceId !== targetId) {
      // If multiple selected and the dragged one is part of selection, move the whole selection as a block
      const selSet = new Set(selectedTasks);
      let idsToMove: string[] = [sourceId];

      if (selectedTasks.length > 1 && selSet.has(sourceId)) {
        // Preserve the relative order they currently have in the visible list
        idsToMove = filteredTasks
          .filter(t => selSet.has(t.id))
          .map(t => t.id);
      }

      reorderBlock(idsToMove, targetId, dropInsertAfter);
    }
    setDraggedId(null);
    setDragOverId(null);
    setDropInsertAfter(false);
  };

  // Move one or more items as a contiguous block (preserving their relative order)
  // Used by drag when multiple are selected, and we want them to stay one below the other.
  const reorderBlock = (movingIds: string[], targetId: string, insertAfter: boolean = false) => {
    if (!movingIds.length) return;

    const list = filteredTasks;
    const movingSet = new Set(movingIds);
    if (movingSet.has(targetId)) {
      // Dropped the block onto one of its own members — no-op
      return;
    }
    // Collect in the order they currently appear (so they stay consecutive after move)
    const movingItems = list.filter(t => movingSet.has(t.id));
    if (movingItems.length === 0) return;

    const remaining = list.filter(t => !movingSet.has(t.id));

    let targetIndex = remaining.findIndex(t => t.id === targetId);
    if (targetIndex < 0) {
      targetIndex = 0;
    }

    let insertPos = targetIndex;
    if (insertAfter) {
      insertPos = targetIndex + 1;
    }

    insertPos = Math.max(0, Math.min(insertPos, remaining.length));

    const newOrdered = [
      ...remaining.slice(0, insertPos),
      ...movingItems,
      ...remaining.slice(insertPos)
    ];

    // Assign fresh sequence to entire newOrdered so block lands exactly at aimed spot
    const base = Date.now() + 1000000;
    newOrdered.forEach((item, i) => {
      onTaskUpdate(item.id, { sortOrder: base - (i * 10) });
    });

    // Highlight the moved items
    const fromInfo: Record<string, number> = {};
    movingIds.forEach(id => {
      const old = list.findIndex(t => t.id === id);
      if (old >= 0) fromInfo[id] = old;
    });
    highlightMove(movingIds, 0, undefined, fromInfo);
  };

  const reorderTask = (draggedId: string, targetId: string, insertAfter: boolean = false) => {
    reorderBlock([draggedId], targetId, insertAfter);
  };

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

  const getVal = (t: Task | undefined): number =>
    t && typeof t.sortOrder === 'number' ? t.sortOrder : 0;

  const handleBulkShift = (delta: number) => {
    if (!selectedTasks.length) return;

    const list = filteredTasks;
    const selSet = new Set(selectedTasks);
    const selectedItems = list.filter(t => selSet.has(t.id));
    if (selectedItems.length === 0) return;

    // Capture "from" positions before the move
    const fromIdx: Record<string, number> = {};
    selectedItems.forEach(item => {
      const idx = list.findIndex(t => t.id === item.id);
      if (idx >= 0) fromIdx[item.id] = idx;
    });

    const remaining = list.filter(t => !selSet.has(t.id));

    // Find original start of the block in the current visible order
    const origMinIdx = list.findIndex(t => selSet.has(t.id));

    // Desired position for the start of the block after the shift
    const targetStart = Math.max(0, origMinIdx + delta);

    // Insert index into the remaining list (selected block will occupy this spot as a unit)
    const insertIdx = Math.min(remaining.length, targetStart);

    const newOrdered = [
      ...remaining.slice(0, insertIdx),
      ...selectedItems,
      ...remaining.slice(insertIdx)
    ];

    // To make the block land exactly at the aimed relative position in the current list,
    // assign a fresh decreasing sortOrder sequence to the entire newOrdered.
    // This guarantees precise landing for small shifts and block moves.
    const base = Date.now() + 1000000;
    newOrdered.forEach((item, i) => {
      onTaskUpdate(item.id, { sortOrder: base - (i * 10) });
    });

    // Highlight: green at new pos + golden from indicator for 2s
    highlightMove(selectedTasks, delta, undefined, fromIdx);

    setSelectedTasks([]);
  };

  // Trigger move feedback:
  // - Green highlight on the task at its NEW position for 2s
  // - Golden line indicator (top border) + optional "from #N" label
  const highlightMove = (taskIds: string[], delta: number, customLabel?: string, fromIndices?: Record<string, number>) => {
    if (!taskIds.length) return;
    const now = Date.now();
    const expiresAt = now + 2000; // 2 seconds

    const updates: Record<string, { label: string; fromIndex?: number; expiresAt: number }> = {};
    taskIds.forEach(id => {
      const label = customLabel || (delta < 0 ? `↑${Math.abs(delta)}` : delta > 0 ? `↓${delta}` : 'moved');
      updates[id] = {
        label,
        fromIndex: fromIndices ? fromIndices[id] : undefined,
        expiresAt
      };
    });

    setMoveHighlights(prev => ({ ...prev, ...updates }));

    // Cleanup expired entries after 2s
    setTimeout(() => {
      const cutoff = Date.now();
      setMoveHighlights(current => {
        const next = { ...current };
        Object.keys(next).forEach(id => {
          if (next[id].expiresAt <= cutoff) delete next[id];
        });
        return next;
      });
    }, 2100);
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
            <p className="text-sm text-gray-600 mt-1">{filteredTasks.length} tasks found <span className="ml-2 text-xs text-emerald-600/70">· drag grip to reorder</span></p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Search:</label>
              <input
                type="text"
                placeholder="Client or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48"
              />
            </div>
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
                <option value="vaishnavi">vaishnavi</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All</option>
                <option value="unassigned">Unassigned</option>
                <option value="assigned">Assigned</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="service-delivered">Service Delivered</option>
              </select>
            </div>
            
            {(dateFilter || assignedToFilter || searchTerm || statusFilter) && (
              <button
                onClick={() => {
                  setDateFilter('');
                  setAssignedToFilter('');
                  setSearchTerm('');
                  setStatusFilter('');
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
                <button
                  onClick={() => {
                    const ids = [...selectedTasks];
                    const currentList = [...filteredTasks];
                    const fromIdx: Record<string, number> = {};
                    ids.forEach(id => {
                      const idx = currentList.findIndex(t => t.id === id);
                      if (idx >= 0) fromIdx[id] = idx;
                    });
                    const base = Date.now();
                    ids.forEach((id, i) => onTaskUpdate(id, { sortOrder: base + (100 - i) }));
                    setSelectedTasks([]);
                    highlightMove(ids, -9999, 'to top', fromIdx);
                  }}
                  className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm hover:bg-emerald-200"
                >
                  Move Top
                </button>
                <button
                  onClick={() => {
                    const ids = [...selectedTasks];
                    const currentList = [...filteredTasks];
                    const fromIdx: Record<string, number> = {};
                    ids.forEach(id => {
                      const idx = currentList.findIndex(t => t.id === id);
                      if (idx >= 0) fromIdx[id] = idx;
                    });
                    const base = -Date.now();
                    ids.forEach((id, i) => onTaskUpdate(id, { sortOrder: base - i }));
                    setSelectedTasks([]);
                    highlightMove(ids, 9999, 'to bottom', fromIdx);
                  }}
                  className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm hover:bg-orange-200"
                >
                  Move Bottom
                </button>

                {/* Bulk relative shift for selected tasks (move block together by N positions) */}
                <div className="flex items-center gap-1 ml-1 pl-2 border-l border-gray-200">
                  <button
                    onClick={() => handleBulkShift(-1)}
                    className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs hover:bg-emerald-200"
                    title="Move selected up 1 position"
                  >
                    ↑1
                  </button>
                  <button
                    onClick={() => handleBulkShift(-5)}
                    className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs hover:bg-emerald-200"
                    title="Move selected up 5 positions"
                  >
                    ↑5
                  </button>

                  <input
                    type="number"
                    min={1}
                    value={bulkShiftAmount}
                    onChange={(e) => setBulkShiftAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-12 px-1.5 py-1 text-xs border border-gray-300 rounded text-center"
                    title="Number of positions to shift selected tasks"
                  />

                  <button
                    onClick={() => handleBulkShift(-bulkShiftAmount)}
                    className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs hover:bg-emerald-200"
                    title={`Move selected up ${bulkShiftAmount} positions`}
                  >
                    Shift Up
                  </button>
                  <button
                    onClick={() => handleBulkShift(bulkShiftAmount)}
                    className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                    title={`Move selected down ${bulkShiftAmount} positions`}
                  >
                    Shift Down
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400" title="Drag rows using the grip to reorder">
                    <GripVertical size={14} />
                  </span>
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
                </div>
              </th>
              <th className="w-8 px-1 py-3 text-center text-xs font-medium text-gray-400" title="Current position in this filtered list (fixed for this view)">
                #
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
            {filteredTasks.map((task, index) => (
              <React.Fragment key={task.id}>
              <tr
                className={`hover:bg-gray-50 transition-colors ${ (draggedId === task.id || (draggedId && selectedTasks.length > 1 && selectedTasks.includes(draggedId) && selectedTasks.includes(task.id)) ) ? 'opacity-40' : ''} ${dragOverId === task.id ? (dropInsertAfter ? 'bg-emerald-50 border-b-2 border-blue-500' : 'bg-emerald-50 border-t-2 border-blue-500') : ''} ${dragOverId === task.id ? 'ring-1 ring-emerald-300' : ''} ${moveHighlights[task.id] && Date.now() < moveHighlights[task.id].expiresAt ? 'bg-green-200 border-t-4 border-yellow-500' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDragLeave={() => setDragOverId(null)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, task.id)}
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-0.5"
                      title="Drag to reorder"
                    >
                      <GripVertical size={14} />
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={() => handleTaskSelect(task.id)}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </td>
                <td className="w-8 px-1 py-4 text-center text-sm font-mono text-gray-500 tabular-nums" title="Position in current list">
                  {index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">{task.serialNo}</div>
                      {task.isGrouped && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                          <Layers size={10} />
                          GROUPED
                        </span>
                      )}
                      {moveHighlights[task.id] && Date.now() < moveHighlights[task.id].expiresAt && (
                        <span 
                          className="text-[10px] font-semibold px-1.5 py-0 rounded bg-white/80 text-green-700 border border-green-300" 
                          title={moveHighlights[task.id].fromIndex !== undefined 
                            ? `Moved from position #${moveHighlights[task.id].fromIndex + 1}` 
                            : 'Recently moved'}
                        >
                          {moveHighlights[task.id].label}
                          {moveHighlights[task.id].fromIndex !== undefined && (
                            <span className="ml-1 text-yellow-600">from #{moveHighlights[task.id].fromIndex + 1}</span>
                          )}
                        </span>
                      )}
                    </div>
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
                    onMouseDown={(e) => e.stopPropagation()}
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
                      onMouseDown={(e) => e.stopPropagation()}
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
                  <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
                    {/* Add Payment Button - only show for tasks with unpaid amount */}
                    {task.unpaidAmount > 0 && onAddPayment && (
                      <button
                        onClick={() => onAddPayment(task)}
                        className="text-emerald-600 hover:text-emerald-800 p-1"
                        title="Add Remaining Payment"
                      >
                        <DollarSign size={16} />
                      </button>
                    )}
                    {task.isGrouped && task.groupId && onViewGroup && (
                      <button
                        onClick={() => onViewGroup(task.groupId!)}
                        className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-xs font-semibold"
                        title="View Group"
                      >
                        <Layers size={12} />
                        Group
                      </button>
                    )}
                    <button
                      onClick={() => onTaskEdit(task)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Edit Task"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => toggleDetails(task.id)}
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
                   {/* Move to top / bottom controls */}
                   <button
                     onClick={() => {
                       const currentIdx = filteredTasks.findIndex(t => t.id === task.id);
                       onTaskUpdate(task.id, { sortOrder: Date.now() });
                       highlightMove([task.id], -9999, 'top', currentIdx >= 0 ? { [task.id]: currentIdx } : undefined);
                     }}
                     className="text-xs px-1.5 py-0.5 border border-gray-300 rounded hover:bg-emerald-50"
                     title="Move to top"
                   >
                     ↑
                   </button>
                   <button
                     onClick={() => {
                       const currentIdx = filteredTasks.findIndex(t => t.id === task.id);
                       onTaskUpdate(task.id, { sortOrder: -Date.now() });
                       highlightMove([task.id], 9999, 'bottom', currentIdx >= 0 ? { [task.id]: currentIdx } : undefined);
                     }}
                     className="text-xs px-1.5 py-0.5 border border-gray-300 rounded hover:bg-orange-50"
                     title="Move to bottom"
                   >
                     ↓
                   </button>
                  </div>
                </td>
              </tr>
                             {expandedTasks[task.id] && (
                <tr>
                  <td className="px-6 py-4 bg-gray-50" colSpan={10}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                      {task.isGrouped && (
                        <div className="md:col-span-2 flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <span className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded-full text-xs font-bold">
                            <Layers size={12} />
                            GROUPED TASK
                          </span>
                          <span className="text-purple-700 text-sm">This task is part of a group session</span>
                          {task.groupId && onViewGroup && (
                            <button
                              onClick={() => onViewGroup(task.groupId!)}
                              className="ml-auto flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700"
                            >
                              <Layers size={12} />
                              View Group
                            </button>
                          )}
                        </div>
                      )}
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
                      
                      {task.paymentHistory && task.paymentHistory.length > 0 && (
                        <div className="md:col-span-2">
                          <div className="font-medium mb-2">Payment History:</div>
                          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Date</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Type</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Amount</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Payment Mode</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Remarks</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {task.paymentHistory.map((payment, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm">{formatDate(payment.paidAt)}</td>
                                    <td className="px-4 py-2 text-sm">
                                      {payment.isInitialPayment ? (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Initial Payment</span>
                                      ) : (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Unpaid Payment</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-medium">{formatCurrency(payment.amount)}</td>
                                    <td className="px-4 py-2 text-sm capitalize">
                                      {payment.paymentMode === 'personal-qr' ? 'Personal QR (Vaibhav)' : payment.paymentMode.replace('-', ' ')}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{payment.paymentRemarks || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
            {/* Drop zone at bottom of list to move items to end */}
            {filteredTasks.length > 0 && (
              <tr
                className={`h-5 transition-colors ${dragOverId === '__bottom__' ? 'bg-emerald-100 border-t border-emerald-300' : 'border-t border-transparent'}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId('__bottom__');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
                  if (sourceId && filteredTasks.length > 0) {
                    const lastId = filteredTasks[filteredTasks.length - 1].id;
                    if (sourceId !== lastId) {
                      const selSet = new Set(selectedTasks);
                      let idsToMove: string[] = [sourceId];
                      if (selectedTasks.length > 1 && selSet.has(sourceId)) {
                        idsToMove = filteredTasks
                          .filter(t => selSet.has(t.id))
                          .map(t => t.id);
                      }
                      reorderBlock(idsToMove, lastId, true);
                    }
                  }
                  setDraggedId(null);
                  setDragOverId(null);
                  setDropInsertAfter(false);
                }}
                onDragLeave={() => setDragOverId(null)}
              >
                <td colSpan={10} className="px-2 py-0 text-[10px] text-gray-400 select-none">
                  {dragOverId === '__bottom__' ? 'Drop here to move to bottom' : ''}
                </td>
              </tr>
            )}
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