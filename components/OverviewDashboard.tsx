
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import Tooltip from './Tooltip';
import Chart from 'react-apexcharts';
import HoldingsSummary from './HoldingsSummary';
import { getWorkflowStatusInternal, getGeneralAccountStatus } from '../lib/shareholdingsVerification';
import MetricCard from './MetricCard';

// CopyableField component with copy notification
const CopyableField: React.FC<{ label: string; value: string; copyable: boolean }> = ({ label, value, copyable }) => {
  const [showCopied, setShowCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = async () => {
    if (!copyable || !value || value === 'Not provided') return;
    
    try {
      await navigator.clipboard.writeText(value);
      setShowCopied(true);
      
      // Clear existing timeout if any
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Hide notification after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setShowCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">{label}</p>
      {copyable && value && value !== 'Not provided' ? (
        <button
          onClick={handleCopy}
          className="text-sm font-black text-neutral-900 hover:text-primary transition-colors cursor-pointer relative group"
        >
          {value}
          {showCopied && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-10">
              Copied!
            </span>
          )}
        </button>
      ) : (
        <p className="text-sm font-black text-neutral-900">{value}</p>
      )}
    </div>
  );
};

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
  const [chartKey, setChartKey] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);

  // Trigger animation when chart container comes into view
  useEffect(() => {
    if (!chartRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            // Reset and trigger animation when chart comes into view
            setChartKey(prev => prev + 1);
            hasAnimatedRef.current = true;
          } else if (!entry.isIntersecting && hasAnimatedRef.current) {
            // Reset flag when chart leaves viewport so it can animate again
            hasAnimatedRef.current = false;
          }
        });
      },
      {
        threshold: 0.3, // Trigger when 30% of the chart is visible
        rootMargin: '0px'
      }
    );

    observer.observe(chartRef.current);

    return () => {
      if (chartRef.current) {
        observer.unobserve(chartRef.current);
      }
    };
  }, []);

  // Calculate data from actual applicants (include all accounts for dashboard)
  const registeredWithHoldings = applicants.filter(a => a.holdingsRecord !== undefined).length;
  const registeredNoHoldings = applicants.filter(a => a.holdingsRecord === undefined).length;
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
  const guestPercentage = Math.round((guestCount / totalUsers) * 100 * 10) / 10;
  const registeredNoHoldingsPercentage = Math.round((registeredNoHoldings / totalUsers) * 100 * 10) / 10;
  const registeredWithHoldingsPercentage = Math.round((registeredWithHoldings / totalUsers) * 100 * 10) / 10;
  
  // Prepare data for ApexCharts
  const chartData = [
    { name: 'Guest Users', value: guestCount, percentage: guestPercentage, color: '#f97316' },
    { name: 'Registered (No Holdings)', value: registeredNoHoldings, percentage: registeredNoHoldingsPercentage, color: '#f1dd3f' },
    { name: 'Registered (With Holdings)', value: registeredWithHoldings, percentage: registeredWithHoldingsPercentage, color: '#86efac' },
  ];

  const chartOptions = {
    chart: {
      type: 'donut' as const,
      animations: {
        enabled: true,
        easing: 'easeinout' as const,
        speed: 2500,
        animateGradually: {
          enabled: true,
          delay: 400
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      },
      events: {
        dataPointMouseEnter: function(event: any, chartContext: any, config: any) {
          // Smooth hover animation is handled by ApexCharts
        }
      },
      offsetX: 0,
      offsetY: 0
    },
    labels: chartData.map(item => item.name),
    colors: chartData.map(item => item.color),
    dataLabels: {
      enabled: true,
      formatter: function(val: number, opts: any) {
        return Math.round(val) + '%';
      },
      style: {
        fontSize: '18px',
        fontWeight: 900,
        fontFamily: 'Inter, sans-serif',
        colors: chartData.map(item => item.color)
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 4,
        opacity: 0.4
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: false
          }
        },
        expandOnClick: false,
        customScale: 1,
        startAngle: -45,
        endAngle: 315
      }
    },
    fill: {
      type: 'solid',
      colors: chartData.map(item => item.color)
    },
    stroke: {
      show: true,
      curve: 'smooth' as const,
      lineCap: 'butt' as const,
      colors: ['#fff'],
      width: 2,
      dashArray: 0
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      fillSeriesColor: false,
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif'
      },
      custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
        const dataPoint = chartData[seriesIndex];
        return `
          <div style="padding: 8px 12px; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); color: #000000; font-size: 12px; font-family: Inter, sans-serif; white-space: nowrap;">
            ${dataPoint.name} : ${dataPoint.value.toLocaleString()} (${dataPoint.percentage}%)
          </div>
        `;
      }
    },
    legend: {
      show: false
    },
    states: {
      hover: {
        filter: {
          type: 'none'
        }
      },
      active: {
        filter: {
          type: 'none'
        }
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 200
        },
        legend: {
          position: 'bottom'
        }
      }
    }]
  };

  const chartSeries = chartData.map(item => item.value);

  return (
    <div className="flex flex-col items-center">
      <div ref={chartRef} className="relative" style={{ width: '100%', maxWidth: '500px', padding: '40px' }}>
        <Chart
          key={`chart-${chartKey}`}
          options={chartOptions}
          series={chartSeries}
          type="donut"
          width="100%"
          height="400"
        />
      </div>
      
      <div className="flex items-center justify-center gap-10 mt-4">
        {chartData.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3"
          >
            <div 
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs font-black uppercase tracking-tight whitespace-nowrap text-neutral-900">
              {item.name}
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
        // Keep isPulsing true after animation completes - don't reset it
        // This keeps the calendar icon on the right side
      }
    } else {
      // Reset flag when navigating to detail view so it animates again when returning
      hasAnimatedRef.current = false;
      setIsPulsing(false);
    }
  }, [selectedInvestor]);

  // Separate accounts by status
  const regularApplicants = applicants.filter(a => !a.isPreVerified);
  const preVerifiedApplicants = applicants.filter(a => a.isPreVerified === true);
  
  // Calculate status for regular accounts
  const getAccountStatus = (applicant: Applicant) => {
    if (applicant.isPreVerified) return null; // Pre-verified uses different status mapping
    const internalStatus = getWorkflowStatusInternal(applicant);
    return getGeneralAccountStatus(internalStatus);
  };
  
  const unverifiedAccounts = regularApplicants.filter(a => getAccountStatus(a) === 'UNVERIFIED');
  const verifiedAccounts = regularApplicants.filter(a => getAccountStatus(a) === 'VERIFIED');
  const pendingAccounts = regularApplicants.filter(a => getAccountStatus(a) === 'PENDING');
  
  // Ranking/Leaderboard: Top 5 accounts (excluding pre-verified)
  // Randomly select top 5 for now (based on activity/interactions)
  const shuffledRegularApplicants = [...regularApplicants].sort(() => Math.random() - 0.5);
  const rankedInvestors = shuffledRegularApplicants
    .slice(0, 5)
    .map((a, i) => ({
      ...a,
      rank: i + 1,
      engagementScore: 98 - (i * 3),
      holdingsDisplay: a.status === RegistrationStatus.APPROVED && a.holdingsRecord
        ? a.holdingsRecord.sharesHeld.toLocaleString()
        : 'Pending Disclosure'
    }));
  
  // Get IDs of ranked investors to exclude them from other containers
  const rankedInvestorIds = new Set(rankedInvestors.map(a => a.id));
  
  // Filter out ranked investors from other containers
  const unverifiedWithoutRanked = unverifiedAccounts.filter(a => !rankedInvestorIds.has(a.id));
  const verifiedWithoutRanked = verifiedAccounts.filter(a => !rankedInvestorIds.has(a.id));
  
  // Sort verified accounts by holdings (high to low) for ranking
  const verifiedSorted = verifiedWithoutRanked
    .map((a) => ({
      ...a,
      holdings: a.holdingsRecord?.sharesHeld || 0
    }))
    .sort((a, b) => b.holdings - a.holdings);
  
  // Sort unverified accounts (just for ordering)
  const unverifiedSorted = [...unverifiedWithoutRanked];
  
  // Assign sequential ranking starting from 6 (after top 5)
  let currentRank = 6;
  const verifiedRanked = verifiedSorted.map((a) => ({
    ...a,
    rank: currentRank++
  }));
  
  const unverifiedRanked = unverifiedSorted.map((a) => ({
    ...a,
    rank: currentRank++
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
            <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest mt-1">Verified Investor</p>
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
                  { label: 'Email', value: selectedInvestor.email, copyable: true },
                  { label: 'Contact Number', value: selectedInvestor.phoneNumber || 'Not provided', copyable: true },
                  { label: 'Network Origin', value: selectedInvestor.location || 'Global Hub', copyable: false },
                  { label: 'Registry Date', value: selectedInvestor.submissionDate, copyable: false }
                ].map((item, i) => (
                  <CopyableField key={i} label={item.label} value={item.value} copyable={item.copyable} />
                ))}
              </div>
            ) : (
              <HoldingsSummary applicant={selectedInvestor} />
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
        ${isPulsing ? 'shadow-black/60' : 'shadow-2xl hover:shadow-black/60'}
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
          { 
            label: 'Shareholders', 
            value: '2,128', 
            trend: { percent: 12, direction: 'up' as const },
            chartColor: '#7C3AED'
          },
          { 
            label: 'Engagement', 
            value: '68%', 
            trend: { percent: 5, direction: 'up' as const },
            chartColor: '#10B981'
          },
          { 
            label: 'Net Asset Delta', 
            value: '3.2%', 
            trend: { percent: 0.8, direction: 'down' as const },
            chartColor: '#F59E0B'
          },
          { 
            label: 'Queue Depth', 
            value: '2,103', 
            trend: { percent: 5, direction: 'down' as const },
            chartColor: '#EF4444'
          }
        ].map((stat, i) => {
          // Generate chart data based on trend
          const baseValue = typeof stat.value === 'string' 
            ? parseFloat(stat.value.replace(/[^0-9.]/g, '')) || 100 
            : stat.value;
          const chartData = Array.from({ length: 7 }, (_, idx) => {
            const progress = idx / 6;
            const trendMultiplier = stat.trend.direction === 'up' 
              ? 1 + (stat.trend.percent / 100) * progress
              : stat.trend.direction === 'down'
              ? 1 - (stat.trend.percent / 100) * progress
              : 1;
            return baseValue * trendMultiplier * (1 + (Math.random() - 0.5) * 0.1);
          });

          return (
            <MetricCard
              key={i}
              title={stat.label}
              value={stat.value}
              trend={stat.trend}
              chartData={chartData}
              chartColor={stat.chartColor}
            />
          );
        })}
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

      {/* Ranking/Leaderboard - Top 5 */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/30">
          <div>
            <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">Top 5 Leaderboard</h3>
            <p className="text-xs text-neutral-500 mt-1">Top 5 most active investors based on frontend interactions (pre-verified accounts excluded)</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-900 text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                <th className="px-10 py-5 w-16 text-center">Rank</th>
                <th className="px-10 py-5">Investor</th>
                <th className="px-10 py-5">Account Status</th>
                <th className="px-10 py-5">Holdings</th>
                <th className="px-10 py-5 text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rankedInvestors.map((investor) => {
                const isTopThree = investor.rank <= 3;
                const rankColors = {
                  1: { 
                    bg: 'bg-gradient-to-r from-yellow-50 to-amber-50', 
                    border: 'border-yellow-300', 
                    badge: 'bg-gradient-to-br from-yellow-400 to-amber-500', 
                    text: 'text-yellow-900', 
                    icon: 'https://img.icons8.com/windows/32/medal2.png',
                    iconColor: 'brightness(0) saturate(100%) invert(70%) sepia(100%) saturate(2000%) hue-rotate(0deg) brightness(110%) contrast(120%)'
                  },
                  2: { 
                    bg: 'bg-gradient-to-r from-gray-50 to-slate-50', 
                    border: 'border-gray-300', 
                    badge: 'bg-gradient-to-br from-gray-400 to-slate-500', 
                    text: 'text-gray-900', 
                    icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABRUlEQVR4nN2TQUoDQRBFH5idujWH8AyJOYUGAhG9gBDwAho3XkUSvIRbxZ3MbNStCpq4EMVECv5A0fTE6ZmVfiiY+V1d9et3N/w3DIElkAOtEm4NuBNna5RwUVTZPIyI2I9wv06RqXjIZYGAVoSjyRTLJurDKfJIoVrep0yRN1UfTpEBp8AN8KGw7xMVTlbvp7h3tpTFQx31hj3gW0UugA6wrugCE61Zzm5q8TbwpgJHK/JGynkFtlIajJ3yAn3gEXgOmk6Va2dSGbfa1HHcE3AADIC543eUawdfGTNt2oisnQNX7n9TuWZpZcxLGhwCL8B2pIGJSraoG5zBe2CboVfHojNtmjju0939L8dfirPHmHRNC5tGK/KOnT1J17SwZKECU1lRPLSeU77Qo6yFvpskFrMmxb1dY+BazSzs2zxPtuXv4Qc+TI21/xkT+wAAAABJRU5ErkJggg==',
                    iconColor: 'brightness(0) saturate(100%) invert(60%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(100%)'
                  },
                  3: { 
                    bg: 'bg-gradient-to-r from-orange-50 to-amber-50', 
                    border: 'border-orange-300', 
                    badge: 'bg-gradient-to-br from-orange-400 to-amber-500', 
                    text: 'text-orange-900', 
                    icon: 'https://img.icons8.com/ios-glyphs/30/medal2-third-place--v1.png',
                    iconColor: 'brightness(0) saturate(100%) invert(67%) sepia(93%) saturate(1352%) hue-rotate(348deg) brightness(101%) contrast(101%)'
                  },
                };
                const rankStyle = isTopThree ? rankColors[investor.rank as 1 | 2 | 3] : null;
                
                return (
                <tr 
                  key={investor.id} 
                  onClick={() => setSelectedInvestor(investor)} 
                  className={`hover:bg-neutral-50 transition-all cursor-pointer group relative ${
                    isTopThree ? `${rankStyle?.bg} ${rankStyle?.border} border-l-4` : ''
                  }`}
                >
                  <td className="px-10 py-7 text-center">
                    {isTopThree ? (
                      <div className="flex items-center justify-center">
                        <img 
                          src={rankStyle?.icon} 
                          alt={`${investor.rank} place medal`}
                          width="32" 
                          height="32"
                          className="drop-shadow-sm"
                          style={{ filter: rankStyle?.iconColor }}
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-black text-neutral-300 group-hover:text-primary transition-colors">#{investor.rank}</span>
                    )}
                  </td>
                  <td className="px-10 py-7">
                    <div className="flex items-center gap-3">
                      {isTopThree && (
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${rankStyle?.badge}`}></div>
                      )}
                      <Avatar name={investor.fullName} size={40} />
                      <div className="min-w-0 flex-1">
                        <Tooltip content={investor.fullName}>
                          <p className={`text-sm font-black uppercase tracking-tight truncate max-w-[200px] ${
                            isTopThree ? rankStyle?.text : 'text-neutral-900'
                          }`}>{investor.fullName}</p>
                        </Tooltip>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-7">
                    {(() => {
                      const internalStatus = getWorkflowStatusInternal(investor);
                      const generalStatus = getGeneralAccountStatus(internalStatus);
                      
                      if (generalStatus === 'VERIFIED') {
                        return (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-[#E6F9F1] text-[#166534] border-[#D1F2E4]">
                            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                              <path d="m9 12 2 2 4-4"></path>
                            </svg>
                            Verified
                          </span>
                        );
                      } else if (generalStatus === 'PENDING') {
                        return (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-purple-50 text-purple-700 border-purple-200">
                            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <path d="M12 6v6l4 2"></path>
                            </svg>
                            Pending
                          </span>
                        );
                      } else {
                        return (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-[#FEF3E7] text-[#9A3412] border-[#FDE0C3]">
                            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            Unverified
                          </span>
                        );
                      }
                    })()}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verified Accounts Container - Below Top 5 Leaderboard */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-100 bg-neutral-50/30">
          <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">Verified Accounts</h3>
          <p className="text-xs text-neutral-500 mt-1">{verifiedRanked.length} accounts (excluding leaderboard)</p>
        </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50 text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                  <th className="px-10 py-5 w-16 text-center">Rank</th>
                  <th className="px-10 py-5">Investor</th>
                  <th className="px-10 py-5">Holdings</th>
                  <th className="px-10 py-5 text-right">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {verifiedRanked.length > 0 ? (
                  verifiedRanked.map((applicant) => (
                    <tr 
                      key={applicant.id} 
                      onClick={() => setSelectedInvestor(applicant)} 
                      className="hover:bg-neutral-50 transition-all cursor-pointer"
                    >
                      <td className="px-10 py-7 text-center">
                        <span className="text-xs font-black text-neutral-300">#{applicant.rank}</span>
                      </td>
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-3">
                          <Avatar name={applicant.fullName} size={40} />
                          <div className="min-w-0 flex-1">
                            <Tooltip content={applicant.fullName}>
                              <p className="text-sm font-black uppercase tracking-tight truncate max-w-[200px] text-neutral-900">{applicant.fullName}</p>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <p className="text-sm font-black text-neutral-900">
                          {applicant.holdingsRecord?.sharesHeld.toLocaleString() || 'N/A'}
                        </p>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{applicant.lastActive}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-10 py-12 text-center text-xs font-bold text-neutral-400 uppercase tracking-widest">
                      No verified accounts (excluding leaderboard)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
      </div>

      {/* Unverified Accounts Container - Below Verified Accounts */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-100 bg-neutral-50/30">
          <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">Unverified Accounts</h3>
          <p className="text-xs text-neutral-500 mt-1">{unverifiedRanked.length} accounts (excluding leaderboard)</p>
        </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50 text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                  <th className="px-10 py-5 w-16 text-center">Rank</th>
                  <th className="px-10 py-5">Name</th>
                  <th className="px-10 py-5">Account Status</th>
                  <th className="px-10 py-5 text-right">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {unverifiedRanked.length > 0 ? (
                  unverifiedRanked.map((applicant) => (
                    <tr 
                      key={applicant.id} 
                      onClick={() => setSelectedInvestor(applicant)} 
                      className="hover:bg-neutral-50 transition-all cursor-pointer"
                    >
                      <td className="px-10 py-7 text-center">
                        <span className="text-xs font-black text-neutral-300">#{applicant.rank}</span>
                      </td>
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-3">
                          <Avatar name={applicant.fullName} size={40} />
                          <div className="min-w-0 flex-1">
                            <Tooltip content={applicant.fullName}>
                              <p className="text-sm font-black uppercase tracking-tight truncate max-w-[200px] text-neutral-900">{applicant.fullName}</p>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-[#FEF3E7] text-[#9A3412] border-[#FDE0C3]">
                          <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                          </svg>
                          Unverified
                        </span>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{applicant.lastActive}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-10 py-12 text-center text-xs font-bold text-neutral-400 uppercase tracking-widest">
                      No unverified accounts (excluding leaderboard)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Pre-verified Accounts - Same style as Top 5 Leaderboard */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/30">
          <div>
            <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">Pre-verified Accounts</h3>
            <p className="text-xs text-neutral-500 mt-1">{preVerifiedApplicants.length} accounts</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-900 text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                <th className="px-10 py-5">Name</th>
                <th className="px-10 py-5">Registration ID</th>
                <th className="px-10 py-5">Email</th>
                <th className="px-10 py-5">Workflow Stage</th>
                <th className="px-10 py-5 text-right">System Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {preVerifiedApplicants.length > 0 ? (
                preVerifiedApplicants.map((applicant) => (
                  <tr 
                    key={applicant.id} 
                    onClick={() => setSelectedInvestor(applicant)} 
                    className="hover:bg-neutral-50 transition-all cursor-pointer group"
                  >
                    <td className="px-10 py-7">
                      <div className="flex items-center gap-3">
                        <Avatar name={applicant.fullName} size={40} />
                        <div className="min-w-0 flex-1">
                          <Tooltip content={applicant.fullName}>
                            <p className="text-sm font-black uppercase tracking-tight truncate max-w-[200px] text-neutral-900">{applicant.fullName}</p>
                          </Tooltip>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-7">
                      <p className="text-xs text-neutral-600 font-medium">
                        {applicant.registrationId && applicant.registrationId.length > 6 
                          ? applicant.registrationId.slice(-6) 
                          : applicant.registrationId || 'N/A'}
                      </p>
                    </td>
                    <td className="px-10 py-7 text-xs text-neutral-600 font-medium">
                      {applicant.email || 'N/A'}
                    </td>
                    <td className="px-10 py-7">
                      <p className="text-xs font-medium text-neutral-700">
                        {applicant.workflowStage || 'N/A'}
                      </p>
                    </td>
                    <td className="px-10 py-7 text-right">
                      <p className="text-xs font-medium text-neutral-700">
                        {applicant.systemStatus || 'N/A'}
                      </p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-10 py-12 text-center text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    No pre-verified accounts
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;
