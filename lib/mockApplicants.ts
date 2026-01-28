import { Applicant, RegistrationStatus, HoldingsRecord } from './types';
import { MOCK_SHAREHOLDERS } from './mockShareholders';
import { ensureWorkflow, setWantsVerification, submitShareholdingInfo, recordManualReview } from './shareholdingsVerification';

/**
 * Create HoldingsRecord for an applicant if they are a verified shareholder
 */
function createHoldingsRecord(applicant: Applicant): HoldingsRecord | undefined {
  if (applicant.status !== RegistrationStatus.APPROVED) {
    return undefined;
  }
  
  // Find matching shareholder by ID
  const shareholder = MOCK_SHAREHOLDERS.find(sh => sh.id === applicant.id);
  if (!shareholder) return undefined;
  
  return {
    companyId: shareholder.id,
    companyName: shareholder.name,
    sharesHeld: shareholder.holdings,
    ownershipPercentage: shareholder.stake,
    sharesClass: shareholder.accountType,
    registrationDate: applicant.submissionDate,
  };
}

const BASE_APPLICANTS: Applicant[] = [
  {
    id: '201200512',
    fullName: 'Juan Carlos Dela Cruz',
    email: 'juan.delacruz@smcorp.com',
    phoneNumber: '+63 2 8888 1234',
    location: 'Pasay City, Philippines',
    submissionDate: '2024-01-15',
    lastActive: '2 hours ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m1/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t1/600/400',
    holdingsRecord: undefined // Will be set below
  },
  {
    id: '201202388',
    fullName: 'Maria Consuelo Ayala',
    email: 'maria.ayala@ayalacorp.com',
    phoneNumber: '+63 2 8888 5678',
    location: 'Makati City, Philippines',
    submissionDate: '2024-01-18',
    lastActive: '5 hours ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m2/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t2/600/400',
    holdingsRecord: undefined // Will be set below
  },
  {
    id: '201198216',
    fullName: 'Roberto San Miguel',
    email: 'roberto.sanmiguel@sanmiguel.com',
    phoneNumber: '+63 2 8888 9012',
    location: 'Mandaluyong City, Philippines',
    submissionDate: '2024-01-20',
    lastActive: '1 day ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m3/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t3/600/400',
    holdingsRecord: undefined // Will be set below
  },
  {
    id: '201199876',
    fullName: 'Ana Patricia Tan',
    email: 'ana.tan@jollibee.com',
    phoneNumber: '+63 2 8888 3456',
    location: 'Ortigas Center, Philippines',
    submissionDate: '2024-01-22',
    lastActive: '2 days ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m4/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t4/600/400',
    holdingsRecord: undefined // Will be set below
  },
  {
    id: '201201234',
    fullName: 'Fernando Reyes',
    email: 'fernando.reyes@bdo.com.ph',
    phoneNumber: '+63 2 8888 7890',
    location: 'Makati City, Philippines',
    submissionDate: '2024-02-01',
    lastActive: '3 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/m5/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t5/600/400',
  },
  {
    id: '201201567',
    fullName: 'Cristina Villanueva',
    email: 'cristina.villanueva@metrobank.com',
    phoneNumber: '+63 2 8888 2468',
    location: 'Makati City, Philippines',
    submissionDate: '2024-02-05',
    lastActive: '4 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/m6/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t6/600/400',
  },
  {
    id: '201201890',
    fullName: 'Miguel Santos',
    email: 'miguel.santos@bpi.com',
    phoneNumber: '+63 2 8888 1357',
    location: 'Makati City, Philippines',
    submissionDate: '2024-02-08',
    lastActive: '5 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/m7/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t7/600/400',
  },
  {
    id: '201202123',
    fullName: 'Lourdes Mendoza',
    email: 'lourdes.mendoza@pldt.com',
    phoneNumber: '+63 2 8888 9753',
    location: 'Makati City, Philippines',
    submissionDate: '2024-02-10',
    lastActive: '1 week ago',
    status: RegistrationStatus.FURTHER_INFO,
    idDocumentUrl: 'https://picsum.photos/seed/m8/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t8/600/400',
  },
  {
    id: '201202456',
    fullName: 'Ricardo Lim',
    email: 'ricardo.lim@globe.com.ph',
    phoneNumber: '+63 2 8888 8642',
    location: 'Taguig City, Philippines',
    submissionDate: '2024-02-12',
    lastActive: '1 week ago',
    status: RegistrationStatus.REJECTED,
    idDocumentUrl: 'https://picsum.photos/seed/m9/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t9/600/400',
  },
  {
    id: '201202789',
    fullName: 'Isabella Garcia',
    email: 'isabella.garcia@megaworld.com',
    phoneNumber: '+63 2 8888 7531',
    location: 'Bonifacio Global City, Philippines',
    submissionDate: '2024-02-15',
    lastActive: '2 weeks ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/m10/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/t10/600/400',
    holdingsRecord: undefined // Will be set below
  },
  {
    id: '201203012',
    fullName: 'Norelyn A. Golingan',
    email: 'nor.golingan@gmail.com',
    phoneNumber: '+63 953 810 6251',
    location: 'Manila, Philippines',
    submissionDate: '2024-02-20',
    lastActive: 'Just now',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/norelyn/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/norelyn-tax/600/400',
  }
];

