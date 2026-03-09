'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Applicant, EngagementRecord, EngagementLevel, UserActivity } from '../lib/types';
import Chart from 'react-apexcharts';
import { ResponsiveContainer, AreaChart, Area, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import {
  generateEngagementRecords,
  generateMostEngagedContent,
  generateUserActivities,
  generateActiveInvestorsMetrics,
  generateContentEngagementData,
  generateInteractionMetrics,
} from '../lib/engagementService';

// ── Constants ───────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const DOCUMENT_TITLES = [
  'Q4 2025 Earnings Report',
  'ESG Impact Report 2025',
  'Dividend Declaration – FY2025',
  'Board Governance Charter Update',
  'Annual General Meeting Notice 2026',
  'Strategic Partnership Press Release',
  'Q3 2025 Investor Presentation',
  'Material Information Disclosure',
  'Sustainability Roadmap 2026',
  'Corporate Governance Report',
];


// ── Helper Components ───────────────────────────────────────────────────

// ── Helper Components ───────────────────────────────────────────────────

type SortField =
  | 'investorName'
  | 'investorType'
  | 'lastActive'
  | 'recentlyViewed'
  | 'readCompletion'
  | 'interactions'
  | 'comments'
  | 'eventActivity'
  | 'engagementScore';

type SortDirection = 'asc' | 'desc';

