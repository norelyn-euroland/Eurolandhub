
'use client';

import React, { useState } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import { GoogleGenAI } from "@google/genai";
import Tooltip from './Tooltip';

interface ComplianceDashboardProps {
  applicants: Applicant[];
}

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ applicants }) => {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const getSystemHealth = async () => {
    setIsLoadingInsight(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const summaryData = applicants.map(a => ({
      name: a.fullName,
      status: a.status,
      type: a.type,
      pep: a.declaration.isPEP
    }));

    const prompt = `
      Act as a Senior Compliance Auditor. Analyze this snapshot of investor registrations:
      ${JSON.stringify(summaryData)}
      
      Provide a brief (3-4 sentence) monotone, professional "Regulatory Risk Outlook" for this portfolio. 
      Focus on PEP flags and verification progress. Do not use markdown formatting or bold text.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiInsight(response.text || "Analysis complete. No critical outliers detected.");
    } catch (e) {
      setAiInsight("Unable to generate AI forecast at this time.");
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const highRiskCount = applicants.filter(a => a.declaration.isPEP).length;
  const pendingRate = (applicants.filter(a => a.status === RegistrationStatus.PENDING).length / applicants.length) * 100;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Risk Gird */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white p-8 rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black text-neutral-900 uppercase tracking-widest">Global Risk Distribution</h3>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Updated: 09:00 AM UTC</span>
          </div>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase">KYC Completion Rate</span>
                <span className="text-[10px] font-black text-neutral-900">84%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-black" style={{ width: '84%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase">AML Screening Coverage</span>
                <span className="text-[10px] font-black text-neutral-900">100%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-black" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2 text-red-600">
                <span className="text-[10px] font-bold uppercase">Critical PEP Flags</span>
                <span className="text-[10px] font-black">{highRiskCount} Alerts</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-600" style={{ width: `${(highRiskCount / applicants.length) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-black p-8 rounded-xl shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-6">AI Compliance Forecast</h3>
            {aiInsight ? (
              <p className="text-xs text-neutral-300 leading-relaxed italic">{aiInsight}</p>
            ) : (
              <p className="text-xs text-neutral-500 leading-relaxed">Initialize system-wide scan to generate a professional risk outlook using Gemini Core.</p>
            )}
          </div>
          <button 
            onClick={getSystemHealth}
            disabled={isLoadingInsight}
            className="w-full mt-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
          >
            {isLoadingInsight ? (
              <div className="w-3 h-3 border-2 border-neutral-300 border-t-black rounded-full animate-spin"></div>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            )}
            {isLoadingInsight ? 'Scanning Registry...' : 'Generate AI Outlook'}
          </button>
        </div>
      </div>

      {/* Active Compliance Alerts */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-xs font-black text-neutral-900 uppercase tracking-widest">Escalated Compliance Queue</h3>
          <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black"></span>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Requires Manual Override</span>
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-neutral-50 text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-200">
              <th className="px-8 py-4">Investor ID</th>
              <th className="px-8 py-4">Primary Risk Factor</th>
              <th className="px-8 py-4">Alert Trigger</th>
              <th className="px-8 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {applicants.filter(a => a.declaration.isPEP || a.status === RegistrationStatus.PENDING).map((a) => (
              <tr key={a.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-8 py-5">
                  <Tooltip content={a.id}>
                    <span className="text-xs font-black text-neutral-900 font-mono truncate max-w-[150px] inline-block">{a.id}</span>
                  </Tooltip>
                </td>
                <td className="px-8 py-5">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${a.declaration.isPEP ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-neutral-100 text-neutral-600'}`}>
                    {a.declaration.isPEP ? 'POLITICAL EXPOSURE' : 'IDENTITY PENDING'}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <Tooltip content="Manual audit required before onboarding">
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tight truncate max-w-[300px]">Manual audit required before onboarding</p>
                  </Tooltip>
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="text-[10px] font-black text-neutral-900 underline uppercase tracking-widest hover:text-neutral-500">Dismiss Alert</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Compliance Policies */}
      <div className="grid grid-cols-2 gap-6">
        <div className="p-6 bg-white border border-neutral-200 rounded-xl flex gap-6 items-start">
            <div className="p-3 bg-neutral-900 text-white rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            </div>
            <div>
                <h4 className="text-xs font-black text-neutral-900 uppercase tracking-widest mb-1">KYC Policy v4.1</h4>
                <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">Updated with new FATF guidelines. All Tier-1 investors now require secondary financial substantiation.</p>
            </div>
        </div>
        <div className="p-6 bg-white border border-neutral-200 rounded-xl flex gap-6 items-start">
            <div className="p-3 bg-neutral-900 text-white rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <div>
                <h4 className="text-xs font-black text-neutral-900 uppercase tracking-widest mb-1">Data Retention Compliance</h4>
                <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">System is strictly GDPR/CCPA compliant. Non-verified dossiers are automatically purged after 180 days.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
