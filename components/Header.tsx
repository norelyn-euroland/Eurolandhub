
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Applicant } from '../lib/types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  viewTitle: string;
  searchPlaceholder?: string;
  pendingApplicants?: Applicant[];
  onNotificationAction?: (action: { type: 'open_shareholders' } | { type: 'review_applicant'; applicantId: string }) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  searchQuery, 
  onSearchChange, 
  viewTitle, 
  searchPlaceholder = "Search...",
  pendingApplicants = [],
  onNotificationAction,
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set(['shareholders_new_data']));
  const notifRef = useRef<HTMLDivElement>(null);

  // Seed unread notifications for any new pending applicants that appear.
  useEffect(() => {
    if (pendingApplicants.length === 0) return;
    setUnreadIds(prev => {
      const next = new Set(prev);
      for (const a of pendingApplicants) next.add(`reg_${a.id}`);
      return next;
    });
  }, [pendingApplicants]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      time: string;
      action: { type: 'open_shareholders' } | { type: 'review_applicant'; applicantId: string };
    }> = [
      {
        id: 'shareholders_new_data',
        title: 'New investor data received',
        detail: 'A new shareholder record was added to the registry.',
        time: 'Just now',
        action: { type: 'open_shareholders' } as const,
      },
    ];

    // One notification per pending applicant (e.g., "James Wilson registered — needs review")
    for (const a of pendingApplicants) {
      items.push({
        id: `reg_${a.id}`,
        title: `New registration: ${a.fullName}`,
        detail: 'Needs verification review (approve/reject/request info).',
        time: 'Today',
        action: { type: 'review_applicant', applicantId: a.id } as const,
      });
    }

    return items;
  }, [pendingApplicants]);

  const unreadCount = notifications.reduce((count, n) => (unreadIds.has(n.id) ? count + 1 : count), 0);

  const handleNotificationClick = (
    id: string,
    action: { type: 'open_shareholders' } | { type: 'review_applicant'; applicantId: string }
  ) => {
    setUnreadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setIsNotifOpen(false);
    onNotificationAction?.(action);
  };

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
        
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(v => !v)}
            className="relative text-neutral-400 hover:text-neutral-900 transition-colors"
            aria-label="Notifications"
            aria-expanded={isNotifOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-neutral-900 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute top-full right-0 mt-3 w-[360px] bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-neutral-900 uppercase tracking-widest">Notifications</p>
                </div>
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                  {unreadCount} new
                </span>
              </div>

              <div className="max-h-[360px] overflow-y-auto divide-y divide-neutral-100">
                {notifications.map((n) => {
                  const isUnread = unreadIds.has(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.action)}
                      className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full ${isUnread ? 'bg-neutral-900' : 'bg-neutral-200'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-black text-neutral-900 leading-tight">{n.title}</p>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest shrink-0">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 font-medium mt-1 leading-snug">{n.detail}</p>
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 bg-white border border-neutral-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-neutral-900">
                              Open task
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
