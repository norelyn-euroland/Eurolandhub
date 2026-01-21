import React, { useState } from 'react';
// @google/genai guidelines: Import ViewType from shared types
import { RegistrationStatus, InvestorType, Applicant, ViewType } from './lib/types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './components/DashboardHome';
import ApplicantDetail from './components/ApplicantDetail';
import ShareholdersRegistry from './components/ShareholdersRegistry';
import ComplianceDashboard from './components/ComplianceDashboard';
import OverviewDashboard from './components/OverviewDashboard';

const MOCK_APPLICANTS: Applicant[] = [
  {
    id: 'INV-101',
    fullName: 'Michael Chen',
    email: 'm.chen@corporate.com',
    phoneNumber: '+1 (555) 010-8899',
    location: 'Singapore',
    type: InvestorType.RETAIL,
    submissionDate: '2023-10-12',
    lastActive: '2 hours ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m1/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t1/600/400',
    declaration: {
      netWorth: '$1M - $5M',
      annualIncome: '$250k',
      isPEP: false,
      sourceOfWealth: 'Technology Sector Exit',
      investmentExperience: 'Institutional grade trading.',
      isShareholder: true,
      shareholdingDetails: '28,500'
    }
  },
  {
    id: 'INV-102',
    fullName: 'Emma Rodriguez',
    email: 'e.rodriguez@vanguard.com',
    phoneNumber: '+1 (555) 011-2233',
    location: 'Madrid, Spain',
    type: InvestorType.RETAIL,
    submissionDate: '2023-10-14',
    lastActive: '5 hours ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m2/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t2/600/400',
    declaration: {
      netWorth: '$500k - $1M',
      annualIncome: '$180k',
      isPEP: false,
      sourceOfWealth: 'Professional Services',
      investmentExperience: 'Active equity investor.',
      isShareholder: true,
      shareholdingDetails: '19,200'
    }
  },
  {
    id: 'INV-103',
    fullName: 'David Thompson',
    email: 'd.thompson@private.io',
    phoneNumber: '+44 20 7946 0011',
    location: 'London, UK',
    type: InvestorType.RETAIL,
    submissionDate: '2023-10-15',
    lastActive: '1 day ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m3/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t3/600/400',
    declaration: {
      netWorth: '$2M+',
      annualIncome: '$300k',
      isPEP: false,
      sourceOfWealth: 'Real Estate Portfolio',
      investmentExperience: 'Diversified long-term holder.',
      isShareholder: true,
      shareholdingDetails: '15,600'
    }
  },
  {
    id: 'INV-104',
    fullName: 'Sophie Laurent',
    email: 's.laurent@finance.fr',
    phoneNumber: '+33 1 42 68 53 00',
    location: 'Paris, France',
    type: InvestorType.RETAIL,
    submissionDate: '2023-10-16',
    lastActive: '2 days ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m4/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t4/600/400',
    declaration: {
      netWorth: '$1M - $2M',
      annualIncome: '$210k',
      isPEP: false,
      sourceOfWealth: 'Inheritance & Consulting',
      investmentExperience: 'Risk-averse capital preservation.',
      isShareholder: true,
      shareholdingDetails: '12,800'
    }
  },
  {
    id: 'INV-105',
    fullName: 'James Wilson',
    email: 'j.wilson@outlook.com',
    phoneNumber: '+1 (555) 345-6789',
    location: 'New York, NY',
    type: InvestorType.RETAIL,
    submissionDate: '2023-10-18',
    lastActive: '3 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/m5/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t5/600/400',
    declaration: {
      netWorth: '$250k - $500k',
      annualIncome: '$110k',
      isPEP: false,
      sourceOfWealth: 'Salary Savings',
      investmentExperience: 'Retail trading explorer.',
      isShareholder: false
    }
  },
  {
    id: 'INV-106',
    fullName: 'Maria Garcia',
    email: 'm.garcia@global.es',
    phoneNumber: '+34 91 123 45 67',
    location: 'Barcelona, Spain',
    type: InvestorType.RETAIL,
    submissionDate: '2023-10-20',
    lastActive: '4 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/m6/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t6/600/400',
    declaration: {
      netWorth: '$100k - $250k',
      annualIncome: '$85k',
      isPEP: false,
      sourceOfWealth: 'Employment',
      investmentExperience: 'New entrant.',
      isShareholder: false
    }
  }
];

const App: React.FC = () => {
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
      case 'overview': return 'EurolandHUB Overview';
      case 'registrations': return 'Investor Registrations';
      case 'detail': return 'Verification Review';
      case 'shareholders': return 'Shareholders Registry';
      case 'compliance': return 'Compliance Oversight';
      default: return 'Overview';
    }
  };

  const getSearchPlaceholder = () => {
    switch(view) {
      case 'overview': return 'Search top investors...';
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
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          searchQuery={searchQuery} 
          onSearchChange={setSearchQuery} 
          viewTitle={getViewTitle()}
          searchPlaceholder={getSearchPlaceholder()}
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
};

export default App;