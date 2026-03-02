'use client';

import React from 'react';
import { HoldingsUpdateHistoryEntry } from '../lib/types';

interface HoldingsUpdateHistoryProps {
  history: HoldingsUpdateHistoryEntry[];
}

const HoldingsUpdateHistory: React.FC<HoldingsUpdateHistoryProps> = ({ history }) => {
  // Sort by most recent first (descending order)
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  if (sortedHistory.length === 0) {
    return (
      <div className="mt-8">
        <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100 mb-4">
          Holdings Update History
        </h3>
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
            No update history available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100 mb-4">
        Holdings Update History
      </h3>
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
              <th className="px-6 py-4 text-left text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {sortedHistory.map((entry, index) => (
              <tr key={index} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {formatDate(entry.updatedAt)}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {formatTime(entry.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HoldingsUpdateHistory;

