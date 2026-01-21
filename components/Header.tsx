
'use client';

import React from 'react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  viewTitle: string;
  searchPlaceholder?: string;
}

const Header: React.FC<HeaderProps> = ({ 
  searchQuery, 
  onSearchChange, 
  viewTitle, 
  searchPlaceholder = "Search..." 
}) => {
  return (
    <header className="h-20 bg-white border-b border-neutral-200 px-8 flex items-center justify-between shrink-0">
      <h1 className="text-xl font-bold text-neutral-900 tracking-tight">{viewTitle}</h1>
      
      <div className="flex items-center gap-6">
        <div className="relative">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input 
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:ring-1 focus:ring-black focus:border-black outline-none w-72 transition-all placeholder:text-neutral-400 font-medium"
          />
        </div>
        
        <button className="relative text-neutral-400 hover:text-neutral-900 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-black border-2 border-white rounded-full"></span>
        </button>
      </div>
    </header>
  );
};

export default Header;
