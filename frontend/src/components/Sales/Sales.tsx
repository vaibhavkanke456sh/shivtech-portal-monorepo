import React, { useState, useEffect } from "react";
import { apiFetch } from '../../utils/api';

const serviceCategories = {
  "Financial Transactions": [
    { id: "ADD NEW ENTRY", name: "ADD NEW ENTRY", icon: "➕", color: "bg-purple-500" },
    { id: "SHOW ENTRIES", name: "Show Entries", icon: "📋", color: "bg-indigo-500" },
    { id: "ADD AEPS TRANSACTION", name: "Add AEPS Transaction", icon: "💳", color: "bg-blue-500" },
    { id: "ADD FUND TRANSFER ENTRY", name: "Add Fund Transfer Entry", icon: "💸", color: "bg-blue-500" },
    { id: "ONLINE RECEIVED CASH GIVEN.", name: "Online Received / Cash Given", icon: "💰", color: "bg-blue-500" },
    { id: "RECHAREG ENTRY", name: "Recharge Entry", icon: "📱", color: "bg-blue-500" },
    { id: "BILL PAYMENT ENTRY", name: "Bill Payment Entry", icon: "🧾", color: "bg-blue-500" }
  ],
  "Services": [
    { id: "SIM SOLD", name: "SIM Sold", icon: "📶", color: "bg-green-500" },
    { id: "PASSPORT PHOTOS", name: "Passport Photos", icon: "📷", color: "bg-green-500" },
    { id: "LAMINATIONS", name: "Laminations", icon: "🔖", color: "bg-green-500" }
  ],
  "Printing & Documentation": [
    { id: "XEROX", name: "Xerox", icon: "📄", color: "bg-orange-500" },
    { id: "PRINT", name: "Print", icon: "🖨️", color: "bg-orange-500" }
  ]
};

const salesTabs = [
  "ADD NEW ENTRY",
  "SHOW ENTRIES",
  "ADD AEPS TRANSACTION",
  "ADD FUND TRANSFER ENTRY",
  "ONLINE RECEIVED CASH GIVEN.",
  "RECHAREG ENTRY",
  "BILL PAYMENT ENTRY",
  "SIM SOLD",
  "XEROX",
  "PRINT",
  "PASSPORT PHOTOS",
  "LAMINATIONS"
];

interface MobileBalanceForm {
  companyName: string;
  operationType: string; // 'add' or 'remove'
  amount: string;
  reason: string;
}

interface BankCashAepsForm {
  companyName: string;
  operationType: string; // 'add' or 'remove'
  amount: string;
  reason: string;
}

interface FundTransferForm {
  customerName: string;
  customerNumber: string;
  beneficiaryName: string;
  beneficiaryNumber: string;
  applicationName: string;
  transferredFrom: string;
  transferredFromRemark: string;
  amount: string;
  cashReceived: string;
  addedInGala: string;
  addedInGalaRemark: string;
  commissionType: string;
  commissionAmount: string;
  commissionRemark: string;
}

interface OnlineReceivedCashGivenForm {
  senderName: string;
  senderNumber: string;
  receivedOnApplication: string;
  accountHolder: string;
  accountHolderRemark: string;
  receivedOnlineAmount: string;
  cashGiven: string;
  moneyDistributionType: string;
  howMoneyGivenSingle: string;
  howMoneyGivenSingleRemark: string;
  howMoneyGivenSinglePersonName: string;
  firstPartMoneyGiven: string;
  firstPartMoneyGivenRemark: string;
  firstPartMoneyGivenPersonName: string;
  firstPartAmount: string;
  remainingPartMoneyGiven: string;
  remainingPartMoneyGivenRemark: string;
  remainingPartMoneyGivenPersonName: string;
  remainingPartAmount: string;
  commissionType: string;
  commissionAmount: string;
  commissionRemark: string;
  remarks: string;
  receivedOnlineFrom?: string; // Optional field for balance calculations
}

const defaultMobileBalanceForm: MobileBalanceForm = {
  companyName: '',
  operationType: '',
  amount: '',
  reason: '',
};

const defaultBankCashAepsForm: BankCashAepsForm = {
  companyName: '',
  operationType: '',
  amount: '',
  reason: '',
};

const defaultFundTransferForm: FundTransferForm = {
  customerName: 'UNKNOWN',
  customerNumber: '00',
  beneficiaryName: '',
  beneficiaryNumber: '',
  applicationName: 'PhonePe',
  transferredFrom: 'Shop Accounts',
  transferredFromRemark: '',
  amount: '',
  cashReceived: 'Yes',
  addedInGala: 'Yes',
  addedInGalaRemark: '',
  commissionType: 'No Commission',
  commissionAmount: '',
  commissionRemark: '',
};

const defaultOnlineReceivedCashGivenForm: OnlineReceivedCashGivenForm = {
  senderName: '',
  senderNumber: '',
  receivedOnApplication: 'Shop QR',
  accountHolder: 'Shop',
  accountHolderRemark: '',
  receivedOnlineAmount: '0',
  cashGiven: '0',
  moneyDistributionType: 'Full Amount given by One Person',
  howMoneyGivenSingle: 'Cash from Gala',
  howMoneyGivenSingleRemark: '',
  howMoneyGivenSinglePersonName: '',
  firstPartMoneyGiven: 'Cash from Gala',
  firstPartMoneyGivenRemark: '',
  firstPartMoneyGivenPersonName: '',
  firstPartAmount: '',
  remainingPartMoneyGiven: 'Cash from Gala',
  remainingPartMoneyGivenRemark: '',
  remainingPartMoneyGivenPersonName: '',
  remainingPartAmount: '',
  commissionType: 'No Commission',
  commissionAmount: '',
  commissionRemark: '',
  remarks: '',
};

interface AEPSForm {
  aepsIdType: string;
  aepsIdName: string;
  amount: string;
  givenToCustomer: string;
  givenToCustomerRemark: string;
  givenToCustomerOther: string;
  withdrawnType: string;
  commissionType: string;
  commissionAmount: string;
  commissionRemark: string;
  paymentApplication?: string;
  transferredFrom?: string;
  transferredFromRemark?: string;
}

const defaultAEPSForm: AEPSForm = {
  aepsIdType: '',
  aepsIdName: '',
  amount: '',
  givenToCustomer: '',
  givenToCustomerRemark: '',
  givenToCustomerOther: '',
  withdrawnType: '',
  commissionType: '',
  commissionAmount: '',
  commissionRemark: '',
  paymentApplication: '',
  transferredFrom: '',
  transferredFromRemark: '',
};


type DashboardEntry =
  | ({ type: 'AEPS'; date?: string } & AEPSForm)
  | ({ type: 'ADD FUND TRANSFER ENTRY'; date?: string } & FundTransferForm)
  | ({ type: 'MOBILE_BALANCE'; date?: string } & MobileBalanceForm)
  | ({ type: 'BANK_CASH_AEPS'; date?: string } & BankCashAepsForm)
  | ({ type: 'ONLINE_RECEIVED_CASH_GIVEN'; date?: string } & OnlineReceivedCashGivenForm)
  | { type: string; amount: string; date?: string };

export type { DashboardEntry };

interface SalesProps {
  token?: string;
  onAepsBalanceUpdate?: (aepsIdType: string, amount: number, payoutInfo?: { transferredFrom?: string; cashFromGala?: boolean; withdrawnFromId?: boolean; commissionType?: string; commissionAmount?: number }) => void;
  onFundTransferBalanceUpdate?: (
    account: 'vaibhav' | 'omkar' | 'uma' | 'shopaccounts' | 'cash',
    amount: number,
    commissionType?: 'cash' | 'online',
    commissionAmount?: number
  ) => void;
  onMobileBalanceUpdate?: (
    companyName: string,
    operationType: 'add' | 'remove',
    amount: number
  ) => void;
  onBankCashAepsUpdate?: (
    companyName: string,
    operationType: 'add' | 'remove',
    amount: number
  ) => void;
  onBalanceRecalculation?: (entries: any[]) => void;
  dashboardEntries: DashboardEntry[];
  setDashboardEntries: React.Dispatch<React.SetStateAction<DashboardEntry[]>>;
}

