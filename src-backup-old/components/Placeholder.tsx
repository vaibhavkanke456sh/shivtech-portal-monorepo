import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
}

const Placeholder: React.FC<PlaceholderProps> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Construction size={64} className="text-gray-400 mb-4" />
      <h2 className="text-2xl font-semibold text-gray-600 mb-2">{title}</h2>
      <p className="text-gray-500">This feature is coming soon...</p>
    </div>
  );
};

export default Placeholder;