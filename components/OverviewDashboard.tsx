
'use client';

import React, { useState, useRef } from 'react';
import { Applicant, RegistrationStatus, InvestorType } from '../lib/types';

interface OverviewDashboardProps {
  applicants: Applicant[];
}

const CHART_DATA = [
  { month: 'Feb 24', price: 32, shares: 3100000 },
  { month: 'Mar 24', price: 31, shares: 3200000 },
  { month: 'Apr 24', price: 29, shares: 3300000 },
  { month: 'May 24', price: 27, shares: 3400000 },
  { month: 'Jun 24', price: 26, shares: 3500000 },
  { month: 'Jul 24', price: 24, shares: 3600000 },
  { month: 'Aug 24', price: 25, shares: 3700000 },
  { month: 'Sep 24', price: 24, shares: 3800000 },
  { month: 'Oct 24', price: 23, shares: 3900000 },
  { month: 'Nov 24', price: 25, shares: 4000000 },
  { month: 'Dec 24', price: 24, shares: 4100000 },
  { month: 'Jan 25', price: 26, shares: 4200000 },
  { month: 'Feb 25', price: 28, shares: 4300000 },
  { month: 'Mar 25', price: 27, shares: 4400000 },
  { month: 'Apr 25', price: 31, shares: 4500000 },
  { month: 'May 25', price: 30, shares: 4600000 },
  { month: 'Jun 25', price: 32, shares: 4700000 },
  { month: 'Jul 25', price: 34, shares: 4800000 },
  { month: 'Aug 25', price: 35, shares: 4900000 },
  { month: 'Sep 25', price: 33, shares: 5000000 },
  { month: 'Oct 25', price: 31, shares: 5100000 },
  { month: 'Nov 25', price: 29, shares: 5200000 },
  { month: 'Dec 25', price: 28, shares: 5300000 },
  { month: 'Jan 26', price: 30, shares: 5400000 },
];

