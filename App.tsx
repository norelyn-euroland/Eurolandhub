import React, { useState } from 'react';
// @google/genai guidelines: Import ViewType from shared types
import { RegistrationStatus, InvestorType, Applicant, ViewType } from './lib/types';
import { MOCK_APPLICANTS } from './lib/mockApplicants';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './components/DashboardHome';
import ApplicantDetail from './components/ApplicantDetail';
import ShareholdersRegistry from './components/ShareholdersRegistry';
import ComplianceDashboard from './components/ComplianceDashboard';
import OverviewDashboard from './components/OverviewDashboard';
import FirebaseConsole from './components/FirebaseConsole';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('dashboard');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
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

  const handleUpdateStatus = (id: string, status: RegistrationStatus) => {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status } : a));
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
          {view === 'compliance' && (
            <ComplianceDashboard applicants={applicants} />
          )}
          {view === 'firebase' && (
            <FirebaseConsole />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;