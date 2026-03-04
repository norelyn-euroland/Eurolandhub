
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Applicant, RegistrationStatus, GeneralAccountStatus, OfficialShareholder } from '../lib/types';
import Tooltip from './Tooltip';
import Chart from 'react-apexcharts';
import HoldingsSummary from './HoldingsSummary';
import { getWorkflowStatusInternal, getGeneralAccountStatus } from '../lib/shareholdingsVerification';
import MetricCard from './MetricCard';
import { officialShareholderService } from '../lib/firestore-service';
import { PressReleasePreview, PressReleaseDetail, AllPressReleasesView } from './PressReleaseSection';
import type { PressRelease } from './PressReleaseSection';
import { getAllPressReleases } from '../services/pressReleaseService';
import { getDataByRange, getLatestPrice, getPriceStats, type ShareDataPoint, type TimeRange } from '../services/shareDataService';
import { releasedDocumentsService, DOCUMENT_TAGS, getDocumentTypeLabel, type ReleasedDocument } from '../services/releasedDocumentsService';
import {
  shouldTriggerGreetingAnimation,
  getCurrentTimeContext,
  getGreetingTheme,
  getGreetingSubtitle,
  type TimeContext,
  type TimeSegment,
  type GreetingTheme,
} from '../services/greetingTimeService';
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
  
  const totalPages = Math.ceil(filteredBySearch.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayDocs = filteredBySearch.slice(startIndex, startIndex + itemsPerPage);

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

      {/* Document List — flex-1 ensures it takes remaining space so pagination stays pinned */}
      <div className="flex-1 space-y-0 divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayDocs.length > 0 ? displayDocs.map((doc) => {
          const docTypeLabel = getDocumentTypeLabel(doc.type);
          const views = doc.views || 0;
          const comments = doc.comments || 0;
          const engagement = views + (comments * 3);
          return (
            <div key={doc.id} className="py-2 first:pt-0 group/doc cursor-pointer transition-all duration-200 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 -mx-1 px-1 rounded">
              {/* Title + Tag */}
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <h4 className="text-[11px] font-bold text-neutral-900 dark:text-white leading-tight group-hover/doc:text-primary dark:group-hover/doc:text-primary-light transition-colors line-clamp-1 flex-1">{doc.title}</h4>
                <span className={`shrink-0 px-1.5 py-px text-[7px] font-bold uppercase tracking-wider rounded border ${TAG_COLORS[docTypeLabel] || 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}>{docTypeLabel}</span>
              </div>

              {/* Upload Date + Metrics inline */}
              <div className="flex items-center gap-2.5">
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium">
                  {formatDocDate(doc.createdAt)}
                </span>
                {views > 0 && (
                  <>
                    <span className="text-neutral-200 dark:text-neutral-700">·</span>
                    <span className="flex items-center gap-0.5 text-[9px] text-neutral-400 dark:text-neutral-500">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                      <span className="font-medium">{views.toLocaleString()}</span>
                    </span>
                  </>
                )}
                {comments > 0 && (
                  <>
                    <span className="text-neutral-200 dark:text-neutral-700">·</span>
                    <span className="flex items-center gap-0.5 text-[9px] text-neutral-400 dark:text-neutral-500">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                      <span className="font-medium">{comments}</span>
                    </span>
                  </>
                )}
                {engagement > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] text-neutral-400 dark:text-neutral-500 ml-auto">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
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

// ── Dynamic Time-of-Day Icon ────────────────────────────────────────
// Contextual SVG icons per time segment: filled + stroked for visual depth.
// Inspired by weather-card UIs — visible, warm/cool fills with clean strokes.
// Future: getWeatherIconOverride() can override these for strong weather.
const TimeOfDayIcon: React.FC<{
  segment: TimeSegment;
  className?: string;
  fillColor?: string;   // CSS fill color (e.g. rgba)
}> = ({ segment, className = '', fillColor = 'currentColor' }) => {
  const baseClass = `${className}`;

  switch (segment) {
    case 'dawn':
      // Rising sun — half circle above horizon with warm fill and rays
      return (
        <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Sun body — filled half-circle */}
          <path d="M6 16a6 6 0 0 1 12 0" fill={fillColor} />
          {/* Horizon */}
          <path d="M2 16h20" />
          {/* Rays */}
          <path d="M12 2v4" />
          <path d="M4.93 5.93l2.83 2.83" />
          <path d="M19.07 5.93l-2.83 2.83" />
          {/* Small upward ray from center */}
          <path d="M12 10v2" strokeWidth="1" />
        </svg>
      );

    case 'morning':
      // Clean sun — filled circle with short rays, warm and crisp
      return (
        <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Sun core — filled */}
          <circle cx="12" cy="12" r="4.5" fill={fillColor} />
          {/* Rays */}
          <path d="M12 2.5v3" />
          <path d="M12 18.5v3" />
          <path d="M4.93 4.93l2.12 2.12" />
          <path d="M16.95 16.95l2.12 2.12" />
          <path d="M2.5 12h3" />
          <path d="M18.5 12h3" />
          <path d="M4.93 19.07l2.12-2.12" />
          <path d="M16.95 7.05l2.12-2.12" />
        </svg>
      );

    case 'afternoon':
      // Stronger sun — larger filled circle with bolder rays
      return (
        <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Sun core — filled, larger */}
          <circle cx="12" cy="12" r="5" fill={fillColor} />
          {/* Rays — longer */}
          <path d="M12 1v3.5" />
          <path d="M12 19.5v3.5" />
          <path d="M3.87 3.87l2.47 2.47" />
          <path d="M17.66 17.66l2.47 2.47" />
          <path d="M1 12h3.5" />
          <path d="M19.5 12h3.5" />
          <path d="M3.87 20.13l2.47-2.47" />
          <path d="M17.66 6.34l2.47-2.47" />
        </svg>
      );

    case 'evening':
      // Sunset — sun sinking below horizon, warm fading light
      return (
        <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Sun body — filled, below horizon */}
          <path d="M6 18a6 6 0 0 1 12 0" fill={fillColor} />
          {/* Horizon line */}
          <path d="M2 18h20" />
          {/* Upper rays (fading) */}
          <path d="M12 4v4" />
          <path d="M5.64 7.64l2.12 2.12" />
          <path d="M18.36 7.64l-2.12 2.12" />
          {/* Soft downward indicator */}
          <path d="M12 14v2" strokeWidth="1" />
        </svg>
      );

    case 'night':
      // Crescent moon with stars — filled crescent, elegant night feel
      return (
        <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Moon crescent — filled */}
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill={fillColor} />
          {/* Star — cross shape */}
          <path d="M19 2v4" strokeWidth="1" />
          <path d="M21 4h-4" strokeWidth="1" />
          {/* Small star dot */}
          <circle cx="16" cy="8" r="0.5" fill="currentColor" />
          {/* Tiny star dot */}
          <circle cx="20" cy="10" r="0.4" fill="currentColor" />
        </svg>
      );

    default:
      // Fallback — simple filled circle
      return (
        <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" fill={fillColor} />
        </svg>
      );
  }
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

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ applicants }) => {
  const [selectedInvestor, setSelectedInvestor] = useState<Applicant | null>(null);
  const [officialShareholders, setOfficialShareholders] = useState<OfficialShareholder[]>([]);
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
  // Only triggers when a meaningful time-based transition happens,
  // NOT on every page visit or refresh.
  useEffect(() => {
    if (!selectedInvestor) {
      if (!hasAnimatedRef.current) {
        const { shouldAnimate, context } = shouldTriggerGreetingAnimation();
        setTimeContext(context);

        if (shouldAnimate) {
          hasAnimatedRef.current = true;
          setIsPulsing(true);
          setSegmentAnimating(true);
          // End segment-change animation class after it plays
          const timer = setTimeout(() => setSegmentAnimating(false), 900);
          return () => clearTimeout(timer);
        } else {
          // Same segment, no animation — but still set isPulsing for layout
          hasAnimatedRef.current = true;
          setIsPulsing(true);
        }
      }
    } else {
      // Reset flag when navigating to detail view so it re-checks on return
      hasAnimatedRef.current = false;
      setIsPulsing(false);
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
    <div className="space-y-6 max-w-screen-2xl mx-auto pb-10">
      {/* Greetings Card + Share Price Widget Side by Side */}
      <div className="flex gap-5 items-stretch">
        {/* Left: Greetings Card — Dynamic Time & Theme Aware */}
        {(() => {
          const theme = getGreetingTheme(timeContext.segment);
          const subtitle = getGreetingSubtitle(timeContext.segment);
          const isNight = timeContext.segment === 'night' || timeContext.segment === 'evening';
          const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
          const fillColor = isDarkMode ? theme.iconFillDark : theme.iconFill;
          const glowColor = isDarkMode ? theme.glowColorDark : theme.glowColor;

          return (
            <div className={`flex-1 p-8 rounded-xl relative overflow-hidden group transition-all duration-[1000ms] cursor-default premium-ease ${theme.shadowClass}
              ${theme.bgClass} ${theme.bgClassDark}
              ${isPulsing ? '' : 'hover:shadow-lg'}
            `}
            onMouseEnter={() => setIsPulsing(true)}
            onMouseLeave={() => setIsPulsing(false)}
            >
              {/* Micro-texture overlay */}
              <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
                <svg className="absolute inset-0 w-full h-full">
                  <filter id="greetings-noise-filter">
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                  </filter>
                  <rect width="100%" height="100%" filter="url(#greetings-noise-filter)" className={`${theme.noiseOpacity} ${theme.noiseOpacityDark}`} />
                </svg>
              </div>

              {/* Time-based ambient overlay (light mode) */}
              <div className={`absolute inset-0 rounded-xl pointer-events-none transition-all duration-[2000ms] ease-in-out ${theme.overlayClass} dark:hidden`} />
              {/* Time-based ambient overlay (dark mode) */}
              <div className={`absolute inset-0 rounded-xl pointer-events-none transition-all duration-[2000ms] ease-in-out hidden dark:block ${theme.overlayClassDark}`} />

              {/* Radial glow — warm/cool ambient light behind icon area */}
              <div
                className={`absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-[2000ms] ease-in-out animate-glow-breathe`}
                style={{
                  background: `radial-gradient(ellipse 50% 80% at 80% 40%, ${glowColor}, transparent 70%)`,
                  opacity: isPulsing ? 1 : 0.7,
                }}
              />

              {/* Animated Background Time Icon (large, decorative) */}
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-[1800ms] premium-ease
                ${isPulsing
                  ? 'left-[calc(100%-11.5rem)] top-6 translate-y-0 rotate-6 scale-[1.4] opacity-[0.20]'
                  : 'left-0 top-1/2 -translate-y-1/2 rotate-0 scale-100 opacity-[0.08] group-hover:left-[calc(100%-11.5rem)] group-hover:top-6 group-hover:translate-y-0 group-hover:rotate-6 group-hover:scale-[1.4] group-hover:opacity-[0.20]'
                }
              `}>
                <TimeOfDayIcon
                  segment={timeContext.segment}
                  fillColor={fillColor}
                  className={`w-72 h-72 ${theme.iconColor} transition-colors duration-[1000ms]`}
                />
              </div>

              {/* Light Sweep / Ambient Pulse Animation */}
              <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isPulsing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${theme.sweepTint} to-transparent ${
                  isNight ? 'animate-ambient-pulse' : 'animate-sweep'
                }`} />
              </div>

              {/* Greeting Content */}
              <div className="relative z-10 flex items-center justify-between">
                <div className={`flex flex-col gap-0.5 pl-2 ${segmentAnimating ? 'animate-segment-fade-in' : ''}`}>
                  <h1 className={`text-3xl font-black tracking-tighter uppercase mb-0.5 transition-all duration-[1000ms] premium-ease group-hover:translate-x-1 ${theme.textColor}`}>
                    {timeContext.greeting}, IR Team
                  </h1>
                  <p className={`font-medium text-xs transition-all duration-[1000ms] premium-ease group-hover:translate-x-1 delay-75 ${theme.subtitleColor}`}>
                    {subtitle}
                  </p>
                </div>
                {/* Dynamic Time-of-Day Icon (anchor position — visible, filled) */}
                <div className={`pr-2 transition-all duration-700 premium-ease ${isPulsing ? 'scale-110 opacity-[0.30]' : 'opacity-[0.15] group-hover:opacity-[0.30] group-hover:scale-110'}`}>
                  <TimeOfDayIcon
                    segment={timeContext.segment}
                    fillColor={fillColor}
                    className={`w-20 h-24 ${theme.iconColor} transition-colors duration-[1000ms]`}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Right: Share Price Widget */}
        <div className="flex-shrink-0 w-[340px] h-[220px] rounded-xl bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] shadow-md relative overflow-hidden">
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
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5 overflow-visible">
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

      {/* Row 3: Shareholder Snapshot (40%) + Documents Released (60%) — fixed height to prevent layout shift */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5" style={{ gridAutoRows: '1fr' }}>
        {/* Left: Shareholder Snapshot (40% = 4/10) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-md p-5 relative overflow-hidden min-h-[460px]">
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

        {/* Right: Documents Released Panel (60% = 6/10) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl shadow-md p-5 relative overflow-hidden min-h-[460px]">
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

      {/* Top Engaged Retail Investors */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl overflow-hidden shadow-md">
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-[0.08em]">Top Engaged Retail Investors</h3>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">Ranked by engagement score</p>
          </div>
          <button className="px-3 py-1.5 text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors uppercase tracking-wider">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-800/50 text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.12em]">
                <th className="px-6 py-3 w-14 text-center">Rank</th>
                <th className="px-6 py-3">Shareholder</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Holdings</th>
                <th className="px-6 py-3">Engagement</th>
                <th className="px-6 py-3 text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
              {(() => {
                // Calculate engagement scores for investors
                const investorsWithScores = applicants
                  .filter(a => {
                    const internalStatus = getWorkflowStatusInternal(a);
                    const generalStatus = getGeneralAccountStatus(internalStatus);
                    return generalStatus === 'VERIFIED' || generalStatus === 'PENDING' || generalStatus === 'UNVERIFIED';
                  })
                  .map(applicant => {
                    // Calculate engagement score based on activity
                    const emailOpens = applicant.emailOpenedCount || 0;
                    const linkClicks = applicant.linkClickedCount || 0;
                    const hasClaimed = applicant.accountClaimedAt ? 1 : 0;
                    const totalInteractions = emailOpens + linkClicks + hasClaimed;
                    
                    // Base score from interactions (0-60 points)
                    let score = Math.min(totalInteractions * 5, 60);
                    
                    // Add points for recent activity (0-20 points)
                    const lastActive = applicant.lastActive || 'Never';
                    if (lastActive.includes('hour') || lastActive === 'Just now') {
                      score += 20;
                    } else if (lastActive.includes('day')) {
                      const days = parseInt(lastActive.match(/\d+/)?.[0] || '0');
                      score += Math.max(20 - (days * 2), 0);
                    }
                    
                    // Add points for holdings (0-20 points)
                    const holdings = applicant.holdingsRecord?.sharesHeld || 0;
                    if (holdings > 0) {
                      score += Math.min(holdings / 1000, 20);
                    }
                    
                    // Cap at 100
                    score = Math.min(Math.round(score), 100);
                    
                    return {
                      applicant,
                      score,
                      holdings: applicant.holdingsRecord?.sharesHeld || 0,
                      status: getGeneralAccountStatus(getWorkflowStatusInternal(applicant)),
                      lastActive: applicant.lastActive || 'Never'
                    };
                  })
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 10)
                  .map((item, index) => ({
                    ...item,
                    rank: index + 1
                  }));
                
                return investorsWithScores.length > 0 ? (
                  investorsWithScores.map((item) => (
                    <tr key={item.applicant.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                      <td className="px-6 py-3.5 text-center">
                        <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">#{item.rank}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={item.applicant.fullName} size={32} profilePictureUrl={item.applicant.profilePictureUrl} />
                          <div className="min-w-0 flex-1">
                            <Tooltip content={item.applicant.fullName}>
                              <p className="text-xs font-bold text-neutral-900 dark:text-white truncate max-w-[180px]">{item.applicant.fullName}</p>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        {item.status === 'VERIFIED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                              <path d="m9 12 2 2 4-4"/>
                            </svg>
                            Verified
                          </span>
                        ) : item.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M12 6v6l4 2"/>
                            </svg>
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/40">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                            </svg>
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        {item.holdings > 0 ? (
                          <span className="text-xs font-bold text-neutral-900 dark:text-white">{item.holdings.toLocaleString()}</span>
                        ) : (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white min-w-[2rem]">{item.score}</span>
                          <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden max-w-[100px]">
                            <div 
                              className="h-full bg-blue-500/70 dark:bg-blue-400/60 rounded-full transition-all duration-500"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{item.lastActive}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                      No engaged investors found
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-neutral-100 dark:border-neutral-800">
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
            <strong className="text-neutral-500 dark:text-neutral-400">Engagement Criteria:</strong> Activity frequency, content views, recent interactions, holdings quantity, and communication engagement.
          </p>
        </div>
      </div>

      {/* Top Content by Engagement */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl overflow-hidden shadow-md">
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-[0.08em]">Top Content by Engagement</h3>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">Ranked by total engagement across all user types</p>
          </div>
          <button className="px-3 py-1.5 text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors uppercase tracking-wider">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-800/50 text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.12em]">
                <th className="px-6 py-3">Content</th>
                <th className="px-6 py-3">Published</th>
                <th className="px-6 py-3 text-right">Total Opens</th>
                <th className="px-6 py-3 text-right">Unique Opens</th>
                <th className="px-6 py-3 text-right">Avg. Time</th>
                <th className="px-6 py-3">Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
              {(() => {
                // Generate mock content engagement data
                const contentData = [
                  {
                    title: 'Q3 2024 Earnings Report',
                    type: 'Report',
                    published: 'Oct 15, 2024',
                    totalOpens: 12580,
                    uniqueOpens: 6840,
                    averageTime: '12:34',
                    breakdown: { guest: 3240, verified: 2850, unverified: 2330 }
                  },
                  {
                    title: 'ESG Sustainability Report 2024',
                    type: 'Report',
                    published: 'Sep 20, 2024',
                    totalOpens: 11420,
                    uniqueOpens: 6220,
                    averageTime: '15:28',
                    breakdown: { guest: 2890, verified: 2450, unverified: 2310 }
                  },
                  {
                    title: 'New Partnership Announcement',
                    type: 'Press Release',
                    published: 'Nov 5, 2024',
                    totalOpens: 10240,
                    uniqueOpens: 5890,
                    averageTime: '8:45',
                    breakdown: { guest: 3120, verified: 2180, unverified: 1680 }
                  },
                  {
                    title: 'Annual General Meeting Transcript',
                    type: 'Transcript',
                    published: 'Jun 18, 2024',
                    totalOpens: 8920,
                    uniqueOpens: 5210,
                    averageTime: '18:52',
                    breakdown: { guest: 2450, verified: 2120, unverified: 1680 }
                  },
                  {
                    title: 'Strategic Growth Initiative Update',
                    type: 'Press Release',
                    published: 'Oct 28, 2024',
                    totalOpens: 8240,
                    uniqueOpens: 4780,
                    averageTime: '7:23',
                    breakdown: { guest: 2780, verified: 1850, unverified: 1260 }
                  }
                ];
                
                return contentData.map((content, index) => {
                  const total = content.breakdown.guest + content.breakdown.verified + content.breakdown.unverified;
                  const guestPercent = Math.round((content.breakdown.guest / total) * 100);
                  const verifiedPercent = Math.round((content.breakdown.verified / total) * 100);
                  const unverifiedPercent = Math.round((content.breakdown.unverified / total) * 100);
                  
                  const chartData = [
                    { name: 'Guest', value: content.breakdown.guest, percentage: guestPercent, color: '#f97316' },
                    { name: 'Verified', value: content.breakdown.verified, percentage: verifiedPercent, color: '#10B981' },
                    { name: 'Unverified', value: content.breakdown.unverified, percentage: unverifiedPercent, color: '#fbbf24' }
                  ];
                  
                  return (
                    <tr key={index} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-white">{content.title}</p>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">{content.type}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{content.published}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-xs font-bold text-neutral-900 dark:text-white">{content.totalOpens.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-xs font-bold text-neutral-900 dark:text-white">{content.uniqueOpens.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-xs font-bold text-neutral-900 dark:text-white">{content.averageTime}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 flex-shrink-0">
                            <Chart
                              options={{
                                chart: { type: 'donut' as const, animations: { enabled: false } },
                                labels: chartData.map(item => item.name),
                                colors: chartData.map(item => item.color),
                                dataLabels: { enabled: false },
                                plotOptions: {
                                  pie: {
                                    donut: { size: '70%' },
                                    expandOnClick: false
                                  }
                                },
                                legend: { show: false },
                                tooltip: { enabled: false },
                                states: { hover: { filter: { type: 'none' } } }
                              }}
                              series={chartData.map(item => item.value)}
                              type="donut"
                              width="48"
                              height="48"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {chartData.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                                  {item.name}: <span className="font-bold text-neutral-900 dark:text-white">{item.value.toLocaleString()}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
            <strong className="text-neutral-500 dark:text-neutral-400">Engagement:</strong> Views, downloads, time spent, shares, interactions.
          </p>
          <button className="px-3 py-1.5 text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors uppercase tracking-wider">
            Analytics →
          </button>
        </div>
      </div>

      {/* Recent User Activities */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl overflow-hidden shadow-md">
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-[0.08em]">Recent User Activities</h3>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">From registered users (verified and unverified)</p>
          </div>
          <button className="px-3 py-1.5 text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors uppercase tracking-wider">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-800/50 text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.12em]">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Activity</th>
                <th className="px-6 py-3">Content</th>
                <th className="px-6 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
              {(() => {
                // Generate recent activities from applicants
                const activities = applicants
                  .filter(a => {
                    const internalStatus = getWorkflowStatusInternal(a);
                    const generalStatus = getGeneralAccountStatus(internalStatus);
                    return generalStatus === 'VERIFIED' || generalStatus === 'PENDING' || generalStatus === 'UNVERIFIED';
                  })
                  .map(applicant => {
                    const status = getGeneralAccountStatus(getWorkflowStatusInternal(applicant));
                    const holdings = applicant.holdingsRecord?.sharesHeld || 0;
                    
                    // Determine activity type based on user data
                    let activity = '';
                    let activityIcon = '';
                    let content = '';
                    
                    if (applicant.accountClaimedAt) {
                      activity = 'Attended Retail Investor Q&A Session';
                      activityIcon = 'calendar';
                      content = 'Retail Investor Q&A Session - October 2024';
                    } else if (applicant.linkClickedAt) {
                      activity = 'Downloaded ESG Sustainability Report';
                      activityIcon = 'document';
                      content = 'ESG Sustainability Report 2024';
                    } else if (applicant.emailOpenedAt) {
                      activity = 'Opened email communication';
                      activityIcon = 'email';
                      content = 'Quarterly Investor Update';
                    } else {
                      activity = 'Viewed Q3 2024 Earnings Report';
                      activityIcon = 'eye';
                      content = 'Q3 2024 Earnings Report';
                    }
                    
                    // Calculate time ago
                    let timeAgo = 'Never';
                    const lastActive = applicant.lastActive || 'Never';
                    if (lastActive.includes('hour')) {
                      const hours = parseInt(lastActive.match(/\d+/)?.[0] || '0');
                      timeAgo = hours === 1 ? '1 hour ago' : `${hours} hours ago`;
                    } else if (lastActive.includes('day')) {
                      const days = parseInt(lastActive.match(/\d+/)?.[0] || '0');
                      timeAgo = days === 1 ? '1 day ago' : `${days} days ago`;
                    } else if (lastActive.includes('week')) {
                      const weeks = parseInt(lastActive.match(/\d+/)?.[0] || '0');
                      timeAgo = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
                    } else if (lastActive === 'Just now') {
                      timeAgo = 'Just now';
                    }
                    
                    // Calculate rank based on engagement
                    const emailOpens = applicant.emailOpenedCount || 0;
                    const linkClicks = applicant.linkClickedCount || 0;
                    const hasClaimed = applicant.accountClaimedAt ? 1 : 0;
                    const totalInteractions = emailOpens + linkClicks + hasClaimed;
                    const rank = totalInteractions > 20 ? 1 : totalInteractions > 15 ? 2 : totalInteractions > 10 ? 3 : totalInteractions > 5 ? 4 : null;
                    
                    return {
                      applicant,
                      activity,
                      activityIcon,
                      content,
                      timeAgo,
                      status,
                      holdings,
                      rank
                    };
                  })
                  .filter(item => item.timeAgo !== 'Never')
                  .sort((a, b) => {
                    // Sort by recency (most recent first)
                    const aHours = a.timeAgo.includes('hour') ? parseInt(a.timeAgo.match(/\d+/)?.[0] || '999') : 999;
                    const bHours = b.timeAgo.includes('hour') ? parseInt(b.timeAgo.match(/\d+/)?.[0] || '999') : 999;
                    return aHours - bHours;
                  })
                  .slice(0, 5);
                
                return activities.length > 0 ? (
                  activities.map((item, index) => (
                    <tr key={item.applicant.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={item.applicant.fullName} size={32} profilePictureUrl={item.applicant.profilePictureUrl} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-neutral-900 dark:text-white">{item.applicant.fullName}</p>
                              {item.status === 'VERIFIED' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                                    <path d="m9 12 2 2 4-4"/>
                                  </svg>
                                </span>
                              )}
                              {item.status === 'PENDING' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 6v6l4 2"/>
                                  </svg>
                                </span>
                              )}
                            </div>
                            {item.status === 'VERIFIED' && item.rank && (
                              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Rank #{item.rank} · {item.holdings.toLocaleString()} shares</p>
                            )}
                            {item.status !== 'VERIFIED' && (
                              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate max-w-[160px]">{item.applicant.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {item.activityIcon === 'eye' && (
                            <svg className="w-3 h-3 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                          {item.activityIcon === 'document' && (
                            <svg className="w-3 h-3 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <path d="M14 2v6h6"/>
                            </svg>
                          )}
                          {item.activityIcon === 'calendar' && (
                            <svg className="w-3 h-3 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                          )}
                          {item.activityIcon === 'email' && (
                            <svg className="w-3 h-3 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                              <polyline points="22,6 12,13 2,6"/>
                            </svg>
                          )}
                          <span className="text-[11px] text-neutral-700 dark:text-neutral-300">{item.activity}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-[11px] text-neutral-700 dark:text-neutral-300">{item.content}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{item.timeAgo}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                      No recent activities found
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default OverviewDashboard;
