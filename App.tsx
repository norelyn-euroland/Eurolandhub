import React, { useState } from 'react';
// @google/genai guidelines: Import ViewType from shared types
import { RegistrationStatus, Applicant, ViewType } from './lib/types';
import { MOCK_APPLICANTS } from './lib/mockApplicants';
import { ensureWorkflow, recordManualReview, sendVerificationCode, getVerificationDeadlineInfo } from './lib/shareholdingsVerification';
import { MOCK_SHAREHOLDERS } from './lib/mockShareholders';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './components/DashboardHome';
import ApplicantDetail from './components/ApplicantDetail';
import ShareholdersRegistry from './components/ShareholdersRegistry';
import ComplianceDashboard from './components/ComplianceDashboard';
import OverviewDashboard from './components/OverviewDashboard';
import FirebaseConsole from './components/FirebaseConsole';
import Toast from './components/Toast';

const DYNAMIC_HOME_LOGIN_PATH = 'https://eurolandhub.com/login'; // Placeholder for the dynamic home login page

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('dashboard');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [registrationsTabRequest, setRegistrationsTabRequest] = useState<{ tab: 'PENDING' | 'VERIFIED' | 'NON_VERIFIED' | 'ALL'; requestId: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isToastVisible, setIsToastVisible] = useState<boolean>(false);

  const filteredApplicants = applicants.filter(a => 
    a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectApplicant = (applicant: Applicant) => {
    setSelectedApplicant(applicant);
    setView('detail');
  };

  const handleUpdateStatus = (id: string, status: RegistrationStatus) => {
    setApplicants(prev => prev.map(a => {
      if (a.id !== id) return a;

      // Always carry the workflow state, even if the record didn't have it yet.
      const base = ensureWorkflow({ ...a, status });

      // Wire existing admin actions to Step 4 (without changing layout).
      // Step 5 (send code) is now manual-only via button in ApplicantDetail.
      if (status === RegistrationStatus.APPROVED) {
        // Step 4: Manual IRO match (don't auto-send code, wait for manual button)
        const updated = recordManualReview(base, true);
        
        // Show toast notification that Send Verification Code button is now available
        setToastMessage('Registration approved. The "Send Verification Code" button is now available at the bottom of the page.');
        setIsToastVisible(true);
        
        // Update the selected applicant so the button appears immediately
        setSelectedApplicant(updated);
        
        // Keep user on detail page to see the button
        setView('detail');
        
        return updated;
      }

      if (status === RegistrationStatus.REJECTED) {
        // Step 4: Manual IRO no-match -> apply resubmission rules (same as Step 3)
        return recordManualReview(base, false);
      }

      return base;
    }));
    
    // Only navigate away if not approving (for reject/request info)
    if (status !== RegistrationStatus.APPROVED) {
      setView('registrations');
      setSelectedApplicant(null);
    }
  };

  const pendingApplicants = applicants.filter(a => a.status === RegistrationStatus.PENDING);

  // Get applicants needing verification (approved by IRO but code not sent yet)
  const getApplicantsNeedingVerification = (): Applicant[] => {
    return applicants.filter(a => {
      const deadlineInfo = getVerificationDeadlineInfo(a);
      return deadlineInfo !== null && deadlineInfo.needsVerification;
    });
  };

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
      case 'compliance': return 'Compliance Oversight';
      case 'firebase': return 'Firebase Console';
      default: return 'Dashboard';
    }
  };

  const getSearchPlaceholder = () => {
    switch(view) {
      case 'dashboard': return 'Search top investors...';
      case 'registrations': return 'Search registration queue...';
      case 'shareholders': return 'Search master ledger...';
      case 'compliance': return 'Search compliance alerts...';
      default: return 'Search...';
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
          searchQuery={searchQuery} 
          onSearchChange={setSearchQuery} 
          viewTitle={getViewTitle()}
          searchPlaceholder={getSearchPlaceholder()}
          pendingApplicants={pendingApplicants}
          applicantsNeedingVerification={getApplicantsNeedingVerification()}
          onNotificationAction={handleNotificationAction}
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
            />
          )}
          {view === 'detail' && selectedApplicant && (
            <ApplicantDetail 
              applicant={selectedApplicant} 
              onBack={() => setView('registrations')}
              onUpdateStatus={handleUpdateStatus}
              onManualSendCode={(id) => {
                setApplicants(prev => prev.map(a => {
                  if (a.id !== id) return a;
                  const updated = sendVerificationCode(a, 'EMAIL', DYNAMIC_HOME_LOGIN_PATH, true);
                  return updated;
                }));
              }}
            />
          )}
          {view === 'shareholders' && (
            <ShareholdersRegistry searchQuery={searchQuery} />
          )}
          {view === 'compliance' && (
            <ComplianceDashboard applicants={applicants} />
          )}
          {view === 'firebase' && (
            <FirebaseConsole />
          )}
        </main>
      </div>
      
      <Toast 
        message={toastMessage}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
    </div>
  );
};

export default App;