const EngagementScoreBadge: React.FC<{ level: EngagementLevel; score: number }> = ({ level, score }) => {
  const colors: Record<EngagementLevel, string> = {
    high: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    low: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[level]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${level === 'high' ? 'bg-emerald-500' : level === 'medium' ? 'bg-amber-500' : 'bg-red-500'}`} />
      {score}
    </span>
  );
};

const ReadCompletionBar: React.FC<{ percent: number }> = ({ percent }) => {
  const color = percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden max-w-[60px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">{percent}%</span>
    </div>
  );
};

const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};


// ── Main Component ──────────────────────────────────────────────────────

interface InvestorActivityPageProps {
  applicants: Applicant[];
  applicantsLoading: boolean;
}

const InvestorActivityPage: React.FC<InvestorActivityPageProps> = ({ applicants, applicantsLoading }) => {
  // ─ State ─
  const [searchQuery, setSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [engagementLevelFilter, setEngagementLevelFilter] = useState<'all' | EngagementLevel>('all');
  const [sortField, setSortField] = useState<SortField>('engagementScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvestor, setSelectedInvestor] = useState<EngagementRecord | null>(null);
  const [engagementRecords, setEngagementRecords] = useState<EngagementRecord[]>([]);
  const [engagementLoading, setEngagementLoading] = useState(true);

  // IRO Reply state
  const [replyingToActivityId, setReplyingToActivityId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [activitiesWithReplies, setActivitiesWithReplies] = useState<Map<string, UserActivity>>(new Map());

  // User Activity Log filters
  const [activityTypeFilter, setActivityTypeFilter] = useState<'all' | 'comment' | 'reaction' | 'view' | 'login' | 'download'>('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [activityDateFilter, setActivityDateFilter] = useState<string>('');
  const [activitySortOrder, setActivitySortOrder] = useState<'newest' | 'oldest'>('newest');
  const [activityPage, setActivityPage] = useState(1);

  // Refs
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const userActivityLogRef = useRef<HTMLDivElement>(null);

  // Scroll to User Activity Log section if sessionStorage flag is set
  useEffect(() => {
    const scrollTarget = sessionStorage.getItem('scrollTo');
    if (scrollTarget === 'user-activity-log') {
      sessionStorage.removeItem('scrollTo');
      // Wait for the page to fully render before scrolling
      setTimeout(() => {
        userActivityLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, []);

  // ─ Data generation ─
  useEffect(() => {
    let isMounted = true;
    setEngagementLoading(true);
    generateEngagementRecords(applicants).then((records) => {
      if (isMounted) {
        setEngagementRecords(records);
        setEngagementLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [applicants]);

  const activeMetrics = useMemo(() => generateActiveInvestorsMetrics(engagementRecords), [engagementRecords]);
  const contentEngagement = useMemo(() => generateContentEngagementData(engagementRecords), [engagementRecords]);
  const mostEngagedContent = useMemo(() => generateMostEngagedContent(engagementRecords), [engagementRecords]);
  const interactionMetrics = useMemo(() => generateInteractionMetrics(engagementRecords), [engagementRecords]);
  const baseUserActivities = useMemo(() => generateUserActivities(engagementRecords), [engagementRecords]);
  
  // Merge base activities with replies
  const userActivities = useMemo(() => {
    return baseUserActivities.map((activity) => {
      const activityWithReplies = activitiesWithReplies.get(activity.id);
      return activityWithReplies || activity;
    });
  }, [baseUserActivities, activitiesWithReplies]);

  // Filtered and sorted user activities
  const filteredUserActivities = useMemo(() => {
    let filtered = [...userActivities];

    // Filter by activity type
    if (activityTypeFilter !== 'all') {
      if (activityTypeFilter === 'reaction') {
        filtered = filtered.filter((a) => a.activityType === 'reaction');
      } else {
        filtered = filtered.filter((a) => a.activityType === activityTypeFilter);
      }
    }

    // Filter by user search query
    if (userSearchQuery.trim()) {
      const query = userSearchQuery.toLowerCase();
      filtered = filtered.filter((a) => a.userName.toLowerCase().includes(query));
    }

    // Filter by date
    if (activityDateFilter) {
      const filterDate = new Date(activityDateFilter);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filtered = filtered.filter((a) => {
        const activityDate = new Date(a.timestamp);
        activityDate.setHours(0, 0, 0, 0);
        return activityDate >= filterDate && activityDate < nextDay;
      });
    }

    // Sort by timestamp
    filtered.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return activitySortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return filtered;
  }, [userActivities, activityTypeFilter, userSearchQuery, activityDateFilter, activitySortOrder]);

  // Initialize activities with replies from localStorage (persist replies)
  useEffect(() => {
    const savedReplies = localStorage.getItem('eurolandhub_iro_replies');
    if (savedReplies) {
      try {
        const parsed = JSON.parse(savedReplies);
        const map = new Map<string, UserActivity>();
        Object.entries(parsed).forEach(([id, activity]) => {
          map.set(id, activity as UserActivity);
        });
        setActivitiesWithReplies(map);
      } catch (e) {
        console.error('Failed to load saved replies:', e);
      }
    }
  }, []);

  // ─ Filtered & sorted table data ─
  const filteredAndSortedData = useMemo(() => {
    let data = [...engagementRecords];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (r) =>
          r.investorName.toLowerCase().includes(q) ||
          r.investorEmail.toLowerCase().includes(q) ||
          r.investorId.toLowerCase().includes(q)
      );
    }

    // User status filter
    if (userStatusFilter !== 'all') {
      data = data.filter((r) => r.userStatus === userStatusFilter);
    }

    // Engagement level filter
    if (engagementLevelFilter !== 'all') {
      data = data.filter((r) => r.engagementLevel === engagementLevelFilter);
    }

    // Sort
    data.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      switch (sortField) {
        case 'investorName':
          aVal = a.investorName.toLowerCase();
          bVal = b.investorName.toLowerCase();
          break;
        case 'userStatus':
          // Down arrow (desc) = Verified first, Up arrow (asc) = Unverified first
          aVal = a.userStatus === 'verified' ? 0 : 1;
          bVal = b.userStatus === 'verified' ? 0 : 1;
          break;
        case 'lastActive':
          aVal = new Date(a.lastActive).getTime();
          bVal = new Date(b.lastActive).getTime();
          break;
        case 'recentlyViewed':
          aVal = a.recentlyViewed?.documentTitle || '';
          bVal = b.recentlyViewed?.documentTitle || '';
          break;
        case 'readCompletion':
          aVal = a.recentlyViewed?.readCompletion || 0;
          bVal = b.recentlyViewed?.readCompletion || 0;
          break;
        case 'interactions':
          aVal = a.interactions.likes + a.interactions.comments + a.interactions.reactions;
          bVal = b.interactions.likes + b.interactions.comments + b.interactions.reactions;
          break;
        case 'comments':
          aVal = a.interactions.comments;
          bVal = b.interactions.comments;
          break;
        case 'eventActivity':
          aVal = a.eventActivity.joined + a.eventActivity.requested;
          bVal = b.eventActivity.joined + b.eventActivity.requested;
          break;
        case 'engagementScore':
          aVal = a.engagementScore;
          bVal = b.engagementScore;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [engagementRecords, searchQuery, userStatusFilter, engagementLevelFilter, sortField, sortDirection]);

  // ─ Pagination ─
  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredAndSortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, userStatusFilter, engagementLevelFilter]);

  // ─ Handlers ─
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleCreateEvent = useCallback(
    async (data: {
      title: string;
      description: string;
      eventType: IREventType;
      dateTime: string;
      endDateTime?: string;
      location?: string;
      meetingLink?: string;
      participantMode: ParticipantMode;
      selectedParticipants: string[];
    }) => {
      // Determine invited list based on participant mode
      let invited: string[] = [];
      if (data.participantMode === 'all') {
        invited = applicants.map((a) => a.id);
      } else if (data.participantMode === 'vip') {
        invited = engagementRecords
          .filter((r) => r.engagementLevel === 'high')
          .map((r) => r.investorId);
      } else {
        invited = data.selectedParticipants;
      }

      await eventService.create({
        title: data.title,
        description: data.description,
        eventType: data.eventType,
        dateTime: data.dateTime,
        endDateTime: data.endDateTime,
        location: data.location,
        meetingLink: data.meetingLink,
        createdBy: 'iro-admin',
        participantMode: data.participantMode,
        invitations: {
          invited,
          accepted: [],
          declined: [],
          pending: [...invited],
        },
      });

      setEventToast({ show: true, message: `Event "${data.title}" created successfully`, type: 'success' });
    },
    [applicants, engagementRecords]
  );

  // IRO Reply handlers
  const handleReply = useCallback((activityId: string) => {
    setReplyingToActivityId(activityId);
    setReplyText('');
  }, []);

  const handleSendReply = useCallback((activityId: string) => {
    if (!replyText.trim()) return;

    const activity = userActivities.find((a) => a.id === activityId);
    if (!activity) return;

    const newReply = {
      id: `reply-${Date.now()}`,
      replyText: replyText.trim(),
      repliedBy: 'IRO Team', // In production, get from auth context
      repliedAt: new Date().toISOString(),
    };

    const updatedActivity: UserActivity = {
      ...activity,
      replies: [...(activity.replies || []), newReply],
    };

    const updatedMap = new Map(activitiesWithReplies);
    updatedMap.set(activityId, updatedActivity);
    setActivitiesWithReplies(updatedMap);

    // Persist to localStorage
    const toSave: Record<string, UserActivity> = {};
    updatedMap.forEach((act, id) => {
      toSave[id] = act;
    });
    localStorage.setItem('eurolandhub_iro_replies', JSON.stringify(toSave));

    setReplyingToActivityId(null);
    setReplyText('');
  }, [replyText, userActivities, activitiesWithReplies]);

  const handleCancelReply = useCallback(() => {
    setReplyingToActivityId(null);
    setReplyText('');
  }, []);

  // ─ Sort icon ─
  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 text-neutral-300 dark:text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // ─ Donut chart config ─
  const donutTotal = contentEngagement.fullyRead + contentEngagement.partiallyRead + contentEngagement.skipped;
  const donutChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      animations: { enabled: true, easing: 'easeinout', speed: 1500 },
      sparkline: { enabled: false },
    },
    labels: ['Fully Read', 'Partially Read', 'Skipped'],
    colors: ['#10b981', '#f59e0b', '#ef4444'],
    dataLabels: {
      enabled: true,
      formatter: (val: number) => Math.round(val) + '%',
      style: { fontSize: '10px', fontWeight: 700, fontFamily: 'Inter, sans-serif', colors: ['#fff'] },
      dropShadow: { enabled: true, top: 1, left: 1, blur: 3, opacity: 0.3 },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '60%',
          labels: {
            show: true,
            name: { show: true, fontSize: '11px', fontWeight: 700, color: undefined },
            value: { show: true, fontSize: '16px', fontWeight: 900, color: undefined },
            total: {
              show: true,
              label: 'Total',
              fontSize: '10px',
              fontWeight: 700,
              formatter: () => String(donutTotal),
            },
          },
        },
      },
    },
    legend: {
      position: 'bottom',
      fontSize: '10px',
      fontWeight: 700,
      labels: { colors: undefined, useSeriesColors: false },
      markers: { size: 4 },
      itemMargin: { horizontal: 8, vertical: 2 },
    },
    stroke: { show: false },
    tooltip: { enabled: true, y: { formatter: (val: number) => `${val} documents` } },
  };

  // ─ Bar chart config ─
  const barChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 1200 },
    },
    plotOptions: {
      bar: { horizontal: true, borderRadius: 4, barHeight: '60%' },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: mostEngagedContent.map((c) => c.title.length > 24 ? c.title.substring(0, 22) + '…' : c.title),
      labels: { style: { fontSize: '10px', fontWeight: 600 } },
    },
    yaxis: { labels: { style: { fontSize: '10px', fontWeight: 600 } } },
    colors: ['#3b82f6'],
    grid: { borderColor: '#e5e5e5', strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    tooltip: {
      y: { formatter: (val: number) => `${val} views` },
    },
  };

  // ─ Sparkline data for interaction card ─
  const sparklineData = interactionMetrics.chartData.map((val, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { value: val, date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
  });

  // ─ Loading state ─
  if (applicantsLoading || engagementLoading) {
    return (
      <div className="space-y-8 max-w-screen-2xl mx-auto">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">Engagement</h2>
            <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
              Track investor engagement and interactions
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl h-[200px] animate-pulse" />
          ))}
        </div>
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl h-[400px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto pb-12">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">
            Investor Activity
          </h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Monitor investor activity, track interactions & respond to inquiries
          </p>
        </div>
        <div className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
          {applicants.length} investors tracked
        </div>
      </div>

     

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1: ENGAGEMENT SUMMARY (4 Analytics Cards)
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Investors */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl p-5 shadow-md hover:border-neutral-300 dark:hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5 h-[200px] flex flex-col justify-between">
          <div>
            <h3 className="text-neutral-400 dark:text-neutral-500 text-[10px] font-bold mb-1.5 tracking-[0.12em] uppercase">
              Active Investors
            </h3>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                {activeMetrics.thisMonth}
              </span>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                This month
              </span>
            </div>
            <p className="text-neutral-500 dark:text-neutral-500 text-[11px] font-medium opacity-70">
              active shareholders
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2">
              <div className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Today</div>
              <div className="text-lg font-black text-neutral-900 dark:text-white">{activeMetrics.today}</div>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2">
              <div className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">This Week</div>
              <div className="text-lg font-black text-neutral-900 dark:text-white">{activeMetrics.thisWeek}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Content Engagement Rate (Donut) */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl p-5 shadow-md hover:border-neutral-300 dark:hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5 h-[200px] flex flex-col">
          <h3 className="text-neutral-400 dark:text-neutral-500 text-[10px] font-bold mb-1 tracking-[0.12em] uppercase">
            Content Engagement Rate
          </h3>
          <div className="flex-1 min-h-0">
            <Chart
              options={donutChartOptions}
              series={[contentEngagement.fullyRead, contentEngagement.partiallyRead, contentEngagement.skipped]}
              type="donut"
              height="100%"
            />
          </div>
        </div>

        {/* Card 3: Most Engaged Content (Bar Chart) */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl p-5 shadow-md hover:border-neutral-300 dark:hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5 h-[200px] flex flex-col">
          <h3 className="text-neutral-400 dark:text-neutral-500 text-[10px] font-bold mb-1 tracking-[0.12em] uppercase">
            Most Engaged Content
          </h3>
          <div className="flex-1 min-h-0">
            <Chart
              options={barChartOptions}
              series={[{ name: 'Views', data: mostEngagedContent.map((c) => c.views) }]}
              type="bar"
              height="100%"
            />
          </div>
        </div>

        {/* Card 4: Investor Interaction Activity */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl p-5 shadow-md hover:border-neutral-300 dark:hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5 h-[200px] flex flex-col justify-between relative overflow-hidden">
          <div className="z-10 relative">
            <h3 className="text-neutral-400 dark:text-neutral-500 text-[10px] font-bold mb-1.5 tracking-[0.12em] uppercase">
              Interaction Activity
            </h3>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                {interactionMetrics.total.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full">Total</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1 z-10 relative">
            {[
              { label: 'Comments', value: interactionMetrics.comments },
              { label: 'Likes', value: interactionMetrics.likes },
              { label: 'RSVPs', value: interactionMetrics.rsvps },
              { label: 'Meetings', value: interactionMetrics.meetingRequests },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-sm font-black text-neutral-900 dark:text-white">{item.value}</div>
                <div className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{item.label}</div>
              </div>
            ))}
          </div>
          {/* Sparkline background */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] opacity-30">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="interactionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#interactionGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2: ENGAGEMENT ACTIVITY MONITOR
         ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm overflow-hidden">
        {/* Section Header & Filters */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Engagement Activity Monitor
            </h3>
            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              {filteredAndSortedData.length} investors
            </span>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* User Status Filter */}
            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value as 'all' | 'verified' | 'unverified')}
              className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            >
              <option value="all">All</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>

            {/* Engagement Level Filter */}
            <select
              value={engagementLevelFilter}
              onChange={(e) => setEngagementLevelFilter(e.target.value as 'all' | EngagementLevel)}
              className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            >
              <option value="all">All Levels</option>
              <option value="high">High Engagement</option>
              <option value="medium">Medium Engagement</option>
              <option value="low">Low Engagement</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                {[
                  { field: 'investorName' as SortField, label: 'Investor' },
                  { field: 'userStatus' as SortField, label: 'Type' },
                  { field: 'lastActive' as SortField, label: 'Last Active' },
                  { field: 'recentlyViewed' as SortField, label: 'Recently Viewed' },
                  { field: 'readCompletion' as SortField, label: 'Read %' },
                  { field: 'interactions' as SortField, label: 'Interactions' },
                  { field: 'comments' as SortField, label: 'Comments' },
                  { field: 'eventActivity' as SortField, label: 'Events' },
                  { field: 'engagementScore' as SortField, label: 'Score' },
                ].map((col) => (
                  <th
                    key={col.field}
                    onClick={() => handleSort(col.field)}
                    className="px-4 py-3 text-left text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon field={col.field} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
              {paginatedData.map((record) => (
                <tr
                  key={record.investorId}
                  onClick={() => setSelectedInvestor(record)}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-700/30 cursor-pointer transition-colors"
                >
                  {/* Investor Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {record.investorName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[140px]">
                          {record.investorName}
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-[140px]">
                          {record.investorEmail}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Type */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        record.userStatus === 'verified'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {record.userStatus === 'verified' ? 'Verified' : 'Unverified'}
                    </span>
                  </td>
                  {/* Last Active */}
                  <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                    {formatRelativeTime(record.lastActive)}
                  </td>
                  {/* Recently Viewed */}
                  <td className="px-4 py-3">
                    {record.recentlyViewed ? (
                      <div className="text-xs text-neutral-700 dark:text-neutral-300 truncate max-w-[150px]" title={record.recentlyViewed.documentTitle}>
                        {record.recentlyViewed.documentTitle}
                      </div>
                    ) : (
                      <span className="text-[10px] text-neutral-400">—</span>
                    )}
                  </td>
                  {/* Read Completion */}
                  <td className="px-4 py-3">
                    {record.recentlyViewed ? (
                      <ReadCompletionBar percent={record.recentlyViewed.readCompletion} />
                    ) : (
                      <span className="text-[10px] text-neutral-400">—</span>
                    )}
                  </td>
                  {/* Interactions */}
                  <td className="px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                    {record.interactions.likes + record.interactions.comments + record.interactions.reactions}
                  </td>
                  {/* Comments */}
                  <td className="px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                    {record.interactions.comments}
                  </td>
                  {/* Event Activity */}
                  <td className="px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300">
                    <span className="font-medium">{record.eventActivity.joined}</span>
                    <span className="text-neutral-400 dark:text-neutral-500"> / {record.eventActivity.requested}</span>
                  </td>
                  {/* Engagement Score */}
                  <td className="px-4 py-3">
                    <EngagementScoreBadge level={record.engagementLevel} score={record.engagementScore} />
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInvestor(record);
                      }}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 uppercase tracking-wider transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">No investors match your filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedData.length)} of {filteredAndSortedData.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 text-xs font-bold rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3: USER ACTIVITY LOG
         ══════════════════════════════════════════════════════════════ */}
      <div id="user-activity-log" ref={userActivityLogRef} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm overflow-hidden">
        {/* Section Header & Filters */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              User Activity Log
            </h3>
            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              {filteredUserActivities.length} activities
            </span>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Activity Type Filter */}
            <select
              value={activityTypeFilter}
              onChange={(e) => {
                setActivityTypeFilter(e.target.value as 'all' | 'comment' | 'reaction' | 'view' | 'login' | 'download');
                setActivityPage(1);
              }}
              className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            >
              <option value="all">All (Present to Oldest)</option>
              <option value="comment">Comments Only</option>
              <option value="reaction">Likes Only</option>
              <option value="view">Viewed Only</option>
              <option value="login">Logged (Login/Logout)</option>
              <option value="download">Download Only</option>
            </select>

            {/* User Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search users..."
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  setActivityPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Date Filter */}
            <input
              type="date"
              value={activityDateFilter}
              min="2026-01-01"
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                setActivityDateFilter(e.target.value);
                setActivityPage(1);
              }}
              className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            />

            {/* Sort Order Filter */}
            <select
              value={activitySortOrder}
              onChange={(e) => {
                setActivitySortOrder(e.target.value as 'newest' | 'oldest');
                setActivityPage(1);
              }}
              className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            >
              <option value="newest">Newest (Present to Oldest)</option>
              <option value="oldest">Oldest to Present</option>
            </select>
          </div>
        </div>

        {/* Activity Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-4 py-3 text-left text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Content
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
              {filteredUserActivities
                .slice((activityPage - 1) * ITEMS_PER_PAGE, activityPage * ITEMS_PER_PAGE)
                .map((activity) => {
                  // Get activity with replies if exists
                  const activityWithReplies = activitiesWithReplies.get(activity.id) || activity;
                  const hasReplies = activityWithReplies.replies && activityWithReplies.replies.length > 0;
                  const getActivityIcon = () => {
                    const iconClass = "w-5 h-5 text-neutral-600 dark:text-neutral-400";
                    switch (activity.activityType) {
                      case 'view':
                        return <span className="text-lg">👁</span>;
                      case 'comment':
                        return <span className="text-lg">💬</span>;
                      case 'download':
                        return (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        );
                      case 'reaction':
                        // Check if it's a like or dislike based on details or use like by default
                        const isDislike = activity.details?.toLowerCase().includes('dislike') || false;
                        if (isDislike) {
                          return (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54" />
                            </svg>
                          );
                        }
                        return (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
                          </svg>
                        );
                      case 'login':
                        // Check if it's login or logout based on details
                        const isLogout = activity.details?.toLowerCase().includes('logout') || activity.details?.toLowerCase().includes('logged out') || false;
                        if (isLogout) {
                          return (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
                            </svg>
                          );
                        }
                        return (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                          </svg>
                        );
                      case 'registration':
                        return <span className="text-lg">📝</span>;
                      default:
                        return <span className="text-lg">📄</span>;
                    }
                  };

                  const getActivityLabel = () => {
                    switch (activity.activityType) {
                      case 'view':
                        return 'Viewed';
                      case 'comment':
                        return 'Commented';
                      case 'download':
                        return 'Downloaded';
                      case 'reaction':
                        const isDislike = activity.details?.toLowerCase().includes('dislike') || false;
                        return isDislike ? 'Disliked' : 'Liked';
                      case 'login':
                        const isLogout = activity.details?.toLowerCase().includes('logout') || activity.details?.toLowerCase().includes('logged out') || false;
                        return isLogout ? 'Logged out' : 'Logged in';
                      case 'registration':
                        return 'Registered';
                      default:
                        return 'Interacted';
                    }
                  };

                  return (
                    <React.Fragment key={activity.id}>
                      <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                              {activity.userName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[140px]">
                                {activity.userName}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span
                                  className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                    activity.userStatus === 'verified'
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                                  }`}
                                >
                                  {activity.userStatus === 'verified' ? 'Verified' : 'Unverified'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center">{getActivityIcon()}</span>
                            <span className="text-xs text-neutral-700 dark:text-neutral-300">{getActivityLabel()}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {activity.contentTitle ? (
                            <div className="text-xs text-neutral-700 dark:text-neutral-300 truncate max-w-[200px]" title={activity.contentTitle}>
                              {activity.contentTitle}
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                          {formatRelativeTime(activity.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          {(activity.activityType === 'comment' || activity.activityType === 'interaction') && (
                            <button
                              onClick={() => handleReply(activity.id)}
                              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 uppercase tracking-wider transition-colors"
                            >
                              Reply
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Reply UI row */}
                      {replyingToActivityId === activity.id && (
                        <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="space-y-2">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Type your reply..."
                                className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                                rows={3}
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSendReply(activity.id)}
                                  disabled={!replyText.trim()}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                  Send Reply
                                </button>
                                <button
                                  onClick={handleCancelReply}
                                  className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Display existing replies */}
                      {hasReplies && activityWithReplies.replies && (
                        <tr className="bg-neutral-50/50 dark:bg-neutral-800/30">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="space-y-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                              {activityWithReplies.replies.map((reply) => (
                                <div key={reply.id} className="bg-white dark:bg-neutral-800 rounded-lg p-2.5">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                      IRO Team
                                    </span>
                                    <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
                                      {formatRelativeTime(reply.repliedAt)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                                    {reply.replyText}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              {filteredUserActivities.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">No activities found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {Math.ceil(filteredUserActivities.length / ITEMS_PER_PAGE) > 1 && (
          <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Showing {(activityPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(activityPage * ITEMS_PER_PAGE, filteredUserActivities.length)} of{' '}
              {filteredUserActivities.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                disabled={activityPage === 1}
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Prev
              </button>
              {Array.from(
                { length: Math.min(Math.ceil(filteredUserActivities.length / ITEMS_PER_PAGE), 7) },
                (_, i) => {
                  let pageNum: number;
                  const totalPages = Math.ceil(filteredUserActivities.length / ITEMS_PER_PAGE);
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (activityPage <= 4) {
                    pageNum = i + 1;
                  } else if (activityPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = activityPage - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setActivityPage(pageNum)}
                      className={`w-8 h-8 text-xs font-bold rounded-lg transition-colors ${
                        activityPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
              )}
              <button
                onClick={() => setActivityPage((p) => Math.min(Math.ceil(filteredUserActivities.length / ITEMS_PER_PAGE), p + 1))}
                disabled={activityPage >= Math.ceil(filteredUserActivities.length / ITEMS_PER_PAGE)}
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>


      {/* ══════════════════════════════════════════════════════════════
          USER ACTIVITY DETAIL PANEL (Right-Side Sliding Panel)
         ══════════════════════════════════════════════════════════════ */}
      {selectedInvestor && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setSelectedInvestor(null)}
          />
          {/* Panel */}
          <div
            ref={detailPanelRef}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700 shadow-2xl z-50 overflow-y-auto transition-transform duration-300"
          >
            {/* Panel Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                  Investor Profile
                </h3>
                <button
                  onClick={() => setSelectedInvestor(null)}
                  className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Investor Info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold shrink-0">
                  {selectedInvestor.investorName.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {selectedInvestor.investorName}
                  </h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{selectedInvestor.investorEmail}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      selectedInvestor.userStatus === 'verified'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                    }`}>
                      {selectedInvestor.userStatus === 'verified' ? 'Verified' : 'Unverified'}
                    </span>
                    <EngagementScoreBadge level={selectedInvestor.engagementLevel} score={selectedInvestor.engagementScore} />
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-center">
                  <div className="text-lg font-black text-neutral-900 dark:text-white">{selectedInvestor.documentsViewed.length}</div>
                  <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Docs Viewed</div>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-center">
                  <div className="text-lg font-black text-neutral-900 dark:text-white">
                    {selectedInvestor.interactions.likes + selectedInvestor.interactions.comments + selectedInvestor.interactions.reactions}
                  </div>
                  <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Interactions</div>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-center">
                  <div className="text-lg font-black text-neutral-900 dark:text-white">{selectedInvestor.eventActivity.joined}</div>
                  <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Events</div>
                </div>
              </div>

              {/* Documents Viewed */}
              <div>
                <h5 className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] mb-2">
                  Documents Viewed
                </h5>
                <div className="space-y-2">
                  {selectedInvestor.documentsViewed
                    .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
                    .map((doc, idx) => (
                      <div key={idx} className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate mr-2">
                            {doc.documentTitle}
                          </span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                            {formatRelativeTime(doc.viewedAt)}
                          </span>
                        </div>
                        <ReadCompletionBar percent={doc.readCompletion} />
                      </div>
                    ))}
                </div>
              </div>

              {/* Comments Posted */}
              {selectedInvestor.commentsPosted.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] mb-2">
                    Comments Posted
                  </h5>
                  <div className="space-y-2">
                    {selectedInvestor.commentsPosted.map((comment, idx) => (
                      <div key={idx} className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            {comment.documentTitle}
                          </span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            {formatRelativeTime(comment.postedAt)}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                          "{comment.commentText}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Event Activity */}
              <div>
                <h5 className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] mb-2">
                  Event Activity
                </h5>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-sm font-black text-neutral-900 dark:text-white">{selectedInvestor.eventActivity.joined}</div>
                    <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Events Joined</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-sm font-black text-neutral-900 dark:text-white">{selectedInvestor.eventActivity.requested}</div>
                    <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Requested</div>
                  </div>
                </div>
              </div>

              {/* Meeting Requests */}
              <div>
                <h5 className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] mb-2">
                  Meeting Requests
                </h5>
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                  <div className="text-sm font-black text-neutral-900 dark:text-white">{selectedInvestor.meetingRequests}</div>
                  <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Total meeting requests submitted</div>
                </div>
              </div>

              {/* Interaction Breakdown */}
              <div>
                <h5 className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] mb-2">
                  Interaction Breakdown
                </h5>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-center">
                    <div className="text-sm font-black text-neutral-900 dark:text-white">{selectedInvestor.interactions.likes}</div>
                    <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Likes</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-center">
                    <div className="text-sm font-black text-neutral-900 dark:text-white">{selectedInvestor.interactions.comments}</div>
                    <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Comments</div>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-center">
                    <div className="text-sm font-black text-neutral-900 dark:text-white">{selectedInvestor.interactions.reactions}</div>
                    <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Reactions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default InvestorActivityPage;
