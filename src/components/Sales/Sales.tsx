import React, { useState } from "react";
import { apiFetch } from '../../utils/api';

const serviceCategories = {
  "Financial Transactions": [
    { id: "ADD AEPS TRANSACTION", name: "Add AEPS Transaction", icon: "💳", color: "bg-blue-500" },
    { id: "ADD FUND TRANSFER ENTRY", name: "Add Fund Transfer Entry", icon: "💸", color: "bg-blue-500" },
    { id: "ONLIEN RECIVED CAHS GIVEN.", name: "Online Received / Cash Given", icon: "💰", color: "bg-blue-500" },
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
  "ADD AEPS TRANSACTION",
  "ADD FUND TRANSFER ENTRY",
  "ONLIEN RECIVED CAHS GIVEN.",
  "RECHAREG ENTRY",
  "BILL PAYMENT ENTRY",
  "SIM SOLD",
  "XEROX",
  "PRINT",
  "PASSPORT PHOTOS",
  "LAMINATIONS"
];

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

const defaultFundTransferForm: FundTransferForm = {
  customerName: '',
  customerNumber: '',
  beneficiaryName: '',
  beneficiaryNumber: '',
  applicationName: '',
  transferredFrom: '',
  transferredFromRemark: '',
  amount: '',
  cashReceived: '',
  addedInGala: '',
  addedInGalaRemark: '',
  commissionType: '',
  commissionAmount: '',
  commissionRemark: '',
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
  | ({ type: 'AEPS' } & AEPSForm)
  | ({ type: 'ADD FUND TRANSFER ENTRY' } & FundTransferForm)
  | { type: string; amount: string };

export type { DashboardEntry };

interface SalesProps {
  onAepsBalanceUpdate?: (aepsIdType: string, amount: number, payoutInfo?: { transferredFrom?: string; cashFromGala?: boolean; withdrawnFromId?: boolean; commissionType?: string; commissionAmount?: number }) => void;
  onFundTransferBalanceUpdate?: (
    account: 'vaibhav' | 'omkar' | 'uma' | 'shopaccounts' | 'cash',
    amount: number,
    commissionType?: 'cash' | 'online',
    commissionAmount?: number
  ) => void;
  dashboardEntries: DashboardEntry[];
  setDashboardEntries: React.Dispatch<React.SetStateAction<DashboardEntry[]>>;
}

const Sales: React.FC<SalesProps> = ({ onAepsBalanceUpdate, onFundTransferBalanceUpdate, dashboardEntries, setDashboardEntries }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [amounts, setAmounts] = useState(Array(salesTabs.length).fill(""));
  const [aepsForm, setAepsForm] = useState<AEPSForm>(defaultAEPSForm);
  const [fundTransferForm, setFundTransferForm] = useState<FundTransferForm>(defaultFundTransferForm);
  const [showModal, setShowModal] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("");

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmounts = [...amounts];
    newAmounts[activeTab] = e.target.value;
    setAmounts(newAmounts);
  };

  const handleAepsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAepsForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAepsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDashboardEntries((prev) => [
      { type: 'AEPS', ...aepsForm },
      ...prev
    ]);
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

  // Enhanced Fund Transfer logic: update dashboard balances for Vaibhav, Omkar, Uma
  const handleFundTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('dsam_token');
      const payload = {
        ...fundTransferForm,
        amount: parseFloat(fundTransferForm.amount || '0'),
        commissionAmount: parseFloat(fundTransferForm.commissionAmount || '0')
      } as any;
      // Persist to backend if logged in
      if (token) {
        const res = await apiFetch('/api/data/fund-transfers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to save entry');
        const saved = json.data.entry;
        setDashboardEntries((prev) => [
          { type: 'ADD FUND TRANSFER ENTRY', ...fundTransferForm, amount: String(saved.amount ?? fundTransferForm.amount) },
          ...prev
        ]);
      } else {
        // Fallback local add when not authenticated
        setDashboardEntries((prev) => [
          { type: 'ADD FUND TRANSFER ENTRY', ...fundTransferForm },
          ...prev
        ]);
      }
    } catch {
      // Local optimistic update on failure
      setDashboardEntries((prev) => [
        { type: 'ADD FUND TRANSFER ENTRY', ...fundTransferForm },
        ...prev
      ]);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDashboardEntries((prev) => [
      { type: salesTabs[activeTab], amount: amounts[activeTab] },
      ...prev
    ]);
    const newAmounts = [...amounts];
    newAmounts[activeTab] = '';
    setAmounts(newAmounts);
  };

  const handleServiceClick = (serviceId: string) => {
    const tabIndex = salesTabs.findIndex(tab => tab === serviceId);
    setActiveTab(tabIndex);
    setSelectedService(serviceId);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedService("");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
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

        {/* Modal */}
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
          {activeTab === 0 ? (
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
                className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-500 text-white font-semibold text-lg shadow-md hover:from-blue-700 hover:to-emerald-600 transition-all"
              >
                Add AEPS Entry
              </button>
            </form>
          ) : activeTab === 1 ? (
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
                    <option value="">Select</option>
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
                    <option value="">Select</option>
                    <option value="Vaibhav">Vaibhav</option>
                    <option value="Omkar">Omkar</option>
                    <option value="Uma">Uma</option>
                    <option value="Shop Accounts">Shop Accounts</option>
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
                    <option value="">Select</option>
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
                    <option value="">Select</option>
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
                className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-500 text-white font-semibold text-lg shadow-md hover:from-blue-700 hover:to-emerald-600 transition-all"
              >
                Add Fund Transfer Entry
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div>
                <label className="block text-lg font-bold text-blue-700 mb-2 tracking-wide text-center">
                  {salesTabs[activeTab]}
                </label>
                <input
                  type="number"
                  className="w-full border-2 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-blue-50 text-lg rounded-lg px-4 py-3 transition-all outline-none shadow-sm"
                  placeholder="Enter amount"
                  value={amounts[activeTab]}
                  onChange={handleAmountChange}
                  min="0"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-500 text-white font-semibold text-lg shadow-md hover:from-blue-700 hover:to-emerald-600 transition-all"
              >
                Add Amount
              </button>
            </form>
          )}
          {/* Dashboard Table */}
          {dashboardEntries.length > 0 && (
            <div className="mt-10">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Submitted Entries</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-blue-200 rounded-lg">
                  <thead>
                    <tr className="bg-blue-50 text-blue-700 text-xs">
                      <th className="px-3 py-2 border-b">Type</th>
                      <th className="px-3 py-2 border-b">Amount</th>
                      <th className="px-3 py-2 border-b">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardEntries.map((entry, idx) => {
                      if (entry.type === 'AEPS') {
                        const aepsEntry = entry as Extract<DashboardEntry, { type: 'AEPS' }>;
                        return (
                          <tr key={idx} className="text-xs text-gray-700">
                            <td className="px-3 py-2 border-b">{aepsEntry.type}</td>
                            <td className="px-3 py-2 border-b">{aepsEntry.amount}</td>
                            <td className="px-3 py-2 border-b text-left">
                              <div>
                                <div><b>ID:</b> {aepsEntry.aepsIdType}{aepsEntry.aepsIdType === 'Other' && ` (${aepsEntry.aepsIdName})`}</div>
                                <div><b>Given To:</b> {aepsEntry.givenToCustomer} {aepsEntry.givenToCustomerRemark && `(Remark: ${aepsEntry.givenToCustomerRemark})`} {aepsEntry.givenToCustomerOther && `(Other: ${aepsEntry.givenToCustomerOther})`} {aepsEntry.withdrawnType && `(Withdrawn: ${aepsEntry.withdrawnType})`}</div>
                                {aepsEntry.givenToCustomer === 'Online' && (
                                  <>
                                    <div><b>Payment Application:</b> {aepsEntry.paymentApplication}</div>
                                    <div><b>Transferred From:</b> {aepsEntry.transferredFrom} {aepsEntry.transferredFrom === 'Other' && `(Remark: ${aepsEntry.transferredFromRemark})`}</div>
                                  </>
                                )}
                                <div><b>Commission:</b> {aepsEntry.commissionType} {aepsEntry.commissionAmount && `(₹${aepsEntry.commissionAmount})`} {aepsEntry.commissionRemark && `(Remark: ${aepsEntry.commissionRemark})`}</div>
                              </div>
                            </td>
                          </tr>
                        );
                      } else if (entry.type === 'ADD FUND TRANSFER ENTRY') {
                        const fundEntry = entry as Extract<DashboardEntry, { type: 'ADD FUND TRANSFER ENTRY' }>;
                        return (
                          <tr key={idx} className="text-xs text-gray-700">
                            <td className="px-3 py-2 border-b">{fundEntry.type}</td>
                            <td className="px-3 py-2 border-b">{fundEntry.amount}</td>
                            <td className="px-3 py-2 border-b text-left">
                              <div>
                                <div><b>Customer:</b> {fundEntry.customerName} ({fundEntry.customerNumber})</div>
                                <div><b>Beneficiary:</b> {fundEntry.beneficiaryName} ({fundEntry.beneficiaryNumber})</div>
                                <div><b>App:</b> {fundEntry.applicationName}</div>
                                <div><b>Transferred From:</b> {fundEntry.transferredFrom} {fundEntry.transferredFrom === 'Other' && `(Remark: ${fundEntry.transferredFromRemark})`}</div>
                                <div><b>Cash Received:</b> {fundEntry.cashReceived}</div>
                                <div><b>Added in Gala:</b> {fundEntry.addedInGala} {fundEntry.addedInGala === 'No' && `(Remark: ${fundEntry.addedInGalaRemark})`}</div>
                                <div><b>Commission:</b> {fundEntry.commissionType} {fundEntry.commissionAmount && `(₹${fundEntry.commissionAmount})`} {fundEntry.commissionRemark && `(Remark: ${fundEntry.commissionRemark})`}</div>
                              </div>
                            </td>
                          </tr>
                        );
                      } else {
                        return (
                          <tr key={idx} className="text-xs text-gray-700">
                            <td className="px-3 py-2 border-b">{entry.type}</td>
                            <td className="px-3 py-2 border-b">{entry.amount}</td>
                            <td className="px-3 py-2 border-b text-left">
                              <span>-</span>
                            </td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
               </div>
             </div>
           </div>
         )}
       </div>
     </div>
   );
};

export default Sales;
