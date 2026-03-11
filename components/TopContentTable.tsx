'use client';

import React from 'react';

interface ContentEngagement {
  title: string;
  readPercentage: number;
  interactions: number;
  views?: number;
}

interface TopContentTableProps {
  topContent: ContentEngagement[];
  engagementLoading: boolean;
  onViewAll?: () => void;
  onViewAnalytics?: () => void;
  limit?: number; // Default to 10
  fixedHeight?: boolean; // If true, always show exactly 10 rows
}

const TopContentTable: React.FC<TopContentTableProps> = ({
  topContent,
  engagementLoading,
  onViewAll,
  onViewAnalytics,
  limit = 10,
  fixedHeight = false,
}) => {
  const displayContent = topContent.slice(0, limit);
  
  // If fixedHeight is true, pad with empty rows to always show 10 rows
  const paddedContent = fixedHeight 
    ? [...displayContent, ...Array(Math.max(0, 10 - displayContent.length)).fill(null)]
    : displayContent;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-100 dark:border-neutral-800">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/30">
        <div>
          <h3 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-[0.08em]">Top Content by Engagement</h3>
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">Ranked by read rate and interactions</p>
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
              <th className="px-4 py-2.5">Content</th>
              <th className="px-4 py-2.5 text-right">Read Rate</th>
              <th className="px-4 py-2.5 text-right">Interactions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
            {engagementLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Loading content data...</p>
                </td>
              </tr>
            ) : paddedContent.length > 0 ? (
              paddedContent.map((content, index) => {
                // Handle empty rows (null entries)
                if (!content) {
                  return (
                    <tr key={`empty-${index}`} className="h-[42px]">
                      <td colSpan={3} className="px-4 py-2.5"></td>
                    </tr>
                  );
                }
                
                return (
                  <tr key={index} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors h-[42px]">
                    <td className="px-4 py-2.5">
                      <p className="text-[11px] font-bold text-neutral-900 dark:text-white truncate max-w-[200px]">{content.title}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[11px] font-bold text-neutral-900 dark:text-white">{content.readPercentage}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[11px] font-bold text-neutral-900 dark:text-white">{content.interactions}</span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  No content data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
        <p className="text-[9px] text-neutral-400 dark:text-neutral-500">
          <strong className="text-neutral-500 dark:text-neutral-400">Engagement:</strong> Views, downloads, time spent, shares, interactions.
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

export default TopContentTable;

