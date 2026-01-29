
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Tooltip from './Tooltip';
import { getWorkflowStatusInternal, getGeneralAccountStatus, getWorkflowStatusFrontendLabel } from '../lib/shareholdingsVerification';

// Helper function to get initials (first letter of first name and last name)
const getInitials = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Helper function to generate consistent color based on name
const getAvatarColor = (name: string): string => {
  const colors = [
    '#4F46E5', // indigo
    '#7C3AED', // violet
    '#EC4899', // pink
    '#F59E0B', // amber
    '#10B981', // emerald
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EF4444', // red
    '#14B8A6', // teal
    '#F97316', // orange
    '#6366F1', // indigo-500
    '#A855F7', // purple-500
    '#06B6D4', // cyan
    '#84CC16', // lime
  ];
  
  // Generate a hash from the name for consistent color assignment
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Avatar component
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 40 }) => {
  const initials = getInitials(name);
  const color = getAvatarColor(name);
  
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-black shrink-0"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        fontSize: `${size * 0.4}px`,
      }}
    >
      {initials}
    </div>
  );
};

// Fix: Use an intersection type to properly combine jsPDF instance methods with the autoTable extension
type jsPDFWithAutoTable = jsPDF & {
  autoTable: (options: any) => void;
};

interface DashboardHomeProps {
  applicants: Applicant[];
  onSelect: (applicant: Applicant) => void;
  tabRequest?: { tab: TabType; requestId: number };
}

type TabType = 'PENDING' | 'VERIFIED' | 'NON_VERIFIED' | 'ALL';

