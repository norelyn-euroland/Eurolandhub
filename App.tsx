import React, { useEffect, useLayoutEffect, useMemo, useState, startTransition, useCallback, useRef } from 'react';
// @google/genai guidelines: Import ViewType from shared types
import { RegistrationStatus, Applicant, ViewType, RegistrationsTabType, BreadcrumbItem, Theme } from './lib/types';
import { ensureWorkflow, recordManualReview, recordRequestInfo } from './lib/shareholdingsVerification';
import { useApplicants } from './hooks/useApplicants';
import { applicantService } from './lib/firestore-service';
import { useAuth } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './components/DashboardHome';
import ApplicantDetail from './components/ApplicantDetail';
import ShareholdersRegistry from './components/ShareholdersRegistry';
import OverviewDashboard from './components/OverviewDashboard';
import LoginPage from './components/LoginPage';
import EngagementPage from './components/EngagementPage';
import InvestorsPage from './components/InvestorsPage';
import InvestorActivityPage from './components/InvestorActivityPage';
import EventsPage from './components/EventsPage';
import MeetingsPage from './components/MeetingsPage';
import EngagementAnalyticsPage from './components/EngagementAnalyticsPage';
import DocumentsPage from './components/DocumentsPage';
import ThemeToggle from './components/ThemeToggle';
import Toast from './components/Toast';

const FADE_DURATION_MS = 300;

interface AuthedAppProps {
  theme: Theme;
  toggleTheme: () => void;
}

