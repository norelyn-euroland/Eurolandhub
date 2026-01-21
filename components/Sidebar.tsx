
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
    <aside className="w-64 bg-black text-white flex flex-col shrink-0">
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <div className="w-4 h-4 bg-white transform rotate-45"></div>
          </div>
          <span className="text-xl font-bold tracking-tight whitespace-nowrap">EurolandHUB</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        <button 
          onClick={() => onViewChange('overview')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${currentView === 'overview' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
          Overview
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
        <button 
          onClick={() => onViewChange('compliance')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${currentView === 'compliance' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          Compliance
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-900">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          Settings
        </button>
      </nav>

      <div className="p-8 border-t border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-400">
            IRT
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-neutral-200">IR Team</p>
            <p className="text-xs text-neutral-500 truncate">Core Operations</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
