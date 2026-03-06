'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Applicant, EngagementRecord } from '../lib/types';
import Chart from 'react-apexcharts';
import {
  generateEngagementRecords,
  generateMostEngagedContent,
  generateActiveInvestorsMetrics,
  generateContentEngagementData,
  generateInteractionMetrics,
} from '../lib/engagementService';

interface EngagementAnalyticsPageProps {
  applicants: Applicant[];
  applicantsLoading: boolean;
}

const EngagementAnalyticsPage: React.FC<EngagementAnalyticsPageProps> = ({ applicants, applicantsLoading }) => {
  const [engagementRecords, setEngagementRecords] = useState<EngagementRecord[]>([]);
  const [engagementLoading, setEngagementLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setEngagementLoading(true);
    generateEngagementRecords(applicants).then((records) => {
      if (isMounted) {
        setEngagementRecords(records);
        setEngagementLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [applicants]);

  // ── Memoized data ──
  const activeMetrics = useMemo(() => generateActiveInvestorsMetrics(engagementRecords), [engagementRecords]);
  const contentEngagement = useMemo(() => generateContentEngagementData(engagementRecords), [engagementRecords]);
  const mostEngagedContent = useMemo(() => generateMostEngagedContent(engagementRecords), [engagementRecords]);
  const interactionMetrics = useMemo(() => generateInteractionMetrics(engagementRecords), [engagementRecords]);

  const scoreDistribution = useMemo(() => {
    const ranges = [
      { label: '0–20', min: 0, max: 20 },
      { label: '21–40', min: 21, max: 40 },
      { label: '41–60', min: 41, max: 60 },
      { label: '61–80', min: 61, max: 80 },
      { label: '81–100', min: 81, max: 100 },
    ];
    return ranges.map((r) => ({
      label: r.label,
      count: engagementRecords.filter((rec) => rec.engagementScore >= r.min && rec.engagementScore <= r.max).length,
    }));
  }, [engagementRecords]);

  const statusBreakdown = useMemo(() => {
    const verified = engagementRecords.filter((r) => r.userStatus === 'verified').length;
    const unverified = engagementRecords.filter((r) => r.userStatus === 'unverified').length;
    return { verified, unverified, total: engagementRecords.length };
  }, [engagementRecords]);

  const engagementLevels = useMemo(() => {
    const high = engagementRecords.filter((r) => r.engagementLevel === 'high').length;
    const medium = engagementRecords.filter((r) => r.engagementLevel === 'medium').length;
    const low = engagementRecords.filter((r) => r.engagementLevel === 'low').length;
    return { high, medium, low };
  }, [engagementRecords]);

  const avgScore = useMemo(() => {
    if (engagementRecords.length === 0) return 0;
    return Math.round(engagementRecords.reduce((s, r) => s + r.engagementScore, 0) / engagementRecords.length);
  }, [engagementRecords]);

  const donutTotal = contentEngagement.fullyRead + contentEngagement.partiallyRead + contentEngagement.skipped;

  // ── Chart options (kept tight) ──
  const scoreBarOpts: ApexCharts.ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 800 } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
    dataLabels: { enabled: true, formatter: (v: number) => String(Math.round(v)), style: { fontSize: '10px', fontWeight: 700 } },
    xaxis: { categories: scoreDistribution.map((d) => d.label), labels: { style: { fontSize: '10px', fontWeight: 600 } } },
    yaxis: { labels: { style: { fontSize: '10px', fontWeight: 600 } } },
    colors: ['#3b82f6'],
    grid: { borderColor: '#e5e7eb', strokeDashArray: 3, padding: { left: 4, right: 4 } },
    tooltip: { y: { formatter: (v: number) => `${v} investors` } },
  };

  const statusDonutOpts: ApexCharts.ApexOptions = {
    chart: { type: 'donut', animations: { enabled: true, easing: 'easeinout', speed: 1000 } },
    labels: ['Verified', 'Unverified'],
    colors: ['#10b981', '#94a3b8'],
    dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%', style: { fontSize: '11px', fontWeight: 700 } },
    plotOptions: {
      pie: {
        donut: {
          size: '55%',
          labels: {
            show: true,
            name: { show: true, fontSize: '11px', fontWeight: 700 },
            value: { show: true, fontSize: '18px', fontWeight: 900 },
            total: { show: true, label: 'Total', fontSize: '10px', fontWeight: 700, formatter: () => String(statusBreakdown.total) },
          },
        },
      },
    },
    legend: { position: 'bottom', fontSize: '11px', fontWeight: 600, markers: { size: 5 }, itemMargin: { horizontal: 8, vertical: 0 } },
    stroke: { show: false },
    tooltip: { y: { formatter: (v: number) => `${v} users` } },
  };

  const readDonutOpts: ApexCharts.ApexOptions = {
    chart: { type: 'donut', animations: { enabled: true, easing: 'easeinout', speed: 1000 } },
    labels: ['Fully Read', 'Partially Read', 'Skipped'],
    colors: ['#10b981', '#f59e0b', '#ef4444'],
    dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%', style: { fontSize: '11px', fontWeight: 700, colors: ['#fff'] } },
    plotOptions: {
      pie: {
        donut: {
          size: '55%',
          labels: {
            show: true,
            name: { show: true, fontSize: '11px', fontWeight: 700 },
            value: { show: true, fontSize: '18px', fontWeight: 900 },
            total: { show: true, label: 'Total', fontSize: '10px', fontWeight: 700, formatter: () => String(donutTotal) },
          },
        },
      },
    },
    legend: { position: 'bottom', fontSize: '11px', fontWeight: 600, markers: { size: 5 }, itemMargin: { horizontal: 8, vertical: 0 } },
    stroke: { show: false },
    tooltip: { y: { formatter: (v: number) => `${v} documents` } },
  };

  const contentBarOpts: ApexCharts.ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 800 } },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '55%' } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: mostEngagedContent.slice(0, 8).map((c) => (c.title.length > 28 ? c.title.substring(0, 26) + '…' : c.title)),
      labels: { style: { fontSize: '10px', fontWeight: 600 } },
    },
    yaxis: { labels: { style: { fontSize: '10px', fontWeight: 600 } } },
    colors: ['#6366f1'],
    grid: { borderColor: '#e5e7eb', strokeDashArray: 3 },
    tooltip: { y: { formatter: (v: number) => `${v} views` } },
  };

  // ── Loading ──
  if (applicantsLoading || engagementLoading) {
    return (
      <div className="space-y-5 max-w-screen-2xl mx-auto pb-10">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">
            Engagement Analytics
          </h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Loading engagement insights...
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl h-72 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-screen-2xl mx-auto pb-10">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">
            Engagement Analytics
          </h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Deep insights into investor engagement and content performance
          </p>
        </div>
        <div className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
          {applicants.length} investors analyzed
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 1 — Key Metrics (compact cards)
         ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Active This Month */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl px-4 py-3.5 shadow-sm">
          <p className="text-neutral-400 dark:text-neutral-500 text-[9px] font-bold tracking-[0.12em] uppercase mb-1">Active This Month</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">{activeMetrics.thisMonth}</span>
            <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">investors</span>
          </div>
          <div className="flex gap-3 mt-2 text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            <span>Today: <strong className="text-neutral-900 dark:text-white">{activeMetrics.today}</strong></span>
            <span>Week: <strong className="text-neutral-900 dark:text-white">{activeMetrics.thisWeek}</strong></span>
          </div>
        </div>

        {/* Total Interactions */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl px-4 py-3.5 shadow-sm">
          <p className="text-neutral-400 dark:text-neutral-500 text-[9px] font-bold tracking-[0.12em] uppercase mb-1">Total Interactions</p>
          <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">{interactionMetrics.total.toLocaleString()}</span>
          <p className="text-neutral-500 text-[10px] font-medium mt-1 opacity-70">across all users</p>
        </div>

        {/* Verified Rate */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl px-4 py-3.5 shadow-sm">
          <p className="text-neutral-400 dark:text-neutral-500 text-[9px] font-bold tracking-[0.12em] uppercase mb-1">Verified Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
              {statusBreakdown.total > 0 ? Math.round((statusBreakdown.verified / statusBreakdown.total) * 100) : 0}%
            </span>
          </div>
          <p className="text-neutral-500 text-[10px] font-medium mt-1 opacity-70">
            {statusBreakdown.verified} of {statusBreakdown.total} users
          </p>
        </div>

        {/* Avg Engagement Score */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl px-4 py-3.5 shadow-sm">
          <p className="text-neutral-400 dark:text-neutral-500 text-[9px] font-bold tracking-[0.12em] uppercase mb-1">Avg Engagement Score</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">{avgScore}</span>
            <span className="text-[9px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full">/ 100</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-blue-500/70 rounded-full transition-all" style={{ width: `${avgScore}%` }} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 2 — Engagement Distribution + User Status (2-col)
         ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Score Distribution — wider */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-4">
          <h3 className="text-[11px] font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.08em] mb-3">
            Engagement Score Distribution
          </h3>
          <div className="w-full overflow-hidden">
            <Chart options={scoreBarOpts} series={[{ name: 'Investors', data: scoreDistribution.map((d) => d.count) }]} type="bar" height={220} />
          </div>
          {/* Level legend */}
          <div className="flex items-center gap-4 mt-2 px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Low ({engagementLevels.low})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Medium ({engagementLevels.medium})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">High ({engagementLevels.high})</span>
            </div>
          </div>
        </div>

        {/* User Status Donut — narrower */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-4 flex flex-col">
          <h3 className="text-[11px] font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.08em] mb-3">
            User Status Breakdown
          </h3>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <Chart options={statusDonutOpts} series={[statusBreakdown.verified, statusBreakdown.unverified]} type="donut" width="100%" height={230} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 3 — Content Readership + Top Performing Content
         ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Reading Status Donut */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-4 flex flex-col">
          <h3 className="text-[11px] font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.08em] mb-3">
            Content Read Status
          </h3>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <Chart
              options={readDonutOpts}
              series={[contentEngagement.fullyRead, contentEngagement.partiallyRead, contentEngagement.skipped]}
              type="donut"
              width="100%"
              height={230}
            />
          </div>
        </div>

        {/* Top Performing Content (bar + list) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-4">
          <h3 className="text-[11px] font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.08em] mb-3">
            Top Performing Content
          </h3>
          <div className="overflow-hidden">
            <Chart
              options={contentBarOpts}
              series={[{ name: 'Views', data: mostEngagedContent.slice(0, 8).map((c) => c.views) }]}
              type="bar"
              height={220}
            />
          </div>
          {/* Compact list underneath */}
          <div className="mt-3 space-y-1.5 max-h-[180px] overflow-y-auto">
            {mostEngagedContent.slice(0, 8).map((content, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <span className="text-[10px] font-black text-neutral-400 w-5 text-right">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-neutral-900 dark:text-white truncate">{content.title}</p>
                  <p className="text-[9px] text-neutral-500 dark:text-neutral-400">
                    {content.readPercentage}% read · {content.interactions} interactions
                  </p>
                </div>
                <span className="text-[10px] font-black text-neutral-600 dark:text-neutral-300 whitespace-nowrap">{content.views} views</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 4 — Interaction Breakdown (compact cards)
         ══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-4">
        <h3 className="text-[11px] font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.08em] mb-3">
          Interaction Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {[
            { label: 'Comments', value: interactionMetrics.comments, icon: '💬', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
            { label: 'Likes', value: interactionMetrics.likes, icon: '👍', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
            { label: 'RSVPs', value: interactionMetrics.rsvps, icon: '📅', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
            { label: 'Meetings', value: interactionMetrics.meetingRequests, icon: '🤝', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
            { label: 'Doc Views', value: contentEngagement.fullyRead + contentEngagement.partiallyRead + contentEngagement.skipped, icon: '📄', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
            { label: 'Total', value: interactionMetrics.total, icon: '📊', color: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400' },
          ].map((item) => (
            <div key={item.label} className={`rounded-lg p-3 text-center ${item.color}`}>
              <span className="text-lg">{item.icon}</span>
              <div className="text-xl font-black mt-1">{item.value.toLocaleString()}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-80">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 5 — Engagement Score Formula Reference
         ══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-4">
        <h3 className="text-[11px] font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.08em] mb-2.5">
          Engagement Score Formula
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { action: 'Document View', pts: '1 pt' },
            { action: 'Reaction', pts: '2 pts' },
            { action: 'Download', pts: '3 pts' },
            { action: 'Comment', pts: '5 pts' },
            { action: 'Event Request', pts: '5 pts' },
            { action: 'Meeting Request', pts: '8 pts' },
            { action: 'Event Joined', pts: '10 pts' },
            { action: 'Login', pts: '0.5 pt' },
          ].map((item) => (
            <span
              key={item.action}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/40"
            >
              <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300">{item.action}</span>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{item.pts}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/40">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Max Score: 100</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default EngagementAnalyticsPage;
