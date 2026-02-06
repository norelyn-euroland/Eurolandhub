import React, { useEffect, useMemo, useState, startTransition } from 'react';
// @google/genai guidelines: Import ViewType from shared types
import { RegistrationStatus, Applicant, ViewType, RegistrationsTabType, BreadcrumbItem } from './lib/types';
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

const FADE_DURATION_MS = 300;

const AuthedApp: React.FC = () => {
  const [view, setView] = useState<ViewType>('dashboard');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const { applicants, loading: applicantsLoading } = useApplicants({ realTime: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [registrationsTabRequest, setRegistrationsTabRequest] = useState<{ tab: RegistrationsTabType; requestId: number } | null>(null);
  
  // Navigation state tracking
  const [activeRegistrationsTab, setActiveRegistrationsTab] = useState<RegistrationsTabType>('ALL');
  const [registrationsSearchQuery, setRegistrationsSearchQuery] = useState<string>('');
  const [preservedFilterState, setPreservedFilterState] = useState<{ tab: RegistrationsTabType; searchQuery: string } | null>(null);

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
    setSelectedApplicant(applicant);
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
    setSelectedApplicant(null);
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
      setSelectedApplicant(applicant);
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
            // Only update if not already in the desired state to prevent lag
            if (activeRegistrationsTab !== 'ALL' || registrationsSearchQuery !== '') {
              // Batch state updates to prevent rapid re-renders
              startTransition(() => {
                setView('registrations');
                setActiveRegistrationsTab('ALL');
                setRegistrationsSearchQuery('');
                setRegistrationsTabRequest({ tab: 'ALL', requestId: Date.now() });
              });
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
        
        // Add Registrations breadcrumb
        items.push({
          label: 'Registrations',
          view: 'registrations',
          onClick: () => {
            setView('registrations');
            if (preservedFilterState) {
              setRegistrationsTabRequest({ 
                tab: preservedFilterState.tab, 
                requestId: Date.now() 
              });
              setActiveRegistrationsTab(preservedFilterState.tab);
              setRegistrationsSearchQuery(preservedFilterState.searchQuery);
            }
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
              setView('registrations');
              setRegistrationsTabRequest({ 
                tab: preservedFilterState.tab, 
                requestId: Date.now() 
              });
              setActiveRegistrationsTab(preservedFilterState.tab);
              setRegistrationsSearchQuery(preservedFilterState.searchQuery);
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

  // Handle tab changes from DashboardHome
  const handleTabChange = (tab: RegistrationsTabType) => {
    setActiveRegistrationsTab(tab);
  };

  // Handle search query changes from DashboardHome
  const handleSearchChange = (query: string) => {
    setRegistrationsSearchQuery(query);
  };

  // Handle back navigation from detail view
  const handleBackFromDetail = () => {
    setView('registrations');
    setSelectedApplicant(null);
    
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
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 overflow-hidden">
      <Sidebar 
        currentView={view} 
        onViewChange={(v) => setView(v)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 ml-64">
        <Header 
          viewTitle={getViewTitle()}
          pendingApplicants={pendingApplicants}
          onNotificationAction={handleNotificationAction}
          breadcrumbItems={breadcrumbItems}
        />
        
        <main className="flex-1 overflow-y-auto p-8">
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
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // Check authentication first
  const { loading: authLoading, isAuthenticated } = useAuth();

  // Crossfade login -> app so the dashboard doesn't appear "suddenly"
  const [loginMounted, setLoginMounted] = useState(true);
  const [loginVisible, setLoginVisible] = useState(true);
  const [appVisible, setAppVisible] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      // Ensure login is mounted and visible
      setLoginMounted(true);
      requestAnimationFrame(() => setLoginVisible(true));
      setAppVisible(false);
      return;
    }

    // Authenticated: fade out login overlay
    setLoginVisible(false);
    const t = window.setTimeout(() => setLoginMounted(false), FADE_DURATION_MS);
    requestAnimationFrame(() => setAppVisible(true));
    return () => window.clearTimeout(t);
  }, [authLoading, isAuthenticated]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-sm font-bold text-neutral-600">Loading...</div>
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
          <AuthedApp />
        </div>
      )}

      {loginMounted && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-300 ease-out ${
            loginVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
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