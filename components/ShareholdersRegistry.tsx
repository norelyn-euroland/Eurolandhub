'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MOCK_SHAREHOLDERS } from '../lib/mockShareholders';
import { MOCK_APPLICANTS } from '../lib/mockApplicants';
import { shareholderService, applicantService, batchService } from '../lib/firestore-service';
import { Shareholder, Applicant, RegistrationStatus } from '../lib/types';
import { getWorkflowStatusInternal, getGeneralAccountStatus } from '../lib/shareholdingsVerification';
import MetricCard from './MetricCard';
import Tooltip from './Tooltip';
import Toast from './Toast';
import HoldingsSummary from './HoldingsSummary';
import { EngagementTabContent } from './OverviewDashboard';

// Engagement Activity Types (matching OverviewDashboard)
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
  status: 'Responded' | 'Pending';
  associatedContent?: {
    type: 'Press Release' | 'Announcement' | 'Event' | 'Document';
    title: string;
  };
}

// Mock engagement data generator (matching OverviewDashboard)
const generateEngagementData = (applicant: Applicant): EngagementActivity[] => {
  const activities: EngagementActivity[] = [];
  const now = new Date();
  
  // Generate mock activities based on user's last active date
  let lastActive: Date;
  try {
    if (applicant.lastActive) {
      lastActive = new Date(applicant.lastActive);
      if (isNaN(lastActive.getTime())) {
        lastActive = applicant.submissionDate ? new Date(applicant.submissionDate) : now;
        if (isNaN(lastActive.getTime())) {
          lastActive = now;
        }
      }
    } else {
      lastActive = applicant.submissionDate ? new Date(applicant.submissionDate) : now;
      if (isNaN(lastActive.getTime())) {
        lastActive = now;
      }
    }
  } catch (error) {
    lastActive = now;
  }
  
  if (lastActive.getTime() > now.getTime()) {
    lastActive = now;
  }
  
  const daysSinceActive = Math.max(0, Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)));
  const maxDays = Math.max(daysSinceActive, 30);
  
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
  const statuses: Array<'Responded' | 'Pending'> = ['Responded', 'Pending'];
  
  const activityCount = Math.floor(Math.random() * 6) + 5;
  
  for (let i = 0; i < activityCount; i++) {
    const daysAgo = Math.floor(Math.random() * Math.min(Math.max(maxDays, 1), 90));
    const activityDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    if (isNaN(activityDate.getTime())) {
      continue;
    }
    
    const activityTypes: Array<'comment' | 'interaction' | 'share'> = ['comment', 'interaction', 'share'];
    const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
    
    const commentText = sampleComments[Math.floor(Math.random() * sampleComments.length)];
    const likes = Math.floor(Math.random() * 50) + 1;
    const replyCount = type === 'interaction' ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 3);
    
    const replyDetails: Array<{ id: string; author: string; text: string; timestamp: string }> = [];
    if (replyCount > 0) {
      const shuffledReplies = [...sampleReplies].sort(() => Math.random() - 0.5);
      for (let j = 0; j < Math.min(replyCount, shuffledReplies.length); j++) {
        const replyDate = new Date(activityDate.getTime() + (j + 1) * 60 * 60 * 1000);
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
        status,
        associatedContent: {
          type: contentType,
          title: contentTitle,
        },
      });
    } catch (error) {
      console.warn('Skipping activity with invalid timestamp:', error);
      continue;
    }
  }
  
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

const MOCK_AUDIT_LOGS = [
  { id: 1, event: 'Ledger Export Generated', user: 'D. Sterling', time: '10:45 AM', date: 'Today' },
  { id: 2, event: 'New Shareholder "Ayala Corporation" Verified', user: 'System', time: '09:12 AM', date: 'Today' },
  { id: 3, event: 'Stake Re-calculation Triggered', user: 'System', time: '04:30 PM', date: 'Yesterday' },
  { id: 4, event: 'Manual Address Update: ID 201198216', user: 'M. Chen', time: '02:15 PM', date: 'Yesterday' },
  { id: 5, event: 'Annual Audit Certification Uploaded', user: 'Admin', time: '11:00 AM', date: 'Oct 24, 2023' },
];

interface ShareholdersRegistryProps {
  searchQuery: string;
}


type TabType = 'shareholder' | 'engagement' | 'all-users';

