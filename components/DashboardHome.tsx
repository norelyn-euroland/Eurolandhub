
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Applicant, RegistrationStatus, OfficialShareholder } from '../lib/types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Tooltip from './Tooltip';
import { getWorkflowStatusInternal, getGeneralAccountStatus, getWorkflowStatusFrontendLabel } from '../lib/shareholdingsVerification';
import AddInvestorModal from './AddInvestorModal';
import MetricCard from './MetricCard';
import { officialShareholderService } from '../lib/firestore-service';

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
const Avatar: React.FC<{ name: string; size?: number; profilePictureUrl?: string }> = ({ name, size = 40, profilePictureUrl }) => {
  const [imageError, setImageError] = React.useState(false);
  const initials = getInitials(name);
  const color = getAvatarColor(name);
  
  // If profile picture is available and no error, use it
  if (profilePictureUrl && !imageError) {
    return (
      <img
        src={profilePictureUrl}
        alt={name}
        className="rounded-full shrink-0 object-cover"
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
        onError={() => setImageError(true)}
      />
    );
  }
  
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

// Fix: Use an intersection type to properly combine jsPDF instance methods with the autoTable extension
type jsPDFWithAutoTable = jsPDF & {
  autoTable: (options: any) => void;
};

interface DashboardHomeProps {
  applicants: Applicant[];
  onSelect: (applicant: Applicant) => void;
  tabRequest?: { tab: TabType; requestId: number };
  onTabChange?: (tab: TabType) => void;
  onSearchChange?: (query: string) => void;
  initialTab?: TabType;
  initialSearchQuery?: string;
  sidebarCollapsed?: boolean;
}

type TabType = 'PENDING' | 'VERIFIED' | 'NON_VERIFIED' | 'PRE_VERIFIED' | 'ALL';

const DashboardHome: React.FC<DashboardHomeProps> = ({ 
  applicants, 
  onSelect, 
  tabRequest,
  onTabChange,
  onSearchChange,
  initialTab,
  initialSearchQuery,
  sidebarCollapsed = false
}) => {
  // Always default to 'ALL' if no initialTab is provided
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // If initialTab is provided, use it; otherwise default to 'ALL'
    return initialTab || 'ALL';
  });
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAddInvestorModalOpen, setIsAddInvestorModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusCache, setStatusCache] = useState<Record<string, string>>({});
  const [officialShareholders, setOfficialShareholders] = useState<OfficialShareholder[]>([]);
  
  const exportRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Compute statuses asynchronously and cache them
  // Updates automatically when applicants change (via real-time subscription)
  useEffect(() => {
    const computeStatuses = async () => {
      const newCache: Record<string, string> = {};
      await Promise.all(
        applicants.map(async (applicant) => {
          try {
            const status = await getWorkflowStatusInternal(applicant);
            newCache[applicant.id] = status;
          } catch (error) {
            console.error('Error computing status for applicant:', applicant.id, error);
            newCache[applicant.id] = 'REGISTRATION_PENDING';
          }
        })
      );
      setStatusCache(newCache);
    };
    
    // Compute immediately when applicants change
    // Real-time subscription will trigger this automatically
    computeStatuses();
  }, [applicants]);

  // Subscribe to official shareholders for real-time updates
  useEffect(() => {
    const unsubscribe = officialShareholderService.subscribeToOfficialShareholders(
      (shareholders) => {
        setOfficialShareholders(shareholders);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Allow external navigation (e.g. notifications) to force a specific tab.
  // Only set internal state here — do NOT call onTabChange to avoid loops
  // (the parent already knows the tab since it created the tabRequest).
  useEffect(() => {
    if (!tabRequest) return;
    setActiveTab(tabRequest.tab);
  }, [tabRequest?.requestId]);

  // Notify parent of tab changes (only call onTabChange, never depend on it)
  const handleInternalTabChange = (newTab: TabType) => {
    setActiveTab(newTab);
    if (onTabChange) {
      onTabChange(newTab);
    }
  };

  // Notify parent of search changes (only call onSearchChange, never depend on it)
  const handleInternalSearchChange = (newQuery: string) => {
    setSearchQuery(newQuery);
    if (onSearchChange) {
      onSearchChange(newQuery);
    }
  };

  // Use useMemo to recalculate filteredData when applicants, filters, or status cache changes
  // This ensures the queue updates automatically when status changes
  const filteredData = useMemo(() => {
    return applicants.filter((applicant) => {
      // Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          applicant.fullName.toLowerCase().includes(query) ||
          applicant.email?.toLowerCase().includes(query) ||
          applicant.id.toLowerCase().includes(query) ||
          applicant.phoneNumber?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Pre-verified: Only accounts created by IRO through Add Investors with email addresses
      if (activeTab === 'PRE_VERIFIED') {
        // Must be marked as pre-verified (created by IRO)
        if (!applicant.isPreVerified) {
          return false;
        }
        // Must have an email address
        const hasEmail = applicant.email && applicant.email.trim().length > 0;
        return hasEmail;
      }
      
      // Exclude pre-verified accounts from all other categories (ALL, PENDING, VERIFIED, NON_VERIFIED)
      // Pre-verified accounts use different status mapping and should only appear in PRE_VERIFIED tab
      if (applicant.isPreVerified) {
        return false;
      }
      
      // Tab Filter - Use General Account Status for categorization (only for non-pre-verified accounts)
      if (activeTab === 'ALL') return true;
      
      const internalStatus = (statusCache[applicant.id] || 'REGISTRATION_PENDING') as any;
      const generalStatus = getGeneralAccountStatus(internalStatus);
      
      const matchesTab = 
        (activeTab === 'PENDING' && generalStatus === 'UNVERIFIED') ||
        (activeTab === 'VERIFIED' && generalStatus === 'VERIFIED') ||
        (activeTab === 'NON_VERIFIED' && generalStatus === 'PENDING');

      return matchesTab;
    });
  }, [applicants, searchQuery, activeTab, statusCache]);

  const filterOptions: Array<{ id: TabType; label: string }> = [
    { id: 'ALL', label: 'All' },
    { id: 'PENDING', label: 'Unverified' },
    { id: 'VERIFIED', label: 'Verified' },
    { id: 'NON_VERIFIED', label: 'Pending' },
    { id: 'PRE_VERIFIED', label: 'Pre-verified' },
  ];

  // Helper function to parse submissionDate (handles YYYY-MM-DD format)
  const parseSubmissionDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    try {
      // Handle YYYY-MM-DD format
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      // Try parsing as ISO string
      return new Date(dateStr);
    } catch {
      return null;
    }
  };

  // Helper function to check if date is older than N days
  const isOlderThanDays = (dateStr: string, days: number): boolean => {
    const date = parseSubmissionDate(dateStr);
    if (!date) return false;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return date.getTime() < cutoffDate.getTime();
  };

  // Helper function to check if date is within a range (last N days)
  const isWithinLastDays = (dateStr: string, days: number): boolean => {
    const date = parseSubmissionDate(dateStr);
    if (!date) return false;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return date.getTime() >= cutoffDate.getTime();
  };

  // Helper function to check if date is between two day ranges
  const isBetweenDays = (dateStr: string, minDays: number, maxDays: number): boolean => {
    const date = parseSubmissionDate(dateStr);
    if (!date) return false;
    const now = new Date();
    const minDate = new Date(now);
    minDate.setDate(minDate.getDate() - maxDays);
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() - minDays);
    return date.getTime() >= minDate.getTime() && date.getTime() < maxDate.getTime();
  };

  // New metric calculation functions for the 4 dashboard cards
  
  // 1. Total Official Shareholders
  const getTotalOfficialShareholders = (): number => {
    return officialShareholders.length;
  };

  // 2. Verified Accounts Rate (%)
  const getVerifiedAccountsRate = (): { count: number; percentage: number } => {
    const verifiedCount = officialShareholders.filter(sh => sh.status === 'VERIFIED').length;
    const total = officialShareholders.length;
    const percentage = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;
    return { count: verifiedCount, percentage };
  };

  // 3. Active Users (Last 30 Days)
  const getActiveUsersLast30Days = (): number => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return applicants.filter(a => {
      // Check if account is verified/claimed
      const internalStatus = (statusCache[a.id] || 'REGISTRATION_PENDING') as any;
      const isVerified = getGeneralAccountStatus(internalStatus) === 'VERIFIED';
      
      if (!isVerified) return false;
      
      // Check lastActive field if available
      if (a.lastActive && a.lastActive !== 'Never') {
        try {
          // Try to parse lastActive (could be date string or "X days ago" format)
          const lastActiveDate = new Date(a.lastActive);
          if (!isNaN(lastActiveDate.getTime())) {
            return lastActiveDate >= thirtyDaysAgo;
          }
        } catch (e) {
          // If parsing fails, check accountClaimedAt as fallback
        }
      }
      
      // Fallback: Use accountClaimedAt or submissionDate for verified accounts
      const activityDate = a.accountClaimedAt 
        ? new Date(a.accountClaimedAt)
        : a.submissionDate 
          ? new Date(a.submissionDate)
          : null;
      
      if (activityDate && !isNaN(activityDate.getTime())) {
        return activityDate >= thirtyDaysAgo;
      }
      
      // If no date available but account is verified, assume active
      return true;
    }).length;
  };

  // 4. Pending Activation (Pre-Verified accounts not yet claimed)
  const getPendingActivation = (): number => {
    return officialShareholders.filter(sh => sh.status === 'PRE-VERIFIED').length;
  };

  // Helper function to calculate 7-day trend based on current data
  // Compares accounts that entered this status in last 7 days vs 7-14 days ago
  const calculateTrend = (
    currentCount: number,
    filterFn: (a: Applicant) => boolean
  ): { percent: number; direction: 'up' | 'down' | 'neutral' } => {
    // Count accounts in this status that were submitted in the last 7 days (recent)
    const recentCount = applicants.filter(a => {
      return filterFn(a) && isWithinLastDays(a.submissionDate, 7);
    }).length;

    // Count accounts in this status that were submitted 7-14 days ago (previous period)
    const previousCount = applicants.filter(a => {
      return filterFn(a) && isBetweenDays(a.submissionDate, 7, 14);
    }).length;

    // If no previous period data, compare recent vs all older data
    if (previousCount === 0) {
      const olderCount = applicants.filter(a => {
        return filterFn(a) && isOlderThanDays(a.submissionDate, 7);
      }).length;
      
      if (olderCount === 0) {
        // If no older data but we have recent data, show as positive trend
        if (recentCount > 0) {
          return { percent: 100, direction: 'up' };
        }
        // If no data at all, return neutral
        return { percent: 0, direction: 'neutral' };
      }
      
      // Compare recent vs older
      const percent = ((recentCount - olderCount) / olderCount) * 100;
      const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'neutral';
      return { percent: Math.abs(percent), direction };
    }

    // Compare recent period vs previous period
    const percent = previousCount > 0 
      ? ((recentCount - previousCount) / previousCount) * 100
      : recentCount > 0 ? 100 : 0;
    const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'neutral';

    return { percent: Math.abs(percent), direction };
  };

  // Calculate new dashboard metrics
  const totalOfficialShareholders = getTotalOfficialShareholders();
  const verifiedAccounts = getVerifiedAccountsRate();
  const activeUsers30Days = getActiveUsersLast30Days();
  const pendingActivation = getPendingActivation();

  // Calculate trends for new metrics
  // For total official shareholders, calculate trend based on when they were created
  const totalOfficialTrend = (() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentCount = officialShareholders.filter(sh => {
      const createdAt = sh.createdAt ? new Date(sh.createdAt) : null;
      return createdAt && createdAt >= thirtyDaysAgo;
    }).length;
    
    const previousCount = officialShareholders.filter(sh => {
      const createdAt = sh.createdAt ? new Date(sh.createdAt) : null;
      if (!createdAt) return false;
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      return createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
    }).length;
    
    if (previousCount === 0) {
      return recentCount > 0 ? { percent: 100, direction: 'up' as const } : { percent: 0, direction: 'neutral' as const };
    }
    
    const percent = ((recentCount - previousCount) / previousCount) * 100;
    return { percent: Math.abs(percent), direction: percent > 0 ? 'up' as const : percent < 0 ? 'down' as const : 'neutral' as const };
  })();

  const verifiedRateTrend = calculateTrend(verifiedAccounts.count, (a) => {
    const internalStatus = (statusCache[a.id] || 'REGISTRATION_PENDING') as any;
    return getGeneralAccountStatus(internalStatus) === 'VERIFIED';
  });

  const activeUsersTrend = calculateTrend(activeUsers30Days, (a) => {
    const internalStatus = (statusCache[a.id] || 'REGISTRATION_PENDING') as any;
    const isVerified = getGeneralAccountStatus(internalStatus) === 'VERIFIED';
    if (!isVerified) return false;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activityDate = a.accountClaimedAt 
      ? new Date(a.accountClaimedAt)
      : a.submissionDate 
        ? new Date(a.submissionDate)
        : null;
    
    return activityDate && activityDate >= thirtyDaysAgo;
  });

  const pendingActivationTrend = calculateTrend(pendingActivation, (a) => {
    return a.isPreVerified && !a.accountClaimedAt;
  });

  // Helper function to get workflow status from cache
  // Maps internal workflow status to frontend display label with appropriate colors
  const getWorkflowStatus = (applicant: Applicant): { label: string; color: string; bgColor: string } => {
    const internalStatus = (statusCache[applicant.id] || 'REGISTRATION_PENDING') as any;
    const frontendLabel = getWorkflowStatusFrontendLabel(internalStatus);

    // Color mapping based on internal status (light/dark mode)
    const statusColors: Record<string, { color: string; bgColor: string }> = {
      'SENT_EMAIL': { color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/30' },
      'REGISTRATION_PENDING': { color: 'text-indigo-700 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/30' },
      'UNDER_REVIEW': { color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/30' },
      'FURTHER_INFO_REQUIRED': { color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/30' },
      'LOCKED_FOR_7_DAYS': { color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30' },
      'VERIFIED': { color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/30' },
      'ACCOUNT_CLAIMED': { color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/30' },
      'INVITATION_EXPIRED': { color: 'text-neutral-500 dark:text-neutral-400', bgColor: 'bg-neutral-100 dark:bg-neutral-700' },
    };

    const colors = statusColors[internalStatus] || { color: 'text-neutral-500 dark:text-neutral-400', bgColor: 'bg-neutral-100 dark:bg-neutral-700' };

    return {
      label: frontendLabel,
      ...colors,
    };
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Full Name', 'Email', 'Submission Date', 'Last Active', 'Status'];
    const csvRows = filteredData.map(a => [
      a.id,
      `"${a.fullName}"`,
      a.email,
      a.submissionDate,
      a.lastActive,
      getWorkflowStatusInternal(a)
    ].join(','));

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `equiverify_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    setIsExportOpen(false);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF() as any as jsPDFWithAutoTable;
    
    doc.setFontSize(18);
    doc.text('EUROLANDHUB REGISTRY REPORT', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Filter View: ${activeTab}`, 14, 35);

    const tableHeaders = [['ID', 'NAME', 'DATE', 'ACTIVE', 'STATUS']];
    const tableData = filteredData.map(a => [
      a.id,
      a.fullName,
      a.submissionDate,
      a.lastActive,
      getWorkflowStatusInternal(a)
    ]);

    doc.autoTable({
      startY: 45,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { top: 45 },
    });

    doc.save(`registry_report_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsExportOpen(false);
  };

  // New dashboard metrics - 4 cards as specified
  const metrics = [
    {
      label: 'Total Official Shareholders',
      value: totalOfficialShareholders,
      trend: totalOfficialTrend,
      subtitle: 'Base universe of investors',
      type: 'total',
      chartColor: '#4F46E5'
    },
    {
      label: 'Verified Accounts Rate',
      value: `${verifiedAccounts.percentage}%`,
      trend: verifiedRateTrend,
      subtitle: `${verifiedAccounts.count} / ${totalOfficialShareholders} activated`,
      type: 'verified-rate',
      chartColor: '#10B981',
      tooltipSymbol: '%'
    },
    {
      label: 'Active Users (Last 30 Days)',
      value: activeUsers30Days,
      trend: activeUsersTrend,
      subtitle: 'Users who logged in or interacted',
      type: 'active',
      chartColor: '#3B82F6'
    },
    {
      label: 'Pending Activation',
      value: pendingActivation,
      trend: pendingActivationTrend,
      subtitle: 'Pre-verified accounts awaiting claim',
      type: 'pending',
      chartColor: '#F59E0B'
    }
  ];

  // Helper function to format trend display
  const formatTrend = (trend: { percent: number; direction: 'up' | 'down' | 'neutral' }): string => {
    if (trend.direction === 'neutral') return '0%';
    const sign = trend.direction === 'up' ? '+' : '-';
    return `${sign}${trend.percent.toFixed(1)}%`;
  };

  // Helper function to get trend tracking period info
  const getTrendTrackingInfo = (): string => {
    return 'Trend tracked over 14 days: Last 7 days compared to previous 7 days';
  };

  // Handle investor form submission
  // Note: Actual saving is now handled in AddInvestorModal via Firebase
  // This callback is kept for backward compatibility but is no longer used for saving
  const handleInvestorSave = (data: { investorName: string; holdingId: string; email: string; phone: string; ownershipPercent: string }) => {
    // Saving is handled in AddInvestorModal component
    // Modal will close automatically after successful save
  };

  // Deterministic seeded random — same seed always produces the same value.
  const seededRandom = (seed: number): number => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };

  // Generate chart data for each metric (7 days of data)
  // Uses a deterministic seed so charts stay stable across re-renders and only change weekly.
  const generateChartData = (baseValue: number, trend: { percent: number; direction: 'up' | 'down' | 'neutral' }, metricIndex: number): number[] => {
    const days = 7;
    const data: number[] = [];
    const safeBaseValue = baseValue || 1;
    const trendMultiplier = trend.direction === 'up' ? 1 + (trend.percent / 100) : trend.direction === 'down' ? 1 - (trend.percent / 100) : 1;
    const weekSeed = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    
    for (let i = 0; i < days; i++) {
      const progress = i / (days - 1);
      const value = safeBaseValue * (1 + (trendMultiplier - 1) * progress);
      const variation = (seededRandom(weekSeed + metricIndex * 7 + i) - 0.5) * 0.1;
      data.push(Math.max(0, value * (1 + variation)));
    }
    
    return data;
  };

  // Chart colors for each metric type
  const chartColors: Record<string, string> = {
    'total': '#4F46E5', // indigo
    'verified-rate': '#10B981', // emerald
    'active': '#3B82F6', // blue
    'pending': '#F59E0B', // amber
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="grid grid-cols-4 gap-8 overflow-visible">
        {metrics.map((metric, i) => {
          // For verified rate, extract numeric value for chart
          const numericValue = typeof metric.value === 'string' && metric.value.includes('%')
            ? parseFloat(metric.value.replace('%', ''))
            : typeof metric.value === 'number'
              ? metric.value
              : 0;
          
          return (
            <MetricCard
              key={i}
              title={metric.label}
              value={metric.value}
              trend={metric.trend}
              subtitle={metric.subtitle || 'compared to last week'}
              chartData={generateChartData(numericValue, metric.trend, i)}
              chartColor={metric.chartColor || chartColors[metric.type] || '#7C3AED'}
              tooltipSymbol={metric.tooltipSymbol}
            />
          );
        })}
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="px-8 py-5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">Queue: Investor Audit</h2>
              <div className="flex items-center gap-2">
                {/* Search Container */}
                <div className="relative">
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input 
                    type="text"
                    placeholder="Search registration queue..."
                    value={searchQuery}
                    onChange={(e) => handleInternalSearchChange(e.target.value)}
                    className="pl-10 pr-4 py-1.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs focus:ring-1 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-[#082b4a] dark:focus:border-[#00adf0] outline-none w-64 transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-medium text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                {/* Filter (icon) */}
                <div className="relative" ref={filterRef}>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(v => !v)}
                    className="h-[34px] w-[34px] inline-flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    aria-label="Filter queue"
                    aria-expanded={isFilterOpen}
                  >
                    {/* Funnel icon */}
                    <svg className="w-4 h-4 text-neutral-600 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
                    </svg>
                  </button>

                  {isFilterOpen && (
                    <div className="absolute top-full right-0 mt-2 w-44 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-[9999] overflow-hidden">
                      {filterOptions.map((opt) => {
                        const isActive = activeTab === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              handleInternalTabChange(opt.id);
                              setIsFilterOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
                              isActive ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => setIsAddInvestorModalOpen(true)}
                  className="px-3 py-1.5 text-[10px] font-bold bg-[#4169E1] text-white rounded-lg hover:bg-[#3151C7] transition-colors uppercase tracking-widest flex items-center gap-2 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add/Update Investors
                </button>
                 <div className="relative" ref={exportRef}>
                   <button 
                    onClick={() => setIsExportOpen(!isExportOpen)}
                    className="px-3 py-1.5 text-[10px] font-bold border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors uppercase tracking-widest flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                   >
                     Export
                     <svg className={`w-3 h-3 transition-transform ${isExportOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                   </button>

                   {isExportOpen && (
                     <div className="absolute top-full right-0 mt-2 w-44 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-[9999] overflow-hidden">
                       <button 
                         onClick={handleExportCSV}
                         className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                       >
                         CSV Spreadsheet
                         <svg className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                       </button>
                       <button 
                         onClick={handleExportPDF}
                         className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between text-neutral-700 dark:text-neutral-300"
                       >
                         Audit PDF
                         <svg className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                       </button>
                     </div>
                   )}
                 </div>
              </div>
            </div>
          </div>
        </div>
        
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50">
              {activeTab === 'PRE_VERIFIED' ? (
                <>
                  <th className="px-8 py-4">Name</th>
                  <th className="px-8 py-4">Registration ID</th>
                  <th className="px-8 py-4">Email</th>
                  <th className="px-8 py-4">Stage</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </>
              ) : (
                <>
                  <th className="px-8 py-4">Investor Profile</th>
                  <th className="px-8 py-4">Submission</th>
                  <th className="px-8 py-4">Last Activity</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Review</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {filteredData.length > 0 ? (
              filteredData.map((applicant) => {
                // Get status from cache
                const internalStatus = (statusCache[applicant.id] || 'REGISTRATION_PENDING') as any;
                // Include all relevant status fields in key to ensure re-render on any status change
                const statusKey = `${applicant.id}-${applicant.status}-${internalStatus}-${applicant.shareholdingsVerification?.step6?.verifiedAt || ''}-${applicant.shareholdingsVerification?.step4?.lastResult || ''}-${applicant.shareholdingsVerification?.step4?.lastReviewedAt || ''}`;
                
                // Debug log for status calculation (only in development)
                if (process.env.NODE_ENV === 'development' && applicant.status === 'APPROVED' && internalStatus !== 'VERIFIED') {
                  console.warn('Status mapping issue detected:', {
                    applicantId: applicant.id,
                    applicantName: applicant.fullName,
                    registrationStatus: applicant.status,
                    internalStatus,
                    hasStep6: !!applicant.shareholdingsVerification?.step6?.verifiedAt,
                    step6VerifiedAt: applicant.shareholdingsVerification?.step6?.verifiedAt,
                    step4LastResult: applicant.shareholdingsVerification?.step4?.lastResult,
                    step1WantsVerification: applicant.shareholdingsVerification?.step1.wantsVerification,
                    hasStep2: !!applicant.shareholdingsVerification?.step2
                  });
                }
                
                return (
                <tr key={statusKey} className="group hover:bg-neutral-50/50 dark:hover:bg-neutral-700/50 transition-colors">
                  {activeTab === 'PRE_VERIFIED' ? (
                    <>
                      <td className="px-8 py-5">
                        <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{applicant.fullName}</div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                          {applicant.registrationId 
                            ? (applicant.registrationId.length > 6 ? applicant.registrationId.slice(-6) : applicant.registrationId)
                            : 'N/A'}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                        {applicant.email || 'N/A'}
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                          {applicant.workflowStage || 'N/A'}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                          {applicant.systemStatus || 'N/A'}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => onSelect(applicant)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#082b4a] dark:hover:bg-[#00adf0] hover:text-white hover:border-[#082b4a] dark:hover:border-[#00adf0] transition-all shadow-sm text-neutral-700 dark:text-neutral-200"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <Avatar name={applicant.fullName} size={36} profilePictureUrl={applicant.profilePictureUrl} />
                          <div className="min-w-0 flex-1">
                            <Tooltip content={applicant.fullName}>
                              <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-none mb-1 truncate">{applicant.fullName}</div>
                            </Tooltip>
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-tight">{applicant.id.length > 6 ? applicant.id.slice(-6) : applicant.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                        {applicant.submissionDate}
                      </td>
                      <td className="px-8 py-5 text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                        {applicant.lastActive}
                      </td>
                      <td className="px-8 py-5">
                        {(() => {
                          const internalStatus = (statusCache[applicant.id] || 'REGISTRATION_PENDING') as any;
                          // Color mapping for internal status (light/dark mode)
                          const statusColors: Record<string, { color: string; bgColor: string }> = {
                            'SENT_EMAIL': { color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/30' },
                            'REGISTRATION_PENDING': { color: 'text-indigo-700 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/30' },
                            'UNDER_REVIEW': { color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/30' },
                            'FURTHER_INFO_REQUIRED': { color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/30' },
                            'LOCKED_FOR_7_DAYS': { color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30' },
                            'VERIFIED': { color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/30' },
                            'ACCOUNT_CLAIMED': { color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/30' },
                            'INVITATION_EXPIRED': { color: 'text-neutral-500 dark:text-neutral-400', bgColor: 'bg-neutral-100 dark:bg-neutral-700' },
                          };
                          const colors = statusColors[internalStatus] || { color: 'text-neutral-500 dark:text-neutral-400', bgColor: 'bg-neutral-100 dark:bg-neutral-700' };
                          return (
                            <span className={`text-[10px] font-bold uppercase tracking-tighter px-2.5 py-1 rounded-full border ${colors.color} ${colors.bgColor} border-current/20 dark:border-transparent`}>
                              {internalStatus}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-8 py-5 text-right">
                        {(() => {
                          // Check if user declined holdings verification - hide Audit button if declined
                          const workflowStatus = (statusCache[applicant.id] || 'REGISTRATION_PENDING') as any;
                          const isHoldingsDeclined = applicant.shareholdingsVerification?.step1?.wantsVerification === false;
                          
                          // Don't show Audit button if holdings verification was declined
                          if (isHoldingsDeclined) {
                            return null;
                          }
                          
                          return (
                            <button 
                              onClick={() => onSelect(applicant)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#082b4a] dark:hover:bg-[#00adf0] hover:text-white hover:border-[#082b4a] dark:hover:border-[#00adf0] transition-all shadow-sm text-neutral-700 dark:text-neutral-200"
                            >
                              Audit
                            </button>
                          );
                        })()}
                      </td>
                    </>
                  )}
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={activeTab === 'PRE_VERIFIED' ? 6 : 5} className="px-8 py-12 text-center text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  No records found in current queue
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Investor Modal */}
      <AddInvestorModal
        isOpen={isAddInvestorModalOpen}
        onClose={() => setIsAddInvestorModalOpen(false)}
        onSave={handleInvestorSave}
        sidebarCollapsed={sidebarCollapsed}
      />
    </div>
  );
};

export default DashboardHome;