const AuthedApp: React.FC<AuthedAppProps> = ({ theme, toggleTheme }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState<'success' | 'warning' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState(false);
  
  // Restore view from localStorage on mount
  // Note: We don't restore 'detail' view as it requires applicant data
  const getInitialView = (): ViewType => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eurolandhub_view');
      if (saved && ['dashboard', 'registrations', 'shareholders', 'investors', 'engagement', 'engagement-activity', 'engagement-events', 'engagement-meetings', 'engagement-analytics', 'documents'].includes(saved)) {
        return saved as ViewType;
      }
    }
    return 'dashboard';
  };

  const [view, setView] = useState<ViewType>(getInitialView);
  
  // Restore selected applicant from localStorage on mount
  const getInitialSelectedApplicantId = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('eurolandhub_selected_applicant_id');
    }
    return null;
  };
  
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(getInitialSelectedApplicantId);
  const { applicants, loading: applicantsLoading } = useApplicants({ realTime: true });
  
  // Find selected applicant from applicants list
  const selectedApplicant = selectedApplicantId 
    ? applicants.find(a => a.id === selectedApplicantId) || null
    : null;
  
  // Track if we've restored the detail view on initial mount
  const hasRestoredDetailView = useRef(false);
  const isInitialMount = useRef(true);
  
  // Only restore detail view on initial mount if we have a saved applicant ID
  useEffect(() => {
    // Only run once on initial mount when applicants are loaded
    if (!isInitialMount.current || applicantsLoading) return;
    
    // Get the saved applicant ID directly from localStorage to avoid dependency issues
    const savedApplicantId = typeof window !== 'undefined' 
      ? localStorage.getItem('eurolandhub_selected_applicant_id')
      : null;
    
    if (savedApplicantId) {
      const foundApplicant = applicants.find(a => a.id === savedApplicantId);
      if (foundApplicant) {
        // Restore detail view only on initial mount
        setView('detail');
        hasRestoredDetailView.current = true;
        isInitialMount.current = false;
      } else {
        // Applicant not found, clear the saved ID
        setSelectedApplicantId(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('eurolandhub_selected_applicant_id');
        }
        hasRestoredDetailView.current = true;
        isInitialMount.current = false;
      }
    } else {
      hasRestoredDetailView.current = true;
      isInitialMount.current = false;
    }
  }, [applicantsLoading, applicants]); // Only depend on loading state and applicants array
  
  // Clear selected applicant ID when explicitly navigating away from detail view
  // But only if we've already restored (to avoid clearing during initial restore)
  useEffect(() => {
    if (!hasRestoredDetailView.current) return; // Don't clear during initial restore
    
    if (view !== 'detail' && selectedApplicantId) {
      // User navigated away from detail view, clear the saved ID
      // This is safe because breadcrumb handlers also clear it, but this is a backup
      setSelectedApplicantId(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('eurolandhub_selected_applicant_id');
      }
    }
  }, [view]); // Only depend on view, not selectedApplicantId to avoid loops
  const [searchQuery, setSearchQuery] = useState('');
  const [registrationsTabRequest, setRegistrationsTabRequest] = useState<{ tab: RegistrationsTabType; requestId: number } | null>(null);
  
  // Navigation state tracking - Default to 'ALL' if no saved state exists
  const getInitialTab = (): RegistrationsTabType => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eurolandhub_registrations_tab');
      if (saved && ['ALL', 'PENDING', 'VERIFIED', 'NON_VERIFIED', 'PRE_VERIFIED'].includes(saved)) {
        return saved as RegistrationsTabType;
      }
    }
    // Default to 'ALL' when first visiting (no saved state)
    return 'ALL';
  };

  const [activeRegistrationsTab, setActiveRegistrationsTab] = useState<RegistrationsTabType>(getInitialTab);
  const [registrationsSearchQuery, setRegistrationsSearchQuery] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('eurolandhub_registrations_search') || '';
    }
    return '';
  });
  const [preservedFilterState, setPreservedFilterState] = useState<{ tab: RegistrationsTabType; searchQuery: string } | null>(null);

  // Persist view changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eurolandhub_view', view);
    }
  }, [view]);

  // Persist registrations tab changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eurolandhub_registrations_tab', activeRegistrationsTab);
    }
  }, [activeRegistrationsTab]);

  // Persist registrations search query
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eurolandhub_registrations_search', registrationsSearchQuery);
    }
  }, [registrationsSearchQuery]);

  const filteredApplicants = applicants.filter(a => 
    a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectApplicant = (applicant: Applicant) => {
    // Preserve current filter state before navigating to detail
    if (view === 'registrations') {
      setPreservedFilterState({
        tab: activeRegistrationsTab,
        searchQuery: registrationsSearchQuery
      });
    }
    setSelectedApplicantId(applicant.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eurolandhub_selected_applicant_id', applicant.id);
    }
    setView('detail');
  };

  const handleUpdateStatus = async (id: string, status: RegistrationStatus) => {
    console.log('handleUpdateStatus called:', { id, status });
    const applicant = applicants.find(a => a.id === id);
    if (!applicant) {
      console.error('Applicant not found:', id);
      setToastMessage(`Error: Applicant not found`);
      setToastVariant('error');
      setShowToast(true);
      return;
    }

    // Always carry the workflow state, even if the record didn't have it yet.
    const base = ensureWorkflow(applicant);

    let updatedApplicant: Applicant;
    let shouldSendVerifiedEmail = false;
    let shouldSendRejectedEmail = false;
    let shouldSendRequestInfoEmail = false;

    // Check if user wants verification - only send emails if they want verification
    const wantsVerification = base.shareholdingsVerification?.step1.wantsVerification !== false;

    // Wire existing admin actions to Step 5 (Manual IRO Verification)
    if (status === RegistrationStatus.APPROVED) {
      // Step 5: Manual IRO match -> APPROVED
      updatedApplicant = recordManualReview(base, true);
      // Check if this is a new verification (Step 6: Verified Account)
      // Only send email if status changed from non-APPROVED to APPROVED and user wants verification
      if (wantsVerification && applicant.status !== RegistrationStatus.APPROVED && updatedApplicant.shareholdingsVerification?.step6?.verifiedAt) {
        shouldSendVerifiedEmail = true;
      }
    } else if (status === RegistrationStatus.REJECTED) {
      // Step 5: Manual IRO no-match -> PENDING (for resubmission)
      updatedApplicant = recordManualReview(base, false);
      // Only send email if user wants verification
      if (wantsVerification) {
        shouldSendRejectedEmail = true;
      }
    } else if (status === RegistrationStatus.FURTHER_INFO) {
      // Step 5: IRO requests more information -> FURTHER_INFO (PENDING in frontend)
      updatedApplicant = recordRequestInfo(base);
      // Only send email if user wants verification
      if (wantsVerification) {
        shouldSendRequestInfoEmail = true;
      }
    } else {
      // For any other status, just update the status
      updatedApplicant = { ...base, status };
    }

    // Update in Firestore (real-time listener will update the UI automatically)
    try {
      console.log('Updating applicant status:', { 
        id, 
        status, 
        applicantName: applicant.fullName, 
        wantsVerification,
        previousStatus: applicant.status,
        newStatus: updatedApplicant.status,
        hasStep6: !!updatedApplicant.shareholdingsVerification?.step6?.verifiedAt,
        step6VerifiedAt: updatedApplicant.shareholdingsVerification?.step6?.verifiedAt,
        step4LastResult: updatedApplicant.shareholdingsVerification?.step4?.lastResult
      });
      await applicantService.update(id, updatedApplicant);
      console.log('Applicant status updated successfully in Firestore:', { 
        id, 
        newStatus: updatedApplicant.status,
        step6VerifiedAt: updatedApplicant.shareholdingsVerification?.step6?.verifiedAt,
        fullShareholdingsVerification: updatedApplicant.shareholdingsVerification
      });

      // Sync verified applicants to official shareholders collection
      // When a frontend-registered applicant gets verified, they should be transferred to official shareholders
      if (updatedApplicant.status === RegistrationStatus.APPROVED) {
        try {
          const { syncVerifiedApplicantToOfficialShareholders } = await import('./lib/official-shareholder-sync.js');
          await syncVerifiedApplicantToOfficialShareholders(updatedApplicant);
        } catch (syncError) {
          console.error('Error syncing verified applicant to official shareholders:', syncError);
          // Don't fail the request if sync fails
        }
      }

      // Always show a status update toast (email sending is secondary and may fail independently).
      if (status === RegistrationStatus.APPROVED) {
        setToastMessage('Applicant status updated: Approved');
        setToastVariant('success');
        setShowToast(true);
      } else if (status === RegistrationStatus.REJECTED) {
        setToastMessage('Applicant status updated: Rejected');
        setToastVariant('warning');
        setShowToast(true);
      } else if (status === RegistrationStatus.FURTHER_INFO) {
        setToastMessage('Applicant status updated: Request Info');
        setToastVariant('info');
        setShowToast(true);
      }
      
      // Helper function to send email and show toast
      const sendEmailNotification = async (endpoint: string, emailType: string, toastMessage: string, toastVariant: 'success' | 'warning' | 'error' | 'info' = 'success') => {
        // Validate email exists and is not empty
        const email = updatedApplicant.email?.trim();
        if (!email || email === '') {
          console.warn(`Cannot send ${emailType} email: No email address for applicant ${updatedApplicant.fullName}`);
          setToastMessage(`Cannot send email: No email address on file for ${updatedApplicant.fullName}`);
          setToastVariant('warning');
          setShowToast(true);
          return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          console.warn(`Cannot send ${emailType} email: Invalid email format for applicant ${updatedApplicant.fullName}`);
          setToastMessage(`Cannot send email: Invalid email address format for ${updatedApplicant.fullName}`);
          setToastVariant('warning');
          setShowToast(true);
          return;
        }
        
        try {
          // Extract first name from fullName
          const nameParts = updatedApplicant.fullName.trim().split(/\s+/);
          const firstName = nameParts[0] || updatedApplicant.fullName;

          // Support both:
          // - Relative `/api/...` (Vercel + Vite dev proxy)
          // - Absolute base via `VITE_API_BASE_URL` (useful for local preview/static hosting)
          const apiBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
          const buildUrl = (path: string) => {
            if (!apiBase) return path;
            const base = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
            if (path.startsWith('/')) return `${base}${path}`;
            return `${base}/${path}`;
          };

          const primaryUrl = buildUrl(endpoint);
          console.log(`Sending ${emailType} email to:`, email, 'via endpoint:', primaryUrl);

          const doFetch = async (url: string): Promise<Response> => {
            try {
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  toEmail: email,
                  firstName,
                }),
              });
              return response;
            } catch (fetchError) {
              // Handle network errors (CORS, connection refused, etc.)
              console.error('Fetch error:', fetchError);
              // Create a fake response object to handle network errors
              const errorMessage = fetchError instanceof Error ? fetchError.message : 'Network error';
              return {
                ok: false,
                status: 0,
                statusText: errorMessage,
                json: async () => ({ 
                  error: 'Network error', 
                  message: errorMessage,
                  details: 'Failed to connect to server. Please ensure the API server is running on port 3001.'
                }),
              } as Response;
            }
          };

          let response = await doFetch(primaryUrl);

          // If we're on localhost and `/api/*` returns 404 or network error, 
          // check if server is running and provide helpful error
          if (
            (response.status === 404 || response.status === 0) &&
            !apiBase &&
            typeof window !== 'undefined' &&
            endpoint.startsWith('/api/') &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ) {
            // Check if it's a network error (CORS, connection refused)
            if (response.status === 0) {
              console.error('Network error - API server may not be running on port 3001');
              setToastMessage('Status updated, but email failed: API server is not running. Please start the server with "npm run dev" or "tsx server.js"');
              setToastVariant('error');
              setShowToast(true);
              return; // Exit early - don't try fallback if it's a network error
            }
            
            // Only try fallback if it's a 404 (endpoint not found)
            const fallbackUrl = `http://localhost:3001${endpoint}`;
            console.warn('Email API returned 404, retrying via fallback URL:', fallbackUrl);
            response = await doFetch(fallbackUrl);
            
            // If fallback also fails with network error, show helpful message
            if (response.status === 0) {
              console.error('Fallback also failed - CORS or server not running');
              setToastMessage('Status updated, but email failed: Cannot connect to API server. Please ensure the server is running on port 3001 with "npm run dev" or "tsx server.js"');
              setToastVariant('error');
              setShowToast(true);
              return;
            }
          }

          console.log(`Email API response status:`, response.status, response.statusText);
          if (response.ok) {
            const responseData = await response.json().catch(() => ({}));
            console.log(`Sent ${emailType} email to:`, email);
            
            // Update IRO decision with email sent timestamp
            if (updatedApplicant.shareholdingsVerification?.step4?.iroDecision) {
              const emailSentAt = new Date().toISOString();
              const updatedIRODecision = {
                ...updatedApplicant.shareholdingsVerification.step4.iroDecision,
                emailSentAt,
              };
              
              const updatedStep4 = {
                ...updatedApplicant.shareholdingsVerification.step4,
                iroDecision: updatedIRODecision,
              };
              
              const updatedShareholdingsVerification = {
                ...updatedApplicant.shareholdingsVerification,
                step4: updatedStep4,
              };
              
              const finalUpdated = {
                ...updatedApplicant,
                shareholdingsVerification: updatedShareholdingsVerification,
              };
              
              // Update the applicant record with email sent timestamp
              try {
                await applicantService.update(updatedApplicant.id, finalUpdated);
                console.log('Updated IRO decision with email sent timestamp');
              } catch (updateError) {
                console.error('Failed to update email sent timestamp:', updateError);
                // Don't fail the whole operation if this update fails
              }
            }
            
            // Show success toast
            setToastMessage(toastMessage);
            setToastVariant(toastVariant);
            setShowToast(true);
          } else {
            // Try to parse error response
            let errorMessage = 'Unknown error';
            try {
              const errorData = await response.json();
              // Try multiple fields that might contain the error message
              errorMessage = errorData.message || errorData.details || errorData.error || errorData.detail || `HTTP ${response.status}: ${response.statusText}`;
            } catch (parseError) {
              // If JSON parsing fails, use status text
              errorMessage = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`;
            }
            
            console.error(`Failed to send ${emailType} email to ${email}:`, errorMessage);
            // Show error toast with specific error message
            // Shorten message if it's too long
            const displayMessage = errorMessage.length > 80 
              ? `${errorMessage.substring(0, 77)}...` 
              : errorMessage;
            setToastMessage(`Status updated, but failed to send email: ${displayMessage}`);
            setToastVariant('error');
            setShowToast(true);
          }
        } catch (emailError) {
          console.error(`Error sending ${emailType} email to ${email}:`, emailError);
          // Show error toast with more specific error message
          const errorMsg = emailError instanceof Error 
            ? emailError.message 
            : typeof emailError === 'string' 
              ? emailError 
              : 'Network error or server unavailable';
          setToastMessage(`Status updated, but email failed: ${errorMsg}`);
          setToastVariant('error');
          setShowToast(true);
        }
      };

      // Step 6: Send account verified email automatically when IRO approves (Investors - Holdings Verification Workflow)
      if (shouldSendVerifiedEmail) {
        await sendEmailNotification(
          '/api/send-account-verified', 
          'Step 6 verified account',
          'Applicant approved and verification email sent successfully!',
          'success'
        );
      } else if (status === RegistrationStatus.APPROVED) {
        // Status updated but no email sent (e.g., user skipped verification)
        setToastMessage('Applicant approved successfully!');
        setToastVariant('success');
        setShowToast(true);
      }

      // Send rejected email when IRO rejects
      if (shouldSendRejectedEmail) {
        await sendEmailNotification(
          '/api/send-account-rejected', 
          'account rejected',
          'Applicant rejected and notification email sent successfully!',
          'warning'
        );
      } else if (status === RegistrationStatus.REJECTED) {
        // Status updated but no email sent
        setToastMessage('Applicant rejected successfully!');
        setToastVariant('warning');
        setShowToast(true);
      }

      // Send request info email when IRO requests more information
      if (shouldSendRequestInfoEmail) {
        await sendEmailNotification(
          '/api/send-request-info', 
          'request info',
          'Request info sent and email notification delivered successfully!',
          'info'
        );
      } else if (status === RegistrationStatus.FURTHER_INFO) {
        // Status updated but no email sent
        setToastMessage('Request info action completed successfully!');
        setToastVariant('info');
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error updating applicant status:', error);
      // Show error toast
      const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
      setToastMessage(`Failed to update applicant status: ${errorMessage}`);
      setToastVariant('error');
      setShowToast(true);
      // Don't navigate away on error - let user see the error and try again
      return;
    }

    // Only navigate away if update was successful
    setView('registrations');
    setSelectedApplicantId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eurolandhub_selected_applicant_id');
    }
  };

  const pendingApplicants = applicants.filter(a => a.status === RegistrationStatus.PENDING);

  const handleNotificationAction = (
    action: { type: 'open_shareholders' } | { type: 'review_applicant'; applicantId: string }
  ) => {
    // Clear any drill-down state when navigating via notifications
    setSelectedApplicant(null);
    setSearchQuery('');

    if (action.type === 'open_shareholders') {
      setView('shareholders');
      return;
    }

    // review_applicant
    const applicant = applicants.find(a => a.id === action.applicantId);
    if (applicant) {
      setSelectedApplicantId(applicant.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('eurolandhub_selected_applicant_id', applicant.id);
      }
      setView('detail');
    } else {
      // Fallback: open the unverified queue if the applicant is not found
      setView('registrations');
      setRegistrationsTabRequest({ tab: 'PENDING', requestId: Date.now() });
    }
  };

  const getViewTitle = () => {
    switch(view) {
      case 'dashboard': return 'EurolandHUB Dashboard';
      case 'registrations': return 'Investor Registrations';
      case 'detail': return 'Verification Review';
      case 'shareholders': return 'Shareholders';
      case 'investors': return 'Investors';
      case 'engagement': return 'Engagement';
      case 'engagement-activity': return 'Investor Activity';
      case 'engagement-events': return 'Events';
      case 'engagement-meetings': return 'Meetings';
      case 'engagement-analytics': return 'Engagement Analytics';
      case 'documents': return 'Documents';
      default: return 'Dashboard';
    }
  };

  // Tab label mapping for breadcrumb display
  const getTabLabel = (tab: RegistrationsTabType): string => {
    const labels: Record<RegistrationsTabType, string> = {
      'ALL': 'All',
      'PENDING': 'Unverified',
      'VERIFIED': 'Verified',
      'NON_VERIFIED': 'Pending',
      'PRE_VERIFIED': 'Pre-verified'
    };
    return labels[tab];
  };

  // Generate breadcrumb items based on current view and state
  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [];

    switch (view) {
      case 'dashboard':
        // For dashboard, show "EurolandHUB Dashboard" (current page, not clickable)
        items.push({
          label: 'EurolandHUB Dashboard',
          view: 'dashboard'
        });
        break;

      case 'registrations':
        // Always start with Dashboard
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        items.push({
          label: 'Investors',
          view: 'investors'
        });
        
        items.push({
          label: 'Registrations',
          view: 'registrations',
          onClick: () => {
            // Reset to ALL filter (default view) — only if needed
            if (activeRegistrationsTab !== 'ALL' || registrationsSearchQuery !== '') {
              setActiveRegistrationsTab('ALL');
              setRegistrationsSearchQuery('');
              setRegistrationsTabRequest({ tab: 'ALL', requestId: Date.now() });
            }
          },
          filter: {
            tab: activeRegistrationsTab,
            searchQuery: registrationsSearchQuery
          }
        });
        
        // Add filter label if not "All"
        if (activeRegistrationsTab !== 'ALL') {
          items.push({
            label: getTabLabel(activeRegistrationsTab),
            view: 'registrations',
            onClick: () => {
              setView('registrations');
              setRegistrationsTabRequest({ tab: activeRegistrationsTab, requestId: Date.now() });
            },
            filter: {
              tab: activeRegistrationsTab,
              searchQuery: registrationsSearchQuery
            }
          });
        }
        break;

      case 'detail':
        // Always start with Dashboard
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        items.push({
          label: 'Investors',
          view: 'investors'
        });
        
        // Add Registrations breadcrumb — clicking goes back to ALL (default) view
        items.push({
          label: 'Registrations',
          view: 'registrations',
          onClick: () => {
            // Clear selected applicant + navigate to registrations (default ALL)
            setSelectedApplicantId(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('eurolandhub_selected_applicant_id');
            }
            setActiveRegistrationsTab('ALL');
            setRegistrationsSearchQuery('');
            setPreservedFilterState(null);
            setView('registrations');
          },
          filter: preservedFilterState ? {
            tab: preservedFilterState.tab,
            searchQuery: preservedFilterState.searchQuery
          } : undefined
        });

        // Add filter label if preserved state exists and not "All"
        if (preservedFilterState && preservedFilterState.tab !== 'ALL') {
          items.push({
            label: getTabLabel(preservedFilterState.tab),
            view: 'registrations',
            onClick: () => {
              // Navigate back to registrations with the preserved filter
              setSelectedApplicantId(null);
              if (typeof window !== 'undefined') {
                localStorage.removeItem('eurolandhub_selected_applicant_id');
              }
              setActiveRegistrationsTab(preservedFilterState.tab);
              setRegistrationsSearchQuery(preservedFilterState.searchQuery);
              setPreservedFilterState(null);
              setView('registrations');
            },
            filter: {
              tab: preservedFilterState.tab,
              searchQuery: preservedFilterState.searchQuery
            }
          });
        }

        // Add Account Detail
        items.push({
          label: 'Account Detail',
          view: 'detail'
        });
        break;

      case 'shareholders':
        // Always start with Dashboard
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        items.push({
          label: 'Investors',
          view: 'investors'
        });
        items.push({
          label: 'Shareholders',
          view: 'shareholders',
          onClick: () => setView('shareholders')
        });
        break;

      case 'investors':
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        items.push({
          label: 'Investors',
          view: 'investors'
        });
        break;

      case 'engagement':
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        items.push({
          label: 'Engagement',
          view: 'engagement'
        });
        break;

      case 'engagement-activity':
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        items.push({
          label: 'Engagement',
          view: 'engagement'
        });
        items.push({
          label: 'Investor Activity',
          view: 'engagement-activity',
          onClick: () => setView('engagement-activity')
        });
        break;

      case 'engagement-events':
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        items.push({
          label: 'Engagement',
          view: 'engagement'
        });
        items.push({
          label: 'Events',
          view: 'engagement-events',
          onClick: () => setView('engagement-events')
        });
        break;

      case 'engagement-meetings':
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        items.push({
          label: 'Engagement',
          view: 'engagement'
        });
        items.push({
          label: 'Meetings',
          view: 'engagement-meetings',
          onClick: () => setView('engagement-meetings')
        });
        break;

      case 'engagement-analytics':
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        items.push({
          label: 'Engagement',
          view: 'engagement'
        });
        items.push({
          label: 'Analytics',
          view: 'engagement-analytics',
          onClick: () => setView('engagement-analytics')
        });
        break;

      case 'documents':
        // Always start with Dashboard
        items.push({
          label: 'Dashboard',
          view: 'dashboard',
          onClick: () => setView('dashboard')
        });
        
        items.push({
          label: 'Documents',
          view: 'documents',
          onClick: () => setView('documents')
        });
        break;
    }

    return items;
  }, [view, activeRegistrationsTab, registrationsSearchQuery, preservedFilterState]);

  // Handle tab changes from DashboardHome (stable reference to prevent loops)
  const handleTabChange = useCallback((tab: RegistrationsTabType) => {
    setActiveRegistrationsTab(tab);
  }, []);

  // Handle search query changes from DashboardHome (stable reference to prevent loops)
  const handleSearchChange = useCallback((query: string) => {
    setRegistrationsSearchQuery(query);
  }, []);

  // Handle back navigation from detail view
  const handleBackFromDetail = () => {
    setView('registrations');
    setSelectedApplicantId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eurolandhub_selected_applicant_id');
    }
    
    // Restore preserved filter state
    if (preservedFilterState) {
      setRegistrationsTabRequest({ 
        tab: preservedFilterState.tab, 
        requestId: Date.now() 
      });
      setActiveRegistrationsTab(preservedFilterState.tab);
      setRegistrationsSearchQuery(preservedFilterState.searchQuery);
      setPreservedFilterState(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 overflow-hidden">
      <Sidebar 
        currentView={view} 
        onViewChange={(v) => setView(v)}
        theme={theme}
        toggleTheme={toggleTheme}
        isCollapsed={isSidebarCollapsed}
        onCollapseChange={setIsSidebarCollapsed}
      />
      
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <Header 
          viewTitle={getViewTitle()}
          pendingApplicants={pendingApplicants}
          onNotificationAction={handleNotificationAction}
          breadcrumbItems={breadcrumbItems}
        />
        
        <main className="flex-1 overflow-y-auto p-6 bg-white dark:bg-neutral-900">
          {view === 'dashboard' && (
            <OverviewDashboard applicants={applicants} onViewChange={setView} />
          )}
          {view === 'registrations' && (
            <DashboardHome 
              applicants={filteredApplicants} 
              onSelect={handleSelectApplicant} 
              tabRequest={registrationsTabRequest ?? undefined}
              onTabChange={handleTabChange}
              onSearchChange={handleSearchChange}
              initialTab={activeRegistrationsTab}
              initialSearchQuery={registrationsSearchQuery}
              sidebarCollapsed={isSidebarCollapsed}
            />
          )}
          {view === 'detail' && selectedApplicant && (
            <ApplicantDetail 
              applicant={selectedApplicant} 
              onBack={handleBackFromDetail}
              onUpdateStatus={handleUpdateStatus}
            />
          )}
          {view === 'shareholders' && (
            <ShareholdersRegistry
              searchQuery={searchQuery}
              applicants={applicants}
              applicantsLoading={applicantsLoading}
            />
          )}
          {view === 'investors' && (
            <InvestorsPage applicants={applicants} applicantsLoading={applicantsLoading} />
          )}
          {view === 'engagement' && (
            <EngagementPage applicants={applicants} applicantsLoading={applicantsLoading} />
          )}
          {view === 'engagement-activity' && (
            <InvestorActivityPage applicants={applicants} applicantsLoading={applicantsLoading} />
          )}
          {view === 'engagement-events' && (
            <EventsPage applicants={applicants} applicantsLoading={applicantsLoading} />
          )}
          {view === 'engagement-meetings' && (
            <MeetingsPage applicants={applicants} applicantsLoading={applicantsLoading} />
          )}
          {view === 'engagement-analytics' && (
            <EngagementAnalyticsPage applicants={applicants} applicantsLoading={applicantsLoading} />
          )}
          {view === 'documents' && (
            <DocumentsPage />
          )}
        </main>
      </div>
      
      {/* Floating Theme Toggle */}
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} isDraggable={true} />
      
      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        variant={toastVariant}
        duration={5000}
      />
    </div>
  );
};

const App: React.FC = () => {
  // Check authentication first
  const { loading: authLoading, isAuthenticated } = useAuth();

  // Theme state management - initialize with default or stored value
  const getInitialTheme = (): Theme => {
    if (typeof window === "undefined") return Theme.DARK;
    const stored = window.localStorage.getItem("eurolandhub_theme");
    if (stored === Theme.LIGHT || stored === Theme.DARK) {
      return stored;
    }
    return Theme.DARK; // Default to dark mode
  };

  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Apply theme to document root and save to localStorage (single source of truth)
  // Use layout effect so Tailwind `dark:` variants flip reliably on click without timing issues.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;
    const isDark = theme === Theme.DARK;
    root.classList.toggle("dark", isDark);
    window.localStorage.setItem("eurolandhub_theme", theme);
  }, [theme]);

  // Toggle theme function
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      return prev === Theme.LIGHT ? Theme.DARK : Theme.LIGHT;
    });
  }, []);

  // Crossfade login -> app so the dashboard doesn't appear "suddenly"
  const [loginMounted, setLoginMounted] = useState(false);
  const [loginVisible, setLoginVisible] = useState(false);
  const [appVisible, setAppVisible] = useState(false);

  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) {
      return;
    }

    // Auth state is now known
    if (isAuthenticated) {
      // User is authenticated - ensure login is not mounted, show app
      setLoginMounted(false);
      setLoginVisible(false);
      // Use requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(() => {
        setAppVisible(true);
      });
    } else {
      // User is not authenticated - show login page
      setLoginMounted(true);
      setAppVisible(false);
      requestAnimationFrame(() => {
        setLoginVisible(true);
      });
    }
  }, [authLoading, isAuthenticated]);

  // Show loading state while checking authentication - use same background as app
  // This prevents any flash of login page
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900">
        <div className="text-sm font-bold text-neutral-600 dark:text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {isAuthenticated && (
        <div
          className={`transition-opacity duration-300 ease-out ${appVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
        >
          <AuthedApp theme={theme} toggleTheme={toggleTheme} />
        </div>
      )}

      {!isAuthenticated && loginMounted && (
        <div
          className={`transition-opacity duration-300 ease-out ${
            loginVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
        >
          <LoginPage />
        </div>
      )}
    </div>
  );
};

export default App;