const DashboardHome: React.FC<DashboardHomeProps> = ({ applicants, onSelect, tabRequest }) => {
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const exportRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Allow external navigation (e.g. notifications) to force a specific tab.
  useEffect(() => {
    if (!tabRequest) return;
    setActiveTab(tabRequest.tab);
  }, [tabRequest?.requestId]);

  const filteredData = applicants.filter((applicant) => {
    // Tab Filter - Use General Account Status for categorization
    if (activeTab === 'ALL') return true;
    
    const internalStatus = getWorkflowStatusInternal(applicant);
    const generalStatus = getGeneralAccountStatus(internalStatus);
    
    const matchesTab = 
      activeTab === 'ALL' ||
      (activeTab === 'PENDING' && generalStatus === 'UNVERIFIED') ||
      (activeTab === 'VERIFIED' && generalStatus === 'VERIFIED') ||
      (activeTab === 'NON_VERIFIED' && generalStatus === 'PENDING');

    return matchesTab;
  });

  const tabs: { id: TabType; label: string }[] = [
    { id: 'ALL', label: 'All Files' },
    { id: 'PENDING', label: 'Unverified' },
    { id: 'VERIFIED', label: 'Verified' },
    { id: 'NON_VERIFIED', label: 'Pending' },
  ];

  // Helper function to parse submissionDate (handles YYYY-MM-DD format)
  const parseSubmissionDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    try {
      // Handle YYYY-MM-DD format
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      // Try parsing as ISO string
      return new Date(dateStr);
    } catch {
      return null;
    }
  };

  // Helper function to check if date is older than N days
  const isOlderThanDays = (dateStr: string, days: number): boolean => {
    const date = parseSubmissionDate(dateStr);
    if (!date) return false;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return date.getTime() < cutoffDate.getTime();
  };

  // Helper function to check if date is within a range (last N days)
  const isWithinLastDays = (dateStr: string, days: number): boolean => {
    const date = parseSubmissionDate(dateStr);
    if (!date) return false;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return date.getTime() >= cutoffDate.getTime();
  };

  // Helper function to check if date is between two day ranges
  const isBetweenDays = (dateStr: string, minDays: number, maxDays: number): boolean => {
    const date = parseSubmissionDate(dateStr);
    if (!date) return false;
    const now = new Date();
    const minDate = new Date(now);
    minDate.setDate(minDate.getDate() - maxDays);
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() - minDays);
    return date.getTime() >= minDate.getTime() && date.getTime() < maxDate.getTime();
  };

  // Helper functions to calculate counts
  const getUnverifiedCount = (): number => {
    return applicants.filter(a => {
      const internalStatus = getWorkflowStatusInternal(a);
      return getGeneralAccountStatus(internalStatus) === 'UNVERIFIED';
    }).length;
  };

  const getVerifiedCount = (): number => {
    return applicants.filter(a => {
      const internalStatus = getWorkflowStatusInternal(a);
      return getGeneralAccountStatus(internalStatus) === 'VERIFIED';
    }).length;
  };

  const getPendingCount = (): number => {
    return applicants.filter(a => {
      const internalStatus = getWorkflowStatusInternal(a);
      return getGeneralAccountStatus(internalStatus) === 'PENDING';
    }).length;
  };

  const getAwaitingIROCount = (): number => {
    return applicants.filter(a => {
      const internalStatus = getWorkflowStatusInternal(a);
      return internalStatus === 'AWAITING_IRO_REVIEW';
    }).length;
  };

  const getAwaitingUserActionsCount = (): number => {
    return applicants.filter(a => {
      const internalStatus = getWorkflowStatusInternal(a);
      return ['EMAIL_VERIFICATION_PENDING', 'REGISTRATION_PENDING', 'RESUBMISSION_REQUIRED'].includes(internalStatus);
    }).length;
  };

  const getOverdueReviewsCount = (): number => {
    return applicants.filter(a => {
      const internalStatus = getWorkflowStatusInternal(a);
      const generalStatus = getGeneralAccountStatus(internalStatus);
      // Count pending verifications older than 3 days
      return generalStatus === 'PENDING' && isOlderThanDays(a.submissionDate, 3);
    }).length;
  };

  // Helper function to calculate 7-day trend based on current data
  // Compares accounts that entered this status in last 7 days vs 7-14 days ago
  const calculateTrend = (
    currentCount: number,
    filterFn: (a: Applicant) => boolean
  ): { percent: number; direction: 'up' | 'down' | 'neutral' } => {
    // Count accounts in this status that were submitted in the last 7 days (recent)
    const recentCount = applicants.filter(a => {
      return filterFn(a) && isWithinLastDays(a.submissionDate, 7);
    }).length;

    // Count accounts in this status that were submitted 7-14 days ago (previous period)
    const previousCount = applicants.filter(a => {
      return filterFn(a) && isBetweenDays(a.submissionDate, 7, 14);
    }).length;

    // If no previous period data, compare recent vs all older data
    if (previousCount === 0) {
      const olderCount = applicants.filter(a => {
        return filterFn(a) && isOlderThanDays(a.submissionDate, 7);
      }).length;
      
      if (olderCount === 0) {
        // If no older data but we have recent data, show as positive trend
        if (recentCount > 0) {
          return { percent: 100, direction: 'up' };
        }
        // If no data at all, return neutral
        return { percent: 0, direction: 'neutral' };
      }
      
      // Compare recent vs older
      const percent = ((recentCount - olderCount) / olderCount) * 100;
      const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'neutral';
      return { percent: Math.abs(percent), direction };
    }

    // Compare recent period vs previous period
    const percent = previousCount > 0 
      ? ((recentCount - previousCount) / previousCount) * 100
      : recentCount > 0 ? 100 : 0;
    const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'neutral';

    return { percent: Math.abs(percent), direction };
  };

  // Calculate all metrics and trends
  const unverifiedCount = getUnverifiedCount();
  const verifiedCount = getVerifiedCount();
  const pendingCount = getPendingCount();
  const awaitingIROCount = getAwaitingIROCount();
  const awaitingUserActionsCount = getAwaitingUserActionsCount();
  const overdueCount = getOverdueReviewsCount();

  const unverifiedTrend = calculateTrend(unverifiedCount, (a) => {
    const internalStatus = getWorkflowStatusInternal(a);
    return getGeneralAccountStatus(internalStatus) === 'UNVERIFIED';
  });

  const verifiedTrend = calculateTrend(verifiedCount, (a) => {
    const internalStatus = getWorkflowStatusInternal(a);
    return getGeneralAccountStatus(internalStatus) === 'VERIFIED';
  });

  const pendingTrend = calculateTrend(pendingCount, (a) => {
    const internalStatus = getWorkflowStatusInternal(a);
    return getGeneralAccountStatus(internalStatus) === 'PENDING';
  });

  const overdueTrend = calculateTrend(overdueCount, (a) => {
    const internalStatus = getWorkflowStatusInternal(a);
    const generalStatus = getGeneralAccountStatus(internalStatus);
    return generalStatus === 'PENDING' && isOlderThanDays(a.submissionDate, 3);
  });

  // Helper function to get workflow status from shareholdingsVerification state
  // Maps internal workflow status to frontend display label with appropriate colors
  const getWorkflowStatus = (applicant: Applicant): { label: string; color: string; bgColor: string } => {
    const internalStatus = getWorkflowStatusInternal(applicant);
    const frontendLabel = getWorkflowStatusFrontendLabel(internalStatus);

    // Color mapping based on internal status
    const statusColors: Record<string, { color: string; bgColor: string }> = {
      'EMAIL_VERIFICATION_PENDING': { color: 'text-blue-700', bgColor: 'bg-blue-50' },
      'EMAIL_VERIFIED': { color: 'text-green-700', bgColor: 'bg-green-50' },
      'SHAREHOLDINGS_DECLINED': { color: 'text-[#9A3412]', bgColor: 'bg-[#FEF3E7]' },
      'REGISTRATION_PENDING': { color: 'text-indigo-700', bgColor: 'bg-indigo-50' },
      'AWAITING_IRO_REVIEW': { color: 'text-purple-700', bgColor: 'bg-purple-50' },
      'RESUBMISSION_REQUIRED': { color: 'text-orange-700', bgColor: 'bg-orange-50' },
      'VERIFIED': { color: 'text-green-700', bgColor: 'bg-green-50' },
    };

    const colors = statusColors[internalStatus] || { color: 'text-neutral-600', bgColor: 'bg-neutral-100' };

    return {
      label: frontendLabel,
      ...colors,
    };
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Full Name', 'Email', 'Submission Date', 'Last Active', 'Status'];
    const csvRows = filteredData.map(a => [
      a.id,
      `"${a.fullName}"`,
      a.email,
      a.submissionDate,
      a.lastActive,
      getWorkflowStatusInternal(a)
    ].join(','));

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `equiverify_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    setIsExportOpen(false);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF() as any as jsPDFWithAutoTable;
    
    doc.setFontSize(18);
    doc.text('EUROLANDHUB REGISTRY REPORT', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Filter View: ${activeTab}`, 14, 35);

    const tableHeaders = [['ID', 'NAME', 'DATE', 'ACTIVE', 'STATUS']];
    const tableData = filteredData.map(a => [
      a.id,
      a.fullName,
      a.submissionDate,
      a.lastActive,
      getWorkflowStatusInternal(a)
    ]);

    doc.autoTable({
      startY: 45,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { top: 45 },
    });

    doc.save(`registry_report_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsExportOpen(false);
  };

  // Metrics array with new structure
  const metrics = [
    {
      label: 'Unverified Accounts',
      value: unverifiedCount,
      trend: unverifiedTrend,
      purpose: 'Drop-off / friction',
      type: 'unverified'
    },
    {
      label: 'Verified Accounts',
      value: verifiedCount,
      trend: verifiedTrend,
      purpose: 'Trust & success',
      type: 'verified'
    },
    {
      label: 'Pending Verification',
      value: pendingCount,
      trend: pendingTrend,
      purpose: 'Requires review',
      awaitingIRO: awaitingIROCount,
      awaitingUser: awaitingUserActionsCount,
      subLabel: 'Requires IRO action',
      type: 'pending'
    },
    {
      label: 'Verification Aging/SLA Risk',
      value: overdueCount,
      trend: overdueTrend,
      purpose: 'SLA breach risk',
      type: 'overdue'
    }
  ];

  // Helper function to format trend display
  const formatTrend = (trend: { percent: number; direction: 'up' | 'down' | 'neutral' }): string => {
    if (trend.direction === 'neutral') return '0%';
    const sign = trend.direction === 'up' ? '+' : '-';
    return `${sign}${trend.percent.toFixed(1)}%`;
  };

  // Helper function to get trend tracking period info
  const getTrendTrackingInfo = (): string => {
    return 'Trend tracked over 14 days: Last 7 days compared to previous 7 days';
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="grid grid-cols-4 gap-8 items-stretch">
        {metrics.map((metric, i) => {
          const InfoIcon: React.FC = () => {
            const [showTooltip, setShowTooltip] = useState(false);
            return (
              <div className="relative inline-block">
                <svg
                  className="w-4 h-4 text-neutral-400 hover:text-neutral-600 cursor-help transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {showTooltip && (
                  <div className="absolute z-50 px-3 py-2 bg-neutral-800 text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap pointer-events-none bottom-full left-1/2 transform -translate-x-1/2 mb-2">
                    {getTrendTrackingInfo()}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-neutral-800"></div>
                    </div>
                  </div>
                )}
              </div>
            );
          };

          return (
            <div
              key={i}
              className="bg-white p-6 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-all grid grid-rows-[auto_1fr_auto_auto] h-full"
            >
              {/* Title + info icon */}
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium text-neutral-700">{metric.label}</p>
                <InfoIcon />
              </div>
            
              {/* Value block */}
              <div className="relative flex items-start">
                <div
                  className={`font-bold text-neutral-900 leading-none ${
                    metric.type === 'pending' ? 'text-4xl' : 'text-5xl'
                  }`}
                >
                  {metric.value}
                </div>

                {/* Trend indicator — anchored bottom-right */}
                <div className="absolute bottom-0 right-0 flex items-center gap-1.5">
                  {metric.trend.direction === 'up' && (
                    <>
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      <span className="text-sm font-medium text-green-600">
                        {formatTrend(metric.trend)}
                      </span>
                    </>
                  )}

                  {metric.trend.direction === 'down' && (
                    <>
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <span className="text-sm font-medium text-red-600">
                        {formatTrend(metric.trend)}
                      </span>
                    </>
                  )}

                  {metric.trend.direction === 'neutral' && (
                    <>
                      <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                      </svg>
                      <span className="text-sm font-medium text-neutral-400">0%</span>
                    </>
                  )}
                </div>
            </div>

              {/* Detail row */}
              <div>
            {metric.type === 'pending' && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        Awaiting IRO
                      </span>
                      <span className="text-xs font-bold text-neutral-900">
                        {metric.awaitingIRO}
                      </span>
                </div>

                <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        Awaiting user
                      </span>
                      <span className="text-xs font-bold text-neutral-900">
                        {metric.awaitingUser}
                      </span>
                </div>
              </div>
            )}
              </div>

              {/* Purpose text always sticks to the bottom */}
              <p className="text-[11px] text-neutral-400 font-medium mt-auto">
                {metric.purpose}
              </p>
          </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="px-8 py-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-neutral-800 uppercase tracking-wider">Queue: Investor Audit</h2>
              <div className="flex gap-2">
                 <div className="relative" ref={exportRef}>
                   <button 
                    onClick={() => setIsExportOpen(!isExportOpen)}
                    className="px-3 py-1.5 text-[10px] font-bold border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors uppercase tracking-widest flex items-center gap-2"
                   >
                     Export
                     <svg className={`w-3 h-3 transition-transform ${isExportOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                   </button>

                   {isExportOpen && (
                     <div className="absolute top-full right-0 mt-2 w-44 bg-white border border-neutral-200 rounded-lg shadow-xl z-50 overflow-hidden">
                       <button 
                         onClick={handleExportCSV}
                         className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-neutral-50 transition-colors flex items-center justify-between border-b border-neutral-100"
                       >
                         CSV Spreadsheet
                         <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                       </button>
                       <button 
                         onClick={handleExportPDF}
                         className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-neutral-50 transition-colors flex items-center justify-between"
                       >
                         Audit PDF
                         <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                       </button>
                     </div>
                   )}
                 </div>
              </div>
            </div>
            
            <div className="flex gap-8 border-t border-neutral-50 pt-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
                    activeTab === tab.id ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-neutral-900"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-100">
              <th className="px-8 py-4">Investor Profile</th>
              <th className="px-8 py-4">Submission</th>
              <th className="px-8 py-4">Last Activity</th>
              <th className="px-8 py-4">Status</th>
              <th className="px-8 py-4 text-right">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {filteredData.length > 0 ? (
              filteredData.map((applicant) => (
                <tr key={applicant.id} className="group hover:bg-neutral-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <Avatar name={applicant.fullName} size={36} />
                      <div className="min-w-0 flex-1">
                        <Tooltip content={applicant.fullName}>
                          <div className="text-sm font-bold text-neutral-900 leading-none mb-1 truncate">{applicant.fullName}</div>
                        </Tooltip>
                        <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-tight">{applicant.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-xs text-neutral-500 font-medium">
                    {applicant.submissionDate}
                  </td>
                  <td className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                    {applicant.lastActive}
                  </td>
                  <td className="px-8 py-5">
                    {(() => {
                      const internalStatus = getWorkflowStatusInternal(applicant);
                      // Color mapping for internal status
                      const statusColors: Record<string, { color: string; bgColor: string }> = {
                        'EMAIL_VERIFICATION_PENDING': { color: 'text-blue-700', bgColor: 'bg-blue-50' },
                        'EMAIL_VERIFIED': { color: 'text-green-700', bgColor: 'bg-green-50' },
                        'SHAREHOLDINGS_DECLINED': { color: 'text-[#9A3412]', bgColor: 'bg-[#FEF3E7]' },
                        'REGISTRATION_PENDING': { color: 'text-indigo-700', bgColor: 'bg-indigo-50' },
                        'AWAITING_IRO_REVIEW': { color: 'text-purple-700', bgColor: 'bg-purple-50' },
                        'RESUBMISSION_REQUIRED': { color: 'text-orange-700', bgColor: 'bg-orange-50' },
                        'VERIFIED': { color: 'text-green-700', bgColor: 'bg-green-50' },
                      };
                      const colors = statusColors[internalStatus] || { color: 'text-neutral-600', bgColor: 'bg-neutral-100' };
                      return (
                        <span className={`text-[10px] font-bold uppercase tracking-tighter px-2.5 py-1 rounded-full border ${colors.color} ${colors.bgColor} border-current/20`}>
                          {internalStatus}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => onSelect(applicant)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition-all shadow-sm"
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  No records found in current queue
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardHome;
