'use client';

import React, { useState, useEffect } from 'react';
import { applicantService } from '../lib/firestore-service';
import { RegistrationStatus } from '../lib/types';
import Tooltip from './Tooltip';

interface EngagementData {
  investorName: string;
  verificationStatus: string;
  latestInteraction: string;
  engagementType: string;
  totalInteractions: number;
  notificationsEnabled: boolean;
}

const EngagementPage: React.FC = () => {
  const [engagementData, setEngagementData] = useState<EngagementData[]>([]);
  const [loadingEngagement, setLoadingEngagement] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nameSort, setNameSort] = useState<string | null>(null);
  const [engagementTypeFilter, setEngagementTypeFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch engagement data
  useEffect(() => {
    const fetchEngagement = async () => {
      setLoadingEngagement(true);
      try {
        const applicants = await applicantService.getAll();
        
        const engagement = applicants.map((applicant) => {
          // Determine verification status
          let verificationStatus = 'Unverified';
          if (applicant.status === RegistrationStatus.APPROVED && applicant.shareholdingsVerification?.step6?.verifiedAt) {
            verificationStatus = 'Verified';
          } else if (applicant.status === RegistrationStatus.PENDING) {
            verificationStatus = 'Pending';
          }

          // Get latest interaction (most recent of email opened, link clicked, or account claimed)
          const interactions: string[] = [];
          if (applicant.emailOpenedAt) interactions.push(applicant.emailOpenedAt);
          if (applicant.linkClickedAt) interactions.push(applicant.linkClickedAt);
          if (applicant.accountClaimedAt) interactions.push(applicant.accountClaimedAt);
          const latestInteraction = interactions.length > 0 
            ? new Date(Math.max(...interactions.map(d => new Date(d).getTime()))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Never';

          // Determine engagement type
          let engagementType = 'None';
          if (applicant.accountClaimedAt) {
            engagementType = 'Disclosure';
          } else if (applicant.linkClickedAt) {
            engagementType = 'Event';
          } else if (applicant.emailOpenedAt) {
            engagementType = 'News';
          }

          // Calculate total interactions
          const totalInteractions = (applicant.emailOpenedCount || 0) + (applicant.linkClickedCount || 0) + (applicant.accountClaimedAt ? 1 : 0);

          // Notifications enabled if email was sent
          const notificationsEnabled = !!applicant.emailSentAt;

          return {
            investorName: applicant.fullName,
            verificationStatus,
            latestInteraction,
            engagementType,
            totalInteractions,
            notificationsEnabled,
          };
        });

        setEngagementData(engagement);
      } catch (error) {
        console.error('Error fetching engagement data:', error);
        setEngagementData([]);
      } finally {
        setLoadingEngagement(false);
      }
    };

    fetchEngagement();
  }, []);

  // Filter and sort function for engagement data
  const filterEngagementData = (data: EngagementData[]): EngagementData[] => {
    let filtered = [...data];

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        return item.investorName.toLowerCase().includes(query) ||
               item.engagementType.toLowerCase().includes(query);
      });
    }

    // Name sort (A-Z or Z-A)
    if (nameSort) {
      filtered.sort((a, b) => {
        const nameA = a.investorName.toLowerCase();
        const nameB = b.investorName.toLowerCase();
        
        if (nameSort === 'a-z') {
          return nameA.localeCompare(nameB);
        } else if (nameSort === 'z-a') {
          return nameB.localeCompare(nameA);
        }
        return 0;
      });
    }

    // Engagement type filter
    if (engagementTypeFilter && engagementTypeFilter !== 'all') {
      filtered = filtered.filter((item) => {
        return item.engagementType.toLowerCase() === engagementTypeFilter.toLowerCase();
      });
    }

    return filtered;
  };

  const getPaginatedData = (data: EngagementData[]): EngagementData[] => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (dataLength: number): number => {
    return Math.ceil(dataLength / itemsPerPage);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const filteredData = filterEngagementData(engagementData);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">Engagement</h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Track investor engagement and interactions
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by name or engagement type..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-transparent"
          />
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Name Sort (A-Z / Z-A) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Name:</label>
            <select
              value={nameSort || 'none'}
              onChange={(e) => {
                setNameSort(e.target.value === 'none' ? null : e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-transparent"
            >
              <option value="none">None</option>
              <option value="a-z">A-Z</option>
              <option value="z-a">Z-A</option>
            </select>
          </div>

          {/* Engagement Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Type:</label>
            <select
              value={engagementTypeFilter || 'all'}
              onChange={(e) => {
                setEngagementTypeFilter(e.target.value === 'all' ? null : e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="disclosure">Disclosure</option>
              <option value="event">Event</option>
              <option value="news">News</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loadingEngagement ? (
        <div className="py-12 text-center">
          <div className="w-12 h-12 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
            <svg className="w-5 h-5 text-neutral-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </div>
          <p className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Loading engagement data...</p>
        </div>
      ) : filteredData.length > 0 ? (
        <div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900/50 text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-4 py-5">INVESTOR NAME</th>
                <th className="px-4 py-5">VERIFICATION STATUS</th>
                <th className="px-4 py-5">LATEST INTERACTION</th>
                <th className="px-4 py-5">ENGAGEMENT TYPE</th>
                <th className="px-4 py-5">TOTAL INTERACTIONS</th>
                <th className="px-4 py-5">NOTIFICATIONS ENABLED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
              {getPaginatedData(filteredData).map((engagement, index) => (
                <tr key={index} className="group hover:bg-neutral-50 dark:hover:bg-neutral-700/80 transition-all cursor-default">
                  <td className="px-4 py-5">
                    <Tooltip content={engagement.investorName}>
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">{engagement.investorName}</p>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-5">
                    <span className={`inline-block px-3 py-1 text-[10px] font-medium rounded-full uppercase tracking-wider ${
                      engagement.verificationStatus === 'Verified'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : engagement.verificationStatus === 'Pending'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}>
                      {engagement.verificationStatus === 'Verified' && (
                        <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                          <path d="m9 12 2 2 4-4"/>
                        </svg>
                      )}
                      {engagement.verificationStatus === 'Pending' && (
                        <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 6v6l4 2"/>
                        </svg>
                      )}
                      {engagement.verificationStatus === 'Unverified' && (
                        <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                        </svg>
                      )}
                      {engagement.verificationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">{engagement.latestInteraction}</span>
                  </td>
                  <td className="px-4 py-5">
                    <span className={`inline-block px-3 py-1 text-[10px] font-medium rounded-full uppercase tracking-wider ${
                      engagement.engagementType === 'Disclosure'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : engagement.engagementType === 'Event'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : engagement.engagementType === 'News'
                        ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}>
                      {engagement.engagementType}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                    <span className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                      {engagement.totalInteractions}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                    <span className={`inline-block px-3 py-1 text-[10px] font-medium rounded-full uppercase tracking-wider ${
                      engagement.notificationsEnabled
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}>
                      {engagement.notificationsEnabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length > itemsPerPage && (
            <div className="mt-6 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700 pt-4">
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} engagement records
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= getTotalPages(filteredData.length)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 text-center">
          <div className="w-12 h-12 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
            <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <p className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">No engagement data found.</p>
        </div>
      )}
    </div>
  );
};

export default EngagementPage;


