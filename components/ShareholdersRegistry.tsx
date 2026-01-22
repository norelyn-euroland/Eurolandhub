
'use client';

import React, { useState } from 'react';
import { MOCK_SHAREHOLDERS } from '../lib/mockShareholders';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Tooltip from './Tooltip';

// Fix: Use an intersection type for jsPDF autoTable extension
type jsPDFWithAutoTable = jsPDF & {
  autoTable: (options: any) => void;
};

const MOCK_AUDIT_LOGS = [
  { id: 1, event: 'Ledger Export Generated', user: 'D. Sterling', time: '10:45 AM', date: 'Today' },
  { id: 2, event: 'New Shareholder "Ayala Corporation" Verified', user: 'System', time: '09:12 AM', date: 'Today' },
  { id: 3, event: 'Stake Re-calculation Triggered', user: 'System', time: '04:30 PM', date: 'Yesterday' },
  { id: 4, event: 'Manual Address Update: ID 201198216', user: 'M. Chen', time: '02:15 PM', date: 'Yesterday' },
  { id: 5, event: 'Annual Audit Certification Uploaded', user: 'Admin', time: '11:00 AM', date: 'Oct 24, 2023' },
];

interface ShareholdersRegistryProps {
  searchQuery: string;
}

const ShareholdersRegistry: React.FC<ShareholdersRegistryProps> = ({ searchQuery }) => {
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [localQuery, setLocalQuery] = useState('');

  const effectiveQuery = (localQuery.trim() || searchQuery.trim()).toLowerCase();
  const filtered = MOCK_SHAREHOLDERS.filter(s => {
    if (!effectiveQuery) return true;
    return (
      s.name.toLowerCase().includes(effectiveQuery) ||
      s.id.toLowerCase().includes(effectiveQuery)
    );
  });

  const totalHoldings = MOCK_SHAREHOLDERS.reduce((sum, s) => sum + s.holdings, 0);
  const top3Stake = MOCK_SHAREHOLDERS.slice(0, 3).reduce((sum, s) => sum + s.stake, 0);

  const handleExportLedger = () => {
    setIsExporting(true);
    const doc = new jsPDF() as any as jsPDFWithAutoTable;
    
    // Add professional styling
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SHAREHOLDER MASTER REGISTRY', 14, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`CERTIFIED LEDGER • GENERATED: ${new Date().toLocaleString().toUpperCase()}`, 14, 32);
    doc.text('CONFIDENTIAL - FOR INTERNAL COMPLIANCE USE ONLY', 14, 37);

    const tableHeaders = [['RANK', 'HOLDINGS', 'STAKE %', 'INVESTOR ID', 'NAME', 'CO ADDRESS', 'COUNTRY (POST)', 'TYPE OF ACCOUNT']];
    const tableData = filtered.map(s => [
      s.rank,
      s.holdings.toLocaleString(),
      s.stake.toFixed(5),
      s.id,
      s.name,
      s.coAddress || 'Registered Office',
      s.country,
      s.accountType
    ]);

    doc.autoTable({
      startY: 45,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40], cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { halign: 'center' },
        2: { halign: 'right' }
      }
    });

    // Save with timestamp
    const filename = `registry_ledger_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    setTimeout(() => setIsExporting(false), 500);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative">
      {/* Side Audit Drawer */}
      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isAuditOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAuditOpen(false)}></div>
        <div className={`absolute top-0 right-0 h-full w-[400px] bg-white shadow-2xl transition-transform duration-500 transform ${isAuditOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-8 h-full flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest">Audit Trail</h3>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Immutability Log</p>
              </div>
              <button onClick={() => setIsAuditOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              {MOCK_AUDIT_LOGS.map((log) => (
                <div key={log.id} className="relative pl-6 border-l border-neutral-100">
                  <div className="absolute left-[-4px] top-1.5 w-2 h-2 rounded-full bg-neutral-900"></div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{log.date} • {log.time}</span>
                  </div>
                  <p className="text-xs font-bold text-neutral-900 leading-tight mb-2">{log.event}</p>
                  <span className="inline-block px-2 py-0.5 bg-neutral-50 text-[9px] font-black text-neutral-500 rounded border border-neutral-100 uppercase tracking-widest">
                    Actor: {log.user}
                  </span>
                </div>
              ))}
            </div>

            <button className="w-full py-4 text-[10px] font-black bg-neutral-900 text-white uppercase tracking-widest rounded-lg mt-8 shadow-lg hover:bg-black transition-all">
              Download Full Security Log
            </button>
          </div>
        </div>
      </div>

      {/* Top Header Section */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 tracking-tighter uppercase">Registry Master</h2>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-1">Verified Shareholder Ledger • Updated Today</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              type="text"
              placeholder="Search name or investor ID..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[11px] focus:ring-1 focus:ring-black focus:border-black outline-none w-64 transition-all placeholder:text-neutral-400 font-medium"
            />
          </div>
          <button 
            onClick={() => setIsAuditOpen(true)}
            className="px-5 py-2 text-[10px] font-black border border-neutral-200 rounded-lg uppercase tracking-widest hover:bg-neutral-50 transition-all flex items-center gap-2 group"
          >
            <svg className="w-3 h-3 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Audit History
          </button>
          <button 
            onClick={handleExportLedger}
            disabled={isExporting}
            className={`px-5 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${isExporting ? 'bg-neutral-400 cursor-not-allowed' : 'bg-black text-white hover:bg-neutral-800'}`}
          >
            {isExporting ? (
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            )}
            {isExporting ? 'Generating...' : 'Export Ledger'}
          </button>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Total Holdings</label>
            <div className="p-1.5 bg-neutral-100 rounded">
                <svg className="w-3 h-3 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            </div>
          </div>
          <p className="text-3xl font-black tracking-tighter text-neutral-900">{totalHoldings.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-neutral-400 mt-2 uppercase tracking-widest">Calculated across all tiers</p>
        </div>
        
        <div className="p-6 bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden relative">
          <div className="flex justify-between items-start mb-4">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Concentration (Top 3)</label>
            <div className="p-1.5 bg-neutral-100 rounded">
                <svg className="w-3 h-3 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/></svg>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-black tracking-tighter text-neutral-900">{top3Stake.toFixed(2)}%</p>
            <div className="mb-1 h-1.5 flex-1 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-black" style={{ width: `${Math.min(top3Stake, 100)}%` }}></div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-black rounded-xl shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
             <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
          </div>
          <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-4">Audit Compliance</label>
          <p className="text-3xl font-black tracking-tighter text-white">CERTIFIED</p>
          <p className="text-[10px] font-bold text-emerald-500 mt-2 uppercase tracking-widest flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            System-wide integrity verified
          </p>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200">
                <th className="px-6 py-5 text-center w-16">Rank</th>
                <th className="px-6 py-5">Holdings</th>
                <th className="px-6 py-5">Stake %</th>
                <th className="px-6 py-5">INVESTOR ID</th>
                <th className="px-6 py-5">Name</th>
                <th className="px-6 py-5">CO address</th>
                <th className="px-6 py-5">Country (post)</th>
                <th className="px-6 py-5 text-right">Type of account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((sh) => (
                <tr key={sh.id} className="group hover:bg-neutral-50/80 transition-all cursor-default">
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-black transition-colors ${sh.rank === 1 ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                        {sh.rank}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-black text-neutral-900 tracking-tight">
                      {sh.holdings.toLocaleString()}
                    </p>
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">Ordinary Shares</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-black text-neutral-900">{sh.stake.toFixed(5)}%</span>
                        <div className="w-16 h-1 bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full bg-neutral-900" style={{ width: `${Math.min(sh.stake * 2.5, 100)}%` }}></div>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-black text-neutral-900 font-mono tracking-tighter bg-neutral-100 px-2.5 py-1 rounded border border-neutral-200">
                      {sh.id}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <Tooltip content={sh.name}>
                      <p className="text-sm font-bold text-neutral-900 uppercase truncate max-w-[200px]">{sh.name}</p>
                    </Tooltip>
                    <p className="text-[10px] text-neutral-400 font-medium italic">{sh.firstName || 'Primary Account Holder'}</p>
                  </td>
                  <td className="px-6 py-5">
                    <Tooltip content={sh.coAddress || 'Registered Office'}>
                      <span className="text-[10px] text-neutral-400 truncate max-w-[240px] block">
                        {sh.coAddress || 'Registered Office'}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs font-bold text-neutral-700">{sh.country}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="inline-block px-3 py-1 bg-neutral-100 text-[10px] font-black text-neutral-600 rounded-full uppercase tracking-widest border border-neutral-200 group-hover:bg-white transition-colors">
                      {sh.accountType}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200">
                <svg className="w-6 h-6 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            <p className="text-sm font-black text-neutral-400 uppercase tracking-widest">No matching records found in the registry.</p>
          </div>
        )}
      </div>
      
      {/* Footer / Context */}
      <div className="flex items-center justify-center py-6">
          <div className="flex items-center gap-2 text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">End of Verified Records • Total Cap Table Accounted: 100.00%</p>
          </div>
      </div>
    </div>
  );
};

export default ShareholdersRegistry;
