// Quick test to verify filtering logic
const sampleTasks = [
  {
    id: '1',
    status: 'unassigned',
    taskType: 'normal',
    unpaidAmount: 0
  },
  {
    id: '2',
    status: 'assigned',
    taskType: 'urgent',
    unpaidAmount: 100
  },
  {
    id: '3',
    status: 'completed',
    taskType: 'do-now',
    unpaidAmount: 50
  },
  {
    id: '4',
    status: 'ongoing',
    taskType: 'normal',
    unpaidAmount: 0
  }
];

// Test the filtering logic
const filters = {
  unassigned: (task) => task.status === 'unassigned',
  assigned: (task) => task.status === 'assigned',
  ongoing: (task) => task.status === 'ongoing',
  completed: (task) => task.status === 'completed',
  'do-now': (task) => task.taskType === 'do-now' && task.status !== 'completed',
  urgent: (task) => task.taskType === 'urgent' && task.status !== 'completed',
  unpaid: (task) => task.unpaidAmount > 0
};

console.log('🧪 Testing filter logic:');
Object.entries(filters).forEach(([filterName, filterFn]) => {
  const matches = sampleTasks.filter(filterFn);
  console.log(`  ${filterName}: ${matches.length} tasks`, matches.map(t => t.id));
});

console.log('\n📊 Task appearances per filter:');
sampleTasks.forEach(task => {
  const appearsIn = Object.entries(filters)
    .filter(([, filterFn]) => filterFn(task))
    .map(([name]) => name);
  console.log(`  Task ${task.id}: appears in [${appearsIn.join(', ')}]`);
});