'use client';

import React from 'react';
import { Applicant } from '../lib/types';

interface MeetingsPageProps {
  applicants: Applicant[];
  applicantsLoading: boolean;
}

const MeetingsPage: React.FC<MeetingsPageProps> = ({ applicants, applicantsLoading }) => {
  // ─ Loading state ─
  if (applicantsLoading) {
    return (
      <div className="space-y-8 max-w-screen-2xl mx-auto">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">Meetings</h2>
            <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
              Manage investor meetings and interactions
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl h-[400px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto pb-12">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">
            Meetings
          </h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Manage investor meetings and interactions
          </p>
        </div>
      </div>

      {/* ── Content Placeholder ───────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-8">
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p className="text-neutral-600 dark:text-neutral-400 font-medium">
            Meetings management coming soon
          </p>
        </div>
      </div>
    </div>
  );
};

export default MeetingsPage;

