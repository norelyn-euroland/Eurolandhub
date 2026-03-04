'use client';

import React from 'react';

interface EngagementPageProps {
  applicants: any[];
  applicantsLoading: boolean;
}

const EngagementPage: React.FC<EngagementPageProps> = () => {
  return (
    <div className="space-y-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">Engagement</h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Track investor engagement and interactions
          </p>
        </div>
      </div>

      {/* Content Area - Placeholder */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
          <svg className="w-8 h-8 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Coming Soon
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          The engagement tracking feature is currently under development. This page will be available in a future update.
        </p>
      </div>
    </div>
  );
};

export default EngagementPage;