export const MOCK_APPLICANTS: Applicant[] = BASE_APPLICANTS.map((a) => {
  // Preserve the existing holdingsRecord demo behavior
  const withHoldingsRecord: Applicant = { ...a, holdingsRecord: createHoldingsRecord(a) };

  // Step 1: ensure workflow object exists on all users (admin-only demo)
  let next = ensureWorkflow(withHoldingsRecord);

  // Seed scenarios for Steps 1–5 (Step 6 deferred) to demonstrate all workflow statuses:
  switch (next.id) {
    // Scenario 1: Step 1 decision: No (Unverified - didn't want to verify)
    case '201201890': { // Miguel Santos
      next = setWantsVerification(next, false);
      break;
    }

    // Scenario 2: Step 1: Yes, but no Step 2 submission yet (Registration Pending)
    case '201202123': { // Lourdes Mendoza (PLDT)
      next = setWantsVerification(next, true);
      // No Step 2 submission - user agreed but hasn't submitted info yet
      break;
    }

    // Scenario 3: Step 1: Yes + Step 2: Submitted + Step 3: Auto check passed (Awaiting IRO Review)
    // Event-driven: submitShareholdingInfo automatically runs Step 3 verification
    case '201201234': { // Fernando Reyes (BDO) - matching record
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '201201234',
        companyName: 'BDO UNIBANK INC.',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS); // Pass shareholders for automatic verification
      break;
    }

    // Scenario 4: Step 1: Yes + Step 2: Submitted + Step 3: Auto check failed (Auto Check Failed)
    // Event-driven: submitShareholdingInfo automatically runs Step 3 verification
    case '201201567': { // Cristina Villanueva (Metrobank) - wrong company name
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '201201567',
        companyName: 'METROBANKK', // intentional mismatch
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS); // Pass shareholders for automatic verification
      break;
    }

    // Scenario 5: Step 1-4: Passed + Step 5: IRO approved -> VERIFIED (Phase 3 / Step 6)
    // Event-driven: submitShareholdingInfo automatically runs Step 4 verification
    case '201199876': { // Ana Patricia Tan (Jollibee)
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '201199876',
        companyName: 'JOLLIBEE FOODS CORPORATION',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS); // Pass shareholders for automatic verification
      next = recordManualReview(next, true); // IRO approved
      break;
    }

    // Scenario 6: Step 1-3: Failed 3 times (Locked 7 Days)
    // Event-driven: submitShareholdingInfo automatically runs Step 3 verification
    // For demo, we manually trigger 3 failed attempts to show lockout state
    case '201202456': { // Ricardo Lim (Globe) - will be locked
      next = setWantsVerification(next, true);
      // First submission (will fail)
      next = submitShareholdingInfo(next, {
        shareholdingsId: '201202456',
        companyName: 'WRONG COMPANY NAME', // intentional mismatch
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS);
      // Simulate 2 more failed attempts to reach lockout threshold
      if (next.shareholdingsVerification) {
        const now = new Date().toISOString();
        const lockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        next = {
          ...next,
          shareholdingsVerification: {
            ...next.shareholdingsVerification,
            step3: {
              ...next.shareholdingsVerification.step3,
              failedAttempts: 3, // Total of 3 failed attempts
              lockedUntil,
            },
          },
        };
      }
      break;
    }

    // Scenario 7: Step 1-3: Passed + Step 4: IRO review pending (Awaiting IRO Review)
    // Event-driven: submitShareholdingInfo automatically runs Step 3 verification
    case '201202388': { // Maria Consuelo Ayala (Ayala Corporation)
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '201202388',
        companyName: 'AYALA CORPORATION',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS); // Pass shareholders for automatic verification
      // Step 4 not done yet - awaiting IRO review
      break;
    }

    // Scenario 8: Step 1: Yes, but no Step 2 submission yet (Registration Pending) - Norelyn A. Golingan
    case '201203012': { // Norelyn A. Golingan
      next = setWantsVerification(next, true);
      // No Step 2 submission - user agreed but hasn't submitted info yet
      break;
    }

    default:
      // For other users, ensure they have workflow but don't force any specific state
      // They'll show as "Not Started" or default states
      break;
  }

  return next;
});

