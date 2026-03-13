'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ISSUER_SAMPLE } from '../lib/issuer-sample';
import { MOCK_APPLICANTS } from '../lib/mockApplicants';
import { shareholderService, batchService, officialShareholderService, applicantService } from '../lib/firestore-service';
import { Shareholder, Applicant, RegistrationStatus, OfficialShareholder } from '../lib/types';
import { getWorkflowStatusInternal, getGeneralAccountStatus } from '../lib/shareholdingsVerification';
import MetricCard from './MetricCard';
import Tooltip from './Tooltip';
import Toast from './Toast';
import HoldingsSummary from './HoldingsSummary';
import { EngagementTabContent } from './OverviewDashboard';
import { computeShareholderStatus, getStatusBadgeColor, getStatusLabel } from '../lib/shareholder-status';

const MOCK_AUDIT_LOGS = [
  { id: 1, event: 'Ledger Export Generated', user: 'D. Sterling', time: '10:45 AM', date: 'Today' },
  { id: 2, event: 'New Shareholder "Ayala Corporation" Verified', user: 'System', time: '09:12 AM', date: 'Today' },
  { id: 3, event: 'Stake Re-calculation Triggered', user: 'System', time: '04:30 PM', date: 'Yesterday' },
  { id: 4, event: 'Manual Address Update: ID 201198216', user: 'M. Chen', time: '02:15 PM', date: 'Yesterday' },
  { id: 5, event: 'Annual Audit Certification Uploaded', user: 'Admin', time: '11:00 AM', date: 'Oct 24, 2023' },
];

interface ShareholdersRegistryProps {
  searchQuery: string;
  applicants: Applicant[];
  applicantsLoading: boolean;
}


type TabType = 'shareholder' | 'all-users';

