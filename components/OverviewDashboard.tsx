
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import Tooltip from './Tooltip';
import Chart from 'react-apexcharts';
import HoldingsSummary from './HoldingsSummary';
import { getWorkflowStatusInternal, getGeneralAccountStatus } from '../lib/shareholdingsVerification';
import MetricCard from './MetricCard';

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
  
  // Get account status
  const getAccountStatus = () => {
    if (applicant.isPreVerified) {
      // For pre-verified, use accountStatus if available
      if (applicant.accountStatus) {
        return applicant.accountStatus;
      }
      return 'PENDING';
    }
    // For regular accounts, use workflow status
    const internalStatus = getWorkflowStatusInternal(applicant);
    return getGeneralAccountStatus(internalStatus);
  };
  
  const accountStatus = getAccountStatus();
  
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
      theme: 'dark',
      fillSeriesColor: false,
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif'
      },
      custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
        const dataPoint = chartData[seriesIndex];
        return `
          <div style="padding: 8px 12px; background: #262626; border: 1px solid #404040; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); color: #e5e5e5; font-size: 12px; font-family: Inter, sans-serif; white-space: nowrap;">
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
            <span className="text-xs font-black uppercase tracking-tight whitespace-nowrap text-neutral-900 dark:text-neutral-100">
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
  
  // Get time-based greeting
  const getTimeBasedGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 18) {
      return 'Good afternoon';
    } else {
      return 'Good evening';
    }
  };
  const [activeDetailTab, setActiveDetailTab] = useState<'holdings' | 'engagement'>('holdings');
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
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
            <div className="grid grid-cols-4 gap-8 mt-6">
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

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      {/* EXACT CODE FOR ANIMATED GREETINGS CARD */}
      <div className={`bg-neutral-100 dark:bg-black p-12 rounded-xl text-neutral-900 dark:text-white relative overflow-hidden group transition-all duration-700 cursor-default premium-ease
        ${isPulsing ? 'shadow-neutral-900/20 dark:shadow-black/60' : 'shadow-2xl hover:shadow-neutral-900/20 dark:hover:shadow-black/60'}
      `}
      onMouseEnter={() => setIsPulsing(true)}
      onMouseLeave={() => setIsPulsing(false)}
      >
        {/* Micro-texture overlay for dark mode */}
        <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.08]">
            <filter id="greetings-noise-filter">
              <feTurbulence 
                type="fractalNoise" 
                baseFrequency="0.9" 
                numOctaves="4" 
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#greetings-noise-filter)" />
          </svg>
        </div>

        {/* Animated Background Calendar Icon */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-[1800ms] premium-ease
          ${isPulsing 
            ? 'left-[calc(100%-11.5rem)] top-12 translate-y-0 rotate-12 scale-[1.7] opacity-20' 
            : 'left-0 top-1/2 -translate-y-1/2 rotate-0 scale-100 opacity-5 group-hover:left-[calc(100%-11.5rem)] group-hover:top-12 group-hover:translate-y-0 group-hover:rotate-12 group-hover:scale-[1.7] group-hover:opacity-20'
          }
        `}>
          <svg className="w-96 h-96 text-neutral-900 dark:text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
        </div>

        {/* Light Sweep Animation Layer */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isPulsing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neutral-900/5 dark:via-white/5 to-transparent animate-sweep"></div>
        </div>

        {/* Header and Static Icon Layer */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex flex-col gap-1 pl-4">
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-1 transition-transform duration-500 premium-ease group-hover:translate-x-2 text-neutral-900 dark:text-white">{getTimeBasedGreeting()}, IR Team</h1>
            <p className="text-neutral-600 dark:text-neutral-400 font-medium text-sm transition-transform duration-500 premium-ease group-hover:translate-x-2 delay-75">Your investor dashboard is primed and ready.</p>
          </div>
          
          {/* Static Anchor Calendar Icon - Prominent size matching shield icon scale */}
          <div className={`pr-4 opacity-10 transition-all duration-700 premium-ease ${isPulsing ? 'scale-110 opacity-40' : 'group-hover:opacity-40 group-hover:scale-110'}`}>
            <svg className="w-24 h-28 text-neutral-900 dark:text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2v4"/>
              <path d="M16 2v4"/>
              <path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/>
              <path d="M3 10h18"/>
              <path d="m16 20 2 2 4-4"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-8 overflow-visible">
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
          // Deterministic seeded random — stable across re-renders, changes weekly.
          const seededRandom = (seed: number): number => {
            const x = Math.sin(seed * 9301 + 49297) * 233280;
            return x - Math.floor(x);
          };
          const baseValue = typeof stat.value === 'string' 
            ? parseFloat(stat.value.replace(/[^0-9.]/g, '')) || 100 
            : stat.value;
          const weekSeed = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
          const chartData = Array.from({ length: 7 }, (_, idx) => {
            const progress = idx / 6;
            const trendMultiplier = stat.trend.direction === 'up' 
              ? 1 + (stat.trend.percent / 100) * progress
              : stat.trend.direction === 'down'
              ? 1 - (stat.trend.percent / 100) * progress
              : 1;
            return baseValue * trendMultiplier * (1 + (seededRandom(weekSeed + i * 7 + idx) - 0.5) * 0.1);
          });

          // Determine tooltip symbol based on label - only currency and percentage
          const getTooltipSymbol = (label: string) => {
            const lowerLabel = label.toLowerCase();
            if (lowerLabel.includes('asset') || lowerLabel.includes('delta') || lowerLabel.includes('engagement')) {
              return '%'; // Percentage values
            }
            return undefined; // No symbol for other values
          };
          
          return (
            <MetricCard
              key={i}
              title={stat.label}
              value={stat.value}
              trend={stat.trend}
              chartData={chartData}
              chartColor={stat.chartColor}
              tooltipSymbol={getTooltipSymbol(stat.label)}
            />
          );
        })}
      </div>

      {/* Shareholder Snapshot */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm p-10">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tighter">Shareholder Snapshot</h3>
          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span className="text-sm font-black uppercase tracking-widest">User Tier Breakdown</span>
          </div>
        </div>
        
        <ShareholderSnapshot applicants={applicants} />
      </div>

      {/* Top Engaged Retail Investors */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between bg-neutral-50/30 dark:bg-neutral-900/30">
          <div>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tighter">Top Engaged Retail Investors</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Ranked by engagement score (activity frequency, content views, and recent interactions)</p>
          </div>
          <button className="px-4 py-2 text-xs font-bold bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors uppercase tracking-wider">
            View All Shareholders
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900 text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">
                <th className="px-10 py-5 w-16 text-center">RANK</th>
                <th className="px-10 py-5">SHAREHOLDER</th>
                <th className="px-10 py-5">STATUS</th>
                <th className="px-10 py-5">HOLDINGS</th>
                <th className="px-10 py-5">ENGAGEMENT SCORE</th>
                <th className="px-10 py-5 text-right">LAST ACTIVITY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
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
                    <tr key={item.applicant.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                      <td className="px-10 py-7 text-center">
                        <span className="text-sm font-black text-neutral-900 dark:text-neutral-100">#{item.rank}</span>
                      </td>
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-3">
                          <Avatar name={item.applicant.fullName} size={40} profilePictureUrl={item.applicant.profilePictureUrl} />
                          <div className="min-w-0 flex-1">
                            <Tooltip content={item.applicant.fullName}>
                              <p className="text-sm font-black text-neutral-900 dark:text-neutral-100 truncate max-w-[200px]">{item.applicant.fullName}</p>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        {item.status === 'VERIFIED' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                              <path d="m9 12 2 2 4-4"/>
                            </svg>
                            Verified
                          </span>
                        ) : item.status === 'PENDING' ? (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M12 6v6l4 2"/>
                            </svg>
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                            </svg>
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="px-10 py-7">
                        {item.holdings > 0 ? (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                            </svg>
                            <span className="text-sm font-black text-neutral-900 dark:text-neutral-100">{item.holdings.toLocaleString()}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">Not connected</span>
                        )}
                      </td>
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-neutral-900 dark:text-neutral-100 min-w-[3rem]">{item.score}</span>
                          <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">{item.lastActive}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-10 py-12 text-center text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                      No engaged investors found
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        <div className="px-10 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            <strong>Engagement Criteria:</strong> Based on activity frequency (logins, content views), recent interactions (last 30 days), holdings quantity, and communication engagement (opens, clicks, event attendance).
          </p>
        </div>
      </div>

      {/* Top Content by Engagement */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between bg-neutral-50/30 dark:bg-neutral-900/30">
          <div>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tighter">Top Content by Engagement</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Content ranked by total engagement across all user types (guest, registered verified, registered unverified)</p>
          </div>
          <button className="px-4 py-2 text-xs font-bold bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors uppercase tracking-wider">
            View All Content
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900 text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">
                <th className="px-10 py-5">CONTENT</th>
                <th className="px-10 py-5">PUBLISHED</th>
                <th className="px-10 py-5 text-right">TOTAL OPENS</th>
                <th className="px-10 py-5 text-right">UNIQUE USER OPENS</th>
                <th className="px-10 py-5 text-right">AVERAGE TIME</th>
                <th className="px-10 py-5">ENGAGEMENT BREAKDOWN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
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
                    <tr key={index} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                      <td className="px-10 py-7">
                        <div>
                          <p className="text-sm font-black text-neutral-900 dark:text-neutral-100">{content.title}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{content.type}</p>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">{content.published}</span>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <span className="text-sm font-black text-neutral-900 dark:text-neutral-100">{content.totalOpens.toLocaleString()}</span>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <span className="text-sm font-black text-neutral-900 dark:text-neutral-100">{content.uniqueOpens.toLocaleString()}</span>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <span className="text-sm font-black text-neutral-900 dark:text-neutral-100">{content.averageTime}</span>
                      </td>
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 flex-shrink-0">
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
                              width="64"
                              height="64"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            {chartData.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                  {item.name}: <span className="font-black text-neutral-900 dark:text-neutral-100">{item.value.toLocaleString()}</span>
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
        <div className="px-10 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30 flex items-center justify-between">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            <strong>Engagement includes:</strong> Views, downloads, time spent, shares, and interactions across all user types.
          </p>
          <button className="px-4 py-2 text-xs font-bold bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors uppercase tracking-wider">
            View Analytics →
          </button>
        </div>
      </div>

      {/* Recent User Activities */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between bg-neutral-50/30 dark:bg-neutral-900/30">
          <div>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tighter">Recent User Activities</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Recent activities from registered users (verified and unverified)</p>
          </div>
          <button className="px-4 py-2 text-xs font-bold bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors uppercase tracking-wider">
            View All User Activities
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900 text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">
                <th className="px-10 py-5">USER</th>
                <th className="px-10 py-5">ACTIVITY</th>
                <th className="px-10 py-5">CONTENT</th>
                <th className="px-10 py-5 text-right">TIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
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
                    <tr key={item.applicant.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                      <td className="px-10 py-7">
                        <div className="flex items-start gap-3">
                          <Avatar name={item.applicant.fullName} size={40} profilePictureUrl={item.applicant.profilePictureUrl} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-black text-neutral-900 dark:text-neutral-100">{item.applicant.fullName}</p>
                              {item.status === 'VERIFIED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                                    <path d="m9 12 2 2 4-4"/>
                                  </svg>
                                  Verified
                                </span>
                              )}
                              {item.status === 'PENDING' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 6v6l4 2"/>
                                  </svg>
                                  Pending
                                </span>
                              )}
                              {item.status === 'UNVERIFIED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                                  </svg>
                                  Unverified
                                </span>
                              )}
                            </div>
                            {item.status === 'VERIFIED' && item.rank && (
                              <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                                <span>Rank #{item.rank}</span>
                                <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12h14"/>
                                  <path d="M12 5l7 7-7 7"/>
                                </svg>
                                <span>({item.holdings.toLocaleString()} shares)</span>
                              </div>
                            )}
                            {item.status !== 'VERIFIED' && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.applicant.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-2">
                          {item.activityIcon === 'eye' && (
                            <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                          {item.activityIcon === 'document' && (
                            <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <path d="M14 2v6h6"/>
                              <path d="M16 13H8"/>
                              <path d="M16 17H8"/>
                              <path d="M10 9H8"/>
                            </svg>
                          )}
                          {item.activityIcon === 'calendar' && (
                            <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                          )}
                          {item.activityIcon === 'email' && (
                            <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                              <polyline points="22,6 12,13 2,6"/>
                            </svg>
                          )}
                          <span className="text-sm text-neutral-900 dark:text-neutral-100">{item.activity}</span>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <span className="text-sm text-neutral-900 dark:text-neutral-100">{item.content}</span>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">{item.timeAgo}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-10 py-12 text-center text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
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