const ShareholdersRegistry: React.FC<ShareholdersRegistryProps> = ({ searchQuery }) => {
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [issuer, setIssuer] = useState<Shareholder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('shareholder');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayTab, setDisplayTab] = useState<TabType>('shareholder');
  const [verifiedShareholders, setVerifiedShareholders] = useState<(Shareholder | Applicant)[]>([]);
  const [loadingShareholders, setLoadingShareholders] = useState(true);
  const [allUsers, setAllUsers] = useState<Applicant[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(true);
  const [engagementData, setEngagementData] = useState<Array<{
    investorName: string;
    verificationStatus: string;
    latestInteraction: string;
    engagementType: string;
    totalInteractions: number;
    notificationsEnabled: boolean;
    activities: EngagementActivity[];
    applicant: Applicant;
  }>>([]);
  const [loadingEngagement, setLoadingEngagement] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [selectedUser, setSelectedUser] = useState<Applicant | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'holdings' | 'engagement'>('holdings');

  // Search and filter state
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [nameSort, setNameSort] = useState<string | null>(null); // 'a-z' or 'z-a'
  const [holdingsSort, setHoldingsSort] = useState<string | null>(null); // 'high-to-low' or 'low-to-high'
  const [engagementTypeFilter, setEngagementTypeFilter] = useState<string | null>(null);

  // Pagination state for each tab
  const [currentPage, setCurrentPage] = useState<Record<TabType, number>>({
    shareholder: 1,
    'all-users': 1,
    engagement: 1,
  });

  const itemsPerPage = 10;

  // Handle smooth tab transitions
  const handleTabChange = (newTab: TabType) => {
    if (newTab === activeTab || isTransitioning) return;
    
    // Update active tab immediately for button styling
    setActiveTab(newTab);
    
    // Start transition
    setIsTransitioning(true);
    
    // Use requestAnimationFrame for smoother transitions
    requestAnimationFrame(() => {
      // Wait for fade out animation
      setTimeout(() => {
        setDisplayTab(newTab);
        setIsTransitioning(false);
      }, 150);
    });
  };

  // Pagination helper functions
  const getPaginatedData = <T,>(data: T[], tab: TabType): T[] => {
    const page = currentPage[tab];
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (dataLength: number): number => {
    return Math.ceil(dataLength / itemsPerPage);
  };

  const handlePageChange = (tab: TabType, newPage: number) => {
    setCurrentPage(prev => ({ ...prev, [tab]: newPage }));
  };

  // Filter and sort functions for Applicant/Shareholder data
  const filterData = <T extends Applicant | Shareholder>(data: T[]): T[] => {
    let filtered = [...data];

    // Search query filter
    if (localSearchQuery.trim()) {
      const query = localSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        if ('fullName' in item) {
          return item.fullName.toLowerCase().includes(query) || 
                 item.email?.toLowerCase().includes(query) ||
                 (item.registrationId || item.id).toLowerCase().includes(query);
        }
        return item.name?.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
      });
    }

    // Name sort (A-Z or Z-A)
    if (nameSort) {
      filtered.sort((a, b) => {
        const nameA = ('fullName' in a ? a.fullName : a.name || '').toLowerCase();
        const nameB = ('fullName' in b ? b.fullName : b.name || '').toLowerCase();
        
        if (nameSort === 'a-z') {
          return nameA.localeCompare(nameB);
        } else if (nameSort === 'z-a') {
          return nameB.localeCompare(nameA);
        }
        return 0;
      });
    }

    // Holdings sort (High to Low or Low to High)
    // For "All Users" tab, prioritize verified/pre-verified accounts first
    if (holdingsSort && displayTab === 'all-users') {
      // Separate into verified/pre-verified and unverified/pending groups
      const verifiedGroup: T[] = [];
      const unverifiedGroup: T[] = [];
      
      filtered.forEach((item) => {
        if ('fullName' in item) {
          const applicant = item as Applicant;
          const internalStatus = getWorkflowStatusInternal(applicant);
          const isVerified = internalStatus === 'VERIFIED';
          const isPreVerified = applicant.isPreVerified;
          
          if (isVerified || isPreVerified) {
            verifiedGroup.push(item);
          } else {
            unverifiedGroup.push(item);
          }
        } else {
          // For Shareholder items, treat as verified
          verifiedGroup.push(item);
        }
      });
      
      // Sort each group by holdings
      const sortByHoldings = (a: T, b: T) => {
        let holdingsA = 0;
        let holdingsB = 0;
        
        if ('holdingsRecord' in a && a.holdingsRecord) {
          holdingsA = a.holdingsRecord.sharesHeld || 0;
        } else if ('holdings' in a) {
          holdingsA = a.holdings || 0;
        }
        
        if ('holdingsRecord' in b && b.holdingsRecord) {
          holdingsB = b.holdingsRecord.sharesHeld || 0;
        } else if ('holdings' in b) {
          holdingsB = b.holdings || 0;
        }
        
        if (holdingsSort === 'high-to-low') {
          return holdingsB - holdingsA;
        } else if (holdingsSort === 'low-to-high') {
          return holdingsA - holdingsB;
        }
        return 0;
      };
      
      verifiedGroup.sort(sortByHoldings);
      unverifiedGroup.sort(sortByHoldings);
      
      // Combine: verified/pre-verified first, then unverified/pending
      filtered = [...verifiedGroup, ...unverifiedGroup];
    } else if (holdingsSort) {
      // For other tabs, use regular holdings sort
      filtered.sort((a, b) => {
        let holdingsA = 0;
        let holdingsB = 0;
        
        if ('holdingsRecord' in a && a.holdingsRecord) {
          holdingsA = a.holdingsRecord.sharesHeld || 0;
        } else if ('holdings' in a) {
          holdingsA = a.holdings || 0;
        }
        
        if ('holdingsRecord' in b && b.holdingsRecord) {
          holdingsB = b.holdingsRecord.sharesHeld || 0;
        } else if ('holdings' in b) {
          holdingsB = b.holdings || 0;
        }
        
        if (holdingsSort === 'high-to-low') {
          return holdingsB - holdingsA;
        } else if (holdingsSort === 'low-to-high') {
          return holdingsA - holdingsB;
        }
        return 0;
      });
    }

    return filtered;
  };

  // Filter and sort function for engagement data
  const filterEngagementData = (data: typeof engagementData): typeof engagementData => {
    let filtered = [...data];

    // Search query filter
    if (localSearchQuery.trim()) {
      const query = localSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        return item.investorName.toLowerCase().includes(query) ||
               item.engagementType.toLowerCase().includes(query);
      });
    }

    // Name sort (A-Z or Z-A)
    if (nameSort) {
      filtered.sort((a, b) => {
        const nameA = a.investorName.toLowerCase();
        const nameB = b.investorName.toLowerCase();
        
        if (nameSort === 'a-z') {
          return nameA.localeCompare(nameB);
        } else if (nameSort === 'z-a') {
          return nameB.localeCompare(nameA);
        }
        return 0;
      });
    }

    // Engagement type filter
    if (engagementTypeFilter && engagementTypeFilter !== 'all') {
      filtered = filtered.filter((item) => {
        return item.engagementType.toLowerCase() === engagementTypeFilter.toLowerCase();
      });
    }

    return filtered;
  };

  // Fetch SM Investment Corporation issuer data
  useEffect(() => {
    const fetchIssuer = async () => {
      setLoading(true);
      try {
        // Fetch existing shareholders from Firebase
        let existingShareholders: Shareholder[] = [];
        try {
          existingShareholders = await shareholderService.getAll();
        } catch (error) {
          console.warn('Error fetching shareholders, using mock data:', error);
        }
        
        // If no shareholders in Firebase, use mock data as fallback
        if (existingShareholders.length === 0) {
          existingShareholders = MOCK_SHAREHOLDERS.map(sh => ({ ...sh }));
        }

        // Find SM Investment Corporation (case-insensitive search)
        const smInvestment = existingShareholders.find(
          sh => sh.name.toLowerCase().includes('sm investment') || 
                sh.name.toLowerCase().includes('sm investments')
        );

        if (smInvestment) {
          setIssuer(smInvestment);
        } else {
          // Fallback to first mock shareholder if not found
          const fallback = MOCK_SHAREHOLDERS.find(
            sh => sh.name.toLowerCase().includes('sm investment') || 
                  sh.name.toLowerCase().includes('sm investments')
          ) || MOCK_SHAREHOLDERS[0];
          setIssuer(fallback);
        }
      } catch (error) {
        console.error('Error fetching issuer:', error);
        // Use mock data as fallback
        const fallback = MOCK_SHAREHOLDERS.find(
          sh => sh.name.toLowerCase().includes('sm investment') || 
                sh.name.toLowerCase().includes('sm investments')
        ) || MOCK_SHAREHOLDERS[0];
        setIssuer(fallback);
    } finally {
        setLoading(false);
    }
  };

    fetchIssuer();
  }, []);

  // Fetch shareholdings data for Shareholder tab - Pending + Verified accounts only
  useEffect(() => {
    const fetchShareholdings = async () => {
      setLoadingShareholders(true);
      try {
        // Fetch all applicants
        const allApplicants = await applicantService.getAll();
        
        // Shareholder Tab (Verification Actions):
        // - Include pre-verified accounts (pending actions)
        // - Include user claims only (not full registry)
        // - Exclude corporates (only individuals)
        const shareholdersWithClaims = allApplicants.filter((applicant) => {
          const internalStatus = getWorkflowStatusInternal(applicant);
          
          // Include pre-verified accounts (pending actions) OR regular user claims
          // Pre-verified: isPreVerified === true with pending/verified status
          // User claims: VERIFIED or AWAITING_IRO_REVIEW (non-pre-verified)
          const isPreVerifiedPending = applicant.isPreVerified && 
            (internalStatus === 'VERIFIED' || internalStatus === 'AWAITING_IRO_REVIEW');
          const isUserClaim = !applicant.isPreVerified && 
            (internalStatus === 'VERIFIED' || internalStatus === 'AWAITING_IRO_REVIEW');
          
          // Only include individuals (applicants are always individuals, not corporates)
          return isPreVerifiedPending || isUserClaim;
        });

        // Store the applicants with claims for display in Shareholder tab
        setVerifiedShareholders(shareholdersWithClaims);
      } catch (error) {
        console.error('Error fetching shareholdings:', error);
        setVerifiedShareholders([]);
      } finally {
        setLoadingShareholders(false);
      }
    };

    if (displayTab === 'shareholder') {
      fetchShareholdings();
    }
  }, [displayTab]);


  // Fetch all users (basic sign-ups without share claims) for All Users tab
  useEffect(() => {
    const fetchAllUsers = async () => {
      setLoadingAllUsers(true);
      try {
        // Fetch all applicants
        const allApplicants = await applicantService.getAll();
        
        // All Users Tab: Include pre-verified accounts since they represent 
        // provisioned users ready for claiming/activation, providing a full registration overview.
        // Also include basic sign-ups without share claims
        const basicUsers = allApplicants.filter((applicant) => {
          const internalStatus = getWorkflowStatusInternal(applicant);
          
          // Include pre-verified accounts (provisioned users ready for claiming/activation)
          if (applicant.isPreVerified) {
            // Include pre-verified accounts that haven't been claimed yet
            // or are in early stages (not yet verified with holdings)
            return internalStatus !== 'VERIFIED' || !applicant.holdingsRecord;
          }
          
          // For non-pre-verified accounts:
          // Exclude users with valid claims (VERIFIED, AWAITING_IRO_REVIEW) - these go to Shareholder tab
          // Exclude users who need to resubmit (RESUBMISSION_REQUIRED)
          // Include only: unverified, no claims, or declined verification
          return internalStatus !== 'VERIFIED' 
            && internalStatus !== 'AWAITING_IRO_REVIEW'
            && internalStatus !== 'RESUBMISSION_REQUIRED';
        });
        
        setAllUsers(basicUsers);
      } catch (error) {
        console.error('Error fetching all users:', error);
        setAllUsers([]);
      } finally {
        setLoadingAllUsers(false);
      }
    };

    if (displayTab === 'all-users') {
      fetchAllUsers();
    }
  }, [displayTab]);

  // Fetch engagement data for Engagement tab
  useEffect(() => {
    const fetchEngagement = async () => {
      setLoadingEngagement(true);
      try {
        const applicants = await applicantService.getAll();
        
        const engagement = applicants.map((applicant) => {
          // Generate detailed engagement activities for this user
          const activities = generateEngagementData(applicant);
          
          // Determine verification status
          let verificationStatus = 'Unverified';
          if (applicant.status === RegistrationStatus.APPROVED && applicant.shareholdingsVerification?.step6?.verifiedAt) {
            verificationStatus = 'Verified';
          } else if (applicant.status === RegistrationStatus.PENDING) {
            verificationStatus = 'Pending';
          }

          // Get latest interaction (most recent of email opened, link clicked, account claimed, or latest activity)
          const interactions: string[] = [];
          if (applicant.emailOpenedAt) interactions.push(applicant.emailOpenedAt);
          if (applicant.linkClickedAt) interactions.push(applicant.linkClickedAt);
          if (applicant.accountClaimedAt) interactions.push(applicant.accountClaimedAt);
          // Add latest activity timestamp if available
          if (activities.length > 0) {
            interactions.push(activities[0].timestamp);
          }
          const latestInteraction = interactions.length > 0 
            ? new Date(Math.max(...interactions.map(d => new Date(d).getTime()))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Never';

          // Determine engagement type based on activities or account status
          let engagementType = 'None';
          if (activities.length > 0) {
            // Use the most recent activity's associated content type
            const latestActivity = activities[0];
            if (latestActivity.associatedContent) {
              switch (latestActivity.associatedContent.type) {
                case 'Press Release':
                case 'Announcement':
                  engagementType = 'News';
                  break;
                case 'Event':
                  engagementType = 'Event';
                  break;
                case 'Document':
                  engagementType = 'Disclosure';
                  break;
              }
            }
          }
          // Fallback to account-based engagement type if no activities
          if (engagementType === 'None') {
            if (applicant.accountClaimedAt) {
              engagementType = 'Disclosure';
            } else if (applicant.linkClickedAt) {
              engagementType = 'Event';
            } else if (applicant.emailOpenedAt) {
              engagementType = 'News';
            }
          }

          // Calculate total interactions (include activity count)
          const totalInteractions = activities.length + (applicant.emailOpenedCount || 0) + (applicant.linkClickedCount || 0) + (applicant.accountClaimedAt ? 1 : 0);

          // Notifications enabled if email was sent
          const notificationsEnabled = !!applicant.emailSentAt;

          return {
            investorName: applicant.fullName,
            verificationStatus,
            latestInteraction,
            engagementType,
            totalInteractions,
            notificationsEnabled,
            activities,
            applicant,
          };
        });

        setEngagementData(engagement);
      } catch (error) {
        console.error('Error fetching engagement data:', error);
        setEngagementData([]);
      } finally {
        setLoadingEngagement(false);
      }
    };

    if (displayTab === 'engagement') {
      fetchEngagement();
    }
  }, [displayTab]);

  // Calculate issuer metrics
  const totalSharesOutstanding = 25381100; // Fixed value from issuer/registry source
  const sharePrice = 125.50; // Random share price in peso
  const marketCap = totalSharesOutstanding * sharePrice; // Computed live
  // Calculate top holders concentration from verified shareholders only
  const verifiedShareholdersForMetrics = verifiedShareholders.filter((item): item is Applicant => 'fullName' in item);
  const topHoldersConcentration = verifiedShareholdersForMetrics.length >= 3
    ? verifiedShareholdersForMetrics.slice(0, 3).reduce((sum, applicant) => {
        const ownership = applicant.holdingsRecord?.ownershipPercentage || 0;
        return sum + ownership;
      }, 0)
    : verifiedShareholdersForMetrics.reduce((sum, applicant) => {
        const ownership = applicant.holdingsRecord?.ownershipPercentage || 0;
        return sum + ownership;
      }, 0);
  
  // Generate sample chart data for metric cards (7 days)
  const generateChartData = (baseValue: number, variance: number = 0.1) => {
    return Array.from({ length: 7 }, (_, i) => {
      const variation = (Math.sin(i) * variance + 1) * baseValue;
      return Math.round(variation);
    });
  };

  // Format peso currency (compact for large numbers to avoid overflow)
  const formatPesoCompact = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000_000) return `₱${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000) return `₱${(value / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `₱${(value / 1_000_000).toFixed(2)}M`;
    return `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const computeTrend = (series: number[]) => {
    if (!series || series.length < 2) return { percent: 0, direction: 'neutral' as const };
    const first = series[0] ?? 0;
    const last = series[series.length - 1] ?? 0;
    if (!first) return { percent: 0, direction: 'neutral' as const };
    const pct = ((last - first) / first) * 100;
    if (Math.abs(pct) < 0.01) return { percent: 0, direction: 'neutral' as const };
    return { percent: Math.abs(pct), direction: pct >= 0 ? ('up' as const) : ('down' as const) };
  };

  // Build 7-day series per metric for 7-day trend badges
  const totalSharesSeries = generateChartData(totalSharesOutstanding, 0.001);
  const sharePriceSeries = generateChartData(sharePrice, 0.03);
  const marketCapSeries = sharePriceSeries.map((p) => Math.round(p * totalSharesOutstanding));
  const topHoldersSeries = generateChartData(topHoldersConcentration, 0.02);

  // Helper function to get last 6 digits of registration/holders ID
  const getLast6Digits = (id: string | undefined | null): string => {
    if (!id) return '—';
    const idStr = id.toString();
    // Get last 6 digits
    return idStr.length >= 6 ? idStr.slice(-6) : idStr.padStart(6, '0');
  };

  // Helper function to get registration/holders ID for applicants
  const getApplicantRegistrationId = (applicant: Applicant): string => {
    // Priority: shareholdingsId from step2 > registrationId > applicant.id
    const internalStatus = getWorkflowStatusInternal(applicant);
    if (internalStatus === 'VERIFIED' || internalStatus === 'AWAITING_IRO_REVIEW') {
      return applicant.shareholdingsVerification?.step2?.shareholdingsId || 
             applicant.registrationId || 
             applicant.id;
    }
    // For pre-verified accounts
    if (applicant.isPreVerified && applicant.registrationId) {
      return applicant.registrationId;
    }
    return applicant.id;
  };

  // Handle uploading all mock data to Firebase
  // Follows the same separation logic as Registry Master tabs:
  // - Shareholders collection: Registry/IRO uploads (Investor tab) - includes corporates
  // - Applicants collection: Individual users (Shareholder tab + All Users tab) - only individuals
  const handleUploadToFirebase = async () => {
    setIsUploading(true);
    console.log('🚀 Starting Firebase upload process for all mock data...');
    console.log('📋 Following Registry Master tab conditions for clean data separation...');
    
    try {
      // ============================================
      // SHAREHOLDERS COLLECTION (Investor Tab Data)
      // ============================================
      // Conditions:
      // - Include IRO uploads (full registry)
      // - Include corporates (yes)
      // - Registry/IRO-uploaded institutional data
      // This data appears in the Investor tab (Ownership Reports)
      const shareholdersToUpload: Shareholder[] = [...MOCK_SHAREHOLDERS];
      
      console.log(`\n📊 SHAREHOLDERS COLLECTION (Investor Tab)`);
      console.log(`   Purpose: Registry/IRO uploads for ownership reports`);
      console.log(`   Includes: Corporates, institutions, nominee accounts`);
      console.log(`   Count: ${shareholdersToUpload.length} records`);

      // ============================================
      // APPLICANTS COLLECTION (Shareholder + All Users Tab Data)
      // ============================================
      // Conditions:
      // - Include pre-verified accounts (pending actions)
      // - Include user claims only (not full registry)
      // - Exclude corporates (only individuals)
      // This data appears in:
      //   - Shareholder tab: Verified/pending individuals with claims
      //   - All Users tab: Basic sign-ups and pre-verified accounts
      const applicantsToUpload: Applicant[] = [...MOCK_APPLICANTS];
      
      console.log(`\n👥 APPLICANTS COLLECTION (Shareholder + All Users Tab)`);
      console.log(`   Purpose: Individual user accounts for verification actions`);
      console.log(`   Includes: Pre-verified accounts, verified users, pending claims, basic sign-ups`);
      console.log(`   Excludes: Corporate entities (only individuals)`);
      console.log(`   Count: ${applicantsToUpload.length} records`);

      let uploadedShareholdersCount = 0;
      let uploadedApplicantsCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Upload shareholders to 'shareholders' collection (Investor tab data)
      if (shareholdersToUpload.length > 0) {
        console.log(`\n📤 Uploading ${shareholdersToUpload.length} shareholders to Firebase 'shareholders' collection...`);
        console.log(`   → These will appear in the Investor tab (Ownership Reports)`);
        console.log(`   → System will check for duplicates and overwrite existing records`);
        try {
          await batchService.migrateShareholders(shareholdersToUpload);
          uploadedShareholdersCount = shareholdersToUpload.length;
          console.log(`✅ Successfully uploaded ${uploadedShareholdersCount} shareholders to Firebase 'shareholders' collection`);
          console.log(`   → Available in Investor tab: Registry/IRO uploads, includes corporates`);
        } catch (error: any) {
          console.error('❌ Error uploading shareholders:', error);
          const errorMsg = `Shareholders: ${error.message || 'Unknown error'}`;
          errors.push(errorMsg);
          errorCount += shareholdersToUpload.length;
        }
      } else {
        console.log('ℹ️  No shareholders to upload');
      }

      // Upload applicants to 'applicants' collection (Shareholder + All Users tab data)
      if (applicantsToUpload.length > 0) {
        console.log(`\n📤 Uploading ${applicantsToUpload.length} applicants to Firebase 'applicants' collection...`);
        console.log(`   → These will appear in Shareholder tab (verified/pending) and All Users tab (all accounts)`);
        console.log(`   → System will check for duplicates by email/registrationId and overwrite existing records`);
        try {
          await batchService.migrateApplicants(applicantsToUpload);
          uploadedApplicantsCount = applicantsToUpload.length;
          console.log(`✅ Successfully uploaded ${uploadedApplicantsCount} applicants to Firebase 'applicants' collection`);
          console.log(`   → Available in Shareholder tab: Pre-verified accounts + user claims (individuals only)`);
          console.log(`   → Available in All Users tab: All registered accounts (including pre-verified)`);
        } catch (error: any) {
          console.error('❌ Error uploading applicants:', error);
          const errorMsg = `Applicants: ${error.message || 'Unknown error'}`;
          errors.push(errorMsg);
          errorCount += applicantsToUpload.length;
        }
      } else {
        console.log('ℹ️  No applicants to upload');
      }

      const totalUploaded = uploadedShareholdersCount + uploadedApplicantsCount;

      if (errorCount === 0) {
        console.log(`\n🎉 Upload completed successfully!`);
        console.log(`\n📊 DATA SEPARATION SUMMARY:`);
        console.log(`   ┌─────────────────────────────────────────────────┐`);
        console.log(`   │ Shareholders Collection (Investor Tab)         │`);
        console.log(`   │ • Registry/IRO uploads                        │`);
        console.log(`   │ • Includes corporates & institutions           │`);
        console.log(`   │ • Count: ${uploadedShareholdersCount.toString().padEnd(3)} records                    │`);
        console.log(`   └─────────────────────────────────────────────────┘`);
        console.log(`   ┌─────────────────────────────────────────────────┐`);
        console.log(`   │ Applicants Collection (Shareholder + All Users) │`);
        console.log(`   │ • Individual user accounts                     │`);
        console.log(`   │ • Pre-verified, verified, pending, basic sign-ups│`);
        console.log(`   │ • Count: ${uploadedApplicantsCount.toString().padEnd(3)} records                    │`);
        console.log(`   └─────────────────────────────────────────────────┘`);
        console.log(`   📈 Total records uploaded: ${totalUploaded}`);
        
        setUploadToast({
          show: true,
          message: `Successfully uploaded ${totalUploaded} records! ${uploadedShareholdersCount} shareholders (Investor tab) + ${uploadedApplicantsCount} applicants (Shareholder/All Users tabs)`,
          type: 'success'
        });
      } else {
        console.log(`\n⚠️  Upload completed with errors:`);
        console.log(`   ✅ Successfully uploaded: ${totalUploaded} records`);
        console.log(`   ❌ Failed: ${errorCount} records`);
        console.log(`   📋 Errors:`, errors);
        
        setUploadToast({
          show: true,
          message: `Uploaded ${totalUploaded} records, but ${errorCount} failed. Check console for details.`,
          type: 'error'
        });
      }

      // Hide toast after 5 seconds
      setTimeout(() => {
        setUploadToast({ show: false, message: '', type: 'success' });
      }, 5000);
    } catch (error: any) {
      console.error('\n❌ Fatal error during Firebase upload:', error);
      console.error('   Error details:', error.message || error);
      console.error('   Stack trace:', error.stack);
      
      setUploadToast({
        show: true,
        message: `Failed to upload data: ${error.message || 'Unknown error'}`,
        type: 'error'
      });
      setTimeout(() => {
        setUploadToast({ show: false, message: '', type: 'success' });
      }, 5000);
    } finally {
      setIsUploading(false);
      console.log('\n🏁 Upload process completed.\n');
    }
  };

  // Helper functions for Avatar and CopyableField
  const getInitials = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarColor = (name: string): string => {
    const colors = [
      '#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444',
      '#14B8A6', '#F97316', '#6366F1', '#A855F7', '#06B6D4', '#84CC16',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const Avatar: React.FC<{ name: string; size?: number; profilePictureUrl?: string }> = ({ name, size = 40, profilePictureUrl }) => {
    const [imageError, setImageError] = useState(false);
    const initials = getInitials(name);
    const color = getAvatarColor(name);
    
    if (profilePictureUrl && !imageError) {
      return (
        <img
          src={profilePictureUrl}
          alt={name}
          className="rounded-full shrink-0 object-cover"
          style={{ width: `${size}px`, height: `${size}px` }}
          onError={() => setImageError(true)}
        />
      );
    }
    
    return (
      <div
        className="rounded-full flex items-center justify-center text-white font-black shrink-0"
        style={{ width: `${size}px`, height: `${size}px`, backgroundColor: color, fontSize: `${size * 0.4}px` }}
      >
        {initials}
      </div>
    );
  };

  const CopyableField: React.FC<{ label: string; value: string; copyable: boolean }> = ({ label, value, copyable }) => {
    const [showCopied, setShowCopied] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleCopy = async () => {
      if (!copyable || !value || value === 'Not provided') return;
      try {
        await navigator.clipboard.writeText(value);
        setShowCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setShowCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
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

  // Show detail view if user is selected
  if (selectedUser) {
    // Get account status
    const getDisplayStatus = () => {
      if (selectedUser.isPreVerified) {
        if (selectedUser.accountStatus) {
          return selectedUser.accountStatus === 'VERIFIED' ? 'VERIFIED INVESTOR' : 
                 selectedUser.accountStatus === 'PENDING' ? 'PENDING INVESTOR' : 
                 'UNVERIFIED INVESTOR';
        }
        return 'PENDING INVESTOR';
      }
      const internalStatus = getWorkflowStatusInternal(selectedUser);
      const status = getGeneralAccountStatus(internalStatus);
      return status === 'VERIFIED' ? 'VERIFIED INVESTOR' : 
             status === 'PENDING' ? 'PENDING INVESTOR' : 
             'UNVERIFIED INVESTOR';
    };

    const displayStatus = getDisplayStatus();
    const initials = getInitials(selectedUser.fullName);

    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={() => setSelectedUser(null)} 
          className="flex items-center gap-2 text-[10px] font-black text-neutral-500 dark:text-neutral-400 hover:text-primary transition-colors uppercase tracking-widest group"
        >
          <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/>
          </svg>
          Shareholders
        </button>
        
        {/* Profile Card - Matching image style */}
        <div className="bg-neutral-700 dark:bg-neutral-800 rounded-lg p-8 flex items-center gap-8">
          {/* Avatar with teal-green background */}
          <div className="w-20 h-20 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-2xl shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white uppercase tracking-tight mb-2">{selectedUser.fullName}</h2>
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
                <p className="text-sm text-white">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Contact</p>
                <p className="text-sm text-white">{selectedUser.phoneNumber || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Network Origin</p>
                <p className="text-sm text-white">{selectedUser.location || 'Global Hub'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Registry Date</p>
                <p className="text-sm text-white">
                  {selectedUser.submissionDate ? new Date(selectedUser.submissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm rounded-xl overflow-hidden">
          <div className="flex border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30">
            <button 
              onClick={() => setActiveDetailTab('holdings')} 
              className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'holdings' ? 'text-blue-400' : 'text-neutral-400 hover:text-blue-400'}`}
            >
              Holdings summary
              {activeDetailTab === 'holdings' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-400"></div>}
            </button>
            <button 
              onClick={() => setActiveDetailTab('engagement')} 
              className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'engagement' ? 'text-blue-400' : 'text-neutral-400 hover:text-blue-400'}`}
            >
              Engagement
              {activeDetailTab === 'engagement' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-400"></div>}
            </button>
          </div>
          <div className="p-10">
            {activeDetailTab === 'holdings' ? (
              <HoldingsSummary applicant={selectedUser} />
            ) : (
              <EngagementTabContent applicant={selectedUser} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative">
      {/* Side Audit Drawer */}
      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isAuditOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAuditOpen(false)}></div>
        <div className={`absolute top-0 right-0 h-full w-[400px] bg-white dark:bg-neutral-800 shadow-2xl transition-transform duration-500 transform ${isAuditOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-8 h-full flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-widest">Audit Trail</h3>
                <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mt-1">Immutability Log</p>
              </div>
              <button onClick={() => setIsAuditOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors">
                <svg className="w-5 h-5 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              {MOCK_AUDIT_LOGS.map((log) => (
                <div key={log.id} className="relative pl-6 border-l border-neutral-200 dark:border-neutral-700">
                  <div className="absolute left-[-4px] top-1.5 w-2 h-2 rounded-full bg-[#082b4a] dark:bg-[#00adf0]"></div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">{log.date} • {log.time}</span>
                  </div>
                  <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 leading-tight mb-2">{log.event}</p>
                  <span className="inline-block px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-[9px] font-black text-neutral-600 dark:text-neutral-300 rounded border border-neutral-300 dark:border-neutral-600 uppercase tracking-widest">
                    Actor: {log.user}
                  </span>
                </div>
              ))}
            </div>

            <button className="w-full py-4 text-[10px] font-black bg-[#082b4a] dark:bg-[#00adf0] text-white uppercase tracking-widest rounded-lg mt-8 shadow-lg hover:bg-[#061d33] dark:hover:bg-[#0099d6] transition-all">
              Download Full Security Log
            </button>
          </div>
        </div>
      </div>

      {/* Top Header Section */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">Shareholders</h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            {issuer ? `${issuer.name.toUpperCase()} • Issuer Information` : 'Issuer Information • Updated Today'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleUploadToFirebase}
            disabled={isUploading}
            className="px-5 py-2 text-[10px] font-black border border-neutral-200 dark:border-neutral-700 rounded-lg uppercase tracking-widest hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all flex items-center gap-2 group text-neutral-600 dark:text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-3 h-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                Upload to Firebase
              </>
            )}
          </button>
          <button 
            onClick={() => setIsAuditOpen(true)}
            className="px-5 py-2 text-[10px] font-black border border-neutral-200 dark:border-neutral-700 rounded-lg uppercase tracking-widest hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all flex items-center gap-2 group text-neutral-600 dark:text-neutral-300"
          >
            <svg className="w-3 h-3 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Audit History
          </button>
        </div>
      </div>

      {/* Issuer Information Section */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-16 h-16 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
            <svg className="w-6 h-6 text-neutral-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            </div>
          <p className="text-sm font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Loading issuer data...</p>
          </div>
      ) : issuer ? (
        <>
          {/* Issuer Details Header - Enlarged like greeting card */}
          <div className="bg-neutral-100 dark:bg-black p-12 rounded-xl shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300 mb-6">
            {/* Micro-texture overlay for dark mode */}
            <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
              <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.08]">
                <filter id="issuer-noise-filter">
                  <feTurbulence 
                    type="fractalNoise" 
                    baseFrequency="0.9" 
                    numOctaves="4" 
                    stitchTiles="stitch"
                  />
                  <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#issuer-noise-filter)" />
              </svg>
        </div>
        
            <div className="absolute top-1/2 right-0 -translate-y-1/2 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
              <svg 
                className="w-24 h-24" 
                viewBox="0 0 66.14583 66.141065" 
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid meet"
              >
                <g transform="translate(-56.044239,-116.18301)">
                  <g transform="matrix(0.66011954,0,0,0.66011954,19.048341,28.016474)">
                    <path
                      style={{ fill: '#0f2feb', fillOpacity: 1 }}
                      d="M 99.634778,233.31422 C 69.287935,229.22114 49.593805,199.21164 57.988555,169.8546 c 7.82088,-27.35017 36.978343,-42.71271 63.995265,-33.71794 28.86013,9.60842 42.57709,42.65531 28.98356,69.82714 -9.59,19.16925 -30.27533,30.19056 -51.332602,27.35042 z"
                    />
                    <path
                      style={{ fill: '#ffffff', fillOpacity: 1 }}
                      d="m 121.57804,187.84701 c 4.64178,-2.40035 6.87794,-12.81135 6.89248,-32.0896 l 0.004,-5.09323 h -2.24896 -2.24896 l -0.002,1.12448 c -0.0328,14.72674 -1.38122,29.43418 -3.69596,31.80808 -2.21309,2.26966 -4.49132,-8.74133 -4.68451,-25.32578 l -0.16812,-7.60678 h -2.37887 -2.37887 l 0.18661,6.81303 c 0.48466,17.69464 1.64741,24.46944 4.90753,28.59379 1.6031,2.02808 3.94553,2.74336 5.81617,1.77601 z"
                    />
                    <path
                      style={{ fill: '#ffffff', fillOpacity: 1 }}
                      d="m 136.94103,183.34023 v -32.67605 h -2.38125 -2.38125 v 32.67605 32.67604 h 2.38125 2.38125 z"
                    />
                    <path
                      style={{ fill: '#ffffff', fillOpacity: 1 }}
                      d="m 115.38739,205.72153 v -10.29474 c 0,0 0.80932,0.38104 1.22879,0.53455 1.77349,0.64905 4.60266,0.7449 6.16617,0.0471 0.55533,-0.24785 0.87734,-0.39753 1.22144,-0.57061 -0.033,1.69832 -0.0273,4.72212 -0.0273,10.39199 v 10.18646 h 2.24896 2.24895 v -15.53007 -15.53008 l -0.7334,1.53636 c -1.89055,3.9604 -5.21019,5.88261 -8.36131,5.77924 -2.99518,-0.0983 -5.88939,-1.89884 -7.69825,-5.68986 l -0.91549,-1.91868 -0.009,15.67657 -0.009,15.67656 h 2.38125 2.38125 z"
                    />
                    <path
                      style={{ fill: '#ffffff', fillOpacity: 1 }}
                      d="m 322.9043,501.0918 c -5.17601,0.039 -10.20766,0.73971 -14.83594,2.10547 -28.46358,8.39928 -49.00049,38.88934 -39.53516,75.89843 3.19023,12.47365 9.26715,23.5945 19.875,35.95118 2.82218,3.28743 6.49777,7.05328 10.03711,10.51953 5.43281,5.32055 8.39695,7.95762 10.92969,10.34961 -1.26758,1.97223 -4.66548,6.76802 -5.74219,8.77343 -19.20964,35.77799 -8.31742,75.66263 22.96289,77.80664 26.65038,1.82669 41.02861,-25.04148 30.07618,-56.20312 -4.53848,-12.91272 -11.71769,-21.77191 -36.3418,-43.68164 -19.07033,-16.96815 -28.95001,-28.87471 -33.43555,-42.01367 -2.75013,-8.05569 -3.83445,-17.58549 -2.70312,-26.05469 5.75036,-43.04735 59.40313,-49.95653 81.82421,-10.22852 3.44859,6.11055 8.90576,16.2724 9.96876,29.45313 2.94368,-0.65326 8.06083,-2.08846 10.80273,-2.90235 -0.11906,2.76106 -0.21605,3.75172 -0.24023,42.03516 l -0.0254,42.35742 -2.85156,-6.68359 c -6.17995,-14.48455 -13.60425,-22.26993 -48.81054,-56.12305 -14.30926,-13.75929 -18.29455,-19.7166 -19.11524,-28.47656 -0.6342,-6.76951 0.86124,-11.58748 5.19727,-13.42773 7.15483,-3.03659 14.6364,1.10193 20.54882,9.2871 3.8688,5.35605 5.8682,13.87111 7.32227,20.33985 3.19243,-0.73595 -0.25521,0.11141 8.30664,-2.03906 7.42493,-1.86509 6.2e-4,5.2e-4 7.03125,-1.68946 -1.12095,-10.21485 -10.39416,-28.29729 -16.51758,-33.5 -6.43389,-5.46655 -13.63875,-9.42194 -21.31054,-9.97265 -18.57241,-1.33319 -30.63617,13.34504 -27.75,33.76367 2.00277,14.16899 9.90674,25.33192 32.83203,46.36719 10.7489,9.86275 19.60638,18.0321 25.90234,25.69921 13.22484,16.10495 17.10015,29.42818 17.16602,47.61719 0.10424,28.78753 -16.92304,48.85635 -41.61524,50.15235 -31.20465,1.63782 -52.96249,-19.82442 -53.09961,-54.41602 -0.0556,-14.02571 2.26353,-24.00015 9.42774,-38.125 3.26007,-6.42754 5.22543,-9.76257 6.39062,-11.9082 -1.67626,-1.14418 -2.80928,-1.91851 -6.06055,-3.90235 -3.11931,-1.90333 -5.65429,-3.46289 -5.65429,-3.46289 0,0 -3.56256,4.1648 -7.85156,11.23633 -24.66868,40.67248 -13.09872,94.58112 23.5664,111.57422 14.52828,6.73337 31.68733,7.66001 44.8711,4.94726 16.2711,-3.34851 30.63324,-14.64918 38.36328,-29.25781 l 3.70312,-7 0.0312,17.25 0.0293,17.25 h 9 9 v -123.5 -123.5 h -9 -9 l -0.0508,24.25 -0.0527,24.25 -2.24804,-6.04883 c -5.0806,-13.66348 -13.44641,-24.76865 -23.10352,-32.41796 -10.81468,-8.56625 -24.98726,-12.79899 -38.21484,-12.69922 z m -2.52735,145.5625 c 3.11033,2.38212 10.93712,9.98871 14.84375,15.81054 14.38357,21.43507 7.25071,48.5131 -11.01367,42.85352 -9.00718,-2.79103 -14.27557,-13.7691 -14.20508,-26.90625 0.0431,-8.01283 2.22594,-16.8805 6.31055,-25.0332 1.65335,-3.29998 3.84195,-6.48276 4.06445,-6.72461 z"
                      transform="matrix(0.26458333,0,0,0.26458333,0,17.378509)"
                    />
                  </g>
                </g>
              </svg>
            </div>
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-4xl font-black text-neutral-900 dark:text-white uppercase tracking-tight mb-4">
                    {issuer.name.toUpperCase()}
                  </h3>
                  <div className="flex flex-wrap gap-6 text-sm text-neutral-600 dark:text-neutral-400">
                    <div>
                      <span className="font-bold uppercase tracking-wider">Issuer ID:</span>{' '}
                      <span className="font-mono">{issuer.id}</span>
          </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider">Address:</span>{' '}
                      {issuer.coAddress || 'Registered Office'}
            </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider">Country:</span>{' '}
                      {issuer.country}
                    </div>
                    <div>
                      <span className="font-bold uppercase tracking-wider">Account Type:</span>{' '}
                      {issuer.accountType}
                    </div>
                  </div>
            </div>
            </div>
          </div>
        </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <MetricCard
              title="Total Shares Outstanding"
              value={totalSharesOutstanding.toLocaleString()}
              trend={computeTrend(totalSharesSeries)}
              chartData={totalSharesSeries}
              chartColor="#7C3AED"
              subtitle="Issued ordinary shares"
            />
            <MetricCard
              title="Share Price"
              value={formatPesoCompact(sharePrice)}
              trend={computeTrend(sharePriceSeries)}
              secondaryTrend={{ percent: 0.42, direction: 'up', display: 'hover', label: 'Today' }}
              chartData={sharePriceSeries}
              chartColor="#10B981"
              subtitle="Last market close"
              tooltipSymbol="₱"
            />
            <MetricCard
              title="Market Capitalization"
              value={formatPesoCompact(marketCap)}
              trend={computeTrend(marketCapSeries)}
              chartData={marketCapSeries.map((v) => v / 1_000_000)}
              chartColor="#3b82f6"
              subtitle="Price × shares outstanding"
              tooltipSymbol="₱"
            />
            <MetricCard
              title="Top Holders Concentration"
              value={`${topHoldersConcentration.toFixed(2)}%`}
              trend={computeTrend(topHoldersSeries)}
              chartData={topHoldersSeries}
              chartColor="#F59E0B"
              subtitle="Top 3 shareholders"
              tooltipSymbol="%"
            />
          </div>

          {/* Tabs Section */}
          {/* Tab Headers */}
          <div className="border-b border-neutral-200 dark:border-neutral-700 mb-6">
            <div className="flex">
              <button
                onClick={() => handleTabChange('shareholder')}
                className={`px-6 py-4 text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === 'shareholder'
                    ? 'text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-100'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Shareholder
              </button>
              <button
                onClick={() => handleTabChange('all-users')}
                className={`px-6 py-4 text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === 'all-users'
                    ? 'text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-100'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                All Users
              </button>
              <button
                onClick={() => handleTabChange('engagement')}
                className={`px-6 py-4 text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === 'engagement'
                    ? 'text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-100'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Engagement
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={localSearchQuery}
                onChange={(e) => {
                  setLocalSearchQuery(e.target.value);
                  setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                }}
                placeholder="Search by name, email, or ID..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-transparent"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Name Sort (A-Z / Z-A) */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Name:</label>
                <select
                  value={nameSort || 'none'}
                  onChange={(e) => {
                    setNameSort(e.target.value === 'none' ? null : e.target.value);
                    setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                  }}
                  className="px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-transparent"
                >
                  <option value="none">None</option>
                  <option value="a-z">A-Z</option>
                  <option value="z-a">Z-A</option>
                </select>
              </div>

              {/* Holdings Sort (High to Low / Low to High) - for Shareholder and All Users tabs */}
              {displayTab !== 'engagement' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Holdings:</label>
                  <select
                    value={holdingsSort || 'none'}
                    onChange={(e) => {
                      setHoldingsSort(e.target.value === 'none' ? null : e.target.value);
                      setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                    }}
                    className="px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-transparent"
                  >
                    <option value="none">None</option>
                    <option value="high-to-low">High to Low</option>
                    <option value="low-to-high">Low to High</option>
                  </select>
                </div>
              )}

              {/* Engagement Type Filter (for Engagement tab) */}
              {displayTab === 'engagement' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Type:</label>
                  <select
                    value={engagementTypeFilter || 'all'}
                    onChange={(e) => {
                      setEngagementTypeFilter(e.target.value === 'all' ? null : e.target.value);
                      setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                    }}
                    className="px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-transparent"
                  >
                    <option value="all">All</option>
                    <option value="disclosure">Disclosure</option>
                    <option value="event">Event</option>
                    <option value="news">News</option>
                    <option value="none">None</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Tab Content */}
          <div className="relative">
              <div 
                className={`transition-opacity duration-150 ease-in-out ${
                  isTransitioning 
                    ? 'opacity-0 pointer-events-none' 
                    : 'opacity-100 pointer-events-auto'
                }`}
                style={{ willChange: isTransitioning ? 'opacity' : 'auto' }}
              >
              {displayTab === 'shareholder' && (
                <div className="overflow-x-auto">
                  {loadingShareholders ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
                        <svg className="w-5 h-5 text-neutral-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                      </div>
                      <p className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Loading shareholdings...</p>
                    </div>
                  ) : verifiedShareholders.length > 0 ? (
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 italic">
                        Operational list of only pending/verified individuals needing IRO review—no full registry dump. Includes pre-verified accounts (pending actions) and user claims only.
                      </p>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-900/50 text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200 dark:border-neutral-700">
                            <th className="px-4 py-5">REGISTRATION ID</th>
                            <th className="px-4 py-5">NAME</th>
                            <th className="px-4 py-5">EMAIL</th>
                            <th className="px-4 py-5">VERIFICATION STATUS</th>
                            <th className="px-4 py-5">SHARES</th>
                            <th className="px-4 py-5">% OWNERSHIP</th>
                            <th className="px-4 py-5">LAST UPDATED</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                          {getPaginatedData(filterData(verifiedShareholders.filter((item): item is Applicant => 'fullName' in item)), 'shareholder').map((applicant) => {
                            const internalStatus = getWorkflowStatusInternal(applicant);
                            const verificationStatus = internalStatus === 'VERIFIED'
                              ? 'Verified' 
                              : internalStatus === 'AWAITING_IRO_REVIEW'
                              ? 'Pending'
                              : 'Unverified';
                            
                            // For pending accounts (AWAITING_IRO_REVIEW), get holdings from holdingsRecord if available
                            // For verified accounts, use holdingsRecord
                            // Holdings should be displayed for both pending and verified
                            let shares = 0;
                            let ownership = 0;
                            
                            if (internalStatus === 'VERIFIED' || internalStatus === 'AWAITING_IRO_REVIEW') {
                              // Both verified and pending (awaiting IRO) should show holdings
                              shares = applicant.holdingsRecord?.sharesHeld || 0;
                              ownership = applicant.holdingsRecord?.ownershipPercentage || 0;
                            }
                            
                            const lastUpdated = applicant.shareholdingsVerification?.step6?.verifiedAt 
                              || applicant.shareholdingsVerification?.step2?.submittedAt 
                              || applicant.submissionDate;

                            const registrationId = getApplicantRegistrationId(applicant);
                            const displayId = getLast6Digits(registrationId);

                            return (
                              <tr 
                                key={applicant.id} 
                                onClick={() => setSelectedUser(applicant)}
                                className="group hover:bg-neutral-50 dark:hover:bg-neutral-700/80 transition-all cursor-pointer"
                              >
                                <td className="px-4 py-5">
                                  <Tooltip content={`Full ID: ${registrationId}`}>
                                    <span className="text-sm font-mono font-black text-neutral-900 dark:text-neutral-100">
                                      {displayId}
                                    </span>
                                  </Tooltip>
                                </td>
                                <td className="px-4 py-5">
                                  <Tooltip content={applicant.fullName}>
                                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">{applicant.fullName}</p>
                                  </Tooltip>
                                </td>
                                <td className="px-4 py-5">
                                  <Tooltip content={applicant.email}>
                                    <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate block">{applicant.email}</span>
                                  </Tooltip>
                                </td>
                                <td className="px-4 py-5">
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-medium rounded-full uppercase tracking-wider ${
                                    verificationStatus === 'Verified'
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                      : verificationStatus === 'Pending'
                                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                      : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                                  }`}>
                                    {verificationStatus === 'Unverified' && (
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                                      </svg>
                                    )}
                                    {verificationStatus === 'Pending' && (
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 6v6l4 2"/>
                                      </svg>
                                    )}
                                    {verificationStatus === 'Verified' && (
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                                        <path d="m9 12 2 2 4-4"/>
                                      </svg>
                                    )}
                                    {verificationStatus}
                                  </span>
                                </td>
                                <td className="px-4 py-5">
                                  <span className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                                    {shares > 0 ? shares.toLocaleString() : '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-5">
                                  <span className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                                    {ownership > 0 ? `${ownership.toFixed(5)}%` : '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-5">
                                  <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                    {lastUpdated ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {(() => {
                        const filteredData = filterData(verifiedShareholders.filter((item): item is Applicant => 'fullName' in item));
                        return filteredData.length > itemsPerPage && (
                          <div className="mt-6 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700 pt-4">
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">
                              Showing {((currentPage.shareholder - 1) * itemsPerPage) + 1} to {Math.min(currentPage.shareholder * itemsPerPage, filteredData.length)} of {filteredData.length} verified investors
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handlePageChange('shareholder', currentPage.shareholder - 1)}
                                disabled={currentPage.shareholder === 1}
                                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => handlePageChange('shareholder', currentPage.shareholder + 1)}
                                disabled={currentPage.shareholder >= getTotalPages(filteredData.length)}
                                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
                        <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                      </div>
                      <p className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">No shareholdings found.</p>
                    </div>
                  )}
                </div>
              )}

              {displayTab === 'all-users' && (
                <div className="overflow-x-auto">
                  {loadingAllUsers ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
                        <svg className="w-5 h-5 text-neutral-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                        </div>
                      <p className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Loading users...</p>
                    </div>
                  ) : allUsers.length > 0 ? (
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 italic">
                        Tracks all frontend-registered accounts (basic sign-ups without share claims). Includes pre-verified accounts since they represent provisioned users ready for claiming/activation, providing a full registration overview.
                      </p>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-900/50 text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200 dark:border-neutral-700">
                            <th className="px-4 py-5">NAME</th>
                            <th className="px-4 py-5">EMAIL</th>
                            <th className="px-4 py-5">REGISTRATION DATE</th>
                            <th className="px-4 py-5">ACTIVITY LEVEL</th>
                            <th className="px-4 py-5">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                          {getPaginatedData(filterData(allUsers), 'all-users').map((user) => {
                            // Determine status (active/inactive)
                            const getStatus = (lastActive: string): 'Active' | 'Inactive' => {
                              if (lastActive === 'Just now' || lastActive.includes('hour') || lastActive.includes('day')) {
                                return 'Active';
                              }
                              return 'Inactive';
                            };

                            const lastActive = user.lastActive || 'Never';
                            const status = getStatus(lastActive);

                            // Determine badge color based on activity recency
                            const getActivityBadgeColor = (lastActive: string) => {
                              if (lastActive === 'Just now' || lastActive.includes('hour')) {
                                return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
                              }
                              if (lastActive.includes('day') || lastActive.includes('week')) {
                                return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
                              }
                              return 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300';
                            };

                            return (
                              <tr 
                                key={user.id} 
                                onClick={() => setSelectedUser(user)}
                                className="group hover:bg-neutral-50 dark:hover:bg-neutral-700/80 transition-all cursor-pointer"
                              >
                                <td className="px-4 py-5">
                                  <Tooltip content={user.fullName}>
                                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">{user.fullName}</p>
                                  </Tooltip>
                  </td>
                  <td className="px-4 py-5">
                                  <Tooltip content={user.email}>
                                    <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate block">{user.email}</span>
                                  </Tooltip>
                                </td>
                                <td className="px-4 py-5">
                                  <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                    {user.submissionDate ? new Date(user.submissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                                  <span className={`inline-block px-3 py-1 text-[10px] font-medium rounded-full uppercase tracking-wider ${getActivityBadgeColor(lastActive)}`}>
                                    {lastActive}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                                  <span className={`inline-block px-3 py-1 text-[10px] font-medium rounded-full uppercase tracking-wider ${
                                    status === 'Active'
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                                  }`}>
                                    {status}
                      </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {(() => {
                        const filteredData = filterData(allUsers);
                        return filteredData.length > itemsPerPage && (
                          <div className="mt-6 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700 pt-4">
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">
                              Showing {((currentPage['all-users'] - 1) * itemsPerPage) + 1} to {Math.min(currentPage['all-users'] * itemsPerPage, filteredData.length)} of {filteredData.length} users
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handlePageChange('all-users', currentPage['all-users'] - 1)}
                                disabled={currentPage['all-users'] === 1}
                                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => handlePageChange('all-users', currentPage['all-users'] + 1)}
                                disabled={currentPage['all-users'] >= getTotalPages(filteredData.length)}
                                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
                        <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                        </svg>
                      </div>
                      <p className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">No users found.</p>
                    </div>
                  )}
                </div>
              )}

              {displayTab === 'engagement' && (
                <div className="overflow-x-auto">
                  {loadingEngagement ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
                        <svg className="w-5 h-5 text-neutral-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                      </div>
                      <p className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Loading engagement data...</p>
                    </div>
                  ) : engagementData.length > 0 ? (
                    <div>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-900/50 text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200 dark:border-neutral-700">
                            <th className="px-4 py-5">INVESTOR NAME</th>
                            <th className="px-4 py-5">VERIFICATION STATUS</th>
                            <th className="px-4 py-5">LATEST INTERACTION</th>
                            <th className="px-4 py-5">ENGAGEMENT TYPE</th>
                            <th className="px-4 py-5">TOTAL INTERACTIONS</th>
                            <th className="px-4 py-5">NOTIFICATIONS ENABLED</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                          {getPaginatedData(filterEngagementData(engagementData), 'engagement').map((engagement, index) => (
                          <tr key={index} className="group hover:bg-neutral-50 dark:hover:bg-neutral-700/80 transition-all cursor-default">
                            <td className="px-4 py-5">
                              <Tooltip content={engagement.investorName}>
                                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">{engagement.investorName}</p>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-5">
                              <span className={`inline-block px-3 py-1 text-[10px] font-medium rounded-full uppercase tracking-wider ${
                                engagement.verificationStatus === 'Verified'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                  : engagement.verificationStatus === 'Pending'
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                              }`}>
                                {engagement.verificationStatus}
                              </span>
                  </td>
                            <td className="px-4 py-5">
                              <span className="text-xs text-neutral-600 dark:text-neutral-400">{engagement.latestInteraction}</span>
                            </td>
                            <td className="px-4 py-5">
                              <span className={`inline-block px-3 py-1 text-[10px] font-medium rounded-full uppercase tracking-wider ${
                                engagement.engagementType === 'Disclosure'
                                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                  : engagement.engagementType === 'Event'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : engagement.engagementType === 'News'
                                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
                                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                              }`}>
                                {engagement.engagementType}
                      </span>
                  </td>
                  <td className="px-4 py-5">
                              <span className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                                {engagement.totalInteractions}
                              </span>
                  </td>
                            <td className="px-4 py-5">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-medium rounded-full uppercase tracking-wider ${
                                engagement.notificationsEnabled
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                              }`}>
                                {engagement.notificationsEnabled ? (
                                  <>
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Yes
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    No
                                  </>
                                )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
                        {(() => {
                          const filteredData = filterEngagementData(engagementData);
                          return filteredData.length > itemsPerPage && (
                            <div className="mt-6 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700 pt-4">
                              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                Showing {((currentPage.engagement - 1) * itemsPerPage) + 1} to {Math.min(currentPage.engagement * itemsPerPage, filteredData.length)} of {filteredData.length} engagement records
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handlePageChange('engagement', currentPage.engagement - 1)}
                                  disabled={currentPage.engagement === 1}
                                  className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  Previous
                                </button>
                                <button
                                  onClick={() => handlePageChange('engagement', currentPage.engagement + 1)}
                                  disabled={currentPage.engagement >= getTotalPages(filteredData.length)}
                                  className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
                        <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                        </svg>
                      </div>
                      <p className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">No engagement data found.</p>
                    </div>
                  )}
                </div>
              )}
              </div>
          </div>
        </>

      ) : (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-neutral-200 dark:border-neutral-700">
                <svg className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
          <p className="text-sm font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">No issuer data found.</p>
          </div>
        )}

      {/* Upload Toast Notification */}
      <Toast
        message={uploadToast.message}
        isVisible={uploadToast.show}
        variant={uploadToast.type}
        onClose={() => setUploadToast({ show: false, message: '', type: 'success' })}
      />
    </div>
  );
};

export default ShareholdersRegistry;