const ShareholdersRegistry: React.FC<ShareholdersRegistryProps> = ({ searchQuery, applicants, applicantsLoading }) => {
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
  const [allShareholders, setAllShareholders] = useState<Shareholder[]>([]);
  const [officialShareholders, setOfficialShareholders] = useState<OfficialShareholder[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [selectedUser, setSelectedUser] = useState<Applicant | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'holdings' | 'engagement'>('holdings');

  // Search and filter state
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null); // 'all', 'VERIFIED', 'PRE-VERIFIED', 'null' for shareholder; 'all', 'VERIFIED', 'PRE-VERIFIED', 'null' for all-users
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest'); // Sort order for shareholder tab: newest to oldest or oldest to newest
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Keep a stable ref to the latest applicants so the Firestore subscription callback
  // can read fresh applicant data without needing `applicants` as an effect dependency.
  // If `applicants` were a dependency the entire subscription would be rebuilt on every
  // parent re-render (which happens on every Firestore write), causing subtle list reorders.
  const applicantsRef = useRef<Applicant[]>(applicants);
  useEffect(() => {
    applicantsRef.current = applicants;
  });

  // Sync selectedUser with updated applicant data when applicants prop changes
  useEffect(() => {
    if (selectedUser) {
      const updatedApplicant = applicants.find(a => a.id === selectedUser.id);
      if (updatedApplicant) {
        // Only update if the applicant data has actually changed
        // Compare key properties that affect holdings summary
        const hasChanged = 
          updatedApplicant.holdingsRecord?.sharesHeld !== selectedUser.holdingsRecord?.sharesHeld ||
          updatedApplicant.holdingsRecord?.ownershipPercentage !== selectedUser.holdingsRecord?.ownershipPercentage ||
          updatedApplicant.holdingsRecord?.companyId !== selectedUser.holdingsRecord?.companyId ||
          updatedApplicant.holdingsUpdateHistory?.length !== selectedUser.holdingsUpdateHistory?.length;
        
        if (hasChanged) {
          setSelectedUser(updatedApplicant);
        }
      }
    }
  }, [applicants, selectedUser]);

  // Pagination state for each tab
  const [currentPage, setCurrentPage] = useState<Record<TabType, number>>({
    shareholder: 1,
    'all-users': 1,
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

  // Filter functions for Applicant/Shareholder data
  const filterData = <T extends Applicant | Shareholder>(data: T[]): T[] => {
    let filtered = [...data];

    // Search query filter
    if (localSearchQuery.trim()) {
      const query = localSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        if ('fullName' in item) {
          // Applicant
          const applicant = item as Applicant;
          return applicant.fullName.toLowerCase().includes(query) || 
                 applicant.email?.toLowerCase().includes(query) ||
                 (applicant.registrationId || applicant.id).toLowerCase().includes(query);
        } else {
          // Shareholder
          const shareholder = item as Shareholder;
          return shareholder.name?.toLowerCase().includes(query) || 
                 shareholder.id.toLowerCase().includes(query);
        }
      });
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((item) => {
        if (!('fullName' in item)) return false; // Only filter applicants in Shareholder tab
        
        const applicant = item as Applicant;
        
        // Use official shareholder status (primary source of truth)
        if (displayTab === 'shareholder') {
          // For Shareholder tab: Use official shareholder status
          const officialShareholder = officialShareholders.find(sh => 
            sh.applicantId === applicant.id || 
            sh.id === applicant.registrationId ||
            (sh.email && applicant.email && sh.email.toLowerCase() === applicant.email.toLowerCase())
          );
          
          if (officialShareholder) {
            if (statusFilter === 'VERIFIED') {
              return officialShareholder.status === 'VERIFIED';
            } else if (statusFilter === 'PRE-VERIFIED') {
              return officialShareholder.status === 'PRE-VERIFIED';
            } else if (statusFilter === 'null') {
              return officialShareholder.status === 'NULL';
            }
          } else {
            // Fallback to applicant status if no official shareholder record
            if (statusFilter === 'VERIFIED') {
              return applicant.status === RegistrationStatus.APPROVED || 
                     applicant.accountStatus === 'VERIFIED' ||
                     applicant.shareholdingsVerification?.step6?.verifiedAt !== undefined;
            } else if (statusFilter === 'PRE-VERIFIED') {
              return applicant.isPreVerified === true;
            }
          }
        } else {
          // For All Users tab: Use computed status
          const status = computeShareholderStatus(applicant, null);
          if (statusFilter === 'VERIFIED') {
            return status === 'VERIFIED';
          } else if (statusFilter === 'PRE-VERIFIED') {
            return status === 'PRE-VERIFIED';
          } else if (statusFilter === 'null') {
            return status === null;
          }
        }
        return false;
      });
    }

    return filtered;
  };

  // Real-time subscription for official shareholders (consolidated collection)
  useEffect(() => {
    setLoading(true);
    
    // Set up real-time subscription for official shareholders
    const unsubscribeOfficialShareholders = officialShareholderService.subscribeToOfficialShareholders(
      (officialShareholders) => {
        // Convert to Shareholder format for compatibility
        const shareholders = officialShareholders.map(os => ({
          id: os.id,
          name: os.name,
          firstName: os.firstName,
          holdings: os.holdings || 0,
          stake: os.ownershipPercentage || 0, // Use ownershipPercentage for backward compatibility
          rank: os.rank || 0,
          coAddress: os.coAddress || '',
          country: os.country || '',
          accountType: os.accountType || '',
        }));
        
        setAllShareholders(shareholders);
        
        // Find SM Investment Corporation (case-insensitive search) from Firestore
        const smInvestment = officialShareholders.find(
          sh => sh.name.toLowerCase().includes('sm investment') || 
                sh.name.toLowerCase().includes('sm investments')
        );

        if (smInvestment) {
          // Convert to Shareholder format for issuer
          setIssuer({
            id: smInvestment.id,
            name: smInvestment.name,
            firstName: smInvestment.firstName,
            holdings: smInvestment.holdings || 0,
            stake: smInvestment.ownershipPercentage || 0,
            rank: smInvestment.rank || 0,
            coAddress: smInvestment.coAddress || '',
            country: smInvestment.country || '',
            accountType: smInvestment.accountType || '',
          });
        } else {
          // Fallback to issuer sample data if not found in Firestore
          setIssuer(ISSUER_SAMPLE);
        }
        
        setLoading(false);
      }
    );

    return () => {
      unsubscribeOfficialShareholders();
    };
  }, []);

  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time subscription for official shareholders
  // This collection tracks PRE-VERIFIED, VERIFIED, and NULL status investors independently
  useEffect(() => {
    if (displayTab !== 'shareholder') {
      return;
    }

    setLoadingShareholders(true);
    
    // Set up real-time subscription for official shareholders
    const unsubscribeOfficial = officialShareholderService.subscribeToOfficialShareholders(
      async (officialShareholdersList) => {
        setOfficialShareholders(officialShareholdersList);
        
        // Fetch corresponding applicant data in PARALLEL (not sequential) to avoid slow reordering
        // NOTE: We do NOT write back to Firestore inside this callback — any update inside the
        // subscription triggers a new snapshot, which would cause an infinite reorder loop.
        const officialInvestorsWithData: (OfficialShareholder & { applicant?: Applicant })[] = 
          await Promise.all(
            officialShareholdersList.map(async (officialShareholder) => {
              let applicant: Applicant | undefined;

              // 1. Try applicantId first (most reliable link)
              if (officialShareholder.applicantId) {
                try {
                  applicant = await applicantService.getById(officialShareholder.applicantId) || undefined;
                } catch {
                  // silently ignore — fallback below
                }
              }

              // 2. Fallback: match in already-loaded applicants list by email or registrationId
              // Read from the ref (always fresh) — NOT from the closure over `applicants` prop
              // so we don't need `applicants` in the effect dependency array
              if (!applicant) {
                applicant = applicantsRef.current.find(a =>
                  (a.email && officialShareholder.email &&
                    a.email.toLowerCase() === officialShareholder.email!.toLowerCase()) ||
                  a.registrationId === officialShareholder.id
                );
              }

              return { ...officialShareholder, applicant };
            })
          );
        
        // Helper: pick the most meaningful "last activity" date for a record.
        // Priority (most recent meaningful event wins):
        //   1. accountClaimedAt  – investor claimed their account
        //   2. holdingsUpdateHistory last entry – IRO updated holdings data
        //   3. emailSentAt       – IRO sent an invitation email
        //   4. createdAt         – IRO first added the investor (stable, never changes)
        const resolveSortDate = (
          official: OfficialShareholder,
          applicant?: Applicant
        ): string => {
          // 1. Account claimed (investor action)
          const claimed = official.accountClaimedAt || applicant?.accountClaimedAt;
          if (claimed) return claimed;

          // 2. Latest holdings update by IRO
          const history = applicant?.holdingsUpdateHistory;
          if (history && history.length > 0) {
            const sorted = [...history].sort((a, b) =>
              (b.updatedAt || '').localeCompare(a.updatedAt || '')
            );
            if (sorted[0]?.updatedAt) return sorted[0].updatedAt;
          }

          // 3. Email sent by IRO
          const emailSent = official.emailSentAt || applicant?.emailSentAt;
          if (emailSent) return emailSent;

          // 4. Investor first added by IRO (createdAt — this NEVER changes, fully stable)
          return official.createdAt;
        };

        // Convert to format expected by the component (using applicant data when available)
        const displayData: (Applicant & { _sortDate: string })[] = officialInvestorsWithData.map((official) => {
          const sortDate = resolveSortDate(official, official.applicant);

          if (official.applicant) {
            return {
              ...official.applicant,
              _sortDate: sortDate,
            } as Applicant & { _sortDate: string };
          }
          
          // No linked applicant — build a minimal display object from officialShareholder
          return {
            id: official.id,
            fullName: official.name,
            email: official.email || '',
            phoneNumber: official.phone,
            location: official.country,
            submissionDate: official.createdAt.split('T')[0],
            lastActive: 'Never',
            status: official.status === 'VERIFIED' ? RegistrationStatus.APPROVED : RegistrationStatus.PENDING,
            idDocumentUrl: '',
            taxDocumentUrl: '',
            isPreVerified: official.status === 'PRE-VERIFIED',
            registrationId: official.id,
            accountStatus: official.status === 'VERIFIED' ? 'VERIFIED' :
                          official.status === 'PRE-VERIFIED' ? 'PENDING' : 'UNVERIFIED',
            workflowStage: official.status === 'VERIFIED' ? 'ACCOUNT_CLAIMED' :
                          official.status === 'PRE-VERIFIED' ? 'SENT_EMAIL' : undefined,
            systemStatus: official.status === 'VERIFIED' ? 'CLAIMED' :
                          official.status === 'PRE-VERIFIED' ? 'ACTIVE' : 'NULL',
            holdingsRecord: official.holdings ? {
              companyId: official.id,
              companyName: official.name,
              sharesHeld: official.holdings,
              ownershipPercentage: official.ownershipPercentage || 0,
              sharesClass: official.accountType || 'Ordinary',
              registrationDate: official.createdAt,
            } : undefined,
            _sortDate: sortDate,
          } as Applicant & { _sortDate: string };
        });
        
        // Sort client-side (never triggers Firestore writes → never causes re-orders)
        displayData.sort((a, b) => {
          const dateA = a._sortDate;
          const dateB = b._sortDate;
          return sortOrder === 'newest'
            ? dateB.localeCompare(dateA)   // newest first
            : dateA.localeCompare(dateB);  // oldest first
        });
        
        setVerifiedShareholders(displayData as Applicant[]);
        setLoadingShareholders(false);
      }
    );

    return () => {
      unsubscribeOfficial();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayTab, sortOrder]);
  // NOTE: `applicants` is intentionally omitted from this dependency array.
  // We access it via `applicantsRef.current` inside the callback so the subscription
  // is not torn-down and rebuilt on every parent re-render (which happens on every
  // Firestore write). Rebuilding causes subtle, hard-to-notice list reordering.


  // Fetch all users (basic sign-ups without share claims) for All Users tab
  // Updates continuously with real-time data
  useEffect(() => {
    if (displayTab !== 'all-users') {
      return;
    }

    const fetchAllUsers = async () => {
      setLoadingAllUsers(true);
      try {
        // Use real-time applicants from App.tsx (Firestore subscription)
        const allApplicants = applicants;
        
        // All Users Tab: Include pre-verified accounts since they represent 
        // provisioned users ready for claiming/activation, providing a full registration overview.
        // Also include basic sign-ups without share claims
        const statusPromises = allApplicants.map(async (applicant) => {
          const internalStatus = await getWorkflowStatusInternal(applicant);
          return { applicant, internalStatus };
        });
        
        const applicantsWithStatus = await Promise.all(statusPromises);
        
        const basicUsers = applicantsWithStatus
          .filter(({ applicant, internalStatus }) => {
            // Include pre-verified accounts (provisioned users ready for claiming/activation)
            if (applicant.isPreVerified) {
              // Include pre-verified accounts that haven't been claimed yet
              // or are in early stages (not yet verified with holdings)
              return internalStatus !== 'VERIFIED' || !applicant.holdingsRecord;
            }
            
            // For non-pre-verified accounts:
            // Exclude users with valid claims (VERIFIED, UNDER_REVIEW) - these go to Shareholder tab
            // Exclude users who need to resubmit (FURTHER_INFO_REQUIRED)
            // Include only: unverified, no claims, or declined verification
            return internalStatus !== 'VERIFIED' 
              && internalStatus !== 'UNDER_REVIEW'
              && internalStatus !== 'FURTHER_INFO_REQUIRED';
          })
          .map(({ applicant }) => applicant);
        
        setAllUsers(basicUsers);
      } catch (error) {
        console.error('Error fetching all users:', error);
        setAllUsers([]);
      } finally {
        setLoadingAllUsers(false);
      }
    };

    if (applicantsLoading) {
      setLoadingAllUsers(true);
      return;
    }
    
    // Fetch immediately - real-time subscription will trigger updates automatically
    fetchAllUsers();
  }, [displayTab, applicants, applicantsLoading]);


  // Generate sample chart data for metric cards (7 days)
  const generateChartData = (baseValue: number, variance: number = 0.1) => {
    return Array.from({ length: 7 }, (_, i) => {
      const variation = (Math.sin(i) * variance + 1) * baseValue;
      return Math.round(variation);
    });
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

  // Calculate metrics for Shareholder Tab (Masterlist View)
  const calculateShareholderTabMetrics = () => {
    // 1. Total Official Shareholders (from official shareholders collection)
    const totalOfficialShareholders = officialShareholders.length;

    // Get the count of what's actually displayed in the table
    const displayedShareholdersCount = verifiedShareholders.length;

    // 2. Verified Accounts (count and percentage)
    // Count verified from official shareholders collection
    const verifiedCount = officialShareholders.filter(sh => sh.status === 'VERIFIED').length;
    
    // Calculate percentage based on total official shareholders
    const verifiedPercentage = totalOfficialShareholders > 0 
      ? Math.round((verifiedCount / totalOfficialShareholders) * 100)
      : 0;

    // 3. Pending Claims (Pre-Verified) - accounts created by IRO but not yet claimed
    // Count from official shareholders collection
    const pendingClaimsCount = officialShareholders.filter(sh => sh.status === 'PRE-VERIFIED').length;

    // 4. No Contact Records (Null Status) - official investors with no email/phone
    // Count from official shareholders collection
    const noContactCount = officialShareholders.filter(sh => sh.status === 'NULL').length;

    return {
      totalOfficialShareholders,
      displayedShareholdersCount,
      verifiedCount,
      verifiedPercentage,
      pendingClaimsCount,
      noContactCount,
    };
  };

  // Calculate metrics for All Users Tab (Account View)
  const calculateAllUsersTabMetrics = () => {
    // 1. Total Registered Users
    const totalRegisteredUsers = allUsers.length;

    // 2. Verified Users
    const verifiedUsersCount = allUsers.filter(user => {
      const status = computeShareholderStatus(user, null);
      return status === 'VERIFIED';
    }).length;

    // 3. Pre-Verified Users
    const preVerifiedUsersCount = allUsers.filter(user => {
      const status = computeShareholderStatus(user, null);
      return status === 'PRE-VERIFIED';
    }).length;

    // 4. Unverified Users (not verified and not pre-verified)
    const unverifiedUsersCount = allUsers.filter(user => {
      const status = computeShareholderStatus(user, null);
      return status === null;
    }).length;

    return {
      totalRegisteredUsers,
      verifiedUsersCount,
      preVerifiedUsersCount,
      unverifiedUsersCount,
    };
  };

  // Get metrics based on active tab
  const shareholderMetrics = calculateShareholderTabMetrics();
  const allUsersMetrics = calculateAllUsersTabMetrics();

  // Generate chart data for trends
  const generateTrendSeries = (value: number) => generateChartData(value, 0.05);

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
    // For pre-verified accounts, use registrationId
    if (applicant.isPreVerified && applicant.registrationId) {
      return applicant.registrationId;
    }
    // For verified accounts
    if (applicant.status === RegistrationStatus.APPROVED || applicant.accountStatus === 'VERIFIED') {
      return applicant.shareholdingsVerification?.step2?.shareholdingsId || 
             applicant.registrationId || 
             applicant.id;
    }
    return applicant.registrationId || applicant.id;
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
      // Note: Shareholders should be uploaded via batch upload feature, not from mock data
      const shareholdersToUpload: Shareholder[] = [];
      
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
      <div className="max-w-screen-2xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={() => setSelectedUser(null)} 
          className="flex items-center gap-1.5 text-[10px] font-black text-neutral-500 dark:text-neutral-400 hover:text-primary transition-colors uppercase tracking-widest group"
        >
          <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/>
          </svg>
          Shareholders
        </button>
        
        {/* Profile Card */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-white/[0.04] rounded-lg p-5 flex items-center gap-5 shadow-sm">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-tight mb-1">{selectedUser.fullName}</h2>
            {/* Status with icon */}
            <div className="flex items-center gap-1.5 mb-3">
              {displayStatus === 'VERIFIED INVESTOR' && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                  <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium uppercase tracking-wide">{displayStatus}</p>
                </div>
              )}
              {displayStatus === 'PENDING INVESTOR' && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  <p className="text-xs text-amber-500 dark:text-amber-400 font-medium uppercase tracking-wide">{displayStatus}</p>
                </div>
              )}
              {(displayStatus === 'UNVERIFIED INVESTOR' || !displayStatus.includes('VERIFIED') && !displayStatus.includes('PENDING')) && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                  </svg>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-wide">{displayStatus}</p>
                </div>
              )}
            </div>
            {/* Profile data inline */}
            {(() => {
              const getRegistrationId = (): string => {
                const internalStatus = getWorkflowStatusInternal(selectedUser);
                if (internalStatus === 'RESUBMISSION_REQUIRED') return '';
                if (internalStatus === 'VERIFIED' || internalStatus === 'AWAITING_IRO_REVIEW') {
                  return selectedUser.shareholdingsVerification?.step2?.shareholdingsId ||
                         selectedUser.registrationId ||
                         selectedUser.id;
                }
                if (selectedUser.isPreVerified && selectedUser.registrationId) return selectedUser.registrationId;
                return selectedUser.id;
              };
              const regId = getRegistrationId();
              const displayRegId = !regId ? '—' : regId.length > 6 ? regId.slice(-6) : regId;
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mt-3">
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Registration ID</p>
                    <p className="text-xs text-neutral-800 dark:text-neutral-200">{displayRegId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Email</p>
                    <p className="text-xs text-neutral-800 dark:text-neutral-200">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Contact</p>
                    <p className="text-xs text-neutral-800 dark:text-neutral-200">{selectedUser.phoneNumber || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Network Origin</p>
                    <p className="text-xs text-neutral-800 dark:text-neutral-200">{selectedUser.location || 'Global Hub'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Registry Date</p>
                    <p className="text-xs text-neutral-800 dark:text-neutral-200">
                      {selectedUser.submissionDate ? new Date(selectedUser.submissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm rounded-xl overflow-hidden">
          <div className="flex border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30">
            <button 
              onClick={() => setActiveDetailTab('holdings')} 
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'holdings' ? 'text-blue-400' : 'text-neutral-400 hover:text-blue-400'}`}
            >
              Holdings summary
              {activeDetailTab === 'holdings' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400"></div>}
            </button>
            <button 
              onClick={() => setActiveDetailTab('engagement')} 
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeDetailTab === 'engagement' ? 'text-blue-400' : 'text-neutral-400 hover:text-blue-400'}`}
            >
              Engagement
              {activeDetailTab === 'engagement' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400"></div>}
            </button>
          </div>
          <div className="p-6">
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
    <div className="space-y-4 max-w-screen-2xl mx-auto relative">
      {/* Side Audit Drawer */}
      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isAuditOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAuditOpen(false)}></div>
        <div className={`absolute top-0 right-0 h-full w-[400px] bg-white dark:bg-neutral-800 shadow-2xl transition-transform duration-500 transform ${isAuditOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xs font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-widest">Audit Trail</h3>
                <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mt-0.5">Immutability Log</p>
              </div>
              <button onClick={() => setIsAuditOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors">
                <svg className="w-5 h-5 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
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

            <button className="w-full py-3 text-[10px] font-black bg-[#082b4a] dark:bg-[#00adf0] text-white uppercase tracking-widest rounded-lg mt-4 shadow-lg hover:bg-[#061d33] dark:hover:bg-[#0099d6] transition-all">
              Download Full Security Log
            </button>
          </div>
        </div>
      </div>

      {/* Top Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">Shareholders</h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-0.5">
            {issuer ? `${issuer.name.toUpperCase()} • Issuer Information` : 'Issuer Information • Updated Today'}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          {/* Issuer Details Header */}
          <div className="bg-neutral-100 dark:bg-black p-6 rounded-xl shadow-md relative overflow-hidden group hover:shadow-lg transition-all duration-300 mb-4">
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
        
            <div className="absolute top-1/2 right-0 -translate-y-1/2 p-4 opacity-10 group-hover:opacity-15 group-hover:scale-105 transition-all duration-500">
              <svg 
                className="w-16 h-16" 
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
                  <h3 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tight mb-2">
                    {issuer.name.toUpperCase()}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-xs text-neutral-600 dark:text-neutral-400">
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

          {/* Dynamic Metric Cards Grid - Changes based on active tab */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {displayTab === 'shareholder' ? (
              <>
                {/* Shareholder Tab (Masterlist View) */}
                <MetricCard
                  title="Total Official Shareholders"
                  value={shareholderMetrics.totalOfficialShareholders.toLocaleString()}
                  trend={computeTrend(generateTrendSeries(shareholderMetrics.totalOfficialShareholders))}
                  chartData={generateTrendSeries(shareholderMetrics.totalOfficialShareholders)}
                  chartColor="#7C3AED"
                  subtitle={`${shareholderMetrics.displayedShareholdersCount} displayed in table`}
                />
                <MetricCard
                  title="Verified Accounts"
                  value={`${shareholderMetrics.verifiedCount.toLocaleString()} (${shareholderMetrics.verifiedPercentage}% Verified)`}
                  trend={computeTrend(generateTrendSeries(shareholderMetrics.verifiedCount))}
                  chartData={generateTrendSeries(shareholderMetrics.verifiedCount)}
                  chartColor="#10B981"
                  subtitle={`${shareholderMetrics.verifiedPercentage}% of total official`}
                />
                <MetricCard
                  title="Pending Claims"
                  value={shareholderMetrics.pendingClaimsCount.toLocaleString()}
                  trend={computeTrend(generateTrendSeries(shareholderMetrics.pendingClaimsCount))}
                  chartData={generateTrendSeries(shareholderMetrics.pendingClaimsCount)}
                  chartColor="#F59E0B"
                  subtitle="Pre-verified, not claimed"
                />
                <MetricCard
                  title="No Contact Records"
                  value={shareholderMetrics.noContactCount.toLocaleString()}
                  trend={computeTrend(generateTrendSeries(shareholderMetrics.noContactCount))}
                  chartData={generateTrendSeries(shareholderMetrics.noContactCount)}
                  chartColor="#EF4444"
                  subtitle="Null status investors"
                />
              </>
            ) : (
              <>
                {/* All Users Tab (Account View) */}
                <MetricCard
                  title="Total Registered Users"
                  value={allUsersMetrics.totalRegisteredUsers.toLocaleString()}
                  trend={computeTrend(generateTrendSeries(allUsersMetrics.totalRegisteredUsers))}
                  chartData={generateTrendSeries(allUsersMetrics.totalRegisteredUsers)}
                  chartColor="#7C3AED"
                  subtitle="All accounts in system"
                />
                <MetricCard
                  title="Verified Users"
                  value={allUsersMetrics.verifiedUsersCount.toLocaleString()}
                  trend={computeTrend(generateTrendSeries(allUsersMetrics.verifiedUsersCount))}
                  chartData={generateTrendSeries(allUsersMetrics.verifiedUsersCount)}
                  chartColor="#10B981"
                  subtitle="Fully verified accounts"
                />
                <MetricCard
                  title="Pre-Verified Users"
                  value={allUsersMetrics.preVerifiedUsersCount.toLocaleString()}
                  trend={computeTrend(generateTrendSeries(allUsersMetrics.preVerifiedUsersCount))}
                  chartData={generateTrendSeries(allUsersMetrics.preVerifiedUsersCount)}
                  chartColor="#F59E0B"
                  subtitle="Invited but not claimed"
                />
                <MetricCard
                  title="Unverified Users"
                  value={allUsersMetrics.unverifiedUsersCount.toLocaleString()}
                  trend={computeTrend(generateTrendSeries(allUsersMetrics.unverifiedUsersCount))}
                  chartData={generateTrendSeries(allUsersMetrics.unverifiedUsersCount)}
                  chartColor="#EF4444"
                  subtitle="Pending verification"
                />
              </>
            )}
          </div>

          {/* Tab Headers */}
          <div className="border-b border-neutral-200 dark:border-neutral-700 mb-3">
            <div className="flex">
              <button
                onClick={() => handleTabChange('shareholder')}
                className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === 'shareholder'
                    ? 'text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-100'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Shareholder
              </button>
               <button
                 onClick={() => handleTabChange('all-users')}
                 className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                   activeTab === 'all-users'
                     ? 'text-neutral-900 dark:text-neutral-100 border-b-2 border-neutral-900 dark:border-neutral-100'
                     : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                 }`}
               >
                 All Users
               </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-3">
            {/* Search Input with Filter Icon */}
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-full pl-10 pr-4 py-2 text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-transparent"
                />
              </div>
              
              {/* Filter Icon Button */}
              <div className="relative" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(v => !v)}
                  className={`h-[36px] w-[36px] inline-flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors ${
                    displayTab === 'shareholder' 
                      ? (sortOrder !== 'newest' ? 'bg-[#082b4a] dark:bg-[#00adf0] border-[#082b4a] dark:border-[#00adf0]' : '')
                      : (statusFilter && statusFilter !== 'all' ? 'bg-[#082b4a] dark:bg-[#00adf0] border-[#082b4a] dark:border-[#00adf0]' : '')
                  }`}
                  aria-label={displayTab === 'shareholder' ? 'Sort order' : 'Filter by status'}
                  aria-expanded={isFilterOpen}
                >
                  {/* Filter/Funnel icon */}
                  <svg className={`w-4 h-4 ${
                    displayTab === 'shareholder' 
                      ? (sortOrder !== 'newest' ? 'text-white' : 'text-neutral-600 dark:text-neutral-500')
                      : (statusFilter && statusFilter !== 'all' ? 'text-white' : 'text-neutral-600 dark:text-neutral-500')
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
                  </svg>
                </button>

                {isFilterOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-[9999] overflow-hidden">
                    {displayTab === 'shareholder' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSortOrder('newest');
                            setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                            setIsFilterOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
                            sortOrder === 'newest'
                              ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                          }`}
                        >
                          Newest to Oldest
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSortOrder('oldest');
                            setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                            setIsFilterOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
                            sortOrder === 'oldest'
                              ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                          }`}
                        >
                          Oldest to Newest
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter(null);
                            setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                            setIsFilterOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
                            !statusFilter || statusFilter === 'all'
                              ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                          }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('VERIFIED');
                            setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                            setIsFilterOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
                            statusFilter === 'VERIFIED'
                              ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                          }`}
                        >
                          Verified
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('null');
                            setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                            setIsFilterOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
                            statusFilter === 'null'
                              ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                          }`}
                        >
                          Unverified
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('PRE-VERIFIED');
                            setCurrentPage(prev => ({ ...prev, [displayTab]: 1 }));
                            setIsFilterOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
                            statusFilter === 'PRE-VERIFIED'
                              ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                          }`}
                        >
                          Pre-Verified
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
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
                       <table className="w-full text-left border-collapse">
                         <thead>
                           <tr className="bg-neutral-50 dark:bg-neutral-900/50 text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200 dark:border-neutral-700">
                             <th className="px-3 py-2.5">NO.</th>
                             <th className="px-3 py-2.5">NAME</th>
                             <th className="px-3 py-2.5">EMAIL</th>
                             <th className="px-3 py-2.5">REGISTRATION DATE</th>
                             <th className="px-3 py-2.5">STATUS</th>
                             <th className="px-3 py-2.5">LAST UPDATED</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                           {getPaginatedData(filterData(verifiedShareholders.filter((item): item is Applicant => 'fullName' in item)), 'shareholder').map((applicant, index) => {
                             // Get status from official shareholder record (primary source of truth)
                             const officialShareholder = officialShareholders.find(sh => 
                               sh.applicantId === applicant.id || 
                               sh.id === applicant.registrationId ||
                               (sh.email && applicant.email && sh.email.toLowerCase() === applicant.email.toLowerCase())
                             );
                             
                             // Use official shareholder status if available, otherwise derive from applicant
                             let accountStatus: 'VERIFIED' | 'PRE-VERIFIED' | null = null;
                             
                             if (officialShareholder) {
                               accountStatus = officialShareholder.status === 'VERIFIED' ? 'VERIFIED' :
                                              officialShareholder.status === 'PRE-VERIFIED' ? 'PRE-VERIFIED' : null;
                             } else {
                               // Fallback to applicant status if no official shareholder record found
                               if (applicant.status === RegistrationStatus.APPROVED || 
                                   applicant.accountStatus === 'VERIFIED' ||
                                   applicant.shareholdingsVerification?.step6?.verifiedAt !== undefined) {
                                 accountStatus = 'VERIFIED';
                               } else if (applicant.isPreVerified === true) {
                                 accountStatus = 'PRE-VERIFIED';
                               }
                             }
                             
                             const statusLabel = accountStatus === 'VERIFIED' ? 'VERIFIED' : 
                                                accountStatus === 'PRE-VERIFIED' ? 'PRE-VERIFIED' : '–';
                             const statusBadgeColor = accountStatus === 'VERIFIED' 
                               ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                               : accountStatus === 'PRE-VERIFIED'
                               ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                               : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300';
                             
                             const registrationDate = applicant.submissionDate || applicant.shareholdingsVerification?.step2?.submittedAt;
                             // lastUpdated = the same priority-resolved date used for sorting
                             // (accountClaimedAt > latest holdings update > emailSentAt > createdAt)
                             const lastUpdated = (applicant as Applicant & { _sortDate?: string })._sortDate
                               || applicant.accountClaimedAt
                               || applicant.submissionDate;
                             
                             // Calculate row number (accounting for pagination)
                             const rowNumber = (currentPage.shareholder - 1) * itemsPerPage + index + 1;

                             return (
                               <tr 
                                 key={applicant.id} 
                                 onClick={() => setSelectedUser(applicant)}
                                 className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-all cursor-pointer"
                               >
                                 <td className="px-3 py-2.5">
                                   <span className="text-xs font-mono font-bold text-neutral-500 dark:text-neutral-400">
                                     {rowNumber}
                                   </span>
                                 </td>
                                 <td className="px-3 py-2.5">
                                   <Tooltip content={applicant.fullName}>
                                     <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[180px]">{applicant.fullName}</p>
                                   </Tooltip>
                                 </td>
                                 <td className="px-3 py-2.5">
                                   <Tooltip content={applicant.email || 'No email'}>
                                     <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate block max-w-[200px]">{applicant.email || '—'}</span>
                                   </Tooltip>
                                 </td>
                                 <td className="px-3 py-2.5">
                                   <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                     {registrationDate ? new Date(registrationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                   </span>
                                 </td>
                                 <td className="px-3 py-2.5">
                                   <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium rounded-full uppercase tracking-wider ${statusBadgeColor}`}>
                                     {accountStatus === 'VERIFIED' && (
                                       <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                         <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                                         <path d="m9 12 2 2 4-4"/>
                                       </svg>
                                     )}
                                     {accountStatus === 'PRE-VERIFIED' && (
                                       <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                         <circle cx="12" cy="12" r="10"/>
                                         <path d="M12 6v6l4 2"/>
                                       </svg>
                                     )}
                                     {statusLabel}
                                   </span>
                                 </td>
                                 <td className="px-3 py-2.5">
                                   <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
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
                          <div className="mt-3 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700 pt-3">
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              Showing {((currentPage.shareholder - 1) * itemsPerPage) + 1}–{Math.min(currentPage.shareholder * itemsPerPage, filteredData.length)} of {filteredData.length}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handlePageChange('shareholder', currentPage.shareholder - 1)}
                                disabled={currentPage.shareholder === 1}
                                className="px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Prev
                              </button>
                              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
                                {currentPage.shareholder} / {getTotalPages(filteredData.length)}
                              </span>
                              <button
                                onClick={() => handlePageChange('shareholder', currentPage.shareholder + 1)}
                                disabled={currentPage.shareholder >= getTotalPages(filteredData.length)}
                                className="px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-2 italic">
                        Tracks all frontend-registered accounts. Includes pre-verified accounts ready for claiming/activation.
                      </p>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-900/50 text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200 dark:border-neutral-700">
                            <th className="px-3 py-2.5">NO.</th>
                            <th className="px-3 py-2.5">NAME</th>
                            <th className="px-3 py-2.5">EMAIL</th>
                            <th className="px-3 py-2.5">REGISTRATION DATE</th>
                            <th className="px-3 py-2.5">STATUS</th>
                            <th className="px-3 py-2.5">LAST ACTIVE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                          {getPaginatedData(filterData(allUsers), 'all-users').map((user, index) => {
                            // Compute status using status mapping utility
                            const userStatus = computeShareholderStatus(user, null);
                            const statusLabel = getStatusLabel(userStatus);
                            const statusBadgeColor = getStatusBadgeColor(userStatus);
                            
                            const registrationDate = user.submissionDate;
                            const lastActive = user.lastActive || user.accountClaimedAt || user.submissionDate;
                            
                            // Calculate row number (accounting for pagination)
                            const rowNumber = (currentPage['all-users'] - 1) * itemsPerPage + index + 1;

                            return (
                              <tr 
                                key={user.id} 
                                onClick={() => setSelectedUser(user)}
                                className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-all cursor-pointer"
                              >
                                <td className="px-3 py-2.5">
                                  <span className="text-xs font-mono font-bold text-neutral-500 dark:text-neutral-400">
                                    {rowNumber}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <Tooltip content={user.fullName}>
                                    <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[180px]">{user.fullName}</p>
                                  </Tooltip>
                                </td>
                                <td className="px-3 py-2.5">
                                  <Tooltip content={user.email || 'No email'}>
                                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate block max-w-[200px]">{user.email || '—'}</span>
                                  </Tooltip>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                    {registrationDate ? new Date(registrationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <Tooltip content={userStatus === null ? "Unverified account" : undefined}>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium rounded-full uppercase tracking-wider ${statusBadgeColor}`}>
                                      {userStatus === 'VERIFIED' && (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                                          <path d="m9 12 2 2 4-4"/>
                                        </svg>
                                      )}
                                      {userStatus === 'PRE-VERIFIED' && (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                          <circle cx="12" cy="12" r="10"/>
                                          <path d="M12 6v6l4 2"/>
                                        </svg>
                                      )}
                                      {statusLabel}
                                    </span>
                                  </Tooltip>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                    {lastActive ? new Date(lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
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
                          <div className="mt-3 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700 pt-3">
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              Showing {((currentPage['all-users'] - 1) * itemsPerPage) + 1}–{Math.min(currentPage['all-users'] * itemsPerPage, filteredData.length)} of {filteredData.length}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handlePageChange('all-users', currentPage['all-users'] - 1)}
                                disabled={currentPage['all-users'] === 1}
                                className="px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Prev
                              </button>
                              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
                                {currentPage['all-users']} / {getTotalPages(filteredData.length)}
                              </span>
                              <button
                                onClick={() => handlePageChange('all-users', currentPage['all-users'] + 1)}
                                disabled={currentPage['all-users'] >= getTotalPages(filteredData.length)}
                                className="px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
