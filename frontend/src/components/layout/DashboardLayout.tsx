import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
}

/**
 * Main application layout wrapping Header, Sidebar, and main content area.
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, activeView, onViewChange }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar activeView={activeView} onViewChange={onViewChange} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:ml-64 transition-all">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
