import React from 'react';
import { formatCurrency } from '../../utils/formatters';

interface MetricCardProps {
  label: string;
  amount: number;
  color?: 'green' | 'blue' | 'orange';
}

const MetricCard: React.FC<MetricCardProps> = ({ label, amount, color = 'green' }) => {
  const colorClasses = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700'
  };

  return (
    <div className={`p-4 rounded-xl border text-center ${colorClasses[color]}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{formatCurrency(amount)}</div>
    </div>
  );
};

export default MetricCard;