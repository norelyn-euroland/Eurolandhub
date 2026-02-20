
'use client';

import React, { useState, useRef, useEffect } from 'react';
// @google/genai guidelines: Import shared ViewType from lib/types
import { ViewType, Theme } from '../lib/types';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';

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
  const { signOut, user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  
  // Get user initials and display info
  const getUserInitials = () => {
    if (user?.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'IR';
  };
  
  const getUserName = () => {
    return user?.displayName || 'IR Team';
  };
  
  const getUserEmail = () => {
    return user?.email || '';
  };
  
  const handleToggle = () => {
    const newState = !isCollapsed;
    if (onCollapseChange) {
      onCollapseChange(newState);
    } else {
      setInternalIsCollapsed(newState);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 transition-all text-sm font-medium ${currentView === 'dashboard' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border-l-4 border-[#082b4a] dark:border-[#00adf0]' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
          title={isCollapsed ? 'Dashboard' : ''}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M3 9h18"/>
            <path d="M9 21V9"/>
          </svg>
          {!isCollapsed && <span>Dashboard</span>}
        </button>
        <button 
          onClick={() => onViewChange('registrations')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 transition-all text-sm font-medium ${currentView === 'registrations' || currentView === 'detail' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border-l-4 border-[#082b4a] dark:border-[#00adf0]' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
          title={isCollapsed ? 'Registrations' : ''}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
          {!isCollapsed && <span>Registrations</span>}
        </button>
        <button 
          onClick={() => onViewChange('shareholders')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 transition-all text-sm font-medium ${currentView === 'shareholders' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border-l-4 border-[#082b4a] dark:border-[#00adf0]' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
          title={isCollapsed ? 'Shareholders' : ''}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          {!isCollapsed && <span>Shareholders</span>}
        </button>
        <button 
          onClick={() => onViewChange('engagement')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 transition-all text-sm font-medium ${currentView === 'engagement' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border-l-4 border-[#082b4a] dark:border-[#00adf0]' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
          title={isCollapsed ? 'Engagement' : ''}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <path d="M13 8H3"/>
            <path d="M17 12H3"/>
          </svg>
          {!isCollapsed && <span>Engagement</span>}
        </button>
        <button 
          onClick={() => onViewChange('documents')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 transition-all text-sm font-medium ${currentView === 'documents' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border-l-4 border-[#082b4a] dark:border-[#00adf0]' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
          title={isCollapsed ? 'Documents' : ''}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/>
            <path d="M16 13H8"/>
            <path d="M16 17H8"/>
            <path d="M10 9H8"/>
          </svg>
          {!isCollapsed && <span>Documents</span>}
        </button>
      </nav>

      {/* Bottom Section: User Profile */}
      <div className="mt-auto border-t border-neutral-200 dark:border-neutral-800">
        {/* User Profile */}
        <div className={`p-4 border-t border-neutral-200 dark:border-neutral-800 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(v => !v)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors`}
              aria-label="User Profile"
              aria-expanded={isProfileOpen}
            >
              <div className="w-10 h-10 rounded-full bg-purple-600 dark:bg-purple-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {getUserInitials()}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{getUserName()}</p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{getUserEmail()}</p>
                </div>
              )}
            </button>

            {isProfileOpen && !isCollapsed && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
                {/* Profile Header */}
                <div className="px-4 py-4 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-600 dark:bg-purple-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {getUserInitials()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{getUserName()}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{getUserEmail()}</p>
                    </div>
                  </div>
                </div>
                
                {/* Menu Items */}
                <div className="py-2">
                  {/* Help */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    aria-label="Help"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                      <path d="M12 17h.01"/>
                    </svg>
                    <span className="flex-1 text-left">Help</span>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                  
                  {/* Settings */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    aria-label="Settings"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span className="flex-1 text-left">Settings</span>
                  </button>
                  
                  {/* Divider */}
                  <div className="border-t border-neutral-200 dark:border-neutral-700 my-1"></div>
                  
                  {/* Logout */}
                  <button
                    onClick={async () => {
                      try {
                        await signOut();
                        setIsProfileOpen(false);
                      } catch (error) {
                        console.error('Logout failed:', error);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    aria-label="Log out"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span className="flex-1 text-left">Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
