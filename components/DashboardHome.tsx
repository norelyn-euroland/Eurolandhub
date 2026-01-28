
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Tooltip from './Tooltip';
import { getWorkflowStatusInternal, getGeneralAccountStatus } from '../lib/shareholdingsVerification';

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

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="grid grid-cols-4 gap-8">
        {[
          { label: 'Unverified Audit', value: applicants.filter(a => {
            const internalStatus = getWorkflowStatusInternal(a);
            return getGeneralAccountStatus(internalStatus) === 'UNVERIFIED';
          }).length, detail: '+2 since yesterday' },
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
