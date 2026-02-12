import React, { useEffect, useLayoutEffect, useMemo, useState, startTransition, useCallback, useRef } from 'react';
// @google/genai guidelines: Import ViewType from shared types
import { RegistrationStatus, Applicant, ViewType, RegistrationsTabType, BreadcrumbItem, Theme } from './lib/types';
import { ensureWorkflow, recordManualReview, recordRequestInfo } from './lib/shareholdingsVerification';
import { MOCK_SHAREHOLDERS } from './lib/mockShareholders';
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
import InvestorProcessing from './components/InvestorProcessing';

const FADE_DURATION_MS = 300;

interface AuthedAppProps {
  theme: Theme;
  toggleTheme: () => void;
}

const AuthedApp: React.FC<AuthedAppProps> = ({ theme, toggleTheme }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Restore view from localStorage on mount
  // Note: We don't restore 'detail' view as it requires applicant data
  const getInitialView = (): ViewType => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eurolandhub_view');
      if (saved && ['dashboard', 'registrations', 'shareholders', 'investor-processing'].includes(saved)) {
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
    const applicant = applicants.find(a => a.id === id);
    if (!applicant) return;

    // Always carry the workflow state, even if the record didn't have it yet.
    const base = ensureWorkflow(applicant);

    let updatedApplicant: Applicant;

    // Wire existing admin actions to Step 5 (Manual IRO Verification)
    if (status === RegistrationStatus.APPROVED) {
      // Step 5: Manual IRO match -> APPROVED
      updatedApplicant = recordManualReview(base, true);
    } else if (status === RegistrationStatus.REJECTED) {
      // Step 5: Manual IRO no-match -> PENDING (for resubmission)
      updatedApplicant = recordManualReview(base, false);
    } else if (status === RegistrationStatus.FURTHER_INFO) {
      // Step 5: IRO requests more information -> FURTHER_INFO (PENDING in frontend)
      updatedApplicant = recordRequestInfo(base);
    } else {
      // For any other status, just update the status
      updatedApplicant = { ...base, status };
    }

    // Update in Firestore (real-time listener will update the UI automatically)
    try {
      await applicantService.update(id, updatedApplicant);
    } catch (error) {
      console.error('Error updating applicant status:', error);
      // Real-time listener will handle the update, but we log the error
    }

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
      case 'shareholders': return 'Shareholders Registry';
      case 'investor-processing': return 'Investor Processing';
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
          label: 'Shareholders',
          view: 'shareholders',
          onClick: () => setView('shareholders')
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
        
        <main className="flex-1 overflow-y-auto p-8 bg-white dark:bg-neutral-900">
          {view === 'dashboard' && (
            <OverviewDashboard applicants={applicants} />
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
            <ShareholdersRegistry searchQuery={searchQuery} />
          )}
          {view === 'investor-processing' && (
            <InvestorProcessing sidebarCollapsed={isSidebarCollapsed} />
          )}
        </main>
      </div>
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