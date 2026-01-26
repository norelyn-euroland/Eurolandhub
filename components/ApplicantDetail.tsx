
'use client';

import React, { useState } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import { MOCK_SHAREHOLDERS } from '../lib/mockShareholders';
import Tooltip from './Tooltip';

interface ApplicantDetailProps {
  applicant: Applicant;
  onBack: () => void;
  onUpdateStatus: (id: string, status: RegistrationStatus) => void;
}

const ApplicantDetail: React.FC<ApplicantDetailProps> = ({ applicant, onBack, onUpdateStatus }) => {
  const getAuditStatusLabel = (s: RegistrationStatus) => {
    if (s === RegistrationStatus.APPROVED) return 'Accepted';
    if (s === RegistrationStatus.FURTHER_INFO) return 'Pending';
    // Treat both PENDING and REJECTED as Unverified in the UI.
    return 'Unverified';
  };

  const getPepScreeningStatusLabel = () => {
    // Demo behavior: if the user self-declares PEP, screening is flagged; otherwise it's clear.
    return applicant.declaration.isPEP ? 'FLAGGED' : 'CLEAR';
  };

  const getCountryLabel = () => {
    const raw = (applicant.location || '').trim();
    if (!raw) return '—';

    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1] || raw;

    // Minimal demo mapping for common abbreviations seen in mock data
    const upper = last.toUpperCase();
    const usStateToCountry: Record<string, string> = {
      NY: 'United States',
    };
    if (usStateToCountry[upper]) return usStateToCountry[upper];

    return last;
  };

  const [shareholderQuery, setShareholderQuery] = useState('');
  const effectiveShareholderQuery = shareholderQuery.trim().toLowerCase();
  const filteredShareholders = MOCK_SHAREHOLDERS.filter((s) => {
    if (!effectiveShareholderQuery) return true;
    return (
      s.name.toLowerCase().includes(effectiveShareholderQuery) ||
      s.id.toLowerCase().includes(effectiveShareholderQuery)
    );
  });

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between mb-10">
        <button 
          onClick={onBack}
          className="group flex items-center gap-3 text-xs font-black text-neutral-400 hover:text-black transition-colors uppercase tracking-widest"
        >
          <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          Return to Registry
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.FURTHER_INFO)}
            className="px-6 py-3 text-[11px] font-black border-2 border-neutral-200 rounded-lg uppercase tracking-widest hover:bg-neutral-50 hover:border-black transition-all"
          >
            Request Info
          </button>
          <button 
            onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.REJECTED)}
            className="px-6 py-3 text-[11px] font-black border-2 border-neutral-900 text-neutral-900 rounded-lg uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
          >
            Reject
          </button>
          <button 
            onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.APPROVED)}
            className="px-8 py-3 text-[11px] font-black bg-black text-white rounded-lg uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-xl shadow-black/20"
          >
            Approve Registration
          </button>
        </div>
      </div>

      <div className="space-y-10">
          <section className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-black"></div>
            <h2 className="text-sm font-black mb-8 text-neutral-900 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
              Identity & Profile Summary
            </h2>
            <div className="grid grid-cols-3 gap-10">
              {[
                { label: 'Legal name', value: applicant.fullName },
                { label: 'Email', value: applicant.email },
                { label: 'Contact Number', value: applicant.phoneNumber || 'Not provided' },
                { label: 'Country', value: getCountryLabel() },
                { label: 'Registration ID', value: applicant.id },
                { label: 'Submission date', value: applicant.submissionDate },
                { label: 'Current status', value: getAuditStatusLabel(applicant.status) }
              ].map((item, idx) => (
                <div key={idx}>
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">{item.label}</label>
                  <p className="text-sm font-bold text-neutral-900">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
                Self-Declaration Audit
              </h2>
              <span className="text-[10px] font-black px-4 py-2 rounded-lg uppercase tracking-widest flex items-center gap-2 shadow-md transition-colors" style={{ backgroundColor: '#f1dd3f', color: '#000000' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Self-Certified Declaration
              </span>
            </div>
            
            <div className="space-y-6">
              {/* Financial Information Row */}
              <div className="grid grid-cols-2 gap-8">
                <div className="p-6 bg-neutral-50 rounded-xl border-2 border-neutral-200 group hover:border-black transition-all">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Declared Net Worth</label>
                  <p className="text-sm font-bold text-neutral-900">{applicant.declaration.netWorth}</p>
                </div>
                <div className="p-6 bg-neutral-50 rounded-xl border-2 border-neutral-200 group hover:border-black transition-all">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Annual Income</label>
                  <p className="text-sm font-bold text-neutral-900">{applicant.declaration.annualIncome}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-neutral-200"></div>

              {/* Source of Wealth & Experience Row */}
              <div className="grid grid-cols-2 gap-8">
                <div className="pb-4 border-b border-neutral-100">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Source of Wealth</label>
                  <p className="text-sm font-bold text-neutral-900">{applicant.declaration.sourceOfWealth}</p>
                </div>
                <div className="pb-4 border-b border-neutral-100">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Experience</label>
                  <p className="text-sm font-bold text-neutral-900">{applicant.declaration.investmentExperience}</p>
                </div>
              </div>

              {/* PEP & Equity Disclosure Row */}
              <div className="grid grid-cols-2 gap-8">
                <div className={`p-6 rounded-xl border-2 transition-all ${applicant.declaration.isPEP ? 'bg-red-50 border-red-300' : 'bg-neutral-50 border-neutral-200'}`}>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">PEP Verification</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${applicant.declaration.isPEP ? 'bg-red-200 text-red-800' : 'bg-neutral-200 text-neutral-700'}`}>
                      {getPepScreeningStatusLabel()}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-neutral-200">
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Self-declared</span>
                      <span className="text-sm font-bold text-neutral-900">
                        {applicant.declaration.isPEP ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-neutral-200">
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Screening status</span>
                      <span className={`text-sm font-bold ${applicant.declaration.isPEP ? 'text-red-700' : 'text-neutral-900'}`}>
                        {getPepScreeningStatusLabel()}
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-neutral-500 leading-relaxed pt-1">
                      {applicant.declaration.isPEP ? 'Politically exposed person flagged for enhanced review.' : 'No political exposure declared.'}
                    </p>
                  </div>
                </div>
                
                <div className="p-6 bg-neutral-50 rounded-xl border-2 border-neutral-200">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Equity Disclosure</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${applicant.declaration.isShareholder ? '' : 'bg-neutral-200 text-neutral-600'}`} style={applicant.declaration.isShareholder ? { backgroundColor: '#2000aa', color: '#ffffff' } : {}}>
                      {applicant.declaration.isShareholder ? 'Declared' : 'Not declared'}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-neutral-200">
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Shareholder declared</span>
                      <span className="text-sm font-bold text-neutral-900">
                        {applicant.declaration.isShareholder ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Declared holdings</span>
                      <p className="text-sm font-bold text-neutral-900">
                        {applicant.declaration.isShareholder
                          ? (applicant.declaration.shareholdingDetails || 'Declared shareholder')
                          : 'No shareholding declared.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm">
            <h2 className="text-sm font-black mb-8 text-neutral-900 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
              Documentary Evidence
            </h2>
            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Government ID Scan</label>
                <div className="relative aspect-[4/3] bg-neutral-100 rounded-lg overflow-hidden group border border-neutral-200 cursor-zoom-in">
                  <img src={applicant.idDocumentUrl} className="w-full h-full object-cover transition-all duration-500 opacity-90 group-hover:opacity-100" alt="ID" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-[2px]">
                    <span className="px-6 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">Verify Original</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Financial Statements</label>
                <div className="relative aspect-[4/3] bg-neutral-100 rounded-lg overflow-hidden group border border-neutral-200 cursor-zoom-in">
                  <img src={applicant.taxDocumentUrl} className="w-full h-full object-cover transition-all duration-500 opacity-90 group-hover:opacity-100" alt="Tax" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-[2px]">
                    <span className="px-6 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">Verify Original</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Shareholder Registry Table (Snapshot) */}
          <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-neutral-100 flex items-start justify-between gap-6">
              <div>
                <h2 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
                  Shareholders Registry
                </h2>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">
                  Registry Snapshot • Table View
                </p>
              </div>

              <div className="relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input
                  type="text"
                  placeholder="Search name or investor ID..."
                  value={shareholderQuery}
                  onChange={(e) => setShareholderQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[11px] focus:ring-1 focus:ring-black focus:border-black outline-none w-64 transition-all placeholder:text-neutral-400 font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/50 text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200">
                    <th className="px-6 py-5 text-center w-16">Rank</th>
                    <th className="px-6 py-5">Holdings</th>
                    <th className="px-6 py-5">Stake %</th>
                    <th className="px-6 py-5">Investor ID</th>
                    <th className="px-6 py-5">Name</th>
                    <th className="px-6 py-5">CO address</th>
                    <th className="px-6 py-5">Country (post)</th>
                    <th className="px-6 py-5 text-right">Type of account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredShareholders.map((sh) => (
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
          </section>
      </div>
    </div>
  );
};

export default ApplicantDetail;
