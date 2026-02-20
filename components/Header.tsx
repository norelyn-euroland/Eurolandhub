
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Applicant, BreadcrumbItem } from '../lib/types';

interface HeaderProps {
  viewTitle: string;
  pendingApplicants?: Applicant[];
  onNotificationAction?: (action: { type: 'open_shareholders' } | { type: 'review_applicant'; applicantId: string }) => void;
  breadcrumbItems?: BreadcrumbItem[];
}

const Header: React.FC<HeaderProps> = ({ 
  viewTitle, 
  pendingApplicants = [],
  onNotificationAction,
  breadcrumbItems = [],
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

  // Generate breadcrumb display - make each segment clickable except the last
  const renderBreadcrumb = () => {
    if (!breadcrumbItems || breadcrumbItems.length === 0) {
      return <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{viewTitle}</h1>;
    }

    return (
      <div className="flex items-center gap-2 text-base font-bold tracking-tight">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          const isClickable = item.onClick && !isLast;

          return (
            <React.Fragment key={index}>
              {isClickable ? (
                <button
                  onClick={item.onClick}
                  className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors font-bold"
                >
                  {item.label}
                </button>
              ) : (
                <span className="text-neutral-900 dark:text-neutral-100 font-bold">{item.label}</span>
              )}
              {!isLast && <span className="text-neutral-400 dark:text-neutral-600">/</span>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <header className="h-20 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-8 flex items-center justify-between shrink-0">
      {renderBreadcrumb()}
      
      <div className="flex items-center gap-6">
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(v => !v)}
            className="relative text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            aria-label="Notifications"
            aria-expanded={isNotifOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ display: 'block' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-neutral-800 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 shadow-lg shadow-purple-500/50">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute top-full right-0 mt-3 w-[360px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-widest">Notifications</p>
                </div>
                <span className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                  {unreadCount} new
                </span>
              </div>

              <div className="max-h-[360px] overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-700">
                {notifications.map((n) => {
                  const isUnread = unreadIds.has(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.action)}
                      className="w-full text-left px-4 py-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full ${
                          isUnread ? 'bg-gradient-to-br from-indigo-500 to-purple-500 shadow-sm shadow-purple-500/50' : 'bg-neutral-400 dark:bg-neutral-600'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-black leading-tight text-neutral-900 dark:text-neutral-100">
                              {n.title}
                            </p>
                            <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 text-neutral-500 dark:text-neutral-400">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium mt-1 leading-snug text-neutral-600 dark:text-neutral-400">
                            {n.detail}
                          </p>
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100">
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
