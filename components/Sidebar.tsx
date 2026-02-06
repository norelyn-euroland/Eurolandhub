
'use client';

import React from 'react';
// @google/genai guidelines: Import shared ViewType from lib/types
import { ViewType } from '../lib/types';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-black text-white flex flex-col shrink-0 z-50">
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <div className="w-4 h-4 bg-white transform rotate-45"></div>
          </div>
          <span className="text-xl font-bold tracking-tight whitespace-nowrap">EurolandHUB</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        <button 
          onClick={() => onViewChange('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${currentView === 'dashboard' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
          Dashboard
        </button>
        <button 
          onClick={() => onViewChange('registrations')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${currentView === 'registrations' || currentView === 'detail' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
          Registrations
        </button>
        <button 
          onClick={() => onViewChange('shareholders')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${currentView === 'shareholders' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          Shareholders
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-900">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Help
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;
