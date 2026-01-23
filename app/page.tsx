
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
    id: '201200512',
    fullName: 'Juan Carlos Dela Cruz',
    email: 'juan.delacruz@smcorp.com',
    phoneNumber: '+63 2 8888 1234',
    location: 'Pasay City, Philippines',
    type: InvestorType.INSTITUTIONAL,
    submissionDate: '2024-01-15',
    lastActive: '2 mins ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/id1/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/tax1/600/400',
    declaration: {
      netWorth: '$10M+',
      annualIncome: '$1.5M+',
      isPEP: false,
      sourceOfWealth: 'Corporate Holdings & Investments',
      investmentExperience: 'Institutional portfolio management.',
      isShareholder: true,
      shareholdingDetails: '8,319,668 shares (28.41% stake)'
    }
  },
  {
    id: '201202388',
    fullName: 'Maria Consuelo Ayala',
    email: 'maria.ayala@ayalacorp.com',
    phoneNumber: '+63 2 8888 5678',
    location: 'Makati City, Philippines',
    type: InvestorType.INSTITUTIONAL,
    submissionDate: '2024-01-18',
    lastActive: '14 mins ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/id2/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/tax2/600/400',
    declaration: {
      netWorth: '$5M - $10M',
      annualIncome: '$800k+',
      isPEP: false,
      sourceOfWealth: 'Family Business & Real Estate',
      investmentExperience: 'Manages family office portfolio.',
      isShareholder: true,
      shareholdingDetails: '3,632,265 shares (12.40% stake)'
    }
  },
  {
    id: '201198216',
    fullName: 'Roberto San Miguel',
    email: 'roberto.sanmiguel@sanmiguel.com',
    phoneNumber: '+63 2 8888 9012',
    location: 'Mandaluyong City, Philippines',
    type: InvestorType.RETAIL,
    submissionDate: '2024-01-20',
    lastActive: '1 day ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/id3/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/tax3/600/400',
    declaration: {
      netWorth: '$3M - $5M',
      annualIncome: '$600k',
      isPEP: false,
      sourceOfWealth: 'Corporate Dividends & Investments',
      investmentExperience: 'Active retail trader for 5 years.',
      isShareholder: true,
      shareholdingDetails: '2,038,782 shares (6.96% stake)'
    }
  }
];

export default function Home() {
  // @google/genai guidelines: Use shared ViewType and set initial state to 'dashboard'
  const [view, setView] = useState<ViewType>('dashboard');
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
      case 'dashboard': return 'Investor Hub Dashboard';
      case 'registrations': return 'Investor Registrations';
      case 'detail': return 'Verification Review';
      case 'shareholders': return 'Shareholders Registry';
      case 'compliance': return 'Compliance Oversight';
      default: return 'Dashboard';
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
          {view === 'dashboard' && (
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