const InteractiveChart: React.FC = () => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const width = 900;
  const height = 300;
  const padding = 40;

  const maxPrice = 40;
  const minPrice = 0;
  const maxShares = 6000000;
  const minShares = 0;

  const getX = (index: number) => (index / (CHART_DATA.length - 1)) * width;
  const getYPrice = (price: number) => height - ((price - minPrice) / (maxPrice - minPrice)) * height;
  const YShares = (shares: number) => height - ((shares - minShares) / (maxShares - minShares)) * height;

  const pricePoints = CHART_DATA.map((d, i) => `${getX(i)},${getYPrice(d.price)}`).join(' ');
  const sharesPoints = CHART_DATA.map((d, i) => `${getX(i)},${YShares(d.shares)}`).join(' ');

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - padding;
    const chartWidth = rect.width - padding * 2;
    const index = Math.round((x / chartWidth) * (CHART_DATA.length - 1));
    if (index >= 0 && index < CHART_DATA.length) {
      setHoverIndex(index);
    } else {
      setHoverIndex(null);
    }
  };

  return (
    <div 
      className="relative w-full h-full group select-none cursor-crosshair"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line key={p} x1="0" y1={height * p} x2={width} y2={height * p} stroke="#f1f1f1" strokeWidth="1" />
        ))}
        <polyline fill="none" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pricePoints} />
        <polyline fill="none" stroke="#d4d4d4" strokeWidth="2" strokeDasharray="6" strokeLinecap="round" strokeLinejoin="round" points={sharesPoints} />
        {hoverIndex !== null && <line x1={getX(hoverIndex)} y1="0" x2={getX(hoverIndex)} y2={height} stroke="#4F46E5" strokeWidth="1" strokeDasharray="4" opacity="0.3" />}
        {CHART_DATA.map((d, i) => <circle key={`p-${i}`} cx={getX(i)} cy={getYPrice(d.price)} r={hoverIndex === i ? 5 : 0} fill="#4F46E5" />)}
      </svg>
      {hoverIndex !== null && (
        <div className="absolute z-50 bg-white border border-neutral-200 shadow-xl p-4 pointer-events-none -translate-x-1/2 -translate-y-[110%] rounded-lg" style={{ left: `${(getX(hoverIndex) / width) * 100}%`, top: `${(getYPrice(CHART_DATA[hoverIndex].price) / height) * 100}%` }}>
          <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 border-b border-neutral-100 pb-1">{CHART_DATA[hoverIndex].month}</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-8">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Share Value</span>
              <span className="text-xs font-black text-primary">$ {CHART_DATA[hoverIndex].price}</span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Registry Sum</span>
              <span className="text-xs font-black text-neutral-900">{(CHART_DATA[hoverIndex].shares / 1000000).toFixed(2)}M</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ applicants }) => {
  const [selectedInvestor, setSelectedInvestor] = useState<Applicant | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'profile' | 'holdings'>('profile');

  const engagedInvestors = applicants.map((a, i) => ({
    ...a,
    rank: i + 1,
    engagementScore: 98 - (i * 3),
    holdingsDisplay: a.status === RegistrationStatus.APPROVED && a.declaration.isShareholder ? a.declaration.shareholdingDetails : 'Pending Disclosure'
  }));

  if (selectedInvestor) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button onClick={() => setSelectedInvestor(null)} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 hover:text-primary transition-colors uppercase tracking-widest group">
          <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          Master Dashboard
        </button>
        <div className="bg-white border border-neutral-200 p-10 shadow-sm rounded-xl flex items-center gap-8">
          <div className="w-20 h-20 bg-primary rounded-lg flex items-center justify-center text-white">
            <span className="text-2xl font-black">{selectedInvestor.fullName.charAt(0)}</span>
          </div>
          <div>
            <h2 className="text-3xl font-black text-neutral-900 uppercase tracking-tighter">{selectedInvestor.fullName}</h2>
            <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest mt-1">Verified {selectedInvestor.type} Class</p>
          </div>
        </div>
        
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
          <div className="flex border-b border-neutral-100 bg-neutral-50/30">
            <button onClick={() => setActiveDetailTab('profile')} className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'profile' ? 'text-primary' : 'text-neutral-400 hover:text-primary'}`}>
              Profile dossier
              {activeDetailTab === 'profile' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary"></div>}
            </button>
            <button onClick={() => setActiveDetailTab('holdings')} className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'holdings' ? 'text-primary' : 'text-neutral-400 hover:text-primary'}`}>
              Holdings audit
              {activeDetailTab === 'holdings' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary"></div>}
            </button>
          </div>
          <div className="p-10">
            {activeDetailTab === 'profile' ? (
              <div className="grid grid-cols-3 gap-12">
                {[
                  { label: 'Correspondence', value: selectedInvestor.email },
                  { label: 'Network Origin', value: selectedInvestor.location || 'Global Hub' },
                  { label: 'Registry Date', value: selectedInvestor.submissionDate }
                ].map((item, i) => (
                  <div key={i}>
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">{item.label}</p>
                    <p className="text-sm font-black text-neutral-900">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[400px]">
                <InteractiveChart />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      {/* Greetings Container - Styled to match Audit Compliance Card */}
      <div className="bg-black p-12 rounded-xl shadow-2xl text-white relative overflow-hidden group">
        {/* Subtle background icon on the left that moves on hover */}
        <div className="absolute top-1/2 -left-4 -translate-y-1/2 opacity-5 pointer-events-none group-hover:translate-x-4 group-hover:scale-110 transition-all duration-700 ease-out">
          <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"></path>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col gap-1 pl-4">
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-1">Welcome back, IR Team</h1>
          <p className="text-neutral-400 font-medium text-sm">Here's what's happening with your Investor Hub today.</p>
        </div>

        <div className="absolute top-0 right-0 p-10 opacity-10">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-8">
        {[
          { label: 'Shareholders', value: '2,128', trend: '+12%', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
          { label: 'Engagement', value: '68%', trend: '+5%', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10' },
          { label: 'Net Asset Delta', value: '3.2%', trend: '-0.8%', icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' },
          { label: 'Queue Depth', value: '2,103', trend: '-5%', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0z' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 border border-neutral-200 rounded-xl shadow-sm hover:border-primary transition-all cursor-default group">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-neutral-100 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors text-neutral-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={stat.icon}/></svg>
              </div>
              <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded">{stat.trend}</span>
            </div>
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-neutral-900 tracking-tighter">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/30">
          <div>
            <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">Top Engaged Retail Investors</h3>
          </div>
          <button className="px-8 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary-dark transition-all rounded-lg shadow-sm shadow-primary/20">
            Full Registry Ledger
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-900 text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                <th className="px-10 py-5 w-16 text-center">Rank</th>
                <th className="px-10 py-5">Shareholder</th>
                <th className="px-10 py-5">Status</th>
                <th className="px-10 py-5">Holdings</th>
                <th className="px-10 py-5 text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {engagedInvestors.map((investor) => (
                <tr key={investor.id} onClick={() => setSelectedInvestor(investor)} className="hover:bg-neutral-50 transition-all cursor-pointer group">
                  <td className="px-10 py-7 text-center">
                    <span className="text-xs font-black text-neutral-300 group-hover:text-primary transition-colors">#{investor.rank}</span>
                  </td>
                  <td className="px-10 py-7">
                    <p className="text-sm font-black text-neutral-900 uppercase tracking-tight">{investor.fullName}</p>
                    <p className="text-[9px] text-neutral-400 font-bold uppercase">{investor.type}</p>
                  </td>
                  <td className="px-10 py-7">
                    {investor.status === RegistrationStatus.APPROVED ? (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-[#E6F9F1] text-[#166534] border-[#D1F2E4]">
                        <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                          <path d="m9 12 2 2 4-4"></path>
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-[#FEF3E7] text-[#9A3412] border-[#FDE0C3]">
                        <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        Unverified
                      </span>
                    )}
                  </td>
                  <td className="px-10 py-7">
                    <p className="text-sm font-black text-neutral-900">{investor.holdingsDisplay}</p>
                  </td>
                  <td className="px-10 py-7 text-right">
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{investor.lastActive}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;
