import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  TrendingUp, 
  Wallet, 
  Users, 
  FileText, 
  Link, 
  Wrench, 
  Settings, 
  BookOpen,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeScreen: string;
  onScreenChange: (screen: string) => void;
  userRole?: 'user' | 'admin' | 'developer';
}

const Sidebar: React.FC<SidebarProps> = ({ activeScreen, onScreenChange, userRole }) => {
  const [taskSubmenuOpen, setTaskSubmenuOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'balances', label: 'Balances', icon: Wallet },
    { id: 'client', label: 'Client', icon: Users },
    { id: 'report', label: 'Report', icon: FileText },
    { id: 'loginlinks', label: 'Login Links', icon: Link },
    { id: 'tools', label: 'Tools', icon: Wrench },
    { id: 'services', label: 'Services', icon: Settings },
    { id: 'tutorials', label: 'Tutorials', icon: BookOpen }
  ];

  const taskSubmenuItems = [
    { id: 'task-add', label: 'Add New Task' },
    { id: 'task-all', label: 'All Task List' },
    { id: 'task-deleted', label: 'Deleted Tasks' }
  ];

  return (
    <aside className="w-60 bg-emerald-900 text-white p-6 flex flex-col">
      <div className="text-2xl font-bold mb-8">DSAM PORTAL <span className="text-lg">~ Powered By SHIVTECH</span></div>
      
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onScreenChange(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                activeScreen === item.id
                  ? 'bg-emerald-700 text-white'
                  : 'text-emerald-100 hover:bg-emerald-800'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}

        {/* Account */}
        <button
          onClick={() => onScreenChange('account')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
            activeScreen === 'account'
              ? 'bg-emerald-700 text-white'
              : 'text-emerald-100 hover:bg-emerald-800'
          }`}
        >
          <Settings size={18} />
          Account
        </button>

        {/* Admin Panel visible to admin/developer */}
        {(userRole === 'admin' || userRole === 'developer') && (
          <button
            onClick={() => onScreenChange('admin-panel')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
              activeScreen === 'admin-panel'
                ? 'bg-emerald-700 text-white'
                : 'text-emerald-100 hover:bg-emerald-800'
            }`}
          >
            <Users size={18} />
            Admin Panel
          </button>
        )}
        
        {/* Task Menu with Submenu */}
        <div>
          <button
            onClick={() => setTaskSubmenuOpen(!taskSubmenuOpen)}
            className={`flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
              activeScreen.startsWith('task')
                ? 'bg-emerald-700 text-white'
                : 'text-emerald-100 hover:bg-emerald-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <CheckSquare size={18} />
              Task
            </div>
            {taskSubmenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          
          {taskSubmenuOpen && (
            <div className="ml-6 mt-1 flex flex-col gap-1">
              {taskSubmenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onScreenChange(item.id)}
                  className={`px-3 py-2 rounded-md text-sm text-left transition-colors ${
                    activeScreen === item.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-200 hover:bg-emerald-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;