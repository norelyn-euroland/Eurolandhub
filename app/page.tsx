
'use client';

import React, { useState } from 'react';
// @google/genai guidelines: Import shared ViewType to fix type mismatch
import { RegistrationStatus, InvestorType, Applicant, ViewType } from '../lib/types';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DashboardHome from '../components/DashboardHome';
import ApplicantDetail from '../components/ApplicantDetail';
// @google/genai guidelines: Import other dashboard components for complete view handling
import ShareholdersRegistry from '../components/ShareholdersRegistry';
import ComplianceDashboard from '../components/ComplianceDashboard';
import OverviewDashboard from '../components/OverviewDashboard';

const MOCK_APPLICANTS: Applicant[] = [
  {
    id: 'INV-001',
    fullName: 'Alexander Sterling',
    email: 'a.sterling@private.com',
    type: InvestorType.ACCREDITED,
    submissionDate: '2023-11-20',
    lastActive: '2 mins ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/id1/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/tax1/600/400',
    declaration: {
      netWorth: '$2.5M - $5M',
      annualIncome: '$300k+',
      isPEP: false,
      sourceOfWealth: 'Sale of previous tech enterprise',
      investmentExperience: '10+ years in private equity and public markets.',
      isShareholder: true,
      shareholdingDetails: 'Holds 5% in Blue Horizon Tech'
    }
  },
  {
    id: 'INV-002',
    fullName: 'Elena Vance',
    email: 'elena.v@vancecapital.org',
    type: InvestorType.INSTITUTIONAL,
    submissionDate: '2023-11-21',
    lastActive: '14 mins ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/id2/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/tax2/600/400',
    declaration: {
      netWorth: '$10M+',
      annualIncome: '$1M+',
      isPEP: true,
      sourceOfWealth: 'Generational wealth and family trust management.',
      investmentExperience: 'Manages family office portfolio.',
      isShareholder: false
    }
  },
  {
    id: 'INV-003',
    fullName: 'Marcus Aurelius',
    email: 'marcus.a@stoicinvest.com',
    type: InvestorType.RETAIL,
    submissionDate: '2023-11-22',
    lastActive: '1 day ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/id3/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/tax3/600/400',
    declaration: {
      netWorth: '$100k - $250k',
      annualIncome: '$80k',
      isPEP: false,
      sourceOfWealth: 'Professional services (Attorney)',
      investmentExperience: 'Active retail trader for 5 years.',
      isShareholder: false
    }
  }
];

export default function Home() {
  // @google/genai guidelines: Use shared ViewType and set initial state to 'overview'
  const [view, setView] = useState<ViewType>('overview');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
  const [searchQuery, setSearchQuery] = useState('');

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

  const getViewTitle = () => {
    switch(view) {
      case 'overview': return 'Investor Hub Overview';
      case 'registrations': return 'Investor Registrations';
      case 'detail': return 'Verification Review';
      case 'shareholders': return 'Shareholders Registry';
      case 'compliance': return 'Compliance Oversight';
      default: return 'Overview';
    }
  };

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 overflow-hidden">
      <Sidebar 
        currentView={view} 
        onViewChange={(v) => setView(v)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          searchQuery={searchQuery} 
          onSearchChange={setSearchQuery} 
          viewTitle={getViewTitle()}
        />
        
        <main className="flex-1 overflow-y-auto p-8">
          {view === 'overview' && (
            <OverviewDashboard applicants={applicants} />
          )}
          {view === 'registrations' && (
            <DashboardHome 
              applicants={filteredApplicants} 
              onSelect={handleSelectApplicant} 
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
        </main>
      </div>
    </div>
  );
}
