
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Applicant, RegistrationStatus, GeneralAccountStatus, OfficialShareholder } from '../lib/types';
import Tooltip from './Tooltip';
import Chart from 'react-apexcharts';
import HoldingsSummary from './HoldingsSummary';
import { getWorkflowStatusInternal, getGeneralAccountStatus } from '../lib/shareholdingsVerification';
import {
  generateEngagementRecords,
  generateMostEngagedContent,
  generateUserActivities,
} from '../lib/engagementService';
import MetricCard from './MetricCard';
import { officialShareholderService } from '../lib/firestore-service';
import { PressReleasePreview, PressReleaseDetail, AllPressReleasesView } from './PressReleaseSection';
import type { PressRelease } from './PressReleaseSection';
import { getAllPressReleases } from '../services/pressReleaseService';
import { getDataByRange, getLatestPrice, getPriceStats, type ShareDataPoint, type TimeRange } from '../services/shareDataService';
import { releasedDocumentsService, DOCUMENT_TAGS, getDocumentTypeLabel, type ReleasedDocument } from '../services/releasedDocumentsService';
import TopEngagedInvestorsTable from './TopEngagedInvestorsTable';
import TopContentTable from './TopContentTable';
import RecentUserActivitiesTable from './RecentUserActivitiesTable';

// Lazy load heavy components for better performance
const CalendarWidget = React.lazy(() => import('./CalendarWidget'));
const TodoTaskWidget = React.lazy(() => import('./TodoTaskWidget'));
import {
  shouldTriggerGreetingAnimation,
  getCurrentTimeContext,
  getGreetingTheme,
  getGreetingSubtitle,
  getWidgetDateLine,
  isDaytime,
  getLocationString,
  getSunPosition,
  getMoonPosition,
  getSunWarmth,
  type TimeContext,
} from '../services/greetingTimeService';
import {
  fetchWeather,
  getWeatherCategory,
  getWeatherGradient,
  getWeatherEmoji,
  capitalizeDescription,
  isNightIcon,
  type WeatherData,
  type WeatherCategory,
} from '../services/weatherService';
import { ResponsiveContainer, AreaChart, Area, Tooltip as RechartsTooltip, XAxis } from 'recharts';

// Engagement Activity Types
interface EngagementActivity {
  id: string;
  type: 'comment' | 'interaction' | 'share';
  commentText: string;
  likes: number;
  replies: number;
  replyDetails?: Array<{
    id: string;
    author: string;
    text: string;
    timestamp: string;
  }>;
  timestamp: string;
  status: 'Responded' | 'Pending'; // IRO response status
  associatedContent?: {
    type: 'Press Release' | 'Announcement' | 'Event' | 'Document';
    title: string;
  };
}

