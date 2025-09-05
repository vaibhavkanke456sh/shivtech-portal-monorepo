import React from 'react';

interface StatusCardProps {
  code: string;
  label: string;
  value: number;
  important?: boolean;
}

const StatusCard: React.FC<StatusCardProps> = ({ code, label, value, important = false }) => {
  const getCardStyle = () => {
    if (important) return 'bg-red-500 text-white';
    if (code === 'SDT') return 'bg-emerald-500 text-white'; // Service Delivered gets green background
    return 'bg-white border border-gray-200';
  };

  return (
    <div className={`p-4 rounded-xl text-center shadow-sm transition-transform hover:scale-105 ${getCardStyle()}`}>
      <div className="text-sm font-medium opacity-90">{code}</div>
      <div className="text-2xl font-bold my-1">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
};

export default StatusCard;