import React, { useState } from 'react';
import { LayoutDashboard, FlaskConical, History, Settings, Menu, X } from 'lucide-react';
import { useExperimentStore } from '../../store/experimentStore';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

/**
 * Left sidebar navigation for the application.
 */
export const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const regionMode = useExperimentStore((s) => s.regionMode);
  const failoverActive = useExperimentStore((s) => s.failoverActive);

  const activeRegion = regionMode === 'multi-region'
    ? (failoverActive ? 'us-west-2 (Failover)' : 'us-east-1 (Primary)')
    : 'us-east-1';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'experiments', label: 'Experiments', icon: FlaskConical },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    onViewChange(id);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed bottom-4 right-4 p-3 bg-indigo-600 text-white rounded-full shadow-lg z-50"
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`
        fixed inset-y-0 left-0 pt-16 w-64 border-r bg-white dark:bg-slate-900 dark:border-slate-800
        transform transition-transform duration-300 ease-in-out z-40 flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors text-left
                  ${isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t dark:border-slate-800">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <span className={`w-2 h-2 rounded-full ${failoverActive ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
            <span className="truncate">Active: <strong className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">{activeRegion}</strong></span>
          </div>
        </div>
      </aside>
    </>
  );
};
