import { Applicant, RegistrationStatus, InvestorType, HoldingsRecord } from './types';
import { MOCK_SHAREHOLDERS } from './mockShareholders';

/**
 * Helper function to extract shares and ownership from shareholdingDetails string
 * Format: "8,319,668 shares (28.41% stake)"
 */
function parseShareholdingDetails(details: string): { shares: number; ownership: number } | null {
  const sharesMatch = details.match(/([\d,]+)\s+shares/);
  const ownershipMatch = details.match(/\(([\d.]+)%\s+stake\)/);
  
  if (!sharesMatch || !ownershipMatch) return null;
  
  const shares = parseInt(sharesMatch[1].replace(/,/g, ''), 10);
  const ownership = parseFloat(ownershipMatch[1]);
  
  return { shares, ownership };
}

/**
 * Create HoldingsRecord for an applicant if they are a verified shareholder
 */
function createHoldingsRecord(applicant: Applicant): HoldingsRecord | undefined {
  if (applicant.status !== RegistrationStatus.APPROVED || !applicant.declaration.isShareholder) {
    return undefined;
  }
  
  // Find matching shareholder by ID
  const shareholder = MOCK_SHAREHOLDERS.find(sh => sh.id === applicant.id);
  if (!shareholder) return undefined;
  
  // Parse shareholding details or use shareholder data
  let sharesHeld = shareholder.holdings;
  let ownershipPercentage = shareholder.stake;
  
  if (applicant.declaration.shareholdingDetails) {
    const parsed = parseShareholdingDetails(applicant.declaration.shareholdingDetails);
    if (parsed) {
      sharesHeld = parsed.shares;
      ownershipPercentage = parsed.ownership;
    }
  }
  
  return {
    companyId: shareholder.id,
    companyName: shareholder.name,
    sharesHeld,
    ownershipPercentage,
    sharesClass: shareholder.accountType,
    registrationDate: applicant.submissionDate,
  };
}

export const MOCK_APPLICANTS: Applicant[] = [
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
    },
    holdingsRecord: undefined // Will be set below
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
    },
    holdingsRecord: undefined // Will be set below
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
    },
    holdingsRecord: undefined // Will be set below
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
    },
    holdingsRecord: undefined // Will be set below
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
    },
    holdingsRecord: undefined // Will be set below
  }
];

// Add holdingsRecord to each applicant
MOCK_APPLICANTS.forEach(applicant => {
  (applicant as Applicant).holdingsRecord = createHoldingsRecord(applicant);
});

