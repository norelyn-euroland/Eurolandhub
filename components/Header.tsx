
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Applicant } from '../lib/types';

interface HeaderProps {
  viewTitle: string;
  pendingApplicants?: Applicant[];
  onNotificationAction?: (action: { type: 'open_shareholders' } | { type: 'review_applicant'; applicantId: string }) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  viewTitle, 
  pendingApplicants = [],
  onNotificationAction,
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set(['shareholders_new_data']));
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
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

    // One notification per pending applicant
    for (const a of pendingApplicants) {
      // Check if this is a pre-verified account
      if (a.isPreVerified) {
        items.push({
          id: `reg_${a.id}`,
          title: `Pre-verified account: ${a.fullName}`,
          detail: 'Pre-verified account ready for invitation email.',
          time: 'Today',
          action: { type: 'review_applicant', applicantId: a.id } as const,
        });
      } else {
        items.push({
          id: `reg_${a.id}`,
          title: `New registration: ${a.fullName}`,
          detail: 'Needs verification review (approve/reject/request info).',
          time: 'Today',
          action: { type: 'review_applicant', applicantId: a.id } as const,
        });
      }
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
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(v => !v)}
            className="relative text-neutral-400 hover:text-neutral-900 transition-colors"
            aria-label="Notifications"
            aria-expanded={isNotifOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white bg-neutral-900">
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
                      className="w-full text-left px-4 py-3 transition-colors hover:bg-neutral-50"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full ${
                          isUnread ? 'bg-neutral-900' : 'bg-neutral-200'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-black leading-tight text-neutral-900">
                              {n.title}
                            </p>
                            <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 text-neutral-400">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium mt-1 leading-snug text-neutral-500">
                            {n.detail}
                          </p>
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white border border-neutral-200 text-neutral-900">
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

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(v => !v)}
            className="hover:opacity-80 transition-opacity"
            aria-label="User Profile"
            aria-expanded={isProfileOpen}
          >
            <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-400">
              IRT
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute top-full right-0 mt-3 w-64 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-400 mb-3">
                    IRT
                  </div>
                  <p className="text-sm font-semibold text-neutral-900 mb-1">IR Team</p>
                  <p className="text-xs text-neutral-500">Core Operations</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