const Sales: React.FC<SalesProps> = ({ token, onAepsBalanceUpdate, onFundTransferBalanceUpdate, onMobileBalanceUpdate, onBankCashAepsUpdate, onBalanceRecalculation, dashboardEntries, setDashboardEntries }) => {

  const [activeTab, setActiveTab] = useState(0);
  const [amounts, setAmounts] = useState(Array(salesTabs.length).fill(""));
  const [aepsForm, setAepsForm] = useState<AEPSForm>(defaultAEPSForm);
  const [fundTransferForm, setFundTransferForm] = useState<FundTransferForm>(defaultFundTransferForm);
  const [onlineReceivedCashGivenForm, setOnlineReceivedCashGivenForm] = useState<OnlineReceivedCashGivenForm>(defaultOnlineReceivedCashGivenForm);
  
  // Debug: Log activeTab changes
  console.log('=== Current activeTab:', activeTab);
  
  // Debug: Log when component mounts
  useEffect(() => {
    console.log('🚀 Sales component has mounted!');
    console.log('📊 Initial activeTab:', activeTab);
  }, []);

  // Debug: Log when OnlineReceivedCashGiven form is displayed
  useEffect(() => {
    if (activeTab === 4) {
      console.log('🎯 OnlineReceivedCashGiven form is now being displayed!');
      console.log('📝 Form data:', onlineReceivedCashGivenForm);
    }
  }, [activeTab, onlineReceivedCashGivenForm]);
  const [mobileBalanceForm, setMobileBalanceForm] = useState<MobileBalanceForm>(defaultMobileBalanceForm);
  const [bankCashAepsForm, setBankCashAepsForm] = useState<BankCashAepsForm>(defaultBankCashAepsForm);
  const [showModal, setShowModal] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("");
  const [showAddNewEntryForm, setShowAddNewEntryForm] = useState(false);
  const [addNewEntryType, setAddNewEntryType] = useState<'mobile' | 'bank'>('mobile');
  const [showEntriesModal, setShowEntriesModal] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterServiceType, setFilterServiceType] = useState('all');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<DashboardEntry | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Validation functions
  const validateAepsForm = (form: AEPSForm): string | null => {
    if (!form.aepsIdType) return 'AEPS ID Type is required';
    if (!form.amount || parseFloat(form.amount) <= 0) return 'Valid amount is required';
    if (!form.givenToCustomer) return 'Given to Customer field is required';
    if (!form.commissionType) return 'Commission type is required';
    return null;
  };

  const validateMobileBalanceForm = (form: MobileBalanceForm): string | null => {
    if (!form.companyName?.trim()) return 'Company name is required';
    if (!form.operationType) return 'Operation type is required';
    if (!form.amount || parseFloat(form.amount) <= 0) return 'Valid amount is required';
    if (!form.reason?.trim()) return 'Reason is required';
    return null;
  };

  const validateBankCashAepsForm = (form: BankCashAepsForm): string | null => {
    if (!form.companyName?.trim()) return 'Company name is required';
    if (!form.operationType) return 'Operation type is required';
    if (!form.amount || parseFloat(form.amount) <= 0) return 'Valid amount is required';
    if (!form.reason?.trim()) return 'Reason is required';
    return null;
  };

  const validateFundTransferForm = (form: FundTransferForm): string | null => {
    if (!form.customerName?.trim()) return 'Customer name is required';
    if (!form.customerNumber?.trim()) return 'Customer number is required';
    if (!form.beneficiaryName?.trim()) return 'Beneficiary name is required';
    if (!form.beneficiaryNumber?.trim()) return 'Beneficiary number is required';
    if (!form.applicationName) return 'Application name is required';
    if (!form.transferredFrom) return 'Transferred from field is required';
    if (!form.amount || parseFloat(form.amount) <= 0) return 'Valid amount is required';
    if (!form.cashReceived) return 'Cash received field is required';
    if (!form.addedInGala) return 'Added in Gala field is required';
    if (!form.commissionType) return 'Commission type is required';
    return null;
  };

  // Show success/error messages
  const showMessage = (message: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccess(message);
      setError(null);
    } else {
      setError(message);
      setSuccess(null);
    }
    setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 5000);
  };

  // Update filtered entries based on current filters
  const updateFilteredEntries = () => {
    // Only include local dashboardEntries that don't have an _id (meaning they're not yet saved to API)
    const localOnlyEntries = dashboardEntries.filter(entry => !entry._id);
    // Combine API entries with local-only entries to prevent duplicates
    const allEntries = [...(Array.isArray(entries) ? entries : []), ...localOnlyEntries];
    
    const filtered = allEntries.filter(entry => {
      // Filter by service type
      if (filterServiceType !== 'all') {
        if (filterServiceType === 'other') {
          const knownTypes = [
            'MOBILE_BALANCE', 'BANK_CASH_AEPS', 'AEPS', 'ADD FUND TRANSFER ENTRY',
            'RECHARGE_ENTRY', 'BILL_PAYMENT_ENTRY', 'SIM_SOLD', 'XEROX', 
            'PRINT', 'PASSPORT_PHOTOS', 'LAMINATIONS'
          ];
          if (knownTypes.includes(entry.type)) {
            return false;
          }
        } else if (entry.type !== filterServiceType) {
          return false;
        }
      }

      // Filter by date range
      if (filterDateFrom || filterDateTo) {
        const entryDate = entry.date ? new Date(entry.date) : 
                     entry.createdAt ? new Date(entry.createdAt) : 
                     entry.timestamp ? new Date(entry.timestamp) : new Date();
        const fromDate = filterDateFrom ? new Date(filterDateFrom) : null;
        const toDate = filterDateTo ? new Date(filterDateTo) : null;

        // Normalize dates to compare only date part, not time
        const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
        const fromDateOnly = fromDate ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()) : null;
        const toDateOnly = toDate ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()) : null;

        if (fromDateOnly && entryDateOnly < fromDateOnly) return false;
        if (toDateOnly && entryDateOnly > toDateOnly) return false;
      }

      return true;
    });
    setFilteredEntries(filtered);
  };

  // Fetch entries from backend
  const fetchEntries = async () => {
    try {
      setLoading(true);
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await apiFetch('/api/data/sales-entries', { headers });
      const data = await response.json();
      if (data.success) {
        // Ensure data.data.entries is an array before setting entries
        const entriesData = Array.isArray(data.data?.entries) ? data.data.entries : [];
        setEntries(entriesData);
        // Trigger balance recalculation from the fetched entries
        if (onBalanceRecalculation) {
          onBalanceRecalculation(entriesData);
        }
        // Clear dashboardEntries that have been successfully saved to API (have _id)
        setDashboardEntries(prev => prev.filter(entry => !entry._id));
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
      // Ensure entries remains an array even on error
      setEntries([]);
      // Don't clear dashboardEntries on error - they should persist locally
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    setFilterDateFrom(today);
    setFilterDateTo(today);
  }, []);

  // Update filtered entries when entries or filters change
  useEffect(() => {
    updateFilteredEntries();
  }, [entries, dashboardEntries, filterServiceType, filterDateFrom, filterDateTo]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmounts = [...amounts];
    newAmounts[activeTab] = e.target.value;
    setAmounts(newAmounts);
  };

  const handleAepsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAepsForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAepsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationError = validateAepsForm(aepsForm);
    if (validationError) {
      showMessage(validationError, 'error');
      return;
    }
    
    setLoading(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await apiFetch('/api/data/sales-entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entryType: 'AEPS',
          data: {
            ...aepsForm,
            amount: parseFloat(aepsForm.amount || '0'),
            commissionAmount: parseFloat(aepsForm.commissionAmount || '0')
          }
        })
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchEntries();
        setAepsForm(defaultAEPSForm);
        showMessage('AEPS entry saved successfully!', 'success');
        closeModal();
      } else {
        showMessage(data.message || 'Failed to save AEPS entry', 'error');
      }
    } catch (error) {
      console.error('Error saving AEPS entry:', error);
      showMessage('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
    // Update AEPS balance in real time
    if (onAepsBalanceUpdate && aepsForm.aepsIdType && aepsForm.amount) {
      const amt = parseFloat(aepsForm.amount);
      if (!isNaN(amt)) {
        // If payout is Online, pass transferredFrom for deduction
        const commissionAmt = parseFloat(aepsForm.commissionAmount);
        if (aepsForm.givenToCustomer === 'Online') {
          onAepsBalanceUpdate(aepsForm.aepsIdType, amt, {
            transferredFrom: aepsForm.transferredFrom,
            commissionType: aepsForm.commissionType,
            commissionAmount: commissionAmt
          });
        } else if (aepsForm.givenToCustomer === 'Cash from Gala') {
          onAepsBalanceUpdate(aepsForm.aepsIdType, amt, {
            cashFromGala: true,
            commissionType: aepsForm.commissionType,
            commissionAmount: commissionAmt
          });
        } else if (aepsForm.givenToCustomer === 'Withdrawn from ID') {
          onAepsBalanceUpdate(aepsForm.aepsIdType, amt, {
            withdrawnFromId: true,
            commissionType: aepsForm.commissionType,
            commissionAmount: commissionAmt
          });
        } else {
          onAepsBalanceUpdate(aepsForm.aepsIdType, amt, {
            commissionType: aepsForm.commissionType,
            commissionAmount: commissionAmt
          });
        }
      }
    }
    setAepsForm(defaultAEPSForm);
  };


  const handleFundTransferChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFundTransferForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOnlineReceivedCashGivenChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setOnlineReceivedCashGivenForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMobileBalanceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMobileBalanceForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBankCashAepsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setBankCashAepsForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMobileBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationError = validateMobileBalanceForm(mobileBalanceForm);
    if (validationError) {
      showMessage(validationError, 'error');
      return;
    }
    
    setLoading(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await apiFetch('/api/data/sales-entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entryType: 'MOBILE_BALANCE',
          data: {
            ...mobileBalanceForm,
            amount: parseFloat(mobileBalanceForm.amount || '0')
          }
        })
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchEntries();
        setMobileBalanceForm(defaultMobileBalanceForm);
        showMessage('Mobile balance entry saved successfully!', 'success');
      } else {
        showMessage(data.message || 'Failed to save mobile balance entry', 'error');
      }
    } catch (error) {
      console.error('Error saving mobile balance entry:', error);
      showMessage('Network error. Please try again.', 'error');
      
      // Removed fallback local state update to prevent duplicates after refresh
    } finally {
      setLoading(false);
    }
    
    // Note: Balance updates are now handled by onBalanceRecalculation after fetchEntries()
    setMobileBalanceForm(defaultMobileBalanceForm);
    setShowAddNewEntryForm(false);
  };

  const handleBankCashAepsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationError = validateBankCashAepsForm(bankCashAepsForm);
    if (validationError) {
      showMessage(validationError, 'error');
      return;
    }
    
    setLoading(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await apiFetch('/api/data/sales-entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entryType: 'BANK_CASH_AEPS',
          data: {
            ...bankCashAepsForm,
            amount: parseFloat(bankCashAepsForm.amount || '0')
          }
        })
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchEntries();
        setBankCashAepsForm(defaultBankCashAepsForm);
        showMessage('Bank cash AEPS entry saved successfully!', 'success');
      } else {
        showMessage(data.message || 'Failed to save bank cash AEPS entry', 'error');
      }
    } catch (error) {
      console.error('Error saving bank cash AEPS entry:', error);
      showMessage('Network error. Please try again.', 'error');
      
      // Removed fallback local state update to prevent duplicates after refresh
    } finally {
      setLoading(false);
    }
    
    // Note: Balance updates are now handled by onBalanceRecalculation after fetchEntries()
    setBankCashAepsForm(defaultBankCashAepsForm);
    setShowAddNewEntryForm(false);
  };

  // Enhanced Fund Transfer logic: update dashboard balances for Vaibhav, Omkar, Uma
  const handleFundTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationError = validateFundTransferForm(fundTransferForm);
    if (validationError) {
      showMessage(validationError, 'error');
      return;
    }
    
    setLoading(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await apiFetch('/api/data/sales-entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entryType: 'ADD_FUND_TRANSFER_ENTRY',
          data: {
            ...fundTransferForm,
            amount: parseFloat(fundTransferForm.amount || '0'),
            commissionAmount: parseFloat(fundTransferForm.commissionAmount || '0')
          }
        })
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchEntries();
        setFundTransferForm(defaultFundTransferForm);
        showMessage('Fund transfer entry saved successfully!', 'success');
        closeModal();
      } else {
        showMessage(data.message || 'Failed to save fund transfer entry', 'error');
      }
    } catch (error) {
      console.error('Error saving fund transfer entry:', error);
      showMessage('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
    // Real-time deduction from Vaibhav, Omkar, Uma, Shop Accounts
    if (onFundTransferBalanceUpdate && fundTransferForm.transferredFrom && fundTransferForm.amount) {
      const amt = parseFloat(fundTransferForm.amount);
      const commissionType = fundTransferForm.commissionType?.toLowerCase() === 'cash' ? 'cash' : (fundTransferForm.commissionType?.toLowerCase() === 'online' ? 'online' : undefined);
      const commissionAmount = parseFloat(fundTransferForm.commissionAmount);
      if (!isNaN(amt)) {
        if (fundTransferForm.transferredFrom === 'Vaibhav') {
          onFundTransferBalanceUpdate('vaibhav', amt, commissionType, commissionAmount);
        } else if (fundTransferForm.transferredFrom === 'Omkar') {
          onFundTransferBalanceUpdate('omkar', amt, commissionType, commissionAmount);
        } else if (fundTransferForm.transferredFrom === 'Uma') {
          onFundTransferBalanceUpdate('uma', amt, commissionType, commissionAmount);
        } else if (fundTransferForm.transferredFrom === 'Shop Accounts') {
          onFundTransferBalanceUpdate('shopaccounts', amt, commissionType, commissionAmount);
        }
        if (fundTransferForm.cashReceived === 'Yes' && fundTransferForm.addedInGala === 'Yes') {
          onFundTransferBalanceUpdate('cash', -amt);
        }
      }
    }
    setFundTransferForm(defaultFundTransferForm);
  };

  const handleOnlineReceivedCashGivenSubmit = async (e: React.FormEvent) => {
    console.log('=== FORM SUBMIT FUNCTION CALLED ===');
    e.preventDefault();
    console.log('Form submission started at:', new Date().toISOString());
    console.log('Form data:', onlineReceivedCashGivenForm);
    console.log('Money distribution type:', onlineReceivedCashGivenForm.moneyDistributionType);
    console.log('Remaining part person name:', onlineReceivedCashGivenForm.remainingPartMoneyGivenPersonName);
    console.log('Token available:', !!token);
    console.log('Token value:', token);
    
    try {
      setLoading(true);
      
      const entryData = {
        type: 'ONLINE_RECEIVED_CASH_GIVEN',
        ...onlineReceivedCashGivenForm,
        timestamp: new Date().toISOString(),
      };

      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      // Map frontend fields to backend model fields
      const backendData = {
        senderName: onlineReceivedCashGivenForm.senderName,
        senderNumber: onlineReceivedCashGivenForm.senderNumber,
        receivedOnApplication: onlineReceivedCashGivenForm.receivedOnApplication,
        accountHolder: onlineReceivedCashGivenForm.accountHolder,
        accountHolderRemark: onlineReceivedCashGivenForm.accountHolderRemark,
        receivedOnlineAmount: parseFloat(onlineReceivedCashGivenForm.receivedOnlineAmount) || 0,
        cashGiven: parseFloat(onlineReceivedCashGivenForm.cashGiven) || 0,
        receivedOnlineFrom: onlineReceivedCashGivenForm.accountHolder,
        moneyDistributionType: onlineReceivedCashGivenForm.moneyDistributionType,
        commissionType: onlineReceivedCashGivenForm.commissionType,
        commissionAmount: parseFloat(onlineReceivedCashGivenForm.commissionAmount) || 0,
        commissionRemark: onlineReceivedCashGivenForm.commissionRemark,
        remarks: onlineReceivedCashGivenForm.remarks
      };

      // Always include relevant fields based on moneyDistributionType
      if (onlineReceivedCashGivenForm.moneyDistributionType === 'Full Amount given by One Person') {
        // Single person scenario - always include these fields
        backendData.howMoneyGivenSingle = onlineReceivedCashGivenForm.howMoneyGivenSingle;
        if (onlineReceivedCashGivenForm.howMoneyGivenSinglePersonName && onlineReceivedCashGivenForm.howMoneyGivenSinglePersonName.trim() !== '') {
          backendData.howMoneyGivenSinglePersonName = onlineReceivedCashGivenForm.howMoneyGivenSinglePersonName;
        }
      } else if (onlineReceivedCashGivenForm.moneyDistributionType === 'Full Amount given by Two Persons') {
        // Two persons scenario - always include required fields
        backendData.firstPartMoneyGiven = onlineReceivedCashGivenForm.firstPartMoneyGiven;
        backendData.remainingPartMoneyGiven = onlineReceivedCashGivenForm.remainingPartMoneyGiven;
        
        if (onlineReceivedCashGivenForm.firstPartMoneyGivenPersonName && onlineReceivedCashGivenForm.firstPartMoneyGivenPersonName.trim() !== '') {
          backendData.firstPartMoneyGivenPersonName = onlineReceivedCashGivenForm.firstPartMoneyGivenPersonName;
        }
        if (onlineReceivedCashGivenForm.firstPartAmount && onlineReceivedCashGivenForm.firstPartAmount.trim() !== '') {
          backendData.firstPartAmount = parseFloat(onlineReceivedCashGivenForm.firstPartAmount);
        }
        if (onlineReceivedCashGivenForm.remainingPartMoneyGivenPersonName && onlineReceivedCashGivenForm.remainingPartMoneyGivenPersonName.trim() !== '') {
          backendData.remainingPartMoneyGivenPersonName = onlineReceivedCashGivenForm.remainingPartMoneyGivenPersonName;
        }
        if (onlineReceivedCashGivenForm.remainingPartAmount && onlineReceivedCashGivenForm.remainingPartAmount.trim() !== '') {
          backendData.remainingPartAmount = parseFloat(onlineReceivedCashGivenForm.remainingPartAmount);
        }
      }
      
      console.log('Sending backend data:', backendData);
      console.log('Making API call to /api/data/sales-entries');
      
      const response = await apiFetch('/api/data/sales-entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entryType: 'ONLINE_RECEIVED_CASH_GIVEN',
          data: backendData
        }),
      });

      console.log('API response status:', response.status);
      console.log('API response ok:', response.ok);

      if (response.ok) {
        // Update balances in real-time
        const cashGivenAmount = parseFloat(onlineReceivedCashGivenForm.cashGiven) || 0;
        const receivedOnlineAmount = parseFloat(onlineReceivedCashGivenForm.receivedOnlineAmount) || 0;
        
        // Handle Cash Given subtraction logic
        if (cashGivenAmount > 0) {
          if (onlineReceivedCashGivenForm.moneyDistributionType === 'Full Amount given by One Person') {
            const moneyGivenBy = onlineReceivedCashGivenForm.howMoneyGivenSingle;
            
            switch (moneyGivenBy) {
              case 'Cash from Gala':
                onBankCashAepsUpdate?.('cash', 'remove', cashGivenAmount);
                break;
              case 'Vaibhav':
                onBankCashAepsUpdate?.('collect from vaibhav', 'remove', cashGivenAmount);
                break;
              case 'Omkar':
                onBankCashAepsUpdate?.('collect from omkar', 'remove', cashGivenAmount);
                break;
              case 'Uma':
                onBankCashAepsUpdate?.('collect from uma', 'remove', cashGivenAmount);
                break;
              case 'Cash Given to Customer by Person':
                // Check person name to determine which account to subtract from
                const personName = onlineReceivedCashGivenForm.howMoneyGivenSinglePersonName;
                if (personName === 'Vaibhav') {
                  onBankCashAepsUpdate?.('collect from vaibhav', 'remove', cashGivenAmount);
                } else if (personName === 'Omkar') {
                  onBankCashAepsUpdate?.('collect from omkar', 'remove', cashGivenAmount);
                } else if (personName === 'Uma') {
                  onBankCashAepsUpdate?.('collect from uma', 'remove', cashGivenAmount);
                }
                break;
            }
          } else if (onlineReceivedCashGivenForm.moneyDistributionType === 'Full Amount given by Two Persons') {
            // Handle two persons scenario
            const firstPartAmount = parseFloat(onlineReceivedCashGivenForm.firstPartAmount) || 0;
            const remainingPartAmount = parseFloat(onlineReceivedCashGivenForm.remainingPartAmount) || 0;
            
            // First part subtraction
            const firstPartGivenBy = onlineReceivedCashGivenForm.firstPartMoneyGiven;
            if (firstPartGivenBy === 'Cash from Gala') {
              onBankCashAepsUpdate?.('cash', 'remove', firstPartAmount);
            } else if (firstPartGivenBy === 'Vaibhav') {
              onBankCashAepsUpdate?.('collect from vaibhav', 'remove', firstPartAmount);
            } else if (firstPartGivenBy === 'Omkar') {
              onBankCashAepsUpdate?.('collect from omkar', 'remove', firstPartAmount);
            } else if (firstPartGivenBy === 'Uma') {
              onBankCashAepsUpdate?.('collect from uma', 'remove', firstPartAmount);
            } else if (firstPartGivenBy === 'Cash Given to Customer by Person') {
              const firstPersonName = onlineReceivedCashGivenForm.firstPartMoneyGivenPersonName;
              if (firstPersonName === 'Vaibhav') {
                onBankCashAepsUpdate?.('collect from vaibhav', 'remove', firstPartAmount);
              } else if (firstPersonName === 'Omkar') {
                onBankCashAepsUpdate?.('collect from omkar', 'remove', firstPartAmount);
              } else if (firstPersonName === 'Uma') {
                onBankCashAepsUpdate?.('collect from uma', 'remove', firstPartAmount);
              }
            }
            
            // Remaining part subtraction
            const remainingPartGivenBy = onlineReceivedCashGivenForm.remainingPartMoneyGiven;
            if (remainingPartGivenBy === 'Cash from Gala') {
              onBankCashAepsUpdate?.('cash', 'remove', remainingPartAmount);
            } else if (remainingPartGivenBy === 'Vaibhav') {
              onBankCashAepsUpdate?.('collect from vaibhav', 'remove', remainingPartAmount);
            } else if (remainingPartGivenBy === 'Omkar') {
              onBankCashAepsUpdate?.('collect from omkar', 'remove', remainingPartAmount);
            } else if (remainingPartGivenBy === 'Uma') {
              onBankCashAepsUpdate?.('collect from uma', 'remove', remainingPartAmount);
            } else if (remainingPartGivenBy === 'Cash Given to Customer by Person') {
              const remainingPersonName = onlineReceivedCashGivenForm.remainingPartMoneyGivenPersonName;
              if (remainingPersonName === 'Vaibhav') {
                onBankCashAepsUpdate?.('collect from vaibhav', 'remove', remainingPartAmount);
              } else if (remainingPersonName === 'Omkar') {
                onBankCashAepsUpdate?.('collect from omkar', 'remove', remainingPartAmount);
              } else if (remainingPersonName === 'Uma') {
                onBankCashAepsUpdate?.('collect from uma', 'remove', remainingPartAmount);
              }
            }
          }
        }
        
        // Handle Account Holder addition logic
        if (receivedOnlineAmount > 0) {
          const receivedOnlineFrom = onlineReceivedCashGivenForm.accountHolder;
          
          switch (receivedOnlineFrom) {
            case 'Vaibhav':
              onBankCashAepsUpdate?.('collect from vaibhav', 'add', receivedOnlineAmount);
              break;
            case 'Omkar':
              onBankCashAepsUpdate?.('collect from omkar', 'add', receivedOnlineAmount);
              break;
            case 'Uma':
              onBankCashAepsUpdate?.('collect from uma', 'add', receivedOnlineAmount);
              break;
            case 'Shop':
              onBankCashAepsUpdate?.('shop qr', 'add', receivedOnlineAmount);
              break;
          }
        }
        
        showMessage('Online Received Cash Given entry added successfully!', 'success');
        setOnlineReceivedCashGivenForm(defaultOnlineReceivedCashGivenForm);
        await fetchEntries();
      } else {
        throw new Error('Failed to add entry');
      }
    } catch (error) {
      console.error('Error adding entry:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      showMessage('Failed to add entry. Please try again.', 'error');
    } finally {
      setLoading(false);
      console.log('Form submission completed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const entryType = salesTabs[activeTab];
    const amount = amounts[activeTab];
    
    if (!amount || parseFloat(amount) <= 0) {
      showMessage('Please enter a valid amount', 'error');
      return;
    }
    
    setLoading(true);
    try {
      // Map frontend service names to backend entry types
      const entryTypeMapping: { [key: string]: string } = {
        'RECHAREG ENTRY': 'RECHARGE_ENTRY',
        'BILL PAYMENT ENTRY': 'BILL_PAYMENT_ENTRY',
        'SIM SOLD': 'SIM_SOLD',
        'XEROX': 'XEROX',
        'PRINT': 'PRINT',
        'PASSPORT PHOTOS': 'PASSPORT_PHOTOS',
        'LAMINATIONS': 'LAMINATIONS'
      };
      
      const backendEntryType = entryTypeMapping[entryType] || entryType;
      
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const response = await apiFetch('/api/data/sales-entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entryType: backendEntryType,
          amount: parseFloat(amount),
          remarks: `${entryType} entry`
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchEntries();
        const newAmounts = [...amounts];
        newAmounts[activeTab] = '';
        setAmounts(newAmounts);
        showMessage(`${entryType} entry saved successfully!`, 'success');
        closeModal();
      } else {
        showMessage(data.message || `Failed to save ${entryType} entry`, 'error');
      }
    } catch (error) {
      console.error(`Error saving ${entryType} entry:`, error);
      showMessage('Network error. Please try again.', 'error');
      
      // Removed fallback local state update to prevent duplicates after refresh
    } finally {
      setLoading(false);
    }
  };

  const handleServiceClick = (serviceId: string) => {
    if (serviceId === 'ADD NEW ENTRY') {
      setShowAddNewEntryForm(true);
      return;
    }
    if (serviceId === 'SHOW ENTRIES') {
      fetchEntries(); // Refresh entries when opening modal
      setFilterServiceType('all'); // Reset filter to show all entries
      setShowEntriesModal(true);
      return;
    }
    
    // Handle specific form services
    if (serviceId === 'ADD AEPS TRANSACTION') {
      setActiveTab(2); // AEPS form
      setSelectedService(serviceId);
      setShowModal(true);
      return;
    }
    if (serviceId === 'ADD FUND TRANSFER ENTRY') {
      setActiveTab(3); // Fund Transfer form
      setSelectedService(serviceId);
      setShowModal(true);
      return;
    }
    
    const tabIndex = salesTabs.findIndex(tab => tab === serviceId);
    setActiveTab(tabIndex);
    setSelectedService(serviceId);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedService("");
  };

  const handleEditEntry = (index: number) => {
    const entry = filteredEntries[index];
    setEditingIndex(index);
    
    // Set edit form based on entry type
    if (entry.type === 'MOBILE_BALANCE') {
      const mobileEntry = entry as Extract<DashboardEntry, { type: 'MOBILE_BALANCE' }>;
      setEditForm({
        type: 'MOBILE_BALANCE',
        companyName: mobileEntry.companyName,
        operationType: mobileEntry.operationType,
        amount: mobileEntry.amount.toString(),
        reason: mobileEntry.reason
      });
    } else if (entry.type === 'BANK_CASH_AEPS') {
      const bankEntry = entry as Extract<DashboardEntry, { type: 'BANK_CASH_AEPS' }>;
      setEditForm({
        type: 'BANK_CASH_AEPS',
        companyName: bankEntry.companyName,
        operationType: bankEntry.operationType,
        amount: bankEntry.amount.toString(),
        reason: bankEntry.reason
      });
    } else if (entry.type === 'AEPS') {
      const aepsEntry = entry as Extract<DashboardEntry, { type: 'AEPS' }>;
      setEditForm({
        type: 'AEPS',
        aepsIdType: aepsEntry.aepsIdType || '',
        aepsIdName: aepsEntry.aepsIdName || '',
        amount: aepsEntry.amount.toString(),
        givenToCustomer: aepsEntry.givenToCustomer || '',
        givenToCustomerRemark: aepsEntry.givenToCustomerRemark || '',
        givenToCustomerOther: aepsEntry.givenToCustomerOther || '',
        withdrawnType: aepsEntry.withdrawnType || '',
        commissionType: aepsEntry.commissionType || '',
        commissionAmount: aepsEntry.commissionAmount.toString(),
        commissionRemark: aepsEntry.commissionRemark || '',
        paymentApplication: aepsEntry.paymentApplication || '',
        transferredFrom: aepsEntry.transferredFrom || '',
        transferredFromRemark: aepsEntry.transferredFromRemark || ''
      });
    } else if (entry.type === 'ADD FUND TRANSFER ENTRY') {
      const fundEntry = entry as Extract<DashboardEntry, { type: 'ADD FUND TRANSFER ENTRY' }>;
      setEditForm({
        type: 'ADD FUND TRANSFER ENTRY',
        customerName: fundEntry.customerName || '',
        customerNumber: fundEntry.customerNumber || '',
        beneficiaryName: fundEntry.beneficiaryName || '',
        beneficiaryNumber: fundEntry.beneficiaryNumber || '',
        applicationName: fundEntry.applicationName || '',
        transferredFrom: fundEntry.transferredFrom || '',
        transferredFromRemark: fundEntry.transferredFromRemark || '',
        amount: fundEntry.amount.toString(),
        cashReceived: fundEntry.cashReceived || '',
        addedInGala: fundEntry.addedInGala || '',
        addedInGalaRemark: fundEntry.addedInGalaRemark || '',
        commissionType: fundEntry.commissionType || '',
        commissionAmount: fundEntry.commissionAmount || '',
        commissionRemark: fundEntry.commissionRemark || ''
      });
    } else if (entry.type === 'ONLINE_RECEIVED_CASH_GIVEN') {
      const onlineEntry = entry as Extract<DashboardEntry, { type: 'ONLINE_RECEIVED_CASH_GIVEN' }>;
      setEditForm({
        type: 'ONLINE_RECEIVED_CASH_GIVEN',
        senderName: onlineEntry.senderName || '',
        senderNumber: onlineEntry.senderNumber || '',
        receivedOnApplication: onlineEntry.receivedOnApplication || '',
        accountHolder: onlineEntry.accountHolder || '',
        accountHolderRemark: onlineEntry.accountHolderRemark || '',
        receivedOnlineAmount: onlineEntry.receivedOnlineAmount || '',
        cashGiven: onlineEntry.cashGiven || '',
        moneyDistributionType: onlineEntry.moneyDistributionType || '',
        howMoneyGivenSingle: onlineEntry.howMoneyGivenSingle || '',
        howMoneyGivenSingleRemark: onlineEntry.howMoneyGivenSingleRemark || '',
        howMoneyGivenSinglePersonName: onlineEntry.howMoneyGivenSinglePersonName || '',
        firstPartMoneyGiven: onlineEntry.firstPartMoneyGiven || '',
        firstPartMoneyGivenRemark: onlineEntry.firstPartMoneyGivenRemark || '',
        firstPartMoneyGivenPersonName: onlineEntry.firstPartMoneyGivenPersonName || '',
        firstPartAmount: onlineEntry.firstPartAmount || '',
        remainingPartMoneyGiven: onlineEntry.remainingPartMoneyGiven || '',
        remainingPartMoneyGivenRemark: onlineEntry.remainingPartMoneyGivenRemark || '',
        remainingPartMoneyGivenPersonName: onlineEntry.remainingPartMoneyGivenPersonName || '',
        remainingPartAmount: onlineEntry.remainingPartAmount || '',
        commissionType: onlineEntry.commissionType || '',
        commissionAmount: onlineEntry.commissionAmount || '',
        commissionRemark: onlineEntry.commissionRemark || '',
        remarks: onlineEntry.remarks || ''
      });
    } else {
      setEditForm({
        type: entry.type,
        amount: (entry as any).amount?.toString() || ''
      });
    }
    
    setShowEditModal(true);
  };

  // Map frontend entry types to backend entry types
  const mapEntryTypeForAPI = (frontendType: string): string => {
    const typeMapping: { [key: string]: string } = {
      'ADD FUND TRANSFER ENTRY': 'ADD_FUND_TRANSFER_ENTRY',
      'AEPS': 'AEPS',
      'MOBILE_BALANCE': 'MOBILE_BALANCE',
      'BANK_CASH_AEPS': 'BANK_CASH_AEPS',
      'RECHARGE_ENTRY': 'RECHARGE_ENTRY',
      'BILL_PAYMENT_ENTRY': 'BILL_PAYMENT_ENTRY',
      'SIM_SOLD': 'SIM_SOLD',
      'XEROX': 'XEROX',
      'PRINT': 'PRINT',
      'PASSPORT_PHOTOS': 'PASSPORT_PHOTOS',
      'LAMINATIONS': 'LAMINATIONS'
    };
    return typeMapping[frontendType] || frontendType;
  };

  const handleDeleteEntry = async (index: number) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      const entry = filteredEntries[index];
      if (!entry._id) {
        // For local entries without _id, remove from dashboardEntries
        setDashboardEntries(prev => prev.filter((_, i) => i !== index));
        showMessage('Entry deleted successfully!', 'success');
        return;
      }
      
      try {
        const headers: any = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const backendType = mapEntryTypeForAPI(entry.type);
        const response = await apiFetch(`/api/data/sales-entries/${encodeURIComponent(backendType)}/${entry._id}`, {
          method: 'DELETE',
          headers
        });
        const data = await response.json();
        
        if (data.success) {
          await fetchEntries();
          showMessage('Entry deleted successfully!', 'success');
        } else {
          showMessage(data.message || 'Failed to delete entry', 'error');
        }
      } catch (error) {
        console.error('Error deleting entry:', error);
        // Fallback: Remove from local state when API fails
        const entryToDelete = filteredEntries[index];
        setDashboardEntries(prev => prev.filter(e => e !== entryToDelete));
        showMessage('Entry removed from local view (API error occurred)', 'error');
      }
    }
  };

  const handleSaveEdit = async () => {
    if (editingIndex !== null && editForm) {
      const entry = filteredEntries[editingIndex];
      if (!entry._id) return;
      
      try {
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const backendType = mapEntryTypeForAPI(entry.type);
        const response = await apiFetch(`/api/data/sales-entries/${encodeURIComponent(backendType)}/${entry._id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(editForm)
        });
        const data = await response.json();
        
        if (data.success) {
          // Fetch updated entries from backend
          await fetchEntries();
          
          // Trigger dashboard recalculation with fresh data
          if (onBalanceRecalculation) {
            // Fetch the latest entries to ensure accurate recalculation
            const headers: any = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const entriesResponse = await apiFetch('/api/data/sales-entries', { headers });
            const entriesData = await entriesResponse.json();
            if (entriesData.success) {
              const latestEntries = Array.isArray(entriesData.data?.entries) ? entriesData.data.entries : [];
              onBalanceRecalculation(latestEntries);
            }
          }
          
          setShowEditModal(false);
          setEditingIndex(null);
          setEditForm(null);
          showMessage('Entry updated successfully!', 'success');
        } else {
          showMessage(data.message || 'Failed to update entry', 'error');
        }
      } catch (error) {
        console.error('Error updating entry:', error);
        showMessage('Failed to update entry', 'error');
      }
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingIndex(null);
    setEditForm(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Success/Error Messages */}
      {success && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2">
          <span>✓</span>
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2">
          <span>✗</span>
          <span>{error}</span>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
        {/* Service Categories */}
        {Object.entries(serviceCategories).map(([categoryName, services]) => (
          <div key={categoryName} className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-300">{categoryName}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  onClick={() => handleServiceClick(service.id)}
                  className="bg-white text-black rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all duration-200 flex items-center space-x-3"
                >
                  <div className={`w-10 h-10 ${service.color} rounded-lg flex items-center justify-center text-white text-xl`}>
                    {service.icon}
                  </div>
                  <span className="font-medium">{service.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Service Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white text-black rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-emerald-500 text-white p-6 rounded-t-2xl flex justify-between items-center">
                <h2 className="text-xl font-semibold">{selectedService}</h2>
                <button
                  onClick={closeModal}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-6">
                {activeTab === 2 ? (
                  <form onSubmit={handleAepsSubmit} className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* AEPS ID Type */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">AEPS ID</label>
                        <select
                          name="aepsIdType"
                          value={aepsForm.aepsIdType}
                          onChange={handleAepsChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          required
                        >
                          <option value="">Select</option>
                          <option value="Redmil">Redmil</option>
                          <option value="Spicemoney">Spicemoney</option>
                          <option value="Airtel Payment Bank">Airtel Payment Bank</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      {/* AEPS ID Name if Other */}
                      {aepsForm.aepsIdType === 'Other' && (
                        <div>
                          <label className="block text-sm font-semibold mb-1">Other ID Name</label>
                          <input
                            name="aepsIdName"
                            value={aepsForm.aepsIdName}
                            onChange={handleAepsChange}
                            className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Enter ID Name"
                            required
                          />
                        </div>
                      )}
                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Amount</label>
                        <input
                          name="amount"
                          type="number"
                          value={aepsForm.amount}
                          onChange={handleAepsChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          min="0"
                          required
                        />
                      </div>
                      {/* How Money Given Customer */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">How Money Given Customer</label>
                        <select
                          name="givenToCustomer"
                          value={aepsForm.givenToCustomer}
                          onChange={handleAepsChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          required
                        >
                          <option value="">Select</option>
                          <option value="Online">Online</option>
                          <option value="Cash from Gala">Cash from Gala</option>
                          <option value="Other">Other</option>
                          <option value="Withdrawn from ID">Withdrawn from ID and Given to Customer</option>
                        </select>
                      </div>
                      {/* Remark for Online + Payment Application/Transferred From */}
                      {aepsForm.givenToCustomer === 'Online' && (
                        <>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold mb-1">Online Remark</label>
                          <input
                            name="givenToCustomerRemark"
                            value={aepsForm.givenToCustomerRemark}
                            onChange={handleAepsChange}
                            className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Enter Remark"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Payment Application</label>
                          <select
                            name="paymentApplication"
                            value={aepsForm.paymentApplication || ''}
                            onChange={handleAepsChange}
                            className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            required
                          >
                            <option value="">Select</option>
                            <option value="PhonePe">PhonePe</option>
                            <option value="Paytm">Paytm</option>
                            <option value="Google Pay">Google Pay</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Transferred From</label>
                          <select
                            name="transferredFrom"
                            value={aepsForm.transferredFrom || ''}
                            onChange={handleAepsChange}
                            className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            required
                          >
                            <option value="">Select</option>
                            <option value="Vaibhav">Vaibhav</option>
                            <option value="Omkar">Omkar</option>
                            <option value="Uma">Uma</option>
                            <option value="Shop Accounts">Shop Accounts</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        {aepsForm.transferredFrom === 'Other' && (
                          <div>
                            <label className="block text-sm font-semibold mb-1">Other Remark</label>
                            <input
                              name="transferredFromRemark"
                              value={aepsForm.transferredFromRemark || ''}
                              onChange={handleAepsChange}
                              className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              placeholder="Enter Remark"
                              required
                            />
                          </div>
                        )}
                        </>
                      )}
                      {/* Other Details */}
                      {aepsForm.givenToCustomer === 'Other' && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold mb-1">Other Details</label>
                          <input
                            name="givenToCustomerOther"
                            value={aepsForm.givenToCustomerOther}
                            onChange={handleAepsChange}
                            className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Enter Details"
                          />
                        </div>
                      )}
                      {/* Withdrawn Type (shown only if selected) */}
                      {aepsForm.givenToCustomer === 'Withdrawn from ID' && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold mb-1">Withdrawn from ID and Given to Customer</label>
                          <input
                            name="withdrawnType"
                            value={aepsForm.withdrawnType}
                            onChange={handleAepsChange}
                            className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Enter Details (optional)"
                          />
                        </div>
                      )}
                      {/* Commission Type */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Commission</label>
                        <select
                          name="commissionType"
                          value={aepsForm.commissionType}
                          onChange={handleAepsChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          required
                        >
                          <option value="">Select</option>
                          <option value="Cash">Cash</option>
                          <option value="Online">Online</option>
                        </select>
                      </div>
                      {/* Commission Amount */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Commission Amount</label>
                        <input
                          name="commissionAmount"
                          type="number"
                          value={aepsForm.commissionAmount}
                          onChange={handleAepsChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          min="0"
                          placeholder="Enter Commission Amount"
                          required
                        />
                      </div>
                      {/* Commission Remark */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Commission Remark</label>
                        <input
                          name="commissionRemark"
                          value={aepsForm.commissionRemark}
                          onChange={handleAepsChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          placeholder="Enter Remark (optional)"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full py-3 rounded-lg font-semibold text-lg shadow-md transition-all ${
                        loading
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white hover:from-blue-700 hover:to-emerald-600'
                      }`}
                    >
                      {loading ? 'Saving...' : 'Add AEPS Entry'}
                    </button>
                  </form>
                ) : activeTab === 3 ? (
                  <form onSubmit={handleFundTransferSubmit} className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Customer Name */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Customer Name</label>
                        <input
                          name="customerName"
                          value={fundTransferForm.customerName}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          placeholder="Enter customer name"
                          required
                        />
                      </div>
                      {/* Customer Number */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Customer Number</label>
                        <input
                          name="customerNumber"
                          value={fundTransferForm.customerNumber}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          placeholder="Enter customer number"
                          required
                        />
                      </div>
                      {/* Beneficiary Name */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Beneficiary Name</label>
                        <input
                          name="beneficiaryName"
                          value={fundTransferForm.beneficiaryName}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          placeholder="Enter beneficiary name"
                          required
                        />
                      </div>
                      {/* Beneficiary Number */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Beneficiary Number</label>
                        <input
                          name="beneficiaryNumber"
                          value={fundTransferForm.beneficiaryNumber}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          placeholder="Enter beneficiary number"
                          required
                        />
                      </div>
                      {/* Application Name */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Application Name</label>
                        <select
                          name="applicationName"
                          value={fundTransferForm.applicationName}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          required
                        >
                          <option value="PhonePe">PhonePe</option>
                          <option value="Paytm">Paytm</option>
                          <option value="Google Pay">Google Pay</option>
                        </select>
                      </div>
                      {/* Transferred From */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Transferred From</label>
                        <select
                          name="transferredFrom"
                          value={fundTransferForm.transferredFrom}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          required
                        >
                          <option value="Shop Accounts">Shop Accounts</option>
                          <option value="Vaibhav">Vaibhav</option>
                          <option value="Omkar">Omkar</option>
                          <option value="Uma">Uma</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      {/* Remark for Other */}
                      {fundTransferForm.transferredFrom === 'Other' && (
                        <div>
                          <label className="block text-sm font-semibold mb-1">Other Remark</label>
                          <input
                            name="transferredFromRemark"
                            value={fundTransferForm.transferredFromRemark}
                            onChange={handleFundTransferChange}
                            className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Enter Remark"
                            required
                          />
                        </div>
                      )}
                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Amount</label>
                        <input
                          name="amount"
                          type="number"
                          value={fundTransferForm.amount}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          min="0"
                          required
                        />
                      </div>
                      {/* Cash Received */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Cash Received</label>
                        <select
                          name="cashReceived"
                          value={fundTransferForm.cashReceived}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          required
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      {/* Added in Gala */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Added in Gala</label>
                        <select
                          name="addedInGala"
                          value={fundTransferForm.addedInGala}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          required
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      {/* Remark for Not Added in Gala */}
                      {fundTransferForm.addedInGala === 'No' && (
                        <div>
                          <label className="block text-sm font-semibold mb-1">Remark (Not Added in Gala)</label>
                          <input
                            name="addedInGalaRemark"
                            value={fundTransferForm.addedInGalaRemark}
                            onChange={handleFundTransferChange}
                            className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Enter Remark"
                            required
                          />
                        </div>
                      )}
                      {/* Commission Type */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Commission Type</label>
                        <select
                          name="commissionType"
                          value={fundTransferForm.commissionType}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          required
                        >
                          <option value="">Select</option>
                          <option value="Online">Online</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>
                      {/* Commission Amount */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Commission Amount</label>
                        <input
                          name="commissionAmount"
                          type="number"
                          value={fundTransferForm.commissionAmount}
                          onChange={handleFundTransferChange}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          min="0"
                          placeholder="Enter Commission Amount"
                          required
                        />
                      </div>
                      {/* Commission Remark */}
                      <div>
                        <label className="block text-sm font-semibold mb-1">Commission Remark</label>
                         <input
                           name="commissionRemark"
                           value={fundTransferForm.commissionRemark}
                           onChange={handleFundTransferChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                           placeholder="Enter Remark (optional)"
                         />
                       </div>
                     </div>
                     <button
                       type="submit"
                       disabled={loading}
                       onClick={() => console.log('=== SUBMIT BUTTON CLICKED ===')}
                       className={`w-full py-3 rounded-lg font-semibold text-lg shadow-md transition-all ${
                         loading
                           ? 'bg-gray-400 cursor-not-allowed'
                           : 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white hover:from-blue-700 hover:to-emerald-600'
                       }`}
                     >
                       {loading ? 'Saving...' : 'Add Fund Transfer Entry'}
                     </button>
                   </form>
                 ) : activeTab === 4 ? (
                   <form onSubmit={handleOnlineReceivedCashGivenSubmit} className="flex flex-col gap-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {/* Basic Info Section */}
                       <div className="md:col-span-2">
                         <h3 className="text-lg font-semibold mb-4 text-blue-600">Basic Info</h3>
                       </div>
                       
                       {/* Sender Name */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">Sender Name</label>
                         <input
                           name="senderName"
                           value={onlineReceivedCashGivenForm.senderName}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                           placeholder="Enter sender name"
                         />
                       </div>
                       
                       {/* Sender Number */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">Sender Number</label>
                         <input
                           name="senderNumber"
                           value={onlineReceivedCashGivenForm.senderNumber}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                           placeholder="Enter sender number"
                         />
                       </div>
                     </div>
                     
                     {/* Transaction Details Section */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="md:col-span-2">
                         <h3 className="text-lg font-semibold mb-4 text-blue-600">Transaction Details</h3>
                       </div>
                       
                       {/* Received On Application */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">Received On Application</label>
                         <select
                           name="receivedOnApplication"
                           value={onlineReceivedCashGivenForm.receivedOnApplication}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                         >
                           <option value="Shop QR">Shop QR</option>
                           <option value="PhonePe">PhonePe</option>
                           <option value="Paytm">Paytm</option>
                           <option value="Google Pay">Google Pay</option>
                         </select>
                       </div>
                       
                       {/* Account Holder */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">Account Holder</label>
                         <select
                           name="accountHolder"
                           value={onlineReceivedCashGivenForm.accountHolder}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                         >
                           <option value="Shop">Shop</option>
                           <option value="Vaibhav">Vaibhav</option>
                           <option value="Omkar">Omkar</option>
                           <option value="Uma">Uma</option>
                           <option value="Other">Other</option>
                         </select>
                       </div>
                       
                       {/* Received Online Amount */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">Received Online Amount</label>
                         <input
                           type="number"
                           name="receivedOnlineAmount"
                           value={onlineReceivedCashGivenForm.receivedOnlineAmount}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                           placeholder="Enter received amount"
                           min="0"
                           step="0.01"
                           required
                         />
                       </div>
                       
                       {/* Cash Given */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">Cash Given</label>
                         <input
                           type="number"
                           name="cashGiven"
                           value={onlineReceivedCashGivenForm.cashGiven}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                           placeholder="Enter cash given amount"
                           min="0"
                           step="0.01"
                           required
                         />
                       </div>
                     </div>
                     
                     {/* Money Distribution Logic Section */}
                     <div className="grid grid-cols-1 gap-4">
                       <div>
                         <h3 className="text-lg font-semibold mb-4 text-blue-600">Money Distribution Logic</h3>
                       </div>
                       
                       {/* How was the money given? */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">How was the money given?</label>
                         <select
                           name="moneyDistributionType"
                           value={onlineReceivedCashGivenForm.moneyDistributionType}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                         >
                           <option value="Full Amount given by One Person">Full Amount given by One Person</option>
                           <option value="Full Amount given by Two Persons">Full Amount given by Two Persons</option>
                         </select>
                       </div>
                       
                       {/* Case A: Full Amount given by One Person */}
                       {onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by One Person" && (
                         <div>
                           <label className="block text-sm font-semibold mb-1">How Money Given to Customer</label>
                           <select
                             name="howMoneyGivenSingle"
                             value={onlineReceivedCashGivenForm.howMoneyGivenSingle}
                             onChange={handleOnlineReceivedCashGivenChange}
                             className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                           >
                             <option value="Cash from Gala">Cash from Gala</option>
                             <option value="Other">Other</option>
                             <option value="Withdrawn from ATM and Given to Customer">Withdrawn from ATM and Given to Customer</option>
                             <option value="Vaibhav">Vaibhav</option>
                             <option value="Omkar">Omkar</option>
                             <option value="Uma">Uma</option>
                             <option value="Cash Given to Customer by Person">Cash Given to Customer by Person</option>
                           </select>
                         </div>
                       )}
                       
                       {/* Case B: Full Amount given by Two Persons */}
                       {onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by Two Persons" && (
                         <div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {/* First part of money given */}
                             <div>
                               <label className="block text-sm font-semibold mb-1">(A) First part of money given</label>
                               <select
                                 name="firstPartMoneyGiven"
                                 value={onlineReceivedCashGivenForm.firstPartMoneyGiven}
                                 onChange={handleOnlineReceivedCashGivenChange}
                                 className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                 required={onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by Two Persons"}
                               >
                                 <option value="Cash from Gala">Cash from Gala</option>
                                 <option value="Other">Other</option>
                                 <option value="Withdrawn from ATM and Given to Customer">Withdrawn from ATM and Given to Customer</option>
                                 <option value="Vaibhav">Vaibhav</option>
                                 <option value="Omkar">Omkar</option>
                                 <option value="Uma">Uma</option>
                                 <option value="Cash Given to Customer by Person">Cash Given to Customer by Person</option>
                               </select>
                             </div>
                             
                             {/* Remaining part of money given */}
                             <div>
                               <label className="block text-sm font-semibold mb-1">(B) Remaining part of money given</label>
                               <select
                                 name="remainingPartMoneyGiven"
                                 value={onlineReceivedCashGivenForm.remainingPartMoneyGiven}
                                 onChange={handleOnlineReceivedCashGivenChange}
                                 className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                 required={onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by Two Persons"}
                               >
                                 <option value="Cash from Gala">Cash from Gala</option>
                                 <option value="Other">Other</option>
                                 <option value="Withdrawn from ATM and Given to Customer">Withdrawn from ATM and Given to Customer</option>
                                 <option value="Vaibhav">Vaibhav</option>
                                 <option value="Omkar">Omkar</option>
                                 <option value="Uma">Uma</option>
                                 <option value="Cash Given to Customer by Person">Cash Given to Customer by Person</option>
                               </select>
                             </div>
                           </div>
                           
                           {/* Amount fields for two-person scenario */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                             <div>
                               <label className="block text-sm font-semibold mb-1">First Part Amount</label>
                               <input
                                 type="number"
                                 name="firstPartAmount"
                                 value={onlineReceivedCashGivenForm.firstPartAmount}
                                 onChange={handleOnlineReceivedCashGivenChange}
                                 className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                 placeholder="Enter first part amount"
                                 required={onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by Two Persons"}
                               />
                             </div>
                             
                             <div>
                               <label className="block text-sm font-semibold mb-1">Remaining Part Amount</label>
                               <input
                                 type="number"
                                 name="remainingPartAmount"
                                 value={onlineReceivedCashGivenForm.remainingPartAmount}
                                 onChange={handleOnlineReceivedCashGivenChange}
                                 className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                 placeholder="Enter remaining part amount"
                                 required={onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by Two Persons"}
                               />
                             </div>
                           </div>
                         </div>
                       )}
                     </div>
                     
                     {/* Conditional Inputs Section */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {/* Conditional Remarks Field */}
                       {(
                         (onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by One Person" && 
                          (onlineReceivedCashGivenForm.howMoneyGivenSingle === "Other" || 
                           onlineReceivedCashGivenForm.howMoneyGivenSingle === "Withdrawn from ATM and Given to Customer")) ||
                         (onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by Two Persons" && 
                          (onlineReceivedCashGivenForm.firstPartMoneyGiven === "Other" || 
                           onlineReceivedCashGivenForm.firstPartMoneyGiven === "Withdrawn from ATM and Given to Customer" ||
                           onlineReceivedCashGivenForm.remainingPartMoneyGiven === "Other" || 
                           onlineReceivedCashGivenForm.remainingPartMoneyGiven === "Withdrawn from ATM and Given to Customer"))
                       ) && (
                         <div>
                           <label className="block text-sm font-semibold mb-1">Remarks</label>
                           <input
                             name="remarks"
                             value={onlineReceivedCashGivenForm.remarks}
                             onChange={handleOnlineReceivedCashGivenChange}
                             className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                             placeholder="Enter remarks"
                           />
                         </div>
                       )}
                       
                       {/* Conditional Person Name Field */}
                       {(
                         (onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by One Person" && 
                          onlineReceivedCashGivenForm.howMoneyGivenSingle === "Cash Given to Customer by Person") ||
                         (onlineReceivedCashGivenForm.moneyDistributionType === "Full Amount given by Two Persons" && 
                          (onlineReceivedCashGivenForm.firstPartMoneyGiven === "Cash Given to Customer by Person" ||
                           onlineReceivedCashGivenForm.remainingPartMoneyGiven === "Cash Given to Customer by Person"))
                       ) && (
                         <div>
                           <label className="block text-sm font-semibold mb-1">Enter Person Name</label>
                           <input
                             name="personName"
                             value={onlineReceivedCashGivenForm.personName}
                             onChange={handleOnlineReceivedCashGivenChange}
                             className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                             placeholder="Enter person name"
                           />
                         </div>
                       )}
                     </div>
                     
                     {/* Commission Section */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="md:col-span-3">
                         <h3 className="text-lg font-semibold mb-4 text-blue-600">Commission Section</h3>
                       </div>
                       
                       {/* Commission Type */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">Commission Type</label>
                         <select
                           name="commissionType"
                           value={onlineReceivedCashGivenForm.commissionType}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                           required
                         >
                           <option value="No Commission">No Commission</option>
                           <option value="Fixed">Fixed</option>
                           <option value="Percentage">Percentage</option>
                         </select>
                       </div>
                       
                       {/* Commission Amount */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">Commission Amount</label>
                         <input
                           type="number"
                           name="commissionAmount"
                           value={onlineReceivedCashGivenForm.commissionAmount}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                           placeholder="Enter commission amount"
                           min="0"
                           step="0.01"
                         />
                       </div>
                       
                       {/* Commission Remark */}
                       <div>
                         <label className="block text-sm font-semibold mb-1">Commission Remark</label>
                         <input
                           name="commissionRemark"
                           value={onlineReceivedCashGivenForm.commissionRemark}
                           onChange={handleOnlineReceivedCashGivenChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                           placeholder="Enter commission remark"
                         />
                       </div>
                     </div>
                     
                     <button
                       type="submit"
                       disabled={loading}
                       className={`w-full py-3 rounded-lg font-semibold text-lg shadow-md transition-all ${
                         loading
                           ? 'bg-gray-400 cursor-not-allowed'
                           : 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white hover:from-blue-700 hover:to-emerald-600'
                       }`}
                     >
                       {loading ? 'Saving...' : 'Add Online Received Cash Given Entry'}
                     </button>
                   </form>
                 ) : (
                   <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                     <div className="text-center">
                       <h3 className="text-lg font-semibold mb-4">{selectedService}</h3>
                       <div className="mb-4">
                         <label className="block text-sm font-semibold mb-2">Amount</label>
                         <input
                           type="number"
                           value={amounts[activeTab]}
                           onChange={handleAmountChange}
                           className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-lg"
                           placeholder="Enter amount"
                           min="0"
                           required
                         />
                       </div>
                     </div>
                     <button
                       type="submit"
                       disabled={loading}
                       className={`w-full py-3 rounded-lg font-semibold text-lg shadow-md transition-all ${
                         loading
                           ? 'bg-gray-400 cursor-not-allowed'
                           : 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white hover:from-blue-700 hover:to-emerald-600'
                       }`}
                     >
                       {loading ? 'Saving...' : `Add ${selectedService} Entry`}
                     </button>
                   </form>
                 )}
               </div>
             </div>
           </div>
         )}

        {/* ADD NEW ENTRY Modal */}
        {showAddNewEntryForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white text-black rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-500 text-white p-6 rounded-t-2xl flex justify-between items-center">
                <h2 className="text-xl font-semibold">Add New Entry</h2>
                <button
                  onClick={() => setShowAddNewEntryForm(false)}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-6">
                {/* Entry Type Selection */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Select Entry Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setAddNewEntryType('mobile')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        addNewEntryType === 'mobile'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">📱</div>
                        <div className="font-medium">Mobile Balances</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setAddNewEntryType('bank')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        addNewEntryType === 'bank'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">🏦</div>
                        <div className="font-medium">Bank / Cash / AEPS Apps</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Mobile Balance Form */}
                {addNewEntryType === 'mobile' && (
                  <form onSubmit={handleMobileBalanceSubmit} className="space-y-4">
                    <h4 className="text-lg font-semibold text-purple-600">Mobile Balances</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1">Company Name</label>
                        <select
                          name="companyName"
                          value={mobileBalanceForm.companyName}
                          onChange={handleMobileBalanceChange}
                          className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 bg-purple-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                          required
                        >
                          <option value="">Select Company</option>
                          <option value="AIRTEL">AIRTEL</option>
                          <option value="JIO">JIO</option>
                          <option value="BSNL">BSNL</option>
                          <option value="VODAFONE">VODAFONE</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-1">Operation Type</label>
                        <select
                          name="operationType"
                          value={mobileBalanceForm.operationType}
                          onChange={handleMobileBalanceChange}
                          className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 bg-purple-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                          required
                        >
                          <option value="">Select</option>
                          <option value="add">Add Amount</option>
                          <option value="remove">Remove Amount</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-1">Amount</label>
                        <input
                          name="amount"
                          type="number"
                          value={mobileBalanceForm.amount}
                          onChange={handleMobileBalanceChange}
                          className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 bg-purple-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                          min="0"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-1">Reason</label>
                        <input
                          name="reason"
                          value={mobileBalanceForm.reason}
                          onChange={handleMobileBalanceChange}
                          className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 bg-purple-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                          placeholder="Enter reason"
                          required
                        />
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full py-3 rounded-lg font-semibold text-lg shadow-md transition-all ${
                        loading
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-500 text-white hover:from-purple-700 hover:to-indigo-600'
                      }`}
                    >
                      {loading ? 'Saving...' : 'Add Mobile Balance Entry'}
                    </button>
                  </form>
                )}

                {/* Bank/Cash/AEPS Form */}
                {addNewEntryType === 'bank' && (
                  <form onSubmit={handleBankCashAepsSubmit} className="space-y-4">
                    <h4 className="text-lg font-semibold text-purple-600">Bank / Cash / AEPS Apps</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1">Company/Bank Name</label>
                        <select
                          name="companyName"
                          value={bankCashAepsForm.companyName}
                          onChange={handleBankCashAepsChange}
                          className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 bg-purple-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                          required
                        >
                          <option value="">Select Company/Bank</option>
                          <option value="Bank">Bank</option>
                          <option value="Cash">Cash</option>
                          <option value="Redmil">Redmil</option>
                          <option value="SpiceMoney">SpiceMoney</option>
                          <option value="Airtel Payment Bank">Airtel Payment Bank</option>
                          <option value="Collect From Vaibhav">Collect From Vaibhav</option>
                          <option value="Collect From Omkar">Collect From Omkar</option>
                          <option value="Collect From Uma">Collect From Uma</option>
                          <option value="Shop QR">Shop QR</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-1">Operation Type</label>
                        <select
                          name="operationType"
                          value={bankCashAepsForm.operationType}
                          onChange={handleBankCashAepsChange}
                          className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 bg-purple-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                          required
                        >
                          <option value="">Select</option>
                          <option value="add">Add Amount</option>
                          <option value="remove">Remove Amount</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-1">Amount</label>
                        <input
                          name="amount"
                          type="number"
                          value={bankCashAepsForm.amount}
                          onChange={handleBankCashAepsChange}
                          className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 bg-purple-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                          min="0"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-1">Reason</label>
                        <input
                          name="reason"
                          value={bankCashAepsForm.reason}
                          onChange={handleBankCashAepsChange}
                          className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 bg-purple-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                          placeholder="Enter reason"
                          required
                        />
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full py-3 rounded-lg font-semibold text-lg shadow-md transition-all ${
                        loading
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-500 text-white hover:from-purple-700 hover:to-indigo-600'
                      }`}
                    >
                      {loading ? 'Saving...' : 'Add Bank/Cash/AEPS Entry'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SHOW ENTRIES Modal */}
        {showEntriesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white text-black rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-500 text-white p-6 rounded-t-2xl flex justify-between items-center">
                <h2 className="text-xl font-semibold">Show Entries</h2>
                <button
                  onClick={() => setShowEntriesModal(false)}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-6">
                {/* Filters */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">From Date</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full border-2 border-indigo-200 rounded-lg px-3 py-2 bg-indigo-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold mb-1">To Date</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full border-2 border-indigo-200 rounded-lg px-3 py-2 bg-indigo-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold mb-1">Service Type</label>
                    <select
                      value={filterServiceType}
                      onChange={(e) => setFilterServiceType(e.target.value)}
                      className="w-full border-2 border-indigo-200 rounded-lg px-3 py-2 bg-indigo-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="all">All</option>
                      <option value="MOBILE_BALANCE">Mobile Balance</option>
                      <option value="BANK_CASH_AEPS">Bank/Cash/AEPS</option>
                      <option value="AEPS">AEPS Transaction</option>
                      <option value="ADD FUND TRANSFER ENTRY">Fund Transfer</option>
                      <option value="ONLINE_RECEIVED_CASH_GIVEN">Online Received / Cash Given</option>
                      <option value="RECHARGE_ENTRY">Recharge Entry</option>
                      <option value="BILL_PAYMENT_ENTRY">Bill Payment Entry</option>
                      <option value="SIM_SOLD">SIM Sold</option>
                      <option value="XEROX">Xerox</option>
                      <option value="PRINT">Print</option>
                      <option value="PASSPORT_PHOTOS">Passport Photos</option>
                      <option value="LAMINATIONS">Laminations</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setFilterDateFrom('');
                        setFilterDateTo('');
                        setFilterServiceType('all');
                      }}
                      className="w-full py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>

                {/* Entries Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Details</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Amount</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                            {loading ? 'Loading entries...' : 'No entries found for the selected filters.'}
                          </td>
                        </tr>
                      ) : (
                        filteredEntries.map((entry, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 
                 entry.date ? new Date(entry.date).toLocaleDateString() : 
                 entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                {entry.type}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {entry.type === 'MOBILE_BALANCE' && (
                                <div>
                                  <div><strong>Company:</strong> {entry.companyName}</div>
                                  <div><strong>Operation:</strong> {entry.operationType}</div>
                                  <div><strong>Reason:</strong> {entry.reason}</div>
                                  {entry.remarks && <div><strong>Remarks:</strong> {entry.remarks}</div>}
                                </div>
                              )}
                              {entry.type === 'BANK_CASH_AEPS' && (
                                <div>
                                  <div><strong>Company:</strong> {entry.companyName}</div>
                                  <div><strong>Operation:</strong> {entry.operationType}</div>
                                  <div><strong>Reason:</strong> {entry.reason}</div>
                                  {entry.remarks && <div><strong>Remarks:</strong> {entry.remarks}</div>}
                                </div>
                              )}
                              {entry.type === 'AEPS' && (
                                <div>
                                  <div><strong>AEPS ID:</strong> {entry.aepsIdType}</div>
                                  <div><strong>Given to Customer:</strong> {entry.givenToCustomer}</div>
                                  <div><strong>Commission:</strong> {entry.commissionType}</div>
                                  {entry.remarks && <div><strong>Remarks:</strong> {entry.remarks}</div>}
                                </div>
                              )}
                              {entry.type === 'ADD FUND TRANSFER ENTRY' && (
                                <div>
                                  <div><strong>Customer:</strong> {entry.customerName}</div>
                                  <div><strong>Beneficiary:</strong> {entry.beneficiaryName}</div>
                                  <div><strong>Application:</strong> {entry.applicationName}</div>
                                  {entry.transferredFromRemark && <div><strong>Transfer Remark:</strong> {entry.transferredFromRemark}</div>}
                                  {entry.addedInGalaRemark && <div><strong>Gala Remark:</strong> {entry.addedInGalaRemark}</div>}
                                  {entry.commissionRemark && <div><strong>Commission Remark:</strong> {entry.commissionRemark}</div>}
                                  {entry.remarks && <div><strong>Remarks:</strong> {entry.remarks}</div>}
                                </div>
                              )}
                              {entry.type === 'ONLINE_RECEIVED_CASH_GIVEN' && (
                                <div>
                                  <div><strong>Sender:</strong> {entry.senderName} ({entry.senderNumber})</div>
                                  <div><strong>Received On:</strong> {entry.receivedOnApplication}</div>
                                  <div><strong>Account Holder:</strong> {entry.accountHolder}</div>
                                  <div><strong>Online Amount:</strong> ₹{entry.receivedOnlineAmount}</div>
                                  <div><strong>Cash Given:</strong> ₹{entry.cashGiven}</div>
                                  <div><strong>Distribution:</strong> {entry.moneyDistributionType}</div>
                                  {entry.moneyDistributionType === 'Full Amount given by One Person' && (
                                    <div><strong>Money Given:</strong> {entry.howMoneyGivenSingle} {entry.howMoneyGivenSinglePersonName && `(${entry.howMoneyGivenSinglePersonName})`}</div>
                                  )}
                                  {entry.moneyDistributionType === 'Amount given by Two Person' && (
                                    <div>
                                      <div><strong>First Part:</strong> {entry.firstPartMoneyGiven} - ₹{entry.firstPartAmount} {entry.firstPartMoneyGivenPersonName && `(${entry.firstPartMoneyGivenPersonName})`}</div>
                                      <div><strong>Remaining Part:</strong> {entry.remainingPartMoneyGiven} - ₹{entry.remainingPartAmount} {entry.remainingPartMoneyGivenPersonName && `(${entry.remainingPartMoneyGivenPersonName})`}</div>
                                    </div>
                                  )}
                                  {entry.commissionType !== 'No Commission' && <div><strong>Commission:</strong> {entry.commissionType} - ₹{entry.commissionAmount}</div>}
                                  {entry.remarks && <div><strong>Remarks:</strong> {entry.remarks}</div>}
                                </div>
                              )}
                              {!['MOBILE_BALANCE', 'BANK_CASH_AEPS', 'AEPS', 'ADD FUND TRANSFER ENTRY', 'ONLINE_RECEIVED_CASH_GIVEN'].includes(entry.type) && (
                                <div>
                                  <div>General entry</div>
                                  {entry.remarks && <div><strong>Remarks:</strong> {entry.remarks}</div>}
                                </div>
                              )}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 font-semibold">
                              {entry.type === 'ONLINE_RECEIVED_CASH_GIVEN' ? 
                                `₹${entry.receivedOnlineAmount}` : 
                                `₹${entry.amount || '0'}`
                              }
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditEntry(index)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(index)}
                                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Entry Modal */}
        {showEditModal && editForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white text-black rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-green-500 text-white p-6 rounded-t-2xl flex justify-between items-center">
                <h2 className="text-xl font-semibold">Edit Entry</h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {editForm.type === 'MOBILE_BALANCE' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Company Name</label>
                        <select
                          value={editForm.companyName || ''}
                          onChange={(e) => setEditForm({...editForm, companyName: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select Company</option>
                          <option value="AIRTEL">AIRTEL</option>
                          <option value="JIO">JIO</option>
                          <option value="BSNL">BSNL</option>
                          <option value="VODAFONE">VODAFONE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Operation Type</label>
                        <select
                          value={editForm.operationType || ''}
                          onChange={(e) => setEditForm({...editForm, operationType: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="add">Add Amount</option>
                          <option value="remove">Remove Amount</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Amount</label>
                        <input
                          type="number"
                          value={editForm.amount || ''}
                          onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Reason</label>
                        <input
                          value={editForm.reason || ''}
                          onChange={(e) => setEditForm({...editForm, reason: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </>
                  )}
                  
                  {editForm.type === 'BANK_CASH_AEPS' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Company Name</label>
                        <input
                          value={editForm.companyName || ''}
                          onChange={(e) => setEditForm({...editForm, companyName: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Operation Type</label>
                        <select
                          value={editForm.operationType || ''}
                          onChange={(e) => setEditForm({...editForm, operationType: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="add">Add Amount</option>
                          <option value="remove">Remove Amount</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Amount</label>
                        <input
                          type="number"
                          value={editForm.amount || ''}
                          onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Reason</label>
                        <input
                          value={editForm.reason || ''}
                          onChange={(e) => setEditForm({...editForm, reason: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </>
                  )}
                  
                  {/* Generic edit form for other types */}
                  {!['MOBILE_BALANCE', 'BANK_CASH_AEPS', 'AEPS', 'ADD FUND TRANSFER ENTRY'].includes(editForm.type) && (
                    <div>
                        <label className="block text-sm font-semibold mb-1">Reason</label>
                        <input
                          value={editForm.reason || ''}
                          onChange={(e) => setEditForm({...editForm, reason: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                  )}

                  {editForm.type === 'AEPS' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold mb-1">AEPS ID Name</label>
                        <input
                          value={editForm.aepsIdName || ''}
                          onChange={(e) => setEditForm({...editForm, aepsIdName: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Amount</label>
                        <input
                          type="number"
                          value={editForm.amount || ''}
                          onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Commission Amount</label>
                        <input
                          type="number"
                          value={editForm.commissionAmount || ''}
                          onChange={(e) => setEditForm({...editForm, commissionAmount: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </>
                  )}

                  {editForm.type === 'ADD FUND TRANSFER ENTRY' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Customer Name</label>
                        <input
                          value={editForm.customerName || ''}
                          onChange={(e) => setEditForm({...editForm, customerName: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Beneficiary Name</label>
                        <input
                          value={editForm.beneficiaryName || ''}
                          onChange={(e) => setEditForm({...editForm, beneficiaryName: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Amount</label>
                        <input
                          type="number"
                          value={editForm.amount || ''}
                          onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Application Name</label>
                        <input
                          value={editForm.applicationName || ''}
                          onChange={(e) => setEditForm({...editForm, applicationName: e.target.value})}
                          className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </>
                  )}

                  {/* Generic form for other entry types */}
                  {!['MOBILE_BALANCE', 'BANK_CASH_AEPS', 'AEPS', 'ADD FUND TRANSFER ENTRY'].includes(editForm.type) && (
                    <div>
                      <label className="block text-sm font-semibold mb-1">Amount</label>
                      <input
                        type="number"
                        value={editForm.amount || ''}
                        onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                        className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-4 mt-6">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sales;
