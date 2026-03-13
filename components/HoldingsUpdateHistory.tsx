'use client';

import React from 'react';
import { HoldingsUpdateHistoryEntry } from '../lib/types';

interface HoldingsUpdateHistoryProps {
  history: HoldingsUpdateHistoryEntry[];
}

const HoldingsUpdateHistory: React.FC<HoldingsUpdateHistoryProps> = ({ history }) => {
  // Sort by most recent first (descending order)
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

  if (sortedHistory.length === 0) {
    return (
      <div className="mt-8">
        <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100 mb-4">
          Holdings Update History
        </h3>
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
            No update history recorded yet. Changes will appear here each time holdings are updated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100">
          Holdings Update History
        </h3>
        <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-full">
          {sortedHistory.length} record{sortedHistory.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
              <th className="px-5 py-3.5 text-left text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                #
              </th>
              <th className="px-5 py-3.5 text-left text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                Date &amp; Time
              </th>
              <th className="px-5 py-3.5 text-right text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                Shares Before
              </th>
              <th className="px-5 py-3.5 text-center text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                Direction
              </th>
              <th className="px-5 py-3.5 text-right text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                Shares After
              </th>
              <th className="px-5 py-3.5 text-right text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                Net Change
              </th>
              <th className="px-5 py-3.5 text-center text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                Updated By
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {sortedHistory.map((entry, index) => {
              const before  = entry.sharesHeldBefore ?? null;
              const after   = entry.sharesHeldAfter  ?? null;
              const change  = before !== null && after !== null ? after - before : null;
              const pctRaw  = before !== null && before > 0 && change !== null
                ? (change / before) * 100
                : null;

              const isIncrease = change !== null && change > 0;
              const isDecrease = change !== null && change < 0;
              const isNoChange = change !== null && change === 0;

              // Row number from oldest → newest so #1 = first ever update
              const rowNum = sortedHistory.length - index;

              return (
                <tr
                  key={index}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  {/* Row number */}
                  <td className="px-5 py-4 text-xs font-bold text-neutral-400 dark:text-neutral-500">
                    {rowNum}
                  </td>

                  {/* Date + Time */}
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatDate(entry.updatedAt)}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {formatTime(entry.updatedAt)}
                    </p>
                  </td>

                  {/* Shares Before */}
                  <td className="px-5 py-4 text-right">
                    {before !== null ? (
                      <span className="text-sm font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                        {before.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-500 text-sm">—</span>
                    )}
                  </td>

                  {/* Direction arrow */}
                  <td className="px-5 py-4 text-center">
                    {isIncrease && (
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40"
                        title="Increase"
                      >
                        <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      </span>
                    )}
                    {isDecrease && (
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/40"
                        title="Decrease"
                      >
                        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </span>
                    )}
                    {isNoChange && (
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-700"
                        title="No change"
                      >
                        <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />
                        </svg>
                      </span>
                    )}
                    {change === null && (
                      <span className="text-neutral-400 dark:text-neutral-500 text-sm">—</span>
                    )}
                  </td>

                  {/* Shares After */}
                  <td className="px-5 py-4 text-right">
                    {after !== null ? (
                      <span
                        className={`text-sm font-mono font-bold ${
                          isIncrease
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isDecrease
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {after.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-500 text-sm">—</span>
                    )}
                  </td>

                  {/* Net Change */}
                  <td className="px-5 py-4 text-right">
                    {change !== null ? (
                      <div>
                        <span
                          className={`text-sm font-bold font-mono ${
                            isIncrease
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isDecrease
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          {change >= 0 ? '+' : ''}{change.toLocaleString()}
                        </span>
                        {pctRaw !== null && (
                          <p
                            className={`text-[10px] font-bold mt-0.5 ${
                              isIncrease
                                ? 'text-emerald-500 dark:text-emerald-500'
                                : isDecrease
                                ? 'text-red-500 dark:text-red-500'
                                : 'text-neutral-400'
                            }`}
                          >
                            {pctRaw >= 0 ? '+' : ''}{pctRaw.toFixed(2)}%
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-500 text-sm">—</span>
                    )}
                  </td>

                  {/* Updated By */}
                  <td className="px-5 py-4 text-center">
                    {entry.updatedBy ? (
                      <span
                        className={`inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          entry.updatedBy === 'IRO'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                        }`}
                      >
                        {entry.updatedBy}
                      </span>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-500 text-sm">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HoldingsUpdateHistory;
