import { DashboardData, Task, Client } from '../types';

export const dashboardData: DashboardData = {
  statusCounts: {
    SDT: 12,
    CTT: 38,
    OGT: 3,
    AST: 5,
    UAT: 2,
    IMT: 1,
    URT: 0
  },
  mobileBalances: {
    airtel: 3500,
    jio: 120,
    bsnl: 820,
    vodafone: 450
  },
  bankBalances: {
    bank: 3500,
    cash: 1200,
    redmil: 600,
    spicemoney: 820,
    airtelpmt: 450
  },
  today: {
    sales: 1450,
    profit: 380,
    expense: 160
  },
  chartSalesProfit: [900, 1200, 1150, 1180, 900, 700, 800],
  chartLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  services: [
    { id: 'srv_recharge', name: 'Recharge', amount: 50 },
    { id: 'srv_aadhar', name: 'Aadhar Update', amount: 100 },
    { id: 'srv_bill', name: 'Bill Payment', amount: 25 },
    { id: 'srv_print', name: 'Print / Copy', amount: 10 },
    { id: 'srv_passport', name: 'Passport Application', amount: 200 },
    { id: 'srv_pan', name: 'PAN Card', amount: 150 }
  ],
  employees: [
    { id: 'emp_vaibhav', name: 'vaibhav' },
    { id: 'emp_omkar', name: 'omkar' },
    { id: 'emp_vaishnavi', name: 'vaishnavi' }
  ],
  savedTasks: [
    'Mobile Recharge',
    'Aadhar Update',
    'Bill Payment',
    'Print Documents',
    'Passport Application',
    'PAN Card Application',
    'Bank Account Opening',
    'Insurance Premium',
    'Electricity Bill',
    'Water Bill'
  ]
};

export const mockTasks: Task[] = [
  {
    id: '1',
    serialNo: 'TSK-20250101-001',
    date: '2025-01-01',
    taskName: 'Mobile Recharge',
    customerName: 'John Doe',
    customerType: 'new',
    serviceDeliveryDate: '2025-01-02',
    taskType: 'normal',
    assignedTo: 'Staff 1',
    serviceCharge: 50,
    finalCharges: 50,
    paymentMode: 'shop-qr',
    amountCollected: 50,
    unpaidAmount: 0,
    documentDetails: 'Stored in cabinet A-1',
    remarks: 'Regular customer',
    status: 'completed'
  },
  {
    id: '2',
    serialNo: 'TSK-20250101-002',
    date: '2025-01-01',
    taskName: 'Aadhar Update',
    customerName: 'Jane Smith',
    customerType: 'old',
    taskType: 'urgent',
    serviceCharge: 100,
    finalCharges: 100,
    paymentMode: 'cash',
    amountCollected: 0,
    unpaidAmount: 100,
    documentDetails: 'Documents pending',
    remarks: 'VIP customer - priority handling',
    status: 'unassigned'
  }
];

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'John Doe',
    phone: '+91 9876543210',
    altPhone: '+91 9876543211',
    notes: 'Regular customer',
    createdAt: '2025-01-01'
  },
  {
    id: '2',
    name: 'Jane Smith',
    phone: '+91 9876543212',
    notes: 'VIP customer',
    createdAt: '2025-01-01'
  }
];