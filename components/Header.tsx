
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Applicant } from '../lib/types';
import { getVerificationDeadlineInfo } from '../lib/shareholdingsVerification';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  viewTitle: string;
  searchPlaceholder?: string;
  pendingApplicants?: Applicant[];
  applicantsNeedingVerification?: Applicant[];
  onNotificationAction?: (action: { type: 'open_shareholders' } | { type: 'review_applicant'; applicantId: string }) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  searchQuery, 
  onSearchChange, 
  viewTitle, 
  searchPlaceholder = "Search...",
  pendingApplicants = [],
  applicantsNeedingVerification = [],
  onNotificationAction,
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set(['shareholders_new_data']));
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render to update countdown
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

  // Auto-update unread notifications for verification deadlines
  useEffect(() => {
    if (applicantsNeedingVerification.length === 0) return;
    setUnreadIds(prev => {
      const next = new Set(prev);
      for (const a of applicantsNeedingVerification) {
        next.add(`verify_${a.id}`);
      }
      return next;
    });
  }, [applicantsNeedingVerification]);

  // Refresh notifications every hour to update countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1); // Force re-render to update countdown
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, []);

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

    // Add notifications for applicants needing verification with deadline countdown
    for (const a of applicantsNeedingVerification) {
      const deadlineInfo = getVerificationDeadlineInfo(a);
      if (!deadlineInfo) continue;
      
      const daysText = deadlineInfo.daysRemaining === 1 
        ? '1 day remaining' 
        : `${deadlineInfo.daysRemaining} days remaining`;
      
      items.push({
        id: `verify_${a.id}`,
        title: `${a.fullName} needs verification`,
        detail: `Send verification code. ${daysText}.`,
        time: 'Active',
        action: { type: 'review_applicant', applicantId: a.id } as const,
      });
    }

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
  }, [pendingApplicants, applicantsNeedingVerification, refreshKey]);

  const unreadCount = notifications.reduce((count, n) => (unreadIds.has(n.id) ? count + 1 : count), 0);
  
  // Check if there are any urgent notifications (1 day remaining)
  const hasUrgentNotifications = notifications.some(n => 
    n.id.startsWith('verify_') && n.detail.includes('1 day remaining') && unreadIds.has(n.id)
  );

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
            <svg className={`w-6 h-6 ${hasUrgentNotifications ? 'text-red-600 animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            {unreadCount > 0 && (
              <span className={`absolute -top-1 -right-1 min-w-5 h-5 px-1.5 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white ${
                hasUrgentNotifications ? 'bg-red-600 animate-pulse' : 'bg-neutral-900'
              }`}>
                {unreadCount}
              </span>
            )}
            {hasUrgentNotifications && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-600 rounded-full border-2 border-white animate-ping"></span>
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
                  // Check if this is an urgent notification (1 day remaining)
                  const isUrgent = n.id.startsWith('verify_') && n.detail.includes('1 day remaining');
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.action)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        isUrgent 
                          ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-600' 
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full ${
                          isUrgent 
                            ? 'bg-red-600 animate-pulse' 
                            : isUnread 
                              ? 'bg-neutral-900' 
                              : 'bg-neutral-200'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {isUrgent && (
                                <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              <p className={`text-xs font-black leading-tight ${
                                isUrgent ? 'text-red-900' : 'text-neutral-900'
                              }`}>
                                {n.title}
                              </p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-widest shrink-0 ${
                              isUrgent ? 'text-red-600' : 'text-neutral-400'
                            }`}>
                              {n.time}
                            </span>
                          </div>
                          <p className={`text-[11px] font-medium mt-1 leading-snug ${
                            isUrgent ? 'text-red-700 font-bold' : 'text-neutral-500'
                          }`}>
                            {n.detail}
                          </p>
                          <div className="mt-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                              isUrgent
                                ? 'bg-red-600 text-white border border-red-700'
                                : 'bg-white border border-neutral-200 text-neutral-900'
                            }`}>
                              {isUrgent ? '⚠️ URGENT - Action Required' : 'Open task'}
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