// Mock engagement data generator
const generateEngagementData = (applicant: Applicant): EngagementActivity[] => {
  const activities: EngagementActivity[] = [];
  const now = new Date();
  
  // Generate mock activities based on user's last active date
  // Validate and parse lastActive date safely
  let lastActive: Date;
  try {
    if (applicant.lastActive) {
      lastActive = new Date(applicant.lastActive);
      // Check if date is valid
      if (isNaN(lastActive.getTime())) {
        // If invalid, use submission date or current date as fallback
        lastActive = applicant.submissionDate ? new Date(applicant.submissionDate) : now;
        if (isNaN(lastActive.getTime())) {
          lastActive = now;
        }
      }
    } else {
      // If lastActive doesn't exist, use submission date or current date
      lastActive = applicant.submissionDate ? new Date(applicant.submissionDate) : now;
      if (isNaN(lastActive.getTime())) {
        lastActive = now;
      }
    }
  } catch (error) {
    // If any error occurs, use current date as fallback
    lastActive = now;
  }
  
  // Ensure lastActive is not in the future
  if (lastActive.getTime() > now.getTime()) {
    lastActive = now;
  }
  
  const daysSinceActive = Math.max(0, Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Ensure we always generate at least some activities, even if daysSinceActive is 0
  const maxDays = Math.max(daysSinceActive, 30); // Use at least 30 days if no activity
  
  // Sample comments for SM Investment Corporation IR updates
  const sampleComments = [
    'Great Q3 results! The ESG initiatives are impressive. Would love to see more details on the sustainability roadmap.',
    'Excellent performance this quarter. The strategic investments in retail and property are paying off well.',
    'Looking forward to the annual report. The transparency in governance is commendable.',
    'The dividend announcement is great news for shareholders. Keep up the good work!',
    'Impressive growth in the property segment. Can we get more insights on the expansion strategy?',
    'The corporate governance improvements are notable. This builds investor confidence.',
    'Strong financial position. The debt reduction strategy is working effectively.',
    'The digital transformation initiatives in SM Retail are showing results. Excited to see what\'s next.',
  ];
  
  // Sample replies from other users
  const sampleReplies = [
    { author: 'Maria Santos', text: 'I agree! The sustainability initiatives are a key differentiator for SM.' },
    { author: 'Juan Dela Cruz', text: 'The property segment growth is impressive. Looking forward to more updates.' },
    { author: 'Ana Garcia', text: 'Great point about governance. Transparency is crucial for long-term investors.' },
    { author: 'Carlos Rodriguez', text: 'The dividend yield is attractive. This shows management\'s commitment to shareholders.' },
    { author: 'Lisa Tan', text: 'The retail expansion strategy is well-executed. SM continues to lead the market.' },
    { author: 'Robert Lim', text: 'Strong fundamentals. The diversified portfolio approach is working well.' },
    { author: 'Patricia Ong', text: 'The ESG focus aligns with global trends. Good to see SM taking the lead.' },
    { author: 'Michael Chen', text: 'The financial metrics are solid. Management is executing the strategy effectively.' },
  ];
  
  const contentTypes: Array<'Press Release' | 'Announcement' | 'Event' | 'Document'> = ['Press Release', 'Announcement', 'Event', 'Document'];
  const contentTitles = [
    'Q3 2024 Earnings Release',
    'Annual General Meeting Notice',
    'Sustainability Report 2024',
    'Corporate Governance Update',
    'Dividend Declaration',
    'Strategic Partnership Announcement',
    'Quarterly Financial Results',
    'Investor Relations Update',
  ];
  // Status: Only "Responded" (by IRO) or "Pending" (waiting for IRO action)
  const statuses: Array<'Responded' | 'Pending'> = ['Responded', 'Pending'];
  
  // Generate 5-10 comment activities
  const activityCount = Math.floor(Math.random() * 6) + 5;
  
  for (let i = 0; i < activityCount; i++) {
    const daysAgo = Math.floor(Math.random() * Math.min(Math.max(maxDays, 1), 90)); // Use maxDays and allow up to 90 days
    const activityDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Validate activityDate before using toISOString
    if (isNaN(activityDate.getTime())) {
      continue; // Skip invalid dates
    }
    
    const activityTypes: Array<'comment' | 'interaction' | 'share'> = ['comment', 'interaction', 'share'];
    const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
    
    const commentText = sampleComments[Math.floor(Math.random() * sampleComments.length)];
    const likes = Math.floor(Math.random() * 50) + 1;
    const replyCount = type === 'interaction' ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 3);
    
    // Generate reply details
    const replyDetails: Array<{ id: string; author: string; text: string; timestamp: string }> = [];
    if (replyCount > 0) {
      const shuffledReplies = [...sampleReplies].sort(() => Math.random() - 0.5);
      for (let j = 0; j < Math.min(replyCount, shuffledReplies.length); j++) {
        const replyDate = new Date(activityDate.getTime() + (j + 1) * 60 * 60 * 1000); // Replies are 1 hour apart
        replyDetails.push({
          id: `reply-${i}-${j}`,
          author: shuffledReplies[j].author,
          text: shuffledReplies[j].text,
          timestamp: replyDate.toISOString(),
        });
      }
    }
    
    const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
    const contentTitle = contentTitles[Math.floor(Math.random() * contentTitles.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    try {
      activities.push({
        id: `activity-${i}`,
        type,
        commentText,
        likes,
        replies: replyCount,
        replyDetails: replyDetails.length > 0 ? replyDetails : undefined,
        timestamp: activityDate.toISOString(),
        status: status, // IRO response status
        associatedContent: {
          type: contentType,
          title: contentTitle,
        },
      });
    } catch (error) {
      // Skip activities with invalid timestamps
      console.warn('Skipping activity with invalid timestamp:', error);
      continue;
    }
  }
  
  // Sort by timestamp (most recent first)
  return activities.sort((a, b) => {
    try {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
        return 0;
      }
      return dateB.getTime() - dateA.getTime();
    } catch (error) {
      return 0;
    }
  });
};

// Engagement Tab Content Component
export const EngagementTabContent: React.FC<{ applicant: Applicant }> = ({ applicant }) => {
  const [engagementData] = useState<EngagementActivity[]>(() => generateEngagementData(applicant));
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [accountStatus, setAccountStatus] = useState<GeneralAccountStatus>('UNVERIFIED');
  
  // Get account status asynchronously
  useEffect(() => {
    const getAccountStatus = async () => {
      if (applicant.isPreVerified) {
        // For pre-verified, use accountStatus if available
        if (applicant.accountStatus) {
          setAccountStatus(applicant.accountStatus as GeneralAccountStatus);
          return;
        }
        setAccountStatus('PENDING');
        return;
      }
      // For regular accounts, use workflow status
      const internalStatus = await getWorkflowStatusInternal(applicant);
      setAccountStatus(getGeneralAccountStatus(internalStatus));
    };
    
    getAccountStatus();
  }, [applicant]);
  
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'PENDING':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'UNVERIFIED':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400';
    }
  };
  
  const toggleReplies = (activityId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };
  
  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'numeric', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return { date: dateStr, time: timeStr };
  };
  
  const getStatusColor = (status: 'Responded' | 'Pending') => {
    switch (status) {
      case 'Responded':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'Pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400';
    }
  };
  
  const getContentIcon = (type: string) => {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };
  
  return (
    <div className="space-y-6">
      {engagementData.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 italic">No engagement activities recorded yet</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                    Investor
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                    Comment/Feedback
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                    Content
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {engagementData.map((activity) => {
                  const { date, time } = formatDateTime(activity.timestamp);
                  
                  return (
                    <React.Fragment key={activity.id}>
                      <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors">
                        {/* Investor Column */}
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            
                            {/* Name and Email */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                                  {applicant.fullName}
                                </h4>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 ${getStatusBadgeColor(accountStatus)}`}>
                                  {accountStatus === 'VERIFIED' && (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                                      <path d="m9 12 2 2 4-4"/>
                                    </svg>
                                  )}
                                  {accountStatus === 'PENDING' && (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                      <circle cx="12" cy="12" r="10"/>
                                      <path d="M12 6v6l4 2"/>
                                    </svg>
                                  )}
                                  {(accountStatus === 'UNVERIFIED' || (accountStatus !== 'VERIFIED' && accountStatus !== 'PENDING')) && (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                                    </svg>
                                  )}
                                  {accountStatus}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400">{applicant.email}</p>
                            </div>
                          </div>
                        </td>
                        
                        {/* Comment/Feedback Column */}
                        <td className="px-6 py-4 align-top">
                          <div className="relative">
                            <div>
                              <p className="text-sm text-neutral-900 dark:text-neutral-100 mb-2 leading-relaxed">
                                {activity.commentText}
                              </p>
                              
                              {/* Likes and Replies */}
                              <div className="flex items-center gap-3">
                                {/* Likes */}
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{activity.likes} likes</span>
                                </div>
                                
                                {/* Replies - Collapsible */}
                                {activity.replies > 0 && (
                                  <button
                                    onClick={() => toggleReplies(activity.id)}
                                    className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <span>{activity.replies} replies</span>
                                    <svg 
                                      className={`w-4 h-4 transition-transform ${expandedReplies.has(activity.id) ? 'rotate-180' : ''}`}
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Replies Section - Inline, Reddit-style */}
                            {activity.replyDetails && activity.replyDetails.length > 0 && expandedReplies.has(activity.id) && (
                              <div className="mt-4 space-y-3 pl-4 border-l-2 border-neutral-300 dark:border-neutral-600">
                                {activity.replyDetails.map((reply) => {
                                  const replyDateTime = formatDateTime(reply.timestamp);
                                  return (
                                    <div key={reply.id} className="py-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                          {reply.author}
                                        </span>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                          {replyDateTime.date} {replyDateTime.time}
                                        </span>
                                      </div>
                                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                                        {reply.text}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Content Column */}
                        <td className="px-6 py-4 align-top">
                          {activity.associatedContent && (
                            <div className="flex items-start gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-0.5">
                                  {activity.associatedContent.type}
                                </p>
                                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                  {activity.associatedContent.title}
                                </p>
                              </div>
                            </div>
                          )}
                        </td>
                        
                        {/* Status Column */}
                        <td className="px-6 py-4 align-top">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(activity.status)}`}>
                            {activity.status}
                          </span>
                        </td>
                        
                        {/* Date Column */}
                        <td className="px-6 py-4 align-top">
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            <p>{date}</p>
                            <p>{time}</p>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

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
      <p className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">{label}</p>
      {copyable && value && value !== 'Not provided' ? (
        <button
          onClick={handleCopy}
          className="text-sm font-black text-neutral-900 dark:text-neutral-100 hover:text-primary transition-colors cursor-pointer relative group"
        >
          {value}
          {showCopied && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-800 dark:bg-black text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-10">
              Copied!
            </span>
          )}
        </button>
      ) : (
        <p className="text-sm font-black text-neutral-900 dark:text-neutral-100">{value}</p>
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

  useEffect(() => {
    if (!chartRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            setChartKey(prev => prev + 1);
            hasAnimatedRef.current = true;
          } else if (!entry.isIntersecting && hasAnimatedRef.current) {
            hasAnimatedRef.current = false;
          }
        });
      },
      { threshold: 0.3, rootMargin: '0px' }
    );
    observer.observe(chartRef.current);
    return () => { if (chartRef.current) observer.unobserve(chartRef.current); };
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
  
  // Prepare data for ApexCharts (design system: Gray=Guest, Blue=NoHoldings, Green=WithHoldings)
  const chartData = [
    { name: 'Guest Users', value: guestCount, percentage: guestPercentage, color: '#9ca3af' },
    { name: 'Registered (No Holdings)', value: registeredNoHoldings, percentage: registeredNoHoldingsPercentage, color: '#3b82f6' },
    { name: 'Registered (With Holdings)', value: registeredWithHoldings, percentage: registeredWithHoldingsPercentage, color: '#10b981' },
  ];

  const verifiedShareholders = registeredWithHoldings;
  const conversionRate = totalUsers > 0 ? Math.round((verifiedShareholders / totalUsers) * 100 * 10) / 10 : 0;

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
      events: { dataPointMouseEnter: function(_event: any) {} },
      offsetX: 0,
      offsetY: 0
    },
    labels: chartData.map(item => item.name),
    colors: chartData.map(item => item.color),
    dataLabels: {
      enabled: true,
      formatter: function(val: number) { return Math.round(val) + '%'; },
      style: { fontSize: '11px', fontWeight: 700, fontFamily: 'Inter, sans-serif', colors: ['#fff'] },
      dropShadow: { enabled: true, top: 1, left: 1, blur: 3, opacity: 0.3 }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '68%',
          labels: {
            show: true,
            name: { show: true, fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, color: undefined, offsetY: -5 },
            value: { show: true, fontSize: '22px', fontFamily: 'Inter, sans-serif', fontWeight: 900, color: undefined, offsetY: 4 },
            total: {
              show: true,
              showAlways: true,
              label: 'Total Users',
              fontSize: '10px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              color: '#9ca3af',
              formatter: function() { return totalUsers.toLocaleString(); }
            }
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
      colors: ['transparent'],
      width: 3,
      dashArray: 0
    },
    tooltip: {
      enabled: true,
      theme: 'dark',
      fillSeriesColor: false,
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif'
      },
      custom: function({ seriesIndex }: any) {
        const dataPoint = chartData[seriesIndex];
        return `<div style="padding: 8px 12px; background: #262626; border: 1px solid #404040; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); color: #e5e5e5; font-size: 12px; font-family: Inter, sans-serif; white-space: nowrap;">
          <span style="color: ${dataPoint.color}; font-weight: 900;">●</span>&nbsp; ${dataPoint.name}: <strong>${dataPoint.value.toLocaleString()}</strong> (${dataPoint.percentage}%)
        </div>`;
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
    <div className="flex flex-col h-full">
      {/* Chart centered */}
      <div className="flex-1 flex items-center justify-center">
        <div ref={chartRef} className="relative">
        <Chart
          key={`chart-${chartKey}`}
          options={chartOptions}
          series={chartSeries}
          type="donut"
            width="240"
            height="240"
        />
        </div>
      </div>
      
      {/* Legend below chart */}
      <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/50">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center justify-between group/legend">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-200 group-hover/legend:scale-110" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">{item.name}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-neutral-900 dark:text-white">{item.value.toLocaleString()}</span>
              <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500">{item.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Released Documents Panel ──────────────────────────────────────────

/**
 * Tag color mapping for document type labels
 */
const TAG_COLORS: Record<string, string> = {
  'Earnings': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'Dividend': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  'Disclosure': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  'Press Release': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  'AGM': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  'Governance': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
  'ESG': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
  'Presentation': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  'Silent Period': 'bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-700/30 dark:text-neutral-400 dark:border-neutral-600',
};

/**
 * Format document date from ISO timestamp
 */
const formatDocDate = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' \u2022 ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

interface ReleasedDocumentsPanelProps {
  onViewAll?: () => void;
}

const ReleasedDocumentsPanel: React.FC<ReleasedDocumentsPanelProps> = ({ onViewAll }) => {
  const [documents, setDocuments] = useState<ReleasedDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTag, setActiveTag] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch documents on mount
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        const publishedDocs = await releasedDocumentsService.getPublishedDocuments();
        setDocuments(publishedDocs);
      } catch (error) {
        console.error('Error loading released documents:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDocuments();
  }, []);

  // Filter documents by tag (type)
  const filteredByTag = activeTag === 'All' 
    ? documents 
    : documents.filter(d => getDocumentTypeLabel(d.type) === activeTag);

  // Filter by search query
  const filteredBySearch = searchQuery.trim() === '' 
    ? filteredByTag 
    : filteredByTag.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.summary.toLowerCase().includes(searchQuery.toLowerCase())
      );
  
  // Sort by publishDate DESC (newest first)
  const sortedDocs = [...filteredBySearch].sort((a, b) => 
    new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
  );
  
  const totalPages = Math.ceil(sortedDocs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayDocs = sortedDocs.slice(startIndex, startIndex + itemsPerPage);
  
  // Pad with empty rows to always show 5 items (fixed height)
  const paddedDocs = [...displayDocs, ...Array(Math.max(0, itemsPerPage - displayDocs.length)).fill(null)];

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTag, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar + Filter Dropdown */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full px-3 py-1.5 text-[11px] bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/50 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary/50 dark:focus:ring-primary-light/50 focus:border-transparent transition-all"
          />
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-300 dark:text-neutral-600 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          </div>
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
              activeTag !== 'All'
                ? 'bg-primary dark:bg-primary-light text-white dark:text-neutral-900 border-primary dark:border-primary-light'
                : 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border-neutral-200/80 dark:border-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M22 3H2l3 9h14l-3 9"/><path d="M6 12h12"/>
            </svg>
          </button>
          {showFilterDropdown && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/50 rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto">
              {DOCUMENT_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    setActiveTag(tag);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${
                    activeTag === tag
                      ? 'bg-primary dark:bg-primary-light text-white dark:text-neutral-900'
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Document List — Fixed height to always show 5 items */}
      <div className="h-[280px] overflow-y-auto overflow-x-hidden space-y-0 divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paddedDocs.length > 0 ? paddedDocs.map((doc, index) => {
          // Handle empty rows (null entries)
          if (!doc) {
            return (
              <div key={`empty-${index}`} className="h-[56px] py-2"></div>
            );
          }
          const docTypeLabel = getDocumentTypeLabel(doc.type);
          const views = doc.views || 0;
          const comments = doc.comments || 0;
          const engagement = views + (comments * 3);
          return (
            <div key={doc.id} className="h-[56px] py-2 first:pt-0 group/doc cursor-pointer transition-all duration-200 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 rounded">
              {/* Title + Tag */}
              <div className="flex items-center justify-between gap-1.5 mb-0.5 min-w-0">
                <h4 className="text-[11px] font-bold text-neutral-900 dark:text-white leading-tight group-hover/doc:text-primary dark:group-hover/doc:text-primary-light transition-colors truncate flex-1 min-w-0">{doc.title}</h4>
                <span className={`shrink-0 px-1 py-px text-[7px] font-bold uppercase tracking-wider rounded border ${TAG_COLORS[docTypeLabel] || 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}>{docTypeLabel}</span>
              </div>

              {/* Upload Date + Metrics inline */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium shrink-0">
                  {formatDocDate(doc.createdAt)}
                </span>
                {views > 0 && (
                  <>
                    <span className="text-neutral-200 dark:text-neutral-700 shrink-0">·</span>
                    <span className="flex items-center gap-0.5 text-[9px] text-neutral-400 dark:text-neutral-500 shrink-0">
                      <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                      <span className="font-medium">{views.toLocaleString()}</span>
                    </span>
                  </>
                )}
                {comments > 0 && (
                  <>
                    <span className="text-neutral-200 dark:text-neutral-700 shrink-0">·</span>
                    <span className="flex items-center gap-0.5 text-[9px] text-neutral-400 dark:text-neutral-500 shrink-0">
                      <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                      <span className="font-medium">{comments}</span>
                    </span>
                  </>
                )}
                {engagement > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] text-neutral-400 dark:text-neutral-500 ml-auto shrink-0">
                    <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
                    <span className="font-medium">{engagement.toLocaleString()}</span>
                  </span>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="flex items-center justify-center py-5">
            <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">No documents found</p>
          </div>
        )}
      </div>

      {/* Pagination — pinned to bottom via mt-auto */}
      <div className="flex items-center justify-center gap-2 mt-auto pt-2.5 border-t border-neutral-100/80 dark:border-neutral-800/50">
        {totalPages > 1 ? (
          <>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-1.5 py-1 rounded text-[9px] font-bold transition-all duration-200 ${
                currentPage === 1
                  ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            </button>
            <span className="px-1 text-[9px] font-medium text-neutral-400 dark:text-neutral-500">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-1.5 py-1 rounded text-[9px] font-bold transition-all duration-200 ${
                currentPage === totalPages
                  ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
          </>
        ) : (
          <span className="px-1 text-[9px] font-medium text-neutral-400 dark:text-neutral-500">1 / 1</span>
        )}
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
        <div className="absolute z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl p-4 pointer-events-none -translate-x-1/2 -translate-y-[110%] rounded-lg" style={{ left: `${(getX(hoverIndex) / width) * 100}%`, top: `${(getYPrice(CHART_DATA[hoverIndex].price) / height) * 100}%` }}>
          <div className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2 border-b border-neutral-200 dark:border-neutral-700 pb-1">{CHART_DATA[hoverIndex].month}</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-8">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Share Value</span>
              <span className="text-xs font-black text-primary">$ {CHART_DATA[hoverIndex].price}</span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Registry Sum</span>
              <span className="text-xs font-black text-neutral-900 dark:text-neutral-100">{(CHART_DATA[hoverIndex].shares / 1000000).toFixed(2)}M</span>
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

// ── TimeOfDayIcon removed — replaced by animated atmospheric scene ──
// The greeting card now uses inline animated SVGs (sun/moon/clouds/stars)
// directly in the JSX for a dynamic iPhone-like weather widget effect.

// Props interface
interface OverviewDashboardProps {
  applicants: Applicant[];
  onViewChange?: (view: string) => void;
}

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

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ applicants, onViewChange }) => {
  const [selectedInvestor, setSelectedInvestor] = useState<Applicant | null>(null);
  const [officialShareholders, setOfficialShareholders] = useState<OfficialShareholder[]>([]);
  const [engagementRecords, setEngagementRecords] = useState<any[]>([]);
  const [engagementLoading, setEngagementLoading] = useState(true);

  // Load engagement records from service
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

  // Memoized engagement data
  const topInvestors = useMemo(() => {
    return engagementRecords
      .sort((a, b) => b.engagementScore - a.engagementScore);
      // Limit will be applied in component (Top 10)
  }, [engagementRecords]);

  const topContent = useMemo(() => {
    const content = generateMostEngagedContent(engagementRecords);
    return content; // Limit will be applied in component (Top 10)
  }, [engagementRecords]);

  const recentActivities = useMemo(() => {
    const activities = generateUserActivities(engagementRecords);
    return activities; // Limit will be applied in component (20 records)
  }, [engagementRecords]);
  const [statusCache, setStatusCache] = useState<Record<string, string>>({});
  
  // Press Release state
  const [pressReleaseView, setPressReleaseView] = useState<'none' | 'all' | 'detail'>('none');
  const [selectedPressRelease, setSelectedPressRelease] = useState<PressRelease | null>(null);
  const [relatedReleases, setRelatedReleases] = useState<PressRelease[]>([]);

  // Handle press release selection
  const handleSelectPressRelease = async (release: PressRelease) => {
    setSelectedPressRelease(release);
    setPressReleaseView('detail');
    // Fetch related releases (same category, excluding current)
    const all = await getAllPressReleases();
    const related = all.filter(r => r.id !== release.id && r.category === release.category).slice(0, 3);
    // If not enough from same category, add from others
    if (related.length < 3) {
      const others = all.filter(r => r.id !== release.id && r.category !== release.category).slice(0, 3 - related.length);
      related.push(...others);
    }
    setRelatedReleases(related);
  };

  // ── Time-Aware Greeting State ──────────────────────────────────────
  const [activeDetailTab, setActiveDetailTab] = useState<'holdings' | 'engagement'>('holdings');
  const [isPulsing, setIsPulsing] = useState(false);
  const [timeContext, setTimeContext] = useState<TimeContext>(() => getCurrentTimeContext());
  const [segmentAnimating, setSegmentAnimating] = useState(false);
  const [liveTime, setLiveTime] = useState(() => new Date());
  const [locationCity, setLocationCity] = useState<string>('');
  const [sweepTriggered, setSweepTriggered] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const hasAnimatedRef = useRef(false);
  const segmentCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simple share price widget state
  const [shareData, setShareData] = useState<ShareDataPoint[]>([]);
  const [shareStats, setShareStats] = useState<{ current: number; change: number; changePercent: number } | null>(null);
  const [shareRange, setShareRange] = useState<TimeRange>('6M');

  // Fetch share price data
  useEffect(() => {
    const fetchShareData = async () => {
      const [data, stats] = await Promise.all([
        getDataByRange(shareRange),
        getPriceStats(shareRange),
      ]);
      setShareData(data);
      setShareStats({ current: stats.current, change: stats.change, changePercent: stats.changePercent });
    };
    fetchShareData();
  }, [shareRange]);

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

  // Compute statuses asynchronously and cache them
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
    
    computeStatuses();
  }, [applicants]);

  // ── Time-Segment Aware Animation Trigger ──────────────────────────
  // ── Fetch Location on Mount ────────────────────────────────────────
  useEffect(() => {
    getLocationString().then(city => {
      if (city) setLocationCity(city);
    }).catch(() => {
      // Silently fail, location will remain empty
    });
  }, []);

  // ── Fetch Weather Data (every 10 minutes) ─────────────────────────
  useEffect(() => {
    const loadWeather = () => {
      fetchWeather().then(data => {
        if (data) {
          setWeatherData(data);
          // Also update location from weather API if we haven't got one yet
          if (!locationCity && data.city) setLocationCity(data.city);
        }
      }).catch(() => { /* Silently fail — weather is ambient info */ });
    };
    loadWeather();
    const weatherInterval = setInterval(loadWeather, 10 * 60 * 1000); // refresh every 10 min
    return () => clearInterval(weatherInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial Greeting Animation (on mount or when selectedInvestor changes) ──
  // Sweep animation triggers on EVERY page visit, regardless of segment change or previous animation.
  useEffect(() => {
    if (!selectedInvestor) {
      const { shouldAnimate, context } = shouldTriggerGreetingAnimation();
      setTimeContext(context);

      // Always trigger sweep animation on page visit
      setSweepTriggered(true);
      setTimeout(() => setSweepTriggered(false), 2000);

      if (shouldAnimate && !hasAnimatedRef.current) {
        hasAnimatedRef.current = true;
        setIsPulsing(true);
        setSegmentAnimating(true);
        // End segment-change animation class after it plays
        const timer = setTimeout(() => {
          setSegmentAnimating(false);
        }, 900);
        return () => clearTimeout(timer);
      } else if (!hasAnimatedRef.current) {
        hasAnimatedRef.current = true;
        setIsPulsing(true);
      }
    } else {
      // Reset flag when navigating to detail view so it re-checks on return
      hasAnimatedRef.current = false;
      setIsPulsing(false);
      setSweepTriggered(false);
    }
  }, [selectedInvestor]);

  // ── Live Time Segment Checker (every 5 minutes) ─────────────────
  // Detects real-time transitions (e.g., morning → afternoon) while
  // the user stays on the dashboard.
  useEffect(() => {
    segmentCheckIntervalRef.current = setInterval(() => {
      const newContext = getCurrentTimeContext();
      setTimeContext(prev => {
        if (prev.segment !== newContext.segment || prev.weather !== newContext.weather) {
          // Time segment or weather changed while on page
          setIsPulsing(true);
          setSegmentAnimating(true);
          setTimeout(() => setSegmentAnimating(false), 900);
          // Update localStorage so next page load won't re-animate
          try {
            localStorage.setItem('eurolandHub_lastGreetingSegment', newContext.segment);
            localStorage.setItem('eurolandHub_lastGreetingWeather', newContext.weather);
            localStorage.setItem('eurolandHub_lastGreetingAnimatedAt', Date.now().toString());
          } catch { /* ignore */ }
          return newContext;
        }
        return prev;
      });
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      if (segmentCheckIntervalRef.current) {
        clearInterval(segmentCheckIntervalRef.current);
      }
    };
  }, []);

  // ── Live Clock (updates every 30s for smooth celestial movement) ──
  useEffect(() => {
    const clockTimer = setInterval(() => setLiveTime(new Date()), 30_000);
    return () => clearInterval(clockTimer);
  }, []);

  // Calculate status for regular accounts
  const getAccountStatus = (applicant: Applicant) => {
    if (applicant.isPreVerified) return null; // Pre-verified uses different status mapping
    const internalStatus = getWorkflowStatusInternal(applicant);
    return getGeneralAccountStatus(internalStatus);
  };

  if (selectedInvestor) {
    // Get account status
    const getDisplayStatus = () => {
      if (selectedInvestor.isPreVerified) {
        if (selectedInvestor.accountStatus) {
          return selectedInvestor.accountStatus === 'VERIFIED' ? 'VERIFIED INVESTOR' : 
                 selectedInvestor.accountStatus === 'PENDING' ? 'PENDING INVESTOR' : 
                 'UNVERIFIED INVESTOR';
        }
        return 'PENDING INVESTOR';
      }
      const internalStatus = getWorkflowStatusInternal(selectedInvestor);
      const status = getGeneralAccountStatus(internalStatus);
      return status === 'VERIFIED' ? 'VERIFIED INVESTOR' : 
             status === 'PENDING' ? 'PENDING INVESTOR' : 
             'UNVERIFIED INVESTOR';
    };

    const displayStatus = getDisplayStatus();
    const initials = getInitials(selectedInvestor.fullName);

    return (
      <div className="max-w-screen-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button onClick={() => setSelectedInvestor(null)} className="flex items-center gap-2 text-[10px] font-black text-neutral-500 dark:text-neutral-400 hover:text-primary transition-colors uppercase tracking-widest group">
          <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          Master Dashboard
        </button>
        
        {/* Profile Card - Matching image style */}
        <div className="bg-neutral-700 dark:bg-neutral-800 rounded-lg p-8 flex items-center gap-8">
          {/* Avatar with teal-green background */}
          <div className="w-20 h-20 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-2xl shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white uppercase tracking-tight mb-2">{selectedInvestor.fullName}</h2>
            {/* Status with icon */}
            <div className="flex items-center gap-2 mb-6">
              {displayStatus === 'VERIFIED INVESTOR' && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                  <p className="text-base text-emerald-400 font-medium uppercase tracking-wide">{displayStatus}</p>
                </div>
              )}
              {displayStatus === 'PENDING INVESTOR' && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  <p className="text-base text-amber-400 font-medium uppercase tracking-wide">{displayStatus}</p>
                </div>
              )}
              {(displayStatus === 'UNVERIFIED INVESTOR' || !displayStatus.includes('VERIFIED') && !displayStatus.includes('PENDING')) && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                  </svg>
                  <p className="text-base text-neutral-400 font-medium uppercase tracking-wide">{displayStatus}</p>
                </div>
              )}
            </div>
            {/* Profile data inline */}
            {(() => {
              const getRegistrationId = (): string => {
                const internalStatus = getWorkflowStatusInternal(selectedInvestor);
                if (internalStatus === 'RESUBMISSION_REQUIRED') return '';
                if (internalStatus === 'VERIFIED' || internalStatus === 'AWAITING_IRO_REVIEW') {
                  return selectedInvestor.shareholdingsVerification?.step2?.shareholdingsId ||
                         selectedInvestor.registrationId ||
                         selectedInvestor.id;
                }
                if (selectedInvestor.isPreVerified && selectedInvestor.registrationId) return selectedInvestor.registrationId;
                return selectedInvestor.id;
              };
              const regId = getRegistrationId();
              const displayRegId = !regId ? '—' : regId.length > 6 ? regId.slice(-6) : regId;
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8 mt-6">
                  <div>
                    <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Registration ID</p>
                    <p className="text-sm text-white">{displayRegId}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Email</p>
                    <p className="text-sm text-white">{selectedInvestor.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Contact</p>
                    <p className="text-sm text-white">{selectedInvestor.phoneNumber || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Network Origin</p>
                    <p className="text-sm text-white">{selectedInvestor.location || 'Global Hub'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Registry Date</p>
                    <p className="text-sm text-white">
                      {selectedInvestor.submissionDate ? new Date(selectedInvestor.submissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm rounded-xl overflow-hidden">
          <div className="flex border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30">
            <button onClick={() => setActiveDetailTab('holdings')} className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'holdings' ? 'text-blue-400' : 'text-neutral-400 hover:text-blue-400'}`}>
              Holdings summary
              {activeDetailTab === 'holdings' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-400"></div>}
            </button>
            <button onClick={() => setActiveDetailTab('engagement')} className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'engagement' ? 'text-blue-400' : 'text-neutral-400 hover:text-blue-400'}`}>
              Engagement
              {activeDetailTab === 'engagement' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-400"></div>}
            </button>
          </div>
          <div className="p-10">
            {activeDetailTab === 'holdings' ? (
              <HoldingsSummary applicant={selectedInvestor} />
            ) : (
              <EngagementTabContent applicant={selectedInvestor} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Press Release Sub-Views ─────────────────────────────────────────
  if (pressReleaseView === 'all') {
  return (
      <div className="space-y-10 max-w-screen-2xl mx-auto pb-12">
        <AllPressReleasesView
          onBack={() => setPressReleaseView('none')}
          onSelectRelease={handleSelectPressRelease}
        />
      </div>
    );
  }

  if (pressReleaseView === 'detail' && selectedPressRelease) {
    return (
      <div className="space-y-10 max-w-screen-2xl mx-auto pb-12">
        <PressReleaseDetail
          release={selectedPressRelease}
          relatedReleases={relatedReleases}
          onBack={() => {
            setSelectedPressRelease(null);
            setPressReleaseView('none');
          }}
          onSelectRelated={handleSelectPressRelease}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-screen-2xl mx-auto pb-6">
      {/* Row 1: Greetings Card (70%) + Share Price (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
        {/* Greetings Card - 70% (7 columns out of 10) */}
        <div className="lg:col-span-7 min-h-[180px]">
        {/* Left: Greetings Card — Weather-Reactive Ambient Widget */}
        {(() => {
          // Determine weather category & night status from real data when available
          const wxCategory: WeatherCategory = weatherData ? getWeatherCategory(weatherData.main) : 'unknown';
          const wxIsNight = weatherData ? isNightIcon(weatherData.icon) : !isDaytime(timeContext.segment);
          const hasRealWeather = weatherData !== null && wxCategory !== 'unknown';

          // Use weather-reactive gradient when real data is available, fallback to time-only theme
          const timeTheme = getGreetingTheme(timeContext.segment);
          const wxGradient = hasRealWeather ? getWeatherGradient(wxCategory, wxIsNight) : null;

          // Merge: weather gradient overrides time-only theme colors when available
          const theme = wxGradient ? { ...timeTheme, ...wxGradient } : timeTheme;

          const subtitle = getGreetingSubtitle(timeContext.segment);
          const isNight = wxIsNight;
          const daytime = !isNight;
          const fillColor = theme.iconFill;
          const glowColor = theme.glowColor;
          const dateLine = getWidgetDateLine(liveTime);

          // Weather condition booleans for particle effects
          const isRainy = wxCategory === 'rain' || wxCategory === 'drizzle';
          const isThunder = wxCategory === 'thunderstorm';
          const isSnowy = wxCategory === 'snow';
          const isCloudy = wxCategory === 'clouds' || wxCategory === 'overcast';
          const isMisty = wxCategory === 'mist';
          const showClouds = daytime || isCloudy;

          // Cloud opacity — heavier for cloudy weather
          const cloudOpacity = isCloudy ? 0.22 : 0.12;

          // ── Dynamic Celestial Positions ───────────────────────
          const sunPos = getSunPosition(liveTime);
          const moonPos = getMoonPosition(liveTime);
          const sunWarmth = getSunWarmth(sunPos.progress);

          // Sun color varies: warm orange at dawn/dusk, bright yellow at noon
          const isLowSun = sunPos.progress < 0.12 || sunPos.progress > 0.88;
          const isMidLowSun = sunPos.progress < 0.22 || sunPos.progress > 0.78;
          const sunFillColor = isLowSun ? '#F97316' : isMidLowSun ? '#FBBF24' : '#F5C211';
          const sunGlowColor = isLowSun
            ? 'rgba(249, 115, 22, 0.55)'
            : isMidLowSun
              ? 'rgba(251, 191, 36, 0.50)'
              : 'rgba(245, 194, 17, 0.45)';
          const sunDiscSize = isCloudy ? 52 : 62;

          // Radial glow follows sun/moon position
          const celestialGlowX = daytime ? sunPos.x : moonPos.x;
          const celestialGlowY = daytime ? sunPos.y : moonPos.y;
          // Map from atmospheric container (right 55%) to full card coordinates
          const glowCardX = 45 + (celestialGlowX / 100) * 55;

          // Weather emoji & display text
          const wxEmoji = hasRealWeather ? getWeatherEmoji(wxCategory, isNight) : '';
          const wxTemp = weatherData ? `${weatherData.temp}°C` : '';
          const wxDesc = weatherData ? capitalizeDescription(weatherData.description) : '';
          const displayCity = weatherData?.city || locationCity;

          return (
            <div className={`flex-1 rounded-xl relative overflow-hidden group transition-all duration-[1000ms] cursor-default ease-in-out ${theme.shadowClass}
              ${theme.bgClass}
              ${isPulsing ? '' : 'hover:shadow-lg'}
      `}
      onMouseEnter={() => setIsPulsing(true)}
      onMouseLeave={() => setIsPulsing(false)}
      >
              {/* ── Layer 1: Noise texture ─────────────────────── */}
              <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden z-0">
                <svg className="absolute inset-0 w-full h-full">
            <filter id="greetings-noise-filter">
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                  </filter>
                  <rect width="100%" height="100%" filter="url(#greetings-noise-filter)" className={`${theme.noiseOpacity}`} />
                </svg>
              </div>

              {/* ── Layer 2: Ambient overlay ──────────────────── */}
              <div className={`absolute inset-0 rounded-xl pointer-events-none transition-all duration-[2000ms] ease-in-out z-[1] ${theme.overlayClass}`} />

              {/* ── Layer 3: Radial glow (follows celestial body) ─ */}
              <div
                className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-[2000ms] ease-in-out z-[2] animate-glow-breathe"
                style={{
                  background: `radial-gradient(ellipse 40% 65% at ${glowCardX}% ${celestialGlowY}%, ${daytime ? sunGlowColor : glowColor}, transparent 65%)`,
                  opacity: isPulsing ? 1 : 0.6,
                }}
              />

              {/* ── Layer 3b: Weather Particle Layer ───────────── */}
              <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden z-[2]">

                {/* Rain particles */}
                {(isRainy || isThunder) && (
                  <>
                    {Array.from({ length: 18 }).map((_, i) => (
                      <div
                        key={`rain-${i}`}
                        className="absolute animate-rain-fall"
                        style={{
                          left: `${5 + (i * 5.2) % 90}%`,
                          top: '-10px',
                          width: 1.5,
                          height: isThunder ? 18 : 14,
                          background: isNight
                            ? 'linear-gradient(to bottom, transparent, rgba(147,197,253,0.35), transparent)'
                            : 'linear-gradient(to bottom, transparent, rgba(59,130,246,0.30), transparent)',
                          borderRadius: 1,
                          animationDelay: `${(i * 0.15) % 1.2}s`,
                          animationDuration: isThunder ? '0.9s' : '1.2s',
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Lightning flash overlay */}
                {isThunder && (
                  <div className="absolute inset-0 animate-lightning-flash bg-white/10 rounded-xl" />
                )}

                {/* Snow particles */}
                {isSnowy && (
                  <>
                    {Array.from({ length: 14 }).map((_, i) => (
                      <div
                        key={`snow-${i}`}
                        className="absolute rounded-full animate-snow-fall"
                        style={{
                          left: `${3 + (i * 7.3) % 90}%`,
                          top: '-6px',
                          width: 3 + (i % 3),
                          height: 3 + (i % 3),
                          backgroundColor: 'rgba(255,255,255,0.5)',
                          animationDelay: `${(i * 0.4) % 4}s`,
                          animationDuration: `${3.5 + (i % 3)}s`,
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Mist layer */}
                {isMisty && (
                  <>
                    <div
                      className="absolute animate-mist-drift rounded-full blur-2xl"
                      style={{ bottom: '10%', left: '5%', width: '60%', height: 40, backgroundColor: 'rgba(255,255,255,0.08)' }}
                    />
                    <div
                      className="absolute animate-mist-drift rounded-full blur-3xl"
                      style={{ bottom: '25%', left: '20%', width: '50%', height: 30, backgroundColor: 'rgba(255,255,255,0.06)', animationDelay: '-10s' }}
                    />
                  </>
                )}
              </div>

              {/* ── Layer 4: Atmospheric Scene (right half) ────── */}
              <div className="absolute right-0 top-0 w-[55%] h-full pointer-events-none z-[3]">

                {/* ═══ Sun System — dynamic arc position ═══ */}
                {daytime && !isRainy && !isThunder && !isSnowy && (
                  <div
                    className="absolute transition-all duration-[2000ms] ease-out group-hover:translate-x-1 group-hover:-translate-y-1"
                    style={{ left: `${sunPos.x}%`, top: `${sunPos.y}%` }}
                  >
                    {/* Ambient glow behind sun */}
                    <div
                      className="absolute animate-celestial-glow blur-3xl rounded-full"
                      style={{
                        width: 130, height: 130,
                        left: '50%', top: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: sunGlowColor,
                      }}
                    />

                    {/* Rotating ray ring (hidden on cloudy) */}
                    {!isCloudy && (
                      <div
                        className="absolute rounded-full animate-spin-slow"
                        style={{
                          width: 88, height: 88,
                          left: '50%', top: '50%',
                          transform: 'translate(-50%, -50%)',
                          background: `conic-gradient(from 0deg, transparent, ${sunGlowColor}, transparent, ${sunGlowColor}, transparent, ${sunGlowColor}, transparent)`,
                          opacity: 0.15,
                          filter: 'blur(6px)',
                        }}
                      />
                    )}

                    {/* Sun disc */}
                    <div
                      className="relative rounded-full"
                      style={{
                        width: sunDiscSize,
                        height: sunDiscSize,
                        background: `radial-gradient(circle at 35% 35%, #FFE066, ${sunFillColor}, ${isLowSun ? '#C2410C' : '#D97706'})`,
                        border: '1px solid rgba(255, 255, 255, 0.35)',
                        boxShadow: `0 0 28px 8px ${sunGlowColor}, 0 0 50px 16px ${sunGlowColor.replace(/[\d.]+\)$/, '0.18)')}, inset 0 -3px 6px rgba(180, 100, 0, 0.25), inset 0 3px 6px rgba(255, 224, 102, 0.35)`,
                        transform: 'translate(-50%, -50%)',
                        opacity: isCloudy ? 0.8 : 1,
                      }}
                    />

                    {/* Cloud wrapping around the sun — bottom-right */}
                    <svg
                      className="absolute"
                      style={{
                        width: 110, height: 55,
                        right: '-50px', bottom: '-40px',
                        transform: 'translate(-50%, -50%)',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))',
                      }}
                      viewBox="0 0 120 60"
                    >
                      <defs>
                        <linearGradient id="sun-cloud-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
                          <stop offset="100%" stopColor="white" stopOpacity="0.7" />
                        </linearGradient>
                      </defs>
                      <path d="M20 45 Q20 32 32 28 Q30 18 48 14 Q66 10 68 24 Q76 18 88 22 Q100 26 98 38 Q102 46 90 48 H28 Q18 48 20 45Z" fill="url(#sun-cloud-grad)" />
                      <path d="M28 46 Q28 38 38 34 Q40 26 52 24 Q62 22 64 30 Q70 26 78 30 Q86 34 84 40 H34 Q28 44 28 46Z" fill="white" opacity="0.45" />
                    </svg>

                    {/* Cloud wrapping — left-bottom */}
                    <svg
                      className="absolute"
                      style={{
                        width: 80, height: 42,
                        left: '-60px', bottom: '-30px',
                        transform: 'translate(-50%, -50%)',
                        filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.03))',
                      }}
                      viewBox="0 0 100 50"
                    >
                      <path d="M15 40 Q15 30 26 27 Q24 18 38 15 Q52 12 54 22 Q60 17 70 20 Q80 24 78 34 Q82 42 72 42 H24 Q15 43 15 40Z" fill="white" opacity="0.8" />
                    </svg>
                  </div>
                )}

                {/* ═══ Weather Override — Rain/Thunder cloud ═══ */}
                {(isRainy || isThunder) && (
                  <div
                    className="absolute transition-all duration-1000 group-hover:translate-x-1 group-hover:-translate-y-1"
                    style={{ right: '16%', top: '30%' }}
                  >
                    <div
                      className="absolute animate-celestial-glow blur-3xl rounded-full"
                      style={{
                        width: 100, height: 100,
                        left: '50%', top: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: glowColor,
                      }}
                    />
                    <svg viewBox="0 0 24 24" className={`${daytime ? 'w-16 h-16' : 'w-14 h-14'} relative`} style={{ filter: `drop-shadow(0 0 8px ${glowColor})`, transform: 'translate(-50%, -50%)' }}>
                      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" fill={fillColor} stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={theme.iconColor} />
                      <line x1="8" y1="19" x2="8" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={theme.iconColor} opacity="0.6" />
                      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={theme.iconColor} opacity="0.45" />
                      <line x1="16" y1="19" x2="16" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={theme.iconColor} opacity="0.6" />
                    </svg>
                  </div>
                )}

                {/* ═══ Weather Override — Snow cloud ═══ */}
                {isSnowy && (
                  <div
                    className="absolute transition-all duration-1000 group-hover:translate-x-1 group-hover:-translate-y-1"
                    style={{ right: '16%', top: '30%' }}
                  >
                    <div
                      className="absolute animate-celestial-glow blur-3xl rounded-full"
                      style={{
                        width: 100, height: 100,
                        left: '50%', top: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: glowColor,
                      }}
                    />
                    <svg viewBox="0 0 24 24" className={`${daytime ? 'w-16 h-16' : 'w-14 h-14'} relative`} style={{ filter: `drop-shadow(0 0 8px ${glowColor})`, transform: 'translate(-50%, -50%)' }}>
                      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" fill={fillColor} stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={theme.iconColor} />
                      <circle cx="8" cy="20" r="1" fill="currentColor" className={theme.iconColor} opacity="0.55" />
                      <circle cx="12" cy="22" r="1" fill="currentColor" className={theme.iconColor} opacity="0.35" />
                      <circle cx="16" cy="20" r="1" fill="currentColor" className={theme.iconColor} opacity="0.55" />
                    </svg>
                  </div>
                )}

                {/* ═══ Moon System — dynamic arc + rise animation ═══ */}
                {!daytime && !isRainy && !isThunder && !isSnowy && (
                  <div
                    className="absolute animate-moon-rise transition-all duration-[2000ms] ease-out group-hover:translate-x-1 group-hover:-translate-y-1"
                    style={{ left: `${moonPos.x}%`, top: `${moonPos.y}%` }}
                  >
                    {/* Moon ambient glow */}
                    <div
                      className="absolute rounded-full animate-celestial-glow blur-2xl"
                      style={{
                        width: 100, height: 100,
                        left: '50%', top: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: glowColor,
                      }}
                    />
                    {/* Moon shimmer ring */}
                    <div
                      className="absolute rounded-full animate-pulse"
                      style={{
                        width: 88, height: 88,
                        left: '50%', top: '50%',
                        transform: 'translate(-50%, -50%)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        opacity: 0.5,
                      }}
                    />
                    {/* Moon full disc + craters */}
                    <div
                      className="relative rounded-full animate-moon-float"
                      style={{
                        width: 62,
                        height: 62,
                        background: 'radial-gradient(circle at 35% 35%, #e8e8e8, #c0c0c0, #a8a8a8)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: `0 0 24px 6px ${glowColor}, inset 0 -3px 6px rgba(0,0,0,0.12), inset 0 3px 6px rgba(255,255,255,0.18)`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="absolute rounded-full" style={{ width: 12, height: 12, top: '22%', left: '18%', backgroundColor: 'rgba(0,0,0,0.10)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.14)' }} />
                      <div className="absolute rounded-full" style={{ width: 9, height: 9, top: '52%', left: '55%', backgroundColor: 'rgba(0,0,0,0.08)', boxShadow: 'inset 0 1px 1.5px rgba(0,0,0,0.10)' }} />
                      <div className="absolute rounded-full" style={{ width: 6, height: 6, top: '36%', left: '62%', backgroundColor: 'rgba(0,0,0,0.06)', boxShadow: 'inset 0 0.5px 1px rgba(0,0,0,0.08)' }} />
                    </div>
                  </div>
                )}

                {/* ═══ Clouds — visible daytime or cloudy ═══ */}
                {showClouds && (
                  <>
                    <svg
                      className="absolute animate-cloud-drift transition-transform duration-1000 group-hover:translate-x-3"
                      style={{ top: '8%', right: '2%', width: 105, opacity: cloudOpacity, animationDelay: '0s' }}
                      viewBox="0 0 100 45"
                    >
                      <defs>
                        <linearGradient id="cloud-grad-1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="white" stopOpacity="1" />
                          <stop offset="100%" stopColor="white" stopOpacity="0.65" />
                        </linearGradient>
                      </defs>
                      <path d="M20 35 Q20 25 30 23 Q28 14 42 12 Q56 10 58 20 Q64 16 74 20 Q84 24 82 32 Q84 38 74 38 H28 Q20 38 20 35Z" fill="url(#cloud-grad-1)" />
                      <path d="M24 36 Q24 30 32 28 Q34 22 44 21 Q52 20 54 26 Q58 22 64 25 Q72 28 70 34 H30 Q24 37 24 36Z" fill="white" opacity="0.45" />
                    </svg>
                    <svg
                      className="absolute animate-cloud-drift-reverse transition-transform duration-1000 group-hover:translate-x-2"
                      style={{ top: '45%', right: '30%', width: 75, opacity: cloudOpacity * 0.65, animationDelay: '-14s' }}
                      viewBox="0 0 100 45"
                    >
                      <path d="M18 34 Q18 26 28 24 Q26 16 38 13 Q52 10 54 20 Q60 16 68 19 Q78 22 76 30 Q78 36 70 36 H26 Q18 37 18 34Z" fill="white" />
                      <path d="M22 35 Q22 30 30 28 Q32 22 42 20 Q50 18 52 24 Q56 20 62 23 Q70 26 68 32 H28 Q22 36 22 35Z" fill="white" opacity="0.35" />
                    </svg>
                    <svg
                      className="absolute animate-cloud-drift transition-transform duration-1000 group-hover:translate-x-1"
                      style={{ top: '72%', right: '8%', width: 50, opacity: cloudOpacity * 0.45, animationDelay: '-22s' }}
                      viewBox="0 0 100 45" fill="white"
                    >
                      <path d="M22 34 Q22 26 32 24 Q30 17 44 15 Q56 13 58 22 Q66 18 74 22 Q82 26 80 32 Q82 37 72 37 H30 Q22 37 22 34Z" />
                    </svg>
                  </>
                )}

                {/* ═══ Stars — sparkle shapes (night + clear) ═══ */}
                {!daytime && !isRainy && !isThunder && !isSnowy && !isCloudy && (
                  <>
                    {[
                      { x: '8%',  y: '10%', s: 10, d: '0s',   dur: '4s' },
                      { x: '35%', y: '6%',  s: 7,  d: '1.5s', dur: '5s' },
                      { x: '68%', y: '18%', s: 9,  d: '0.8s', dur: '4.5s' },
                      { x: '18%', y: '52%', s: 6,  d: '2.2s', dur: '3.5s' },
                      { x: '82%', y: '8%',  s: 8,  d: '0.3s', dur: '5.5s' },
                      { x: '55%', y: '45%', s: 5,  d: '1.8s', dur: '4s' },
                      { x: '28%', y: '32%', s: 7,  d: '2.5s', dur: '3s' },
                      { x: '88%', y: '38%', s: 5,  d: '1.2s', dur: '6s' },
                      { x: '5%',  y: '38%', s: 6,  d: '3s',   dur: '4.8s' },
                      { x: '48%', y: '68%', s: 5,  d: '0.5s', dur: '5.2s' },
                      { x: '75%', y: '55%', s: 4,  d: '2.8s', dur: '4.2s' },
                      { x: '42%', y: '22%', s: 6,  d: '1s',   dur: '5.8s' },
                    ].map((star, i) => (
                      <svg
                        key={`star-${i}`}
                        className="absolute animate-star-twinkle"
                        style={{
                          left: star.x, top: star.y,
                          width: star.s, height: star.s,
                          animationDelay: star.d,
                          animationDuration: star.dur,
                        }}
                        viewBox="0 0 8 9"
                        fill="white"
                      >
                        <path d="M2.83 3C2.05 3.85 1.11 4.3 0 4.35C1.11 4.41 2.05 4.86 2.83 5.71C3.61 6.55 4 7.56 4 8.73C4 7.96 4.17 7.25 4.52 6.59C4.89 5.93 5.37 5.4 5.98 5.01C6.6 4.6 7.27 4.39 8 4.35C6.88 4.29 5.94 3.85 5.16 3.01C4.38 2.16 4 1.16 4 0C4 1.16 3.61 2.16 2.83 3Z" />
                      </svg>
                    ))}
                  </>
                )}

                {/* ═══ Floating Ambient Particles — depth layer ═══ */}
                {[
                  { x: '15%', y: '20%', s: 3,   d: '0s',   dur: '9s' },
                  { x: '45%', y: '65%', s: 2.5, d: '2s',   dur: '11s' },
                  { x: '70%', y: '30%', s: 2,   d: '4s',   dur: '10s' },
                  { x: '30%', y: '80%', s: 2.5, d: '1s',   dur: '8s' },
                  { x: '85%', y: '55%', s: 2,   d: '3s',   dur: '12s' },
                  { x: '55%', y: '15%', s: 1.5, d: '5s',   dur: '10s' },
                  { x: '10%', y: '60%', s: 2,   d: '6s',   dur: '9s' },
                  { x: '92%', y: '20%', s: 1.5, d: '2.5s', dur: '11s' },
                ].map((p, i) => (
                  <div
                    key={`particle-${i}`}
                    className="absolute rounded-full animate-particle-float"
                    style={{
                      left: p.x, top: p.y,
                      width: p.s, height: p.s,
                      backgroundColor: daytime ? 'rgba(255,255,255,0.6)' : 'rgba(200,210,255,0.4)',
                      animationDelay: p.d,
                      animationDuration: p.dur,
                    }}
                  />
                ))}

                {/* ═══ Horizon glow — dawn/evening warm band ═══ */}
                {(timeContext.segment === 'dawn' || timeContext.segment === 'evening') && (
                  <>
                    <div
                      className="absolute animate-horizon-pulse"
                      style={{
                        bottom: '12%', left: 0, right: 0, height: '18%',
                        background: timeContext.segment === 'dawn'
                          ? 'linear-gradient(to top, rgba(251,146,60,0.18), rgba(251,191,36,0.08), transparent)'
                          : 'linear-gradient(to top, rgba(239,68,68,0.12), rgba(251,146,60,0.06), transparent)',
                        borderRadius: '0 0 0.75rem 0',
                      }}
                    />
                    <div className="absolute bottom-[18%] left-[3%] right-[3%] h-px bg-white/[0.06]" />
                  </>
                )}
              </div>

              {/* ── Layer 5: Light Sweep / Ambient Pulse ────────── */}
              <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 z-[4] ${
                sweepTriggered || isPulsing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                <div 
                  key={sweepTriggered ? 'sweep-triggered' : 'sweep-idle'}
                  className={`absolute inset-0 bg-gradient-to-r from-transparent ${theme.sweepTint} to-transparent ${
                    isNight ? 'animate-ambient-pulse' : (sweepTriggered ? 'animate-sweep-once' : 'animate-sweep')
                  }`} 
                />
              </div>

              {/* ── Layer 6: Widget Content ─────────────────────── */}
              <div className={`relative z-10 px-10 py-9 flex flex-col justify-center h-full ${segmentAnimating ? 'animate-segment-fade-in' : ''}`}>
                <h1 className={`text-[28px] leading-tight font-bold tracking-tight mb-1.5 transition-all duration-[1000ms] ease-in-out group-hover:translate-x-1 ${theme.textColor}`}>
                  {timeContext.greeting}, IR Team
                </h1>
                <p className={`text-sm font-medium tracking-wide transition-all duration-[1000ms] ease-in-out group-hover:translate-x-1 delay-75 ${theme.subtitleColor} opacity-70 mb-2`}>
                  {dateLine}
                </p>
                <p className={`font-normal text-[15px] leading-relaxed transition-all duration-[1000ms] ease-in-out group-hover:translate-x-1 delay-100 ${theme.subtitleColor}`}>
                  {subtitle}
                </p>

                {/* Location + Weather line */}
                <div className={`flex items-center gap-1.5 mt-4 transition-all duration-[1000ms] ease-in-out group-hover:translate-x-1 delay-150`}>
                  {displayCity && (
                    <>
                      <svg className={`w-3.5 h-3.5 ${theme.subtitleColor} opacity-60`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className={`text-xs font-medium ${theme.subtitleColor} opacity-60`}>{displayCity}</span>
                    </>
                  )}
                  {hasRealWeather && weatherData && (
                    <>
                      {displayCity && <span className={`text-xs ${theme.subtitleColor} opacity-40 mx-0.5`}>•</span>}
                      <span className={`text-xs font-medium ${theme.subtitleColor} opacity-60`}>
                        {wxEmoji} {wxTemp} {wxDesc}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        </div>{/* end col-span-7 (Greetings Card - 70%) */}

        {/* Share Price — 30% (3 columns out of 10) */}
        <div className="lg:col-span-3">
          <div className="h-full min-h-[200px] rounded-xl bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] shadow-md relative overflow-hidden">
          {/* Noise texture */}
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden z-0">
            <svg className="absolute inset-0 w-full h-full opacity-[0.02] dark:opacity-[0.05]">
              <filter id="share-widget-noise">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
              <rect width="100%" height="100%" filter="url(#share-widget-noise)" />
          </svg>
        </div>

          {/* Edge-to-edge chart (fills left, right, bottom) */}
          <div className="absolute inset-0 top-[64px] z-[1]">
            {shareData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={shareData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sharePriceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={shareStats && shareStats.change >= 0 ? '#4F46E5' : '#c73630'} stopOpacity={0.2} />
                      <stop offset="80%" stopColor={shareStats && shareStats.change >= 0 ? '#4F46E5' : '#c73630'} stopOpacity={0.05} />
                      <stop offset="100%" stopColor={shareStats && shareStats.change >= 0 ? '#4F46E5' : '#c73630'} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const price = data.price;
                        const currentIndex = shareData.findIndex((d: any) => d.date === data.date);
                        const prevPrice = currentIndex > 0 ? shareData[currentIndex - 1].price : price;
                        const change = price - prevPrice;
                        const changePct = prevPrice !== 0 ? ((change / prevPrice) * 100) : 0;
                        return (
                          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg px-3 py-2 min-w-[130px]">
                            <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium mb-0.5">{data.date}</p>
                            <p className="text-xs font-black text-neutral-900 dark:text-white">₱{price.toFixed(2)}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {change >= 0 ? (
                                <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
          </svg>
                              ) : (
                                <svg className="w-2.5 h-2.5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
                                </svg>
                              )}
                              <span className={`text-[9px] font-bold ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {change >= 0 ? '+' : ''}{change.toFixed(2)} ({change >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ stroke: 'rgba(120,120,120,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={shareStats && shareStats.change >= 0 ? '#4F46E5' : '#c73630'}
                    strokeWidth={1.5}
                    fill="url(#sharePriceGradient)"
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 2, stroke: shareStats && shareStats.change >= 0 ? '#4F46E5' : '#c73630', fill: '#fff' }}
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
        </div>

          {/* Header (above chart) */}
          <div className="relative z-20 px-4 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5 text-primary dark:text-primary-light" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
              </svg>
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.12em]">Share Price</span>
        </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-0.5">
              {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeRange[]).map(range => (
                <button
                  key={range}
                  onClick={() => setShareRange(range)}
                  className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded transition-all duration-200 ${
                    shareRange === range
                      ? 'bg-primary dark:bg-primary-light text-white dark:text-neutral-900'
                      : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          
          {/* Price + Trend (overlaid on top of chart, bottom-left) */}
          <div className="absolute bottom-3 left-4 z-20">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                {shareStats ? `₱${shareStats.current.toFixed(2)}` : '—'}
              </span>
              {shareStats && (
                <span className={`flex items-center gap-0.5 text-[10px] font-bold ${shareStats.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {shareStats.change >= 0 ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
                    </svg>
                  )}
                  {shareStats.change >= 0 ? '+' : ''}{shareStats.changePercent.toFixed(2)}%
                </span>
              )}
            </div>
            <p className="text-[8px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">Last updated</p>
          </div>
        </div>{/* end share price card */}
        </div>{/* end col-span-3 (Share Price - 30%) */}
      </div>{/* end Row 1 grid */}

      {/* Row 2: Calendar + To-Do Task (combined) (70%) + Shareholder Snapshot (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
        {/* Calendar + To-Do Task Combined Container - 70% (7 columns out of 10) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-3 relative overflow-hidden min-h-[340px]">
          {/* Noise texture */}
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden z-0">
            <svg className="absolute inset-0 w-full h-full opacity-[0.02] dark:opacity-[0.05]">
              <filter id="calendar-todo-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
              <rect width="100%" height="100%" filter="url(#calendar-todo-noise)" />
            </svg>
          </div>
          <div className="relative z-10 h-full flex flex-col lg:flex-row gap-3">
            {/* Calendar Widget - Takes most of the space */}
            <div className="flex-1 min-w-0">
              <React.Suspense fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <CalendarWidget />
              </React.Suspense>
            </div>
            
            {/* Divider */}
            <div className="hidden lg:block w-px bg-neutral-200/80 dark:bg-neutral-700/50"></div>
            
            {/* To-Do Task Widget - Fixed width sidebar */}
            <div className="lg:w-[220px] shrink-0">
              <React.Suspense fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <TodoTaskWidget noContainer={true} />
              </React.Suspense>
            </div>
          </div>
        </div>
        
        {/* Shareholder Snapshot - 30% (3 columns out of 10) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-3 relative overflow-hidden min-h-[340px]">
          {/* Noise texture */}
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
            <svg className="absolute inset-0 w-full h-full opacity-[0.02] dark:opacity-[0.05]">
              <filter id="snapshot-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
              <rect width="100%" height="100%" filter="url(#snapshot-noise)" />
            </svg>
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-[0.08em]">Shareholder Snapshot</h3>
                <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">User Segmentation Overview</p>
              </div>
              <div className="flex items-center gap-2 text-neutral-300 dark:text-neutral-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
            </div>
            <ShareholderSnapshot applicants={applicants} />
          </div>
        </div>
      </div>

      {/* Row 3: Metrics Cards (50%) + Documents Released (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
        {/* Metrics Cards - 50% (5 columns out of 10), 4 cards in 2x2 grid */}
        <div className="lg:col-span-5">
          <div className="grid grid-cols-2 gap-3 overflow-visible h-[400px]">
            {(() => {
              // Calculate new dashboard metrics
              const totalOfficialShareholders = officialShareholders.length;
              
              const verifiedCount = officialShareholders.filter(sh => sh.status === 'VERIFIED').length;
              const verifiedPercentage = totalOfficialShareholders > 0 
                ? Math.round((verifiedCount / totalOfficialShareholders) * 100) 
                : 0;
              
              // Active Users (Last 30 Days)
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              const activeUsers30Days = applicants.filter(a => {
                const internalStatus = (statusCache[a.id] || 'REGISTRATION_PENDING') as any;
                const isVerified = getGeneralAccountStatus(internalStatus) === 'VERIFIED';
                if (!isVerified) return false;
                
                if (a.lastActive && a.lastActive !== 'Never') {
                  try {
                    const lastActiveDate = new Date(a.lastActive);
                    if (!isNaN(lastActiveDate.getTime())) {
                      return lastActiveDate >= thirtyDaysAgo;
                    }
                  } catch (e) {}
                }
                
                const activityDate = a.accountClaimedAt 
                  ? new Date(a.accountClaimedAt)
                  : a.submissionDate 
                    ? new Date(a.submissionDate)
                    : null;
                
                if (activityDate && !isNaN(activityDate.getTime())) {
                  return activityDate >= thirtyDaysAgo;
                }
                
                return true;
              }).length;
              
              // Pending Activation (Pre-Verified accounts not yet claimed)
              const pendingActivation = officialShareholders.filter(sh => sh.status === 'PRE-VERIFIED').length;
              
              // Calculate trends (simplified - comparing last 30 days vs previous 30 days)
              const calculateTrend = (current: number, previous: number) => {
                if (previous === 0) {
                  return current > 0 ? { percent: 100, direction: 'up' as const } : { percent: 0, direction: 'neutral' as const };
                }
                const percent = ((current - previous) / previous) * 100;
                return { 
                  percent: Math.abs(percent), 
                  direction: percent > 0 ? 'up' as const : percent < 0 ? 'down' as const : 'neutral' as const 
                };
              };
              
              // For trends, we'll use a simple calculation based on recent additions
              // In a real implementation, you'd compare periods
              const totalTrend = calculateTrend(totalOfficialShareholders, Math.max(0, totalOfficialShareholders - 10));
              const verifiedTrend = calculateTrend(verifiedCount, Math.max(0, verifiedCount - 5));
              const activeTrend = calculateTrend(activeUsers30Days, Math.max(0, activeUsers30Days - 3));
              const pendingTrend = calculateTrend(pendingActivation, Math.max(0, pendingActivation - 2));
              
              const metrics = [
                {
                  label: 'Total Official Shareholders',
                  value: totalOfficialShareholders,
                  trend: totalTrend,
                  subtitle: 'Base universe of investors',
                  chartColor: '#4F46E5'
                },
                {
                  label: 'Verified Accounts Rate',
                  value: `${verifiedPercentage}%`,
                  trend: verifiedTrend,
                  subtitle: `${verifiedCount} / ${totalOfficialShareholders} activated`,
                  chartColor: '#10B981',
                  tooltipSymbol: '%'
                },
                {
                  label: 'Active Users (Last 30 Days)',
                  value: activeUsers30Days,
                  trend: activeTrend,
                  subtitle: 'Users who logged in or interacted',
                  chartColor: '#3B82F6'
                },
                {
                  label: 'Pending Activation',
                  value: pendingActivation,
                  trend: pendingTrend,
                  subtitle: 'Pre-verified accounts awaiting claim',
                  chartColor: '#F59E0B'
                }
              ];
              
              // Deterministic seeded random — stable across re-renders, changes weekly.
              const seededRandom = (seed: number): number => {
                const x = Math.sin(seed * 9301 + 49297) * 233280;
                return x - Math.floor(x);
              };
              
              return metrics.map((stat, i) => {
                const numericValue = typeof stat.value === 'string' && stat.value.includes('%')
                  ? parseFloat(stat.value.replace('%', ''))
                  : typeof stat.value === 'number'
                    ? stat.value
                    : 0;
                
                const weekSeed = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
                const chartData = Array.from({ length: 7 }, (_, idx) => {
                  const progress = idx / 6;
                  const trendMultiplier = stat.trend.direction === 'up' 
                    ? 1 + (stat.trend.percent / 100) * progress
                    : stat.trend.direction === 'down'
                    ? 1 - (stat.trend.percent / 100) * progress
                    : 1;
                  return numericValue * trendMultiplier * (1 + (seededRandom(weekSeed + i * 7 + idx) - 0.5) * 0.1);
                });
                
                return (
                  <MetricCard
                    key={i}
                    title={stat.label}
                    value={stat.value}
                    trend={stat.trend}
                    subtitle={stat.subtitle || 'compared to last week'}
                    chartData={chartData}
                    chartColor={stat.chartColor}
                    tooltipSymbol={stat.tooltipSymbol}
                  />
                );
              });
            })()}
          </div>
        </div>
        
        {/* Documents Released - 50% (5 columns out of 10) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-3 relative overflow-hidden h-[400px]">
          {/* Noise texture */}
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
            <svg className="absolute inset-0 w-full h-full opacity-[0.02] dark:opacity-[0.05]">
              <filter id="docs-panel-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
              <rect width="100%" height="100%" filter="url(#docs-panel-noise)" />
            </svg>
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="mb-3">
              <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-[0.08em]">Documents Released</h3>
            </div>
            <ReleasedDocumentsPanel />
          </div>
        </div>
      </div>

      {/* Row 4: Leaderboard — Full Width (Top Engaged Retail Investors + Top Content by Engagement) */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-sm p-3 relative overflow-hidden">
        {/* Leaderboard heading */}
        <div className="mb-3 pb-2.5 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-[0.1em]">Leaderboard</h2>
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">Top performers ranked by engagement score</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Top Engaged Retail Investors */}
          <div className="h-full">
            <TopEngagedInvestorsTable
              topInvestors={topInvestors}
              applicants={applicants}
              engagementLoading={engagementLoading}
              onViewAll={() => onViewChange?.('engagement-activity')}
              onViewAnalytics={() => onViewChange?.('engagement-analytics')}
              limit={10}
              fixedHeight={true}
            />
          </div>
          {/* Top Content by Engagement */}
          <div className="h-full">
            <TopContentTable
              topContent={topContent}
              engagementLoading={engagementLoading}
              onViewAll={() => onViewChange?.('engagement-activity')}
              onViewAnalytics={() => onViewChange?.('engagement-analytics')}
              limit={10}
              fixedHeight={true}
            />
          </div>
        </div>
      </div>{/* end Leaderboard card */}

      {/* Row 5: Recent User Activities — Full Width */}
      <RecentUserActivitiesTable
        recentActivities={recentActivities}
        engagementLoading={engagementLoading}
        onViewAll={() => {
          sessionStorage.setItem('scrollTo', 'user-activity-log');
          onViewChange?.('engagement-activity');
        }}
        limit={20}
      />

    </div>
  );
};

export default OverviewDashboard;
