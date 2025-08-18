import React from 'react';
import { Plus } from 'lucide-react';
import StatusCard from './StatusCard';
import BalanceSection from './BalanceSection';
import MetricCard from './MetricCard';
import ChartCard from './ChartCard';
import { DashboardData } from '../../types';

interface DashboardProps {
  data: DashboardData;
  onAddTask: () => void;
  onAddClient?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data, onAddTask, onAddClient }) => {
  const mobileBalanceItems = [
    { label: 'Airtel ID', amount: data.mobileBalances.airtel },
    { label: 'Jio ID', amount: data.mobileBalances.jio },
    { label: 'BSNL ID', amount: data.mobileBalances.bsnl },
    { label: 'Vodafone ID', amount: data.mobileBalances.vodafone }
  ];

  const bankBalanceItems = [
    { label: 'Bank', amount: data.bankBalances.bank },
    { label: 'Cash', amount: data.bankBalances.cash },
    { label: 'Redmil', amount: data.bankBalances.redmil },
    { label: 'SpiceMoney', amount: data.bankBalances.spicemoney },
    { label: 'Airtel Payment Bank', amount: data.bankBalances.airtelpmt },
    { label: 'COLLECT FROM VAIBHAV', amount: data.bankBalances.vaibhav },
    { label: 'COLLECT FROM OMKAR', amount: data.bankBalances.omkar },
    { label: 'COLLECT FROM UMA', amount: data.bankBalances.uma },
    { label: 'SHOP QR', amount: data.bankBalances.shopqr }
  ];

  const salesChartData = {
    labels: data.chartLabels,
    datasets: [{
      label: 'Sales',
      data: data.chartSalesProfit,
      backgroundColor: '#10b981'
    }]
  };

  const expenseChartData = {
    labels: ['Sales', 'Expense'],
    datasets: [{
      data: [data.today.sales, data.today.expense],
      backgroundColor: ['#10b981', '#f59e0b']
    }]
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
      {/* Left Column */}
      <div className="xl:col-span-3 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatusCard code="PDT" label="Pending Tasks" value={data.statusCounts.PDT} />
          <StatusCard code="CTT" label="Completed Tasks" value={data.statusCounts.CTT} />
          <StatusCard code="OGT" label="Ongoing Tasks" value={data.statusCounts.OGT} />
          <StatusCard code="AST" label="Assigned Tasks" value={data.statusCounts.AST} />
          <StatusCard code="UAT" label="Unassigned Tasks" value={data.statusCounts.UAT} />
          <StatusCard code="IMT" label="Do Now Tasks" value={data.statusCounts.IMT} important />
          <StatusCard code="URT" label="Urgent Tasks" value={data.statusCounts.URT} />
        </div>

        {/* Balance Sections */}
        <BalanceSection title="Mobile Balances" items={mobileBalanceItems} />
        <BalanceSection title="Bank / Cash / AEPS Apps" items={bankBalanceItems} />
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* Metrics */}
        <div className="space-y-3">
          <MetricCard label="Today's Sales" amount={data.today.sales} color="green" />
          <MetricCard label="Today's Profit" amount={data.today.profit} color="blue" />
          <MetricCard label="Today's Expense" amount={data.today.expense} color="orange" />
        </div>

        {/* Charts */}
        <ChartCard title="Sales / Profit" type="bar" data={salesChartData} />
        <ChartCard title="Expense" type="doughnut" data={expenseChartData} />

        {/* Add Work Button */}
        <div className="text-right">
          <button
            onClick={onAddTask}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            <Plus size={16} />
            Add Work
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={onAddClient}
          >
            Add New Client
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;