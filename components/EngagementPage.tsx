'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Applicant, EngagementRecord, EngagementLevel, IREvent, IREventType, ParticipantMode } from '../lib/types';
import Chart from 'react-apexcharts';
import { ResponsiveContainer, AreaChart, Area, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import { eventService } from '../services/eventService';
import CreateEventModal from './CreateEventModal';

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

const EVENT_TYPE_LABELS: Record<IREventType, string> = {
  meeting: 'Meeting',
  briefing: 'Briefing',
  webinar: 'Webinar',
  earnings_discussion: 'Earnings',
  other: 'Other',
};

// ── Seeded Random ───────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

// ── Mock Data Generators ────────────────────────────────────────────────

function generateEngagementRecords(applicants: Applicant[]): EngagementRecord[] {
  return applicants.map((applicant, idx) => {
    const seed = idx * 17 + applicant.id.charCodeAt(0);
    const isOfficial = applicant.holdingsRecord !== undefined || applicant.isPreVerified === true;

    const docCount = seededInt(seed + 1, 1, 6);
    const documentsViewed = Array.from({ length: docCount }, (_, i) => {
      const docSeed = seed + i * 7;
      return {
        documentId: `doc-${seededInt(docSeed, 1, 8)}`,
        documentTitle: DOCUMENT_TITLES[seededInt(docSeed + 2, 0, DOCUMENT_TITLES.length - 1)],
        readCompletion: seededInt(docSeed + 3, 10, 100),
        viewedAt: new Date(Date.now() - seededInt(docSeed + 4, 0, 30) * 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    const recentDoc = documentsViewed.sort(
      (a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
    )[0];

    const likes = seededInt(seed + 10, 0, 45);
    const comments = seededInt(seed + 11, 0, 20);
    const reactions = seededInt(seed + 12, 0, 30);
    const joined = seededInt(seed + 13, 0, 8);
    const requested = seededInt(seed + 14, 0, 3);
    const meetingRequests = seededInt(seed + 15, 0, 4);

    // Calculate engagement score based on multiple factors
    const readAvg = documentsViewed.reduce((sum, d) => sum + d.readCompletion, 0) / documentsViewed.length;
    const interactionScore = Math.min(100, (likes + comments * 3 + reactions * 2) * 1.5);
    const eventScore = Math.min(100, (joined * 10 + requested * 5 + meetingRequests * 8));
    const engagementScore = Math.round(readAvg * 0.35 + interactionScore * 0.35 + eventScore * 0.3);

    const engagementLevel: EngagementLevel = engagementScore >= 65 ? 'high' : engagementScore >= 35 ? 'medium' : 'low';

    const commentsPosted = Array.from({ length: Math.min(comments, 5) }, (_, i) => {
      const cSeed = seed + 20 + i;
      const commentTexts = [
        'Great transparency in the quarterly report.',
        'Looking forward to the dividend payout.',
        'The ESG initiatives are impressive.',
        'Can we get more details on the expansion strategy?',
        'Strong financial position this quarter.',
        'Governance improvements are noted.',
        'The digital transformation is showing results.',
        'Well-executed retail expansion strategy.',
      ];
      return {
        documentTitle: DOCUMENT_TITLES[seededInt(cSeed, 0, DOCUMENT_TITLES.length - 1)],
        commentText: commentTexts[seededInt(cSeed + 1, 0, commentTexts.length - 1)],
        postedAt: new Date(Date.now() - seededInt(cSeed + 2, 0, 30) * 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    // Parse lastActive to compute a proper timestamp
    let lastActiveDate: Date;
    const now = new Date();
    if (applicant.lastActive.includes('hour')) {
      const hours = parseInt(applicant.lastActive) || 1;
      lastActiveDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
    } else if (applicant.lastActive.includes('day')) {
      const days = parseInt(applicant.lastActive) || 1;
      lastActiveDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    } else if (applicant.lastActive.includes('week')) {
      const weeks = parseInt(applicant.lastActive) || 1;
      lastActiveDate = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    } else if (applicant.lastActive.includes('month')) {
      const months = parseInt(applicant.lastActive) || 1;
      lastActiveDate = new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    } else {
      lastActiveDate = new Date(applicant.lastActive);
      if (isNaN(lastActiveDate.getTime())) {
        lastActiveDate = new Date(now.getTime() - seededInt(seed + 30, 0, 14) * 24 * 60 * 60 * 1000);
      }
    }

    return {
      investorId: applicant.id,
      investorName: applicant.fullName,
      investorEmail: applicant.email,
      investorType: isOfficial ? 'official' : 'guest',
      profilePictureUrl: applicant.profilePictureUrl,
      lastActive: lastActiveDate.toISOString(),
      recentlyViewed: recentDoc
        ? {
            documentId: recentDoc.documentId,
            documentTitle: recentDoc.documentTitle,
            readCompletion: recentDoc.readCompletion,
          }
        : undefined,
      documentsViewed,
      interactions: { likes, comments, reactions },
      commentsPosted,
      eventActivity: { joined, requested },
      meetingRequests,
      engagementScore,
      engagementLevel,
    };
  });
}

function generateActiveInvestorsMetrics(records: EngagementRecord[]) {
  const now = Date.now();
  const today = records.filter((r) => now - new Date(r.lastActive).getTime() < 24 * 60 * 60 * 1000).length;
  const thisWeek = records.filter((r) => now - new Date(r.lastActive).getTime() < 7 * 24 * 60 * 60 * 1000).length;
  const thisMonth = records.filter((r) => now - new Date(r.lastActive).getTime() < 30 * 24 * 60 * 60 * 1000).length;
  return { today, thisWeek, thisMonth };
}

function generateContentEngagementData(records: EngagementRecord[]) {
  let fullyRead = 0;
  let partiallyRead = 0;
  let skipped = 0;
  records.forEach((r) => {
    r.documentsViewed.forEach((d) => {
      if (d.readCompletion >= 80) fullyRead++;
      else if (d.readCompletion >= 30) partiallyRead++;
      else skipped++;
    });
  });
  return { fullyRead, partiallyRead, skipped };
}

function generateMostEngagedContent(records: EngagementRecord[]) {
  const contentMap: Record<string, { views: number; avgRead: number; comments: number; totalRead: number }> = {};
  records.forEach((r) => {
    r.documentsViewed.forEach((d) => {
      if (!contentMap[d.documentTitle]) {
        contentMap[d.documentTitle] = { views: 0, avgRead: 0, comments: 0, totalRead: 0 };
      }
      contentMap[d.documentTitle].views++;
      contentMap[d.documentTitle].totalRead += d.readCompletion;
    });
    r.commentsPosted.forEach((c) => {
      if (contentMap[c.documentTitle]) {
        contentMap[c.documentTitle].comments++;
      }
    });
  });
  return Object.entries(contentMap)
    .map(([title, data]) => ({
      title,
      views: data.views,
      avgRead: data.views > 0 ? Math.round(data.totalRead / data.views) : 0,
      comments: data.comments,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);
}

function generateInteractionMetrics(records: EngagementRecord[]) {
  const totals = records.reduce(
    (acc, r) => ({
      comments: acc.comments + r.interactions.comments,
      likes: acc.likes + r.interactions.likes,
      rsvps: acc.rsvps + r.eventActivity.joined,
      meetingRequests: acc.meetingRequests + r.meetingRequests,
    }),
    { comments: 0, likes: 0, rsvps: 0, meetingRequests: 0 }
  );
  // Generate sparkline data (7 days)
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const daySeed = i * 31 + 42;
    return Math.round(((totals.comments + totals.likes) / 7) * (0.6 + seededRandom(daySeed) * 0.8));
  });
  return { ...totals, total: totals.comments + totals.likes + totals.rsvps + totals.meetingRequests, chartData };
}

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

const formatEventDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ── Main Component ──────────────────────────────────────────────────────

interface EngagementPageProps {
  applicants: Applicant[];
  applicantsLoading: boolean;
}

const EngagementPage: React.FC<EngagementPageProps> = ({ applicants, applicantsLoading }) => {
  // ─ State ─
  const [searchQuery, setSearchQuery] = useState('');
  const [investorTypeFilter, setInvestorTypeFilter] = useState<'all' | 'official' | 'guest'>('all');
  const [engagementLevelFilter, setEngagementLevelFilter] = useState<'all' | EngagementLevel>('all');
  const [sortField, setSortField] = useState<SortField>('engagementScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvestor, setSelectedInvestor] = useState<EngagementRecord | null>(null);

  // Event management state
  const [events, setEvents] = useState<IREvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [eventToast, setEventToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  // Refs
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // ─ Data generation ─
  const engagementRecords = useMemo(() => generateEngagementRecords(applicants), [applicants]);
  const activeMetrics = useMemo(() => generateActiveInvestorsMetrics(engagementRecords), [engagementRecords]);
  const contentEngagement = useMemo(() => generateContentEngagementData(engagementRecords), [engagementRecords]);
  const mostEngagedContent = useMemo(() => generateMostEngagedContent(engagementRecords), [engagementRecords]);
  const interactionMetrics = useMemo(() => generateInteractionMetrics(engagementRecords), [engagementRecords]);

  // ─ Load events from Firestore ─
  useEffect(() => {
    setEventsLoading(true);
    const unsubscribe = eventService.subscribe((fetchedEvents) => {
      setEvents(fetchedEvents);
      setEventsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Toast auto-hide
  useEffect(() => {
    if (eventToast.show) {
      const timer = setTimeout(() => setEventToast((prev) => ({ ...prev, show: false })), 3000);
      return () => clearTimeout(timer);
    }
  }, [eventToast.show]);

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

    // Investor type filter
    if (investorTypeFilter !== 'all') {
      data = data.filter((r) => r.investorType === investorTypeFilter);
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
        case 'investorType':
          aVal = a.investorType;
          bVal = b.investorType;
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
  }, [engagementRecords, searchQuery, investorTypeFilter, engagementLevelFilter, sortField, sortDirection]);

  // ─ Pagination ─
  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredAndSortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, investorTypeFilter, engagementLevelFilter]);

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

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    try {
      await eventService.delete(eventId);
      setEventToast({ show: true, message: 'Event deleted', type: 'success' });
    } catch (error) {
      setEventToast({ show: true, message: 'Failed to delete event', type: 'error' });
    }
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
  if (applicantsLoading) {
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
            Engagement
          </h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Monitor investor activity, content engagement & interactions
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

            {/* Investor Type Filter */}
            <select
              value={investorTypeFilter}
              onChange={(e) => setInvestorTypeFilter(e.target.value as 'all' | 'official' | 'guest')}
              className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            >
              <option value="all">All Types</option>
              <option value="official">Official Shareholder</option>
              <option value="guest">Guest User</option>
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
                  { field: 'investorType' as SortField, label: 'Type' },
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
                        record.investorType === 'official'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {record.investorType === 'official' ? 'Official' : 'Guest'}
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
          SECTION 3: EVENT & MEETING MANAGEMENT
         ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Event & Meeting Management
            </h3>
            <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em] mt-0.5">
              Schedule and manage investor events
            </p>
          </div>
          <button
            onClick={() => setIsCreateEventOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Event
          </button>
        </div>

        {eventsLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-3 border border-dashed border-neutral-200 dark:border-neutral-700">
              <svg className="w-7 h-7 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">No events yet</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Create your first investor event or meeting
            </p>
            <button
              onClick={() => setIsCreateEventOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Create Event
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {events.map((event) => {
              const totalInvited = event.invitations.invited.length;
              const accepted = event.invitations.accepted.length;
              const declined = event.invitations.declined.length;
              const pending = event.invitations.pending.length;
              const isPast = new Date(event.dateTime) < new Date();

              return (
                <div key={event.id} className="px-5 py-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Event type icon */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPast ? 'bg-neutral-100 dark:bg-neutral-700' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
                        <svg className={`w-4.5 h-4.5 ${isPast ? 'text-neutral-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                            {event.title}
                          </h4>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isPast
                              ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          }`}>
                            {isPast ? 'Past' : 'Upcoming'}
                          </span>
                          <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                            {EVENT_TYPE_LABELS[event.eventType]}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">
                          {formatEventDate(event.dateTime)}
                          {event.location && ` · ${event.location}`}
                        </p>
                        {/* Invitation metrics */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400">Invited:</span>
                            <span className="text-[10px] font-bold text-neutral-900 dark:text-neutral-100">{totalInvited}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{accepted} accepted</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{declined} declined</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{pending} pending</span>
                          </div>
                        </div>
                        {/* RSVP progress bar */}
                        {totalInvited > 0 && (
                          <div className="flex h-1.5 rounded-full overflow-hidden mt-2 max-w-xs bg-neutral-100 dark:bg-neutral-700">
                            <div className="bg-emerald-500 transition-all" style={{ width: `${(accepted / totalInvited) * 100}%` }} />
                            <div className="bg-red-400 transition-all" style={{ width: `${(declined / totalInvited) * 100}%` }} />
                            <div className="bg-amber-400 transition-all" style={{ width: `${(pending / totalInvited) * 100}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                      title="Delete event"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
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
                      selectedInvestor.investorType === 'official'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                    }`}>
                      {selectedInvestor.investorType === 'official' ? 'Official Shareholder' : 'Guest User'}
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

      {/* ── Create Event Modal ─────────────────────────────────────── */}
      <CreateEventModal
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        onSave={handleCreateEvent}
        applicants={applicants}
      />

      {/* ── Event Toast ────────────────────────────────────────────── */}
      {eventToast.show && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 transition-all duration-300 ${
          eventToast.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400'
        }`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {eventToast.type === 'success' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            )}
          </svg>
          <span className="text-xs font-bold">{eventToast.message}</span>
        </div>
      )}
    </div>
  );
};

export default EngagementPage;
