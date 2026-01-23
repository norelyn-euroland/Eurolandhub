'use client';

import React, { useState } from 'react';
import { batchService } from '../../lib/firestore-service';
import { Applicant } from '../../lib/types';
import { RegistrationStatus, InvestorType } from '../../lib/types';

// Import mock data (same as App.tsx)
const MOCK_APPLICANTS: Applicant[] = [
  {
    id: '201200512',
    fullName: 'Juan Carlos Dela Cruz',
    email: 'juan.delacruz@smcorp.com',
    phoneNumber: '+63 2 8888 1234',
    location: 'Pasay City, Philippines',
    type: InvestorType.INSTITUTIONAL,
    submissionDate: '2024-01-15',
    lastActive: '2 hours ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m1/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t1/600/400',
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
    lastActive: '5 hours ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m2/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t2/600/400',
    declaration: {
      netWorth: '$5M - $10M',
      annualIncome: '$800k+',
      isPEP: false,
      sourceOfWealth: 'Family Business & Real Estate',
      investmentExperience: 'Long-term equity investor.',
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
    type: InvestorType.INSTITUTIONAL,
    submissionDate: '2024-01-20',
    lastActive: '1 day ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m3/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t3/600/400',
    declaration: {
      netWorth: '$3M - $5M',
      annualIncome: '$600k',
      isPEP: false,
      sourceOfWealth: 'Corporate Dividends & Investments',
      investmentExperience: 'Diversified institutional holder.',
      isShareholder: true,
      shareholdingDetails: '2,038,782 shares (6.96% stake)'
    }
  },
  {
    id: '201199876',
    fullName: 'Ana Patricia Tan',
    email: 'ana.tan@jollibee.com',
    phoneNumber: '+63 2 8888 3456',
    location: 'Ortigas Center, Philippines',
    type: InvestorType.ACCREDITED,
    submissionDate: '2024-01-22',
    lastActive: '2 days ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m4/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t4/600/400',
    declaration: {
      netWorth: '$2M - $3M',
      annualIncome: '$450k',
      isPEP: false,
      sourceOfWealth: 'Business Operations & Franchising',
      investmentExperience: 'Active equity investor.',
      isShareholder: true,
      shareholdingDetails: '1,555,760 shares (5.31% stake)'
    }
  },
  {
    id: '201201234',
    fullName: 'Fernando Reyes',
    email: 'fernando.reyes@bdo.com.ph',
    phoneNumber: '+63 2 8888 7890',
    location: 'Makati City, Philippines',
    type: InvestorType.ACCREDITED,
    submissionDate: '2024-02-01',
    lastActive: '3 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/m5/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t5/600/400',
    declaration: {
      netWorth: '$1M - $2M',
      annualIncome: '$300k',
      isPEP: false,
      sourceOfWealth: 'Banking & Financial Services',
      investmentExperience: 'Professional investor.',
      isShareholder: true,
      shareholdingDetails: '1,245,678 shares (4.26% stake)'
    }
  },
  {
    id: '201201567',
    fullName: 'Cristina Villanueva',
    email: 'cristina.villanueva@metrobank.com',
    phoneNumber: '+63 2 8888 2468',
    location: 'Makati City, Philippines',
    type: InvestorType.ACCREDITED,
    submissionDate: '2024-02-05',
    lastActive: '4 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/m6/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t6/600/400',
    declaration: {
      netWorth: '$800k - $1M',
      annualIncome: '$250k',
      isPEP: false,
      sourceOfWealth: 'Financial Services & Investments',
      investmentExperience: 'Moderate experience.',
      isShareholder: true,
      shareholdingDetails: '1,123,456 shares (3.84% stake)'
    }
  },
  {
    id: '201201890',
    fullName: 'Miguel Santos',
    email: 'miguel.santos@bpi.com',
    phoneNumber: '+63 2 8888 1357',
    location: 'Makati City, Philippines',
    type: InvestorType.RETAIL,
    submissionDate: '2024-02-08',
    lastActive: '5 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/m7/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t7/600/400',
    declaration: {
      netWorth: '$500k - $800k',
      annualIncome: '$180k',
      isPEP: false,
      sourceOfWealth: 'Employment & Savings',
      investmentExperience: 'Active retail investor.',
      isShareholder: false
    }
  },
  {
    id: '201202123',
    fullName: 'Lourdes Mendoza',
    email: 'lourdes.mendoza@pldt.com',
    phoneNumber: '+63 2 8888 9753',
    location: 'Makati City, Philippines',
    type: InvestorType.RETAIL,
    submissionDate: '2024-02-10',
    lastActive: '1 week ago',
    status: RegistrationStatus.FURTHER_INFO,
    idDocumentUrl: 'https://picsum.photos/seed/m8/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t8/600/400',
    declaration: {
      netWorth: '$250k - $500k',
      annualIncome: '$120k',
      isPEP: false,
      sourceOfWealth: 'Telecommunications Industry',
      investmentExperience: 'New to equity markets.',
      isShareholder: false
    }
  },
  {
    id: '201202456',
    fullName: 'Ricardo Lim',
    email: 'ricardo.lim@globe.com.ph',
    phoneNumber: '+63 2 8888 8642',
    location: 'Taguig City, Philippines',
    type: InvestorType.RETAIL,
    submissionDate: '2024-02-12',
    lastActive: '1 week ago',
    status: RegistrationStatus.REJECTED,
    idDocumentUrl: 'https://picsum.photos/seed/m9/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t9/600/400',
    declaration: {
      netWorth: '$200k - $400k',
      annualIncome: '$95k',
      isPEP: false,
      sourceOfWealth: 'Employment',
      investmentExperience: 'Limited experience.',
      isShareholder: false
    }
  },
  {
    id: '201202789',
    fullName: 'Isabella Garcia',
    email: 'isabella.garcia@megaworld.com',
    phoneNumber: '+63 2 8888 7531',
    location: 'Bonifacio Global City, Philippines',
    type: InvestorType.ACCREDITED,
    submissionDate: '2024-02-15',
    lastActive: '2 weeks ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m10/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t10/600/400',
    declaration: {
      netWorth: '$1.5M - $2M',
      annualIncome: '$350k',
      isPEP: true,
      sourceOfWealth: 'Real Estate Development',
      investmentExperience: 'Property and equity investor.',
      isShareholder: true,
      shareholdingDetails: '654,321 shares (2.23% stake)'
    }
  }
];

export default function MigrateDataPage() {
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    setMigrationStatus(null);

    try {
      await batchService.migrateApplicants(MOCK_APPLICANTS);
      setMigrationStatus({
        success: true,
        message: 'Successfully migrated all applicants to Firestore!',
        count: MOCK_APPLICANTS.length
      });
    } catch (err: any) {
      setError(err.message || 'Migration failed');
      setMigrationStatus({
        success: false,
        message: 'Migration failed. Check console for details.'
      });
      console.error('Migration error:', err);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-black mb-6 text-neutral-900 uppercase tracking-tighter">
        Migrate Data to Firebase
      </h1>

      <div className="space-y-6">
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-black mb-4 text-neutral-900 uppercase tracking-tight">
            Migration Information
          </h2>
          <div className="space-y-2 text-sm text-neutral-700">
            <p><span className="font-bold">Total Applicants:</span> {MOCK_APPLICANTS.length}</p>
            <p><span className="font-bold">Collection:</span> applicants</p>
            <p><span className="font-bold">Note:</span> This will add all mock applicants to Firestore.</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-sm font-black text-blue-900 mb-2 uppercase">Applicants to Migrate</h3>
          <div className="space-y-1 text-sm text-blue-700">
            {MOCK_APPLICANTS.map((applicant, idx) => (
              <div key={applicant.id} className="flex items-center justify-between">
                <span>{idx + 1}. {applicant.fullName} ({applicant.email})</span>
                <span className="text-xs font-bold">{applicant.status}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleMigrate}
          disabled={migrating}
          className={`w-full py-4 px-6 rounded-xl font-black uppercase tracking-widest transition-all ${
            migrating
              ? 'bg-neutral-400 cursor-not-allowed'
              : 'bg-black text-white hover:bg-neutral-800 shadow-lg'
          }`}
        >
          {migrating ? 'Migrating...' : `Migrate ${MOCK_APPLICANTS.length} Applicants to Firestore`}
        </button>

        {migrationStatus && (
          <div
            className={`border rounded-xl p-6 ${
              migrationStatus.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{migrationStatus.success ? '✅' : '❌'}</span>
              <div>
                <h3
                  className={`text-sm font-black uppercase mb-1 ${
                    migrationStatus.success ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {migrationStatus.success ? 'Migration Successful!' : 'Migration Failed'}
                </h3>
                <p
                  className={`text-sm ${
                    migrationStatus.success ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {migrationStatus.message}
                  {migrationStatus.count && (
                    <span className="block mt-1 font-bold">
                      {migrationStatus.count} applicants added to Firestore.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-sm font-black text-red-900 mb-2 uppercase">Error</h3>
            <p className="text-sm text-red-700 font-mono">{error}</p>
            <p className="text-xs text-red-600 mt-2">
              Check browser console (F12) for detailed error information.
            </p>
          </div>
        )}

        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6">
          <h3 className="text-sm font-black text-neutral-900 mb-2 uppercase">Next Steps</h3>
          <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
            <li>After migration, verify data in Firebase Console</li>
            <li>Set up Firestore security rules (see FIREBASE_SETUP.md)</li>
            <li>Test fetching data using useApplicants hook</li>
            <li>Navigate to /test-firebase to verify connection</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

