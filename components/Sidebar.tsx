
'use client';

import React, { useState } from 'react';
// @google/genai guidelines: Import shared ViewType from lib/types
import { ViewType, Theme } from '../lib/types';
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  theme: Theme;
  toggleTheme: () => void;
  isCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, theme, toggleTheme, isCollapsed: externalIsCollapsed, onCollapseChange }) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  
  const handleToggle = () => {
    const newState = !isCollapsed;
    if (onCollapseChange) {
      onCollapseChange(newState);
    } else {
      setInternalIsCollapsed(newState);
    }
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col shrink-0 z-50 border-r border-neutral-200 dark:border-neutral-800 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`p-8 ${isCollapsed ? 'px-4' : ''} relative`}>
        <div className="flex items-center gap-3">
          <button
            onClick={isCollapsed ? handleToggle : undefined}
            className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${isCollapsed ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
            disabled={!isCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : undefined}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="w-8 h-8 fill-[#082b4a] dark:fill-[#00adf0]">
              <path d="M333.4 66.9C329.2 65 324.7 64 320 64C315.3 64 310.8 65 306.6 66.9L118.3 146.8C96.3 156.1 79.9 177.8 80 204C80.5 303.2 121.3 484.7 293.6 567.2C310.3 575.2 329.7 575.2 346.4 567.2C518.8 484.7 559.6 303.2 560 204C560.1 177.8 543.7 156.1 521.7 146.8L333.4 66.9zM224 218.4C224 212.6 228.7 208 234.4 208L234.6 208C238 208 241.1 209.6 243.1 212.3L283.1 265.6C286.1 269.6 290.9 272 295.9 272L343.9 272C348.9 272 353.7 269.6 356.7 265.6L396.7 212.3C398.7 209.6 401.9 208 405.2 208L405.4 208C411.2 208 415.8 212.7 415.8 218.4L416 336C416 389 373 432 320 432C267 432 224 389 224 336L224 218.4zM280 352C288.8 352 296 344.8 296 336C296 327.2 288.8 320 280 320C271.2 320 264 327.2 264 336C264 344.8 271.2 352 280 352zM376 336C376 327.2 368.8 320 360 320C351.2 320 344 327.2 344 336C344 344.8 351.2 352 360 352C368.8 352 376 344.8 376 336z"/>
            </svg>
          </button>
          {!isCollapsed && (
            <span className="text-xl font-bold tracking-tight whitespace-nowrap text-neutral-900 dark:text-white">EurolandHUB</span>
          )}
        </div>
        {/* Sidebar layout icon button - only shown when expanded, positioned at top right */}
        {!isCollapsed && (
          <button
            onClick={handleToggle}
            className="absolute right-2 top-2 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors z-10"
            aria-label="Collapse sidebar"
          >
            <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="5" height="14" rx="1" fill="currentColor" opacity="0.2"/>
              <rect x="10" y="5" width="11" height="14" rx="1" fill="currentColor" opacity="0.2"/>
              <rect x="3" y="5" width="5" height="14" rx="1" stroke="currentColor"/>
              <rect x="10" y="5" width="11" height="14" rx="1" stroke="currentColor"/>
            </svg>
          </button>
        )}
      </div>

      <nav className={`flex-1 space-y-2 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <button 
          onClick={() => onViewChange('dashboard')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition-all text-sm font-medium ${currentView === 'dashboard' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border-l-4 border-[#082b4a] dark:border-[#00adf0]' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
          title={isCollapsed ? 'Dashboard' : ''}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
          {!isCollapsed && <span>Dashboard</span>}
        </button>
        <button 
          onClick={() => onViewChange('registrations')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition-all text-sm font-medium ${currentView === 'registrations' || currentView === 'detail' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border-l-4 border-[#082b4a] dark:border-[#00adf0]' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
          title={isCollapsed ? 'Registrations' : ''}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
          {!isCollapsed && <span>Registrations</span>}
        </button>
        <button 
          onClick={() => onViewChange('shareholders')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition-all text-sm font-medium ${currentView === 'shareholders' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border-l-4 border-[#082b4a] dark:border-[#00adf0]' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
          title={isCollapsed ? 'Shareholders' : ''}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          {!isCollapsed && <span>Shareholders</span>}
        </button>
        <button 
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition-all text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900`}
          title={isCollapsed ? 'Help' : ''}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {!isCollapsed && <span>Help</span>}
        </button>
      </nav>

      {/* Theme Toggle at bottom left */}
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>
    </aside>
  );
};

export default Sidebar;
