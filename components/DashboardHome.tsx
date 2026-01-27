
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Applicant, RegistrationStatus, ShareholdingsVerificationState } from '../lib/types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Tooltip from './Tooltip';

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

const StatusBadge: React.FC<{ status: RegistrationStatus }> = ({ status }) => {
  const getStyles = (s: RegistrationStatus) => {
    switch(s) {
      case RegistrationStatus.APPROVED:
        return {
          container: 'bg-[#E6F9F1] text-[#166534] border-[#D1F2E4]',
          icon: (
            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
          ),
          label: 'Verify'
        };
      case RegistrationStatus.PENDING:
        return {
          container: 'bg-indigo-50 text-indigo-700 border-indigo-100',
          icon: (
            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          ),
          label: 'Pending'
        };
      case RegistrationStatus.REJECTED:
        return {
          container: 'bg-[#FEF3E7] text-[#9A3412] border-[#FDE0C3]',
          icon: (
            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          ),
          label: 'Unverify'
        };
      case RegistrationStatus.FURTHER_INFO:
        return {
          container: 'bg-indigo-50 text-indigo-700 border-indigo-100',
          icon: (
            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          ),
          label: 'Pending'
        };
      default:
        return { container: 'bg-neutral-100 text-neutral-500', icon: null, label: s };
    }
  };

  const style = getStyles(status);

  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold border ${style.container}`}>
      {style.icon}
      {style.label}
    </span>
  );
};

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
    // Tab Filter
    const matchesTab = 
      activeTab === 'ALL' ||
      (activeTab === 'PENDING' && (applicant.status === RegistrationStatus.PENDING || applicant.status === RegistrationStatus.REJECTED)) ||
      (activeTab === 'VERIFIED' && applicant.status === RegistrationStatus.APPROVED) ||
      (activeTab === 'NON_VERIFIED' && applicant.status === RegistrationStatus.FURTHER_INFO);

    return matchesTab;
  });

  const tabs: { id: TabType; label: string }[] = [
    { id: 'ALL', label: 'All Files' },
    { id: 'PENDING', label: 'Unverified' },
    { id: 'VERIFIED', label: 'Accepted' },
    { id: 'NON_VERIFIED', label: 'Pending' },
  ];

  const getStatusLabel = (s: RegistrationStatus) => {
    if (s === RegistrationStatus.APPROVED) return 'Verify';
    if (s === RegistrationStatus.FURTHER_INFO) return 'Pending';
    if (s === RegistrationStatus.REJECTED) return 'Unverify';
    if (s === RegistrationStatus.PENDING) return 'Pending';
    return s;
  };

  // Helper function to get workflow status from shareholdingsVerification state
  const getWorkflowStatus = (applicant: Applicant): { label: string; color: string; bgColor: string } => {
    const wf = applicant.shareholdingsVerification;
    
    if (!wf) {
      return { label: 'Not Started', color: 'text-neutral-500', bgColor: 'bg-neutral-100' };
    }

    // UNVERIFIED: User declined shareholdings verification
    if (wf.step1.wantsVerification === false) {
      return { label: 'UNVERIFIED', color: 'text-[#9A3412]', bgColor: 'bg-[#FEF3E7]' };
    }

    // REGISTRATION_PENDING: User agreed but hasn't submitted Step 2
    if (wf.step1.wantsVerification === true && !wf.step2) {
      return { label: 'REGISTRATION_PENDING', color: 'text-indigo-700', bgColor: 'bg-indigo-50' };
    }

    // LOCKED_7_DAYS: Locked after 3 failed attempts
    if (wf.step3.lockedUntil) {
      const lockedUntil = new Date(wf.step3.lockedUntil);
      if (lockedUntil.getTime() > Date.now()) {
        return { label: 'LOCKED_7_DAYS', color: 'text-red-700', bgColor: 'bg-red-50' };
      }
    }

    // AUTO_CHECK_FAILED: Failed Step 3 but not locked yet
    if (wf.step3.lastResult === 'NO_MATCH' && (!wf.step3.lockedUntil || new Date(wf.step3.lockedUntil).getTime() <= Date.now())) {
      return { label: 'AUTO_CHECK_FAILED', color: 'text-orange-700', bgColor: 'bg-orange-50' };
    }

    // Step 3: Auto check passed
    if (wf.step3.lastResult === 'MATCH') {
      // AWAITING_IRO_REVIEW: Step 3 passed, waiting for IRO review
      if (!wf.step4.lastResult) {
        return { label: 'AWAITING_IRO_REVIEW', color: 'text-purple-700', bgColor: 'bg-purple-50' };
      }
      
      // Step 4: IRO review passed
      if (wf.step4.lastResult === 'MATCH') {
        // CODE_SENT: Code sent, waiting for user to enter
        if (wf.step5) {
          // Check if code is still valid (not invalidated and not expired)
          const expiresAt = new Date(wf.step5.expiresAt);
          const isExpired = expiresAt.getTime() <= Date.now();
          const isInvalidated = wf.step5.invalidatedAt && new Date(wf.step5.invalidatedAt).getTime() <= Date.now();
          
          if (!isExpired && !isInvalidated && wf.step5.attemptsRemaining > 0) {
            return { label: 'CODE_SENT', color: 'text-blue-700', bgColor: 'bg-blue-50' };
          }
          // Code expired - treat as UNVERIFIED
          return { label: 'UNVERIFIED', color: 'text-neutral-500', bgColor: 'bg-neutral-100' };
        }
        // Awaiting code to be sent
        return { label: 'AWAITING_IRO_REVIEW', color: 'text-indigo-700', bgColor: 'bg-indigo-50' };
      }
      
      // Step 4: IRO review failed - treat as UNVERIFIED
      if (wf.step4.lastResult === 'NO_MATCH') {
        return { label: 'UNVERIFIED', color: 'text-orange-700', bgColor: 'bg-orange-50' };
      }
    }
    
    // VERIFIED: Status is APPROVED (completed verification)
    if (applicant.status === RegistrationStatus.APPROVED && wf.step5 && wf.step5.attemptsRemaining === 0) {
      return { label: 'VERIFIED', color: 'text-green-700', bgColor: 'bg-green-50' };
    }

    // Default fallback
    return { label: 'In Progress', color: 'text-neutral-600', bgColor: 'bg-neutral-100' };
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Full Name', 'Email', 'Workflow Status', 'Submission Date', 'Last Active', 'IRO Status'];
    const csvRows = filteredData.map(a => [
      a.id,
      `"${a.fullName}"`,
      a.email,
      getWorkflowStatus(a).label,
      a.submissionDate,
      a.lastActive,
      getStatusLabel(a.status)
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

    const tableHeaders = [['ID', 'NAME', 'WORKFLOW STATUS', 'DATE', 'ACTIVE', 'IRO STATUS']];
    const tableData = filteredData.map(a => [
      a.id,
      a.fullName,
      getWorkflowStatus(a).label,
      a.submissionDate,
      a.lastActive,
      getStatusLabel(a.status)
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

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="grid grid-cols-4 gap-8">
        {[
          { label: 'Unverified Audit', value: applicants.filter(a => a.status === RegistrationStatus.PENDING || a.status === RegistrationStatus.REJECTED).length, detail: '+2 since yesterday' },
          { label: 'Active Shareholders', value: '1,402', detail: 'Across 12 entities' },
          { label: 'Risk Threshold', value: '18%', detail: 'Historical average' },
          { label: 'Compliance Score', value: '99.4', detail: 'Audit target: 99.0' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-all">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <div className="text-3xl font-bold text-neutral-900 mb-1">{stat.value}</div>
            <p className="text-[10px] text-neutral-400 font-medium">{stat.detail}</p>
          </div>
        ))}
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
              <th className="px-8 py-4">Workflow Status</th>
              <th className="px-8 py-4">Submission</th>
              <th className="px-8 py-4">Last Activity</th>
              <th className="px-8 py-4">IRO Status</th>
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
                  <td className="px-8 py-5">
                    {(() => {
                      const workflowStatus = getWorkflowStatus(applicant);
                      return (
                        <span className={`text-[10px] font-bold uppercase tracking-tighter px-2.5 py-1 rounded-full border ${workflowStatus.color} ${workflowStatus.bgColor} border-current/20`}>
                          {workflowStatus.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-8 py-5 text-xs text-neutral-500 font-medium">
                    {applicant.submissionDate}
                  </td>
                  <td className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                    {applicant.lastActive}
                  </td>
                  <td className="px-8 py-5">
                    <StatusBadge status={applicant.status} />
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
                <td colSpan={6} className="px-8 py-12 text-center text-xs font-bold text-neutral-400 uppercase tracking-widest">
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
