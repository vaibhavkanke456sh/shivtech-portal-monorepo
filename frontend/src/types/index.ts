export interface StatusCounts {
  SDT: number; // Service Delivered Tasks
  CTT: number; // Completed Tasks
  OGT: number; // Ongoing Tasks
  AST: number; // Assigned Tasks
  UAT: number; // Unassigned Tasks
  IMT: number; // Do Now Tasks
  URT: number; // Urgent Tasks
  UPT: number; // Unpaid Tasks
}

export interface MobileBalances {
  airtel: number;
  jio: number;
  bsnl: number;
  vodafone: number;
}

export interface BankBalances {
  bank: number;
  cash: number;
  redmil: number;
  spicemoney: number;
  airtelpmt: number;
  vaibhav: number;
  omkar: number;
  uma: number;
  shopqr: number;
}

export interface TodayMetrics {
  sales: number;
  profit: number;
  expense: number;
}

export interface Service {
  id: string;
  name: string;
  amount: number;
}

export interface PaymentHistoryEntry {
  amount: number;
  paymentMode: 'cash' | 'shop-qr' | 'personal-qr' | 'other';
  paymentRemarks?: string;
  paidAt: string;
  isInitialPayment: boolean;
}

export interface Task {
  id: string;
  serialNo: string;
  date: string;
  taskName: string;
  customerName: string;
  customerType: 'new' | 'old';
  serviceDeliveryDate?: string;
  taskType: 'do-now' | 'urgent' | 'normal';
  assignedTo?: string;
  serviceCharge: number;
  finalCharges: number;
  paymentMode: 'cash' | 'shop-qr' | 'personal-qr' | 'other';
  paymentRemarks?: string;
  amountCollected: number;
  unpaidAmount: number;
  paymentHistory?: PaymentHistoryEntry[];
  documentDetails?: string;
  uploadedDocuments?: UploadedDocument[];
  remarks?: string;
  status: 'service-delivered' | 'ongoing' | 'completed' | 'assigned' | 'unassigned';
  createdById?: string;
  updatedById?: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface UploadedDocument {
  id: string;
  name: string;
  file: File;
  uploadedAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  altPhone?: string;
  notes?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
}

export interface DashboardData {
  statusCounts: StatusCounts;
  mobileBalances: MobileBalances;
  bankBalances: BankBalances;
  today: TodayMetrics;
  chartSalesProfit: number[];
  chartLabels: string[];
  services: Service[];
  employees: Employee[];
  savedTasks: string[];
}