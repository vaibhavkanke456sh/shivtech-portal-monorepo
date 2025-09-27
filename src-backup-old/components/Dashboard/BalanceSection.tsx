import React from 'react';
import { formatCurrency } from '../../utils/formatters';

interface BalanceItem {
  label: string;
  amount: number;
}

interface BalanceSectionProps {
  title: string;
  items: BalanceItem[];
}

const BalanceSection: React.FC<BalanceSectionProps> = ({ title, items }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-600">{item.label}</div>
            <div className="text-lg font-bold text-gray-900">{formatCurrency(item.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BalanceSection;