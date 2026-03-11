'use client';

import React from 'react';
import { Applicant } from '../lib/types';
import Tooltip from './Tooltip';

interface EngagementRecord {
  investorId: string;
  investorName: string;
  userStatus: 'verified' | 'unverified';
  engagementScore: number;
  lastActive: string;
  profilePictureUrl?: string;
}

interface TopEngagedInvestorsTableProps {
  topInvestors: EngagementRecord[];
  applicants: Applicant[];
  engagementLoading: boolean;
  onViewAll?: () => void;
  onViewAnalytics?: () => void;
  limit?: number; // Default to 10
  fixedHeight?: boolean; // If true, always show exactly 10 rows
}

const Avatar: React.FC<{ name: string; size?: number; profilePictureUrl?: string }> = ({ name, size = 32, profilePictureUrl }) => {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs shrink-0"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
};

const TopEngagedInvestorsTable: React.FC<TopEngagedInvestorsTableProps> = ({
  topInvestors,
  applicants,
  engagementLoading,
  onViewAll,
  onViewAnalytics,
  limit = 10,
  fixedHeight = false,
}) => {
  const displayInvestors = topInvestors.slice(0, limit);
  
  // If fixedHeight is true, pad with empty rows to always show 10 rows
  const paddedInvestors = fixedHeight 
    ? [...displayInvestors, ...Array(Math.max(0, 10 - displayInvestors.length)).fill(null)]
    : displayInvestors;

  const formatRelativeTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-100 dark:border-neutral-800">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/30">
        <div>
          <h3 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-[0.08em]">Top Engaged Retail Investors</h3>
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">Ranked by engagement score</p>
        </div>
        {onViewAll && (
          <button 
            onClick={onViewAll}
            className="px-2.5 py-1 text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors uppercase tracking-wider"
          >
            View All
          </button>
        )}
      </div>
      <div className={`overflow-x-hidden ${fixedHeight ? 'h-[500px]' : ''}`}>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-neutral-50/50 dark:bg-neutral-800/50 text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.12em]">
              <th className="px-4 py-2.5 w-10 text-center">Rank</th>
              <th className="px-4 py-2.5">Shareholder</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Holdings</th>
              <th className="px-4 py-2.5">Engagement</th>
              <th className="px-4 py-2.5 text-right">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
            {engagementLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Loading engagement data...</p>
                </td>
              </tr>
            ) : paddedInvestors.length > 0 ? (
              paddedInvestors.map((record, index) => {
                // Handle empty rows (null entries)
                if (!record) {
                  return (
                    <tr key={`empty-${index}`} className="h-[42px]">
                      <td colSpan={6} className="px-4 py-2.5"></td>
                    </tr>
                  );
                }
                
                const applicant = applicants.find(a => a.id === record.investorId);
                if (!applicant) return null;
                
                const holdings = applicant.holdingsRecord?.sharesHeld || 0;
                
                return (
                  <tr key={record.investorId} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors h-[42px]">
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400">#{index + 1}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={record.investorName} size={26} profilePictureUrl={record.profilePictureUrl} />
                        <div className="min-w-0 flex-1">
                          <Tooltip content={record.investorName}>
                            <p className="text-[11px] font-bold text-neutral-900 dark:text-white truncate max-w-[160px]">{record.investorName}</p>
                          </Tooltip>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {record.userStatus === 'verified' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                            <path d="m9 12 2 2 4-4"/>
                          </svg>
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/40">
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {holdings > 0 ? (
                        <span className="text-[11px] font-bold text-neutral-900 dark:text-white">{holdings.toLocaleString()}</span>
                      ) : (
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-neutral-900 dark:text-white min-w-[1.5rem]">{record.engagementScore}</span>
                        <div className="flex-1 h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden max-w-[80px]">
                          <div 
                            className="h-full bg-blue-500/70 dark:bg-blue-400/60 rounded-full transition-all duration-500"
                            style={{ width: `${record.engagementScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{formatRelativeTime(record.lastActive)}</span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  No engaged investors found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
        <p className="text-[9px] text-neutral-400 dark:text-neutral-500">
          <strong className="text-neutral-500 dark:text-neutral-400">Engagement Criteria:</strong> Activity frequency, content views, recent interactions, holdings quantity, and communication engagement.
        </p>
        {onViewAnalytics && (
          <button 
            onClick={onViewAnalytics}
            className="px-2.5 py-1 text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors uppercase tracking-wider"
          >
            Analytics →
          </button>
        )}
      </div>
    </div>
  );
};

export default TopEngagedInvestorsTable;

