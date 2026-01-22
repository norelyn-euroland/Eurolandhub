
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Applicant, RegistrationStatus, InvestorType } from '../lib/types';
import Tooltip from './Tooltip';

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

interface ShareholderSnapshotProps {
  applicants: Applicant[];
}

const ShareholderSnapshot: React.FC<ShareholderSnapshotProps> = ({ applicants }) => {
  // Calculate data from actual applicants
  const registeredWithHoldings = applicants.filter(a => a.declaration.isShareholder).length;
  const registeredNoHoldings = applicants.filter(a => !a.declaration.isShareholder).length;
  const totalRegistered = applicants.length;
  
  // Guest users: 13% of total users (demo data)
  // If guests are 13%, then registered are 87%
  // So: guests / (guests + registered) = 0.13
  // Solving: guests = 0.13 * (guests + registered)
  // guests = 0.13 * guests + 0.13 * registered
  // 0.87 * guests = 0.13 * registered
  // guests = (0.13 / 0.87) * registered
  const guestCount = Math.round((0.13 / 0.87) * totalRegistered);
  const totalUsers = guestCount + totalRegistered;
  
  // Calculate percentages
  const guestPercentage = (guestCount / totalUsers) * 100;
  const registeredNoHoldingsPercentage = (registeredNoHoldings / totalUsers) * 100;
  const registeredWithHoldingsPercentage = (registeredWithHoldings / totalUsers) * 100;
  
  // Build data array with colors
  const SHAREHOLDER_SNAPSHOT_DATA = [
    { label: 'Guest Users', percentage: guestPercentage, color: '#f97316' }, // orange
    { label: 'Registered (No Holdings)', percentage: registeredNoHoldingsPercentage, color: '#f1dd3f' }, // yellow/gold
    { label: 'Registered (With Holdings)', percentage: registeredWithHoldingsPercentage, color: '#86efac' }, // light green
  ];
  const chartSize = 320;
  const svgPadding = 60;
  const size = chartSize + (svgPadding * 2);
  const radius = 120;
  const strokeWidth = 40;
  const center = chartSize / 2 + svgPadding;
  const circumference = 2 * Math.PI * radius;

  // Normalize data to ensure it sums to exactly 100%
  const total = SHAREHOLDER_SNAPSHOT_DATA.reduce((sum, item) => sum + item.percentage, 0);
  const normalizedData = SHAREHOLDER_SNAPSHOT_DATA.map(item => ({
    ...item,
    percentage: (item.percentage / total) * 100
  }));

  let cumulativeOffset = 0;

  const segments = normalizedData.map((item) => {
    const percentage = item.percentage / 100;
    const segmentLength = circumference * percentage;
    
    // Calculate the offset: we want segments to start where previous ended
    // strokeDashoffset positions the start of the dash pattern
    // We start from top (12 o'clock) which is at offset 0 after -90° rotation
    const dashOffset = circumference - cumulativeOffset;
    
    // Calculate angles in degrees (0° = top after rotation)
    const startAngleDeg = (cumulativeOffset / circumference) * 360;
    const midAngleDeg = startAngleDeg + (percentage * 360) / 2;
    
    // Convert to radians for calculations (SVG is rotated -90°, so 0° is at top)
    const midAngleRad = ((midAngleDeg - 90) * Math.PI) / 180;
    
    // Calculate position for percentage label
    const labelRadius = radius + strokeWidth / 2 + 35;
    const labelX = center + labelRadius * Math.cos(midAngleRad);
    const labelY = center + labelRadius * Math.sin(midAngleRad);

    // Leader line: solid segment from donut edge, dashed segment to label
    const lineStartRadius = radius + strokeWidth / 2 + 3;
    const lineMidRadius = lineStartRadius + 25; // Longer solid segment
    const lineStartX = center + lineStartRadius * Math.cos(midAngleRad);
    const lineStartY = center + lineStartRadius * Math.sin(midAngleRad);
    const lineMidX = center + lineMidRadius * Math.cos(midAngleRad);
    const lineMidY = center + lineMidRadius * Math.sin(midAngleRad);
    
    // Update cumulative offset for next segment
    const currentOffset = cumulativeOffset;
    cumulativeOffset += segmentLength;
    
    return {
      ...item,
      // strokeDasharray: segmentLength dash, then gap of (circumference - segmentLength)
      // This ensures no overlap and proper spacing
      strokeDasharray: `${segmentLength} ${circumference}`,
      strokeDashoffset: dashOffset,
      labelX,
      labelY,
      midAngleRad,
      lineStartX,
      lineStartY,
      lineMidX,
      lineMidY,
      lineEndX: labelX,
      lineEndY: labelY,
    };
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size + 60 }}>
        <svg width={size} height={size + 60} className="transform -rotate-90" style={{ overflow: 'visible' }}>
          {/* Segments with solid colors - sharp edges, no gaps */}
          {segments.map((segment, index) => (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={segment.strokeDasharray}
              strokeDashoffset={segment.strokeDashoffset}
              strokeLinecap="butt"
            />
          ))}
          {/* Leader lines: solid from donut edge, dashed to label */}
          <g transform={`rotate(90 ${center} ${center})`}>
            {segments.map((segment, index) => (
              <g key={index}>
                {/* Solid line from donut edge */}
                <line
                  x1={segment.lineStartX}
                  y1={segment.lineStartY}
                  x2={segment.lineMidX}
                  y2={segment.lineMidY}
                  stroke={segment.color}
                  strokeWidth="2.5"
                />
                {/* Dashed line to percentage label */}
                <line
                  x1={segment.lineMidX}
                  y1={segment.lineMidY}
                  x2={segment.lineEndX}
                  y2={segment.lineEndY}
                  stroke={segment.color}
                  strokeWidth="2"
                  strokeDasharray="5,3"
                />
                {/* Dot at segment edge */}
                <circle
                  cx={segment.lineStartX}
                  cy={segment.lineStartY}
                  r="4"
                  fill={segment.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </g>
            ))}
          </g>
          {/* Percentage labels - properly positioned */}
          <g transform={`rotate(90 ${center} ${center})`}>
            {segments.map((segment, index) => (
              <text
                key={index}
                x={segment.labelX}
                y={segment.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={segment.color}
                fontSize="20"
                fontWeight="900"
                className="font-black"
                style={{ 
                  textShadow: '0 0 8px rgba(255,255,255,0.95), 0 0 12px rgba(255,255,255,0.7)',
                  pointerEvents: 'none'
                }}
              >
                {Math.round(segment.percentage)}%
              </text>
            ))}
          </g>
        </svg>
      </div>
      
      <div className="flex items-center justify-center gap-10 mt-4" style={{ width: chartSize }}>
        {normalizedData.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3"
          >
            <div 
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs font-black uppercase tracking-tight whitespace-nowrap text-neutral-900">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

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

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ applicants }) => {
  const [selectedInvestor, setSelectedInvestor] = useState<Applicant | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'profile' | 'holdings'>('profile');
  const [isPulsing, setIsPulsing] = useState(false);
  const hasAnimatedRef = useRef(false);

  // Trigger animation once when dashboard page is visited
  useEffect(() => {
    if (!selectedInvestor) {
      // Only animate if we haven't animated yet for this visit
      if (!hasAnimatedRef.current) {
        hasAnimatedRef.current = true;
        setIsPulsing(true);
        // Reset after animation completes (1.5 seconds)
        const timer = setTimeout(() => {
          setIsPulsing(false);
        }, 1500);
        return () => clearTimeout(timer);
      }
    } else {
      // Reset flag when navigating to detail view so it animates again when returning
      hasAnimatedRef.current = false;
    }
  }, [selectedInvestor]);

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
          <Avatar name={selectedInvestor.fullName} size={80} />
          <div>
            <h2 className="text-3xl font-black text-neutral-900 uppercase tracking-tighter">{selectedInvestor.fullName}</h2>
            <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest mt-1">Verified {selectedInvestor.type} Class</p>
          </div>
        </div>
        
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
          <div className="flex border-b border-neutral-100 bg-neutral-50/30">
            <button onClick={() => setActiveDetailTab('profile')} className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'profile' ? 'text-primary' : 'text-neutral-400 hover:text-primary'}`}>
              Profile summary
              {activeDetailTab === 'profile' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary"></div>}
            </button>
            <button onClick={() => setActiveDetailTab('holdings')} className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'holdings' ? 'text-primary' : 'text-neutral-400 hover:text-primary'}`}>
              Holdings summary
              {activeDetailTab === 'holdings' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary"></div>}
            </button>
          </div>
          <div className="p-10">
            {activeDetailTab === 'profile' ? (
              <div className="grid grid-cols-4 gap-12">
                {[
                  { label: 'Correspondence', value: selectedInvestor.email },
                  { label: 'Contact Number', value: selectedInvestor.phoneNumber || 'Not provided' },
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
      {/* EXACT CODE FOR ANIMATED GREETINGS CARD */}
      <div className={`bg-black p-12 rounded-xl text-white relative overflow-hidden group transition-all duration-700 cursor-default premium-ease
        ${isPulsing ? 'shadow-black/60 -translate-y-1' : 'shadow-2xl hover:shadow-black/60 hover:-translate-y-1'}
      `}
      onMouseEnter={() => setIsPulsing(true)}
      onMouseLeave={() => setIsPulsing(false)}
      >
        {/* Animated Background Calendar Icon */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-[1800ms] premium-ease
          ${isPulsing 
            ? 'left-[calc(100%-11.5rem)] top-12 translate-y-0 rotate-12 scale-[1.7] opacity-20' 
            : 'left-0 top-1/2 -translate-y-1/2 rotate-0 scale-100 opacity-5 group-hover:left-[calc(100%-11.5rem)] group-hover:top-12 group-hover:translate-y-0 group-hover:rotate-12 group-hover:scale-[1.7] group-hover:opacity-20'
          }
        `}>
          <svg className="w-96 h-96 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
        </div>

        {/* Light Sweep Animation Layer */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isPulsing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-sweep"></div>
        </div>

        {/* Header and Static Icon Layer */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex flex-col gap-1 pl-4">
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-1 transition-transform duration-500 premium-ease group-hover:translate-x-2">Welcome back, IR Team</h1>
            <p className="text-neutral-400 font-medium text-sm transition-transform duration-500 premium-ease group-hover:translate-x-2 delay-75">Your investor dashboard is primed and ready.</p>
          </div>
          
          {/* Static Anchor Calendar Icon - Prominent size matching shield icon scale */}
          <div className={`pr-4 opacity-10 transition-all duration-700 premium-ease ${isPulsing ? 'scale-110 opacity-40' : 'group-hover:opacity-40 group-hover:scale-110'}`}>
            <svg className="w-24 h-28 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2v4"/>
              <path d="M16 2v4"/>
              <path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/>
              <path d="M3 10h18"/>
              <path d="m16 20 2 2 4-4"/>
            </svg>
          </div>
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

      {/* Shareholder Snapshot */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm p-10">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">Shareholder Snapshot</h3>
          <div className="flex items-center gap-2 text-neutral-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span className="text-sm font-black uppercase tracking-widest">User Tier Breakdown</span>
          </div>
        </div>
        
        <ShareholderSnapshot applicants={applicants} />
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
                    <div className="flex items-center gap-3">
                      <Avatar name={investor.fullName} size={40} />
                      <div className="min-w-0 flex-1">
                        <Tooltip content={investor.fullName}>
                          <p className="text-sm font-black text-neutral-900 uppercase tracking-tight truncate max-w-[200px]">{investor.fullName}</p>
                        </Tooltip>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase">{investor.type}</p>
                      </div>
                    </div>
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
                    <Tooltip content={investor.holdingsDisplay}>
                      <p className="text-sm font-black text-neutral-900 truncate max-w-[150px]">{investor.holdingsDisplay}</p>
                    </Tooltip>
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
