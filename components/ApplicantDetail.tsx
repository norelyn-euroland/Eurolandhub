
'use client';

import React from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';

interface ApplicantDetailProps {
  applicant: Applicant;
  onBack: () => void;
  onUpdateStatus: (id: string, status: RegistrationStatus) => void;
}

const ApplicantDetail: React.FC<ApplicantDetailProps> = ({ applicant, onBack, onUpdateStatus }) => {
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

      <div className="grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-8 space-y-10">
          <section className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-black"></div>
            <h2 className="text-sm font-black mb-8 text-neutral-900 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
              Identity & Profile Dossier
            </h2>
            <div className="grid grid-cols-3 gap-10">
              {[
                { label: 'Legal Entity / Name', value: applicant.fullName },
                { label: 'Email Correspondence', value: applicant.email },
                { label: 'Investor Classification', value: applicant.type },
                { label: 'Registration ID', value: applicant.id },
                { label: 'Dossier Opened', value: applicant.submissionDate },
                { label: 'Current Audit Status', value: applicant.status === RegistrationStatus.APPROVED ? 'Verified' : 'Audit Pending' }
              ].map((item, idx) => (
                <div key={idx}>
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">{item.label}</label>
                  <p className="text-sm font-bold text-neutral-900">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
                Self-Declaration Audit
              </h2>
              <span className="text-[9px] font-black px-3 py-1 bg-neutral-900 text-white rounded uppercase tracking-widest">Self-Certified Signed Dossier</span>
            </div>
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="p-6 bg-neutral-50 rounded-lg border border-neutral-100 group hover:border-black transition-all">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Declared Net Worth</label>
                  <p className="text-xl font-black text-neutral-900 tracking-tight">{applicant.declaration.netWorth}</p>
                </div>
                <div className="p-6 bg-neutral-50 rounded-lg border border-neutral-100 group hover:border-black transition-all">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Annual Gross Income</label>
                  <p className="text-xl font-black text-neutral-900 tracking-tight">{applicant.declaration.annualIncome}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Capital Origin (Source of Wealth)</label>
                  <p className="text-sm leading-relaxed text-neutral-700 font-medium">{applicant.declaration.sourceOfWealth}</p>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Investment Experience Depth</label>
                  <p className="text-sm leading-relaxed text-neutral-700 font-medium">{applicant.declaration.investmentExperience}</p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className={`flex-1 p-5 rounded-lg border transition-all ${applicant.declaration.isPEP ? 'bg-red-50 border-red-200 text-red-700' : 'bg-neutral-50 border-neutral-100'}`}>
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-[9px] font-black uppercase tracking-widest opacity-60">PEP Verification</span>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${applicant.declaration.isPEP ? 'text-red-700 font-black' : 'text-neutral-900'}`}>
                        {applicant.declaration.isPEP ? 'FLAG: POSITIVE' : 'CLEAR'}
                     </span>
                   </div>
                   <p className="text-sm font-bold">
                     {applicant.declaration.isPEP ? 'Politically Exposed Person identified.' : 'No reported political exposure.'}
                   </p>
                </div>
                
                <div className="flex-1 p-5 bg-neutral-50 rounded-lg border border-neutral-100">
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Equity Disclosure</span>
                     <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600">
                        {applicant.declaration.isShareholder ? 'ACTIVE HOLDER' : 'NONE'}
                     </span>
                   </div>
                   <p className="text-sm font-bold text-neutral-900">
                     {applicant.declaration.isShareholder ? applicant.declaration.shareholdingDetails : 'No current holdings declared.'}
                   </p>
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
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-10">
          <div className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm">
            <h2 className="text-[10px] font-black mb-10 text-neutral-900 uppercase tracking-[0.2em] border-b border-neutral-100 pb-4">Audit Traceability</h2>
            <div className="space-y-8">
              {[
                { time: '12:02 PM', action: 'Digital signature verified', user: 'Docu-Verify' },
                { time: '11:45 AM', action: 'Compliance screening passed', user: 'Auto-Audit' },
                { time: 'Yesterday', action: 'KYC dossier updated', user: 'Gateway' }
              ].map((log, i) => (
                <div key={i} className="flex gap-5">
                  <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-black shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-[11px] font-black text-neutral-900 uppercase tracking-tight leading-none mb-1">{log.action}</p>
                    <div className="flex justify-between items-center text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      <span>{log.time}</span>
                      <span>{log.user}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-10 py-4 text-[11px] font-black text-neutral-900 border-2 border-dashed border-neutral-200 rounded-lg transition-all uppercase tracking-widest hover:border-black hover:bg-neutral-50">
              Full Security Ledger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicantDetail;
