import React from 'react';
import { Search, Plus, LogOut } from 'lucide-react';

interface HeaderProps {
  title: string;
  onAddClient: () => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onAddClient, onLogout }) => {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
      
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            placeholder="Search anything Siohioma..."
            className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
        
        <button
          onClick={onAddClient}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors font-medium"
        >
          <Plus size={16} />
          Add new client
        </button>
        
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;