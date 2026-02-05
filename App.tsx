import React, { useState } from 'react';
// @google/genai guidelines: Import ViewType from shared types
import { RegistrationStatus, Applicant, ViewType } from './lib/types';
import { ensureWorkflow, recordManualReview, recordRequestInfo } from './lib/shareholdingsVerification';
import { MOCK_SHAREHOLDERS } from './lib/mockShareholders';
import { useApplicants } from './hooks/useApplicants';
import { applicantService } from './lib/firestore-service';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './components/DashboardHome';
import ApplicantDetail from './components/ApplicantDetail';
import ShareholdersRegistry from './components/ShareholdersRegistry';
import OverviewDashboard from './components/OverviewDashboard';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('dashboard');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const { applicants, loading: applicantsLoading } = useApplicants({ realTime: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [registrationsTabRequest, setRegistrationsTabRequest] = useState<{ tab: 'PENDING' | 'VERIFIED' | 'NON_VERIFIED' | 'ALL'; requestId: number } | null>(null);

  const filteredApplicants = applicants.filter(a => 
    a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectApplicant = (applicant: Applicant) => {
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

export default App;