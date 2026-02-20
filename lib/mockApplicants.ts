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
    id: '200512',
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
    id: '202388',
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
    id: '198216',
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
    id: '199876',
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
    id: '201234',
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
    id: '201567',
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
    id: '201890',
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
    id: '202123',
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
    id: '202456',
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
    id: '202789',
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
    id: '203012',
    fullName: 'Norelyn A. Golingan',
    email: 'nor.golingan@gmail.com',
    phoneNumber: '+63 953 810 6251',
    location: 'Manila, Philippines',
    submissionDate: '2024-02-20',
    lastActive: 'Just now',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/norelyn/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/norelyn-tax/600/400',
  },
  // New dummy accounts - 7 trying to verify shareholdings
  {
    id: '203345',
    fullName: 'Jose Maria Bautista',
    email: 'jose.bautista@gmail.com',
    phoneNumber: '+63 917 123 4567',
    location: 'Quezon City, Philippines',
    submissionDate: '2024-03-01',
    lastActive: '1 hour ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/jose/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/jose-tax/600/400',
    registrationId: '123456', // 6-digit registration ID
  },
  {
    id: '203678',
    fullName: 'Maria Elena Ramos',
    email: 'maria.ramos@yahoo.com',
    phoneNumber: '+63 918 234 5678',
    location: 'Makati City, Philippines',
    submissionDate: '2024-03-02',
    lastActive: '2 hours ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/maria-elena/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/maria-elena-tax/600/400',
    registrationId: '234567', // 6-digit registration ID
  },
  {
    id: '203901',
    fullName: 'Carlos Antonio Villanueva',
    email: 'carlos.villanueva@outlook.com',
    phoneNumber: '+63 919 345 6789',
    location: 'Pasig City, Philippines',
    submissionDate: '2024-03-03',
    lastActive: '3 hours ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/carlos/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/carlos-tax/600/400',
    registrationId: '345678', // 6-digit registration ID
  },
  {
    id: '204234',
    fullName: 'Angela Grace Santos',
    email: 'angela.santos@gmail.com',
    phoneNumber: '+63 920 456 7890',
    location: 'Taguig City, Philippines',
    submissionDate: '2024-03-04',
    lastActive: '4 hours ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/angela/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/angela-tax/600/400',
    registrationId: '456789', // 6-digit registration ID
  },
  {
    id: '204567',
    fullName: 'Rafael Domingo Cruz',
    email: 'rafael.cruz@yahoo.com',
    phoneNumber: '+63 921 567 8901',
    location: 'Mandaluyong City, Philippines',
    submissionDate: '2024-03-05',
    lastActive: '5 hours ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/rafael/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/rafael-tax/600/400',
    registrationId: '567890', // 6-digit registration ID
  },
  {
    id: '204890',
    fullName: 'Patricia Ann Reyes',
    email: 'patricia.reyes@gmail.com',
    phoneNumber: '+63 922 678 9012',
    location: 'Pasay City, Philippines',
    submissionDate: '2024-03-06',
    lastActive: '6 hours ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/patricia/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/patricia-tax/600/400',
    registrationId: '678901', // 6-digit registration ID
  },
  {
    id: '205123',
    fullName: 'Michael Angelo Torres',
    email: 'michael.torres@outlook.com',
    phoneNumber: '+63 923 789 0123',
    location: 'Marikina City, Philippines',
    submissionDate: '2024-03-07',
    lastActive: '7 hours ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/michael/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/michael-tax/600/400',
    registrationId: '789012', // 6-digit registration ID
  },
  // 8 accounts with various scenarios (no registration IDs - just want accounts)
  {
    id: '205456',
    fullName: 'Catherine Rose Garcia',
    email: 'catherine.garcia@gmail.com',
    phoneNumber: '+63 924 890 1234',
    location: 'Las Piñas City, Philippines',
    submissionDate: '2024-03-08',
    lastActive: '1 day ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/catherine/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/catherine-tax/600/400',
    // No registrationId - doesn't want to verify holdings
  },
  {
    id: '205789',
    fullName: 'Francisco Javier Mendoza',
    email: 'francisco.mendoza@yahoo.com',
    phoneNumber: '+63 925 901 2345',
    location: 'Valenzuela City, Philippines',
    submissionDate: '2024-03-09',
    lastActive: '2 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/francisco/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/francisco-tax/600/400',
    // No registrationId - doesn't want to verify holdings
  },
  {
    id: '206012',
    fullName: 'Jennifer Lynn Dela Cruz',
    email: 'jennifer.delacruz@gmail.com',
    phoneNumber: '+63 926 012 3456',
    location: 'Caloocan City, Philippines',
    submissionDate: '2024-03-10',
    lastActive: '3 days ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/jennifer/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/jennifer-tax/600/400',
    // No registrationId - doesn't want to verify holdings
  },
  {
    id: '206345',
    fullName: 'Rodrigo Sebastian Aquino',
    email: 'rodrigo.aquino@outlook.com',
    phoneNumber: '+63 927 123 4567',
    location: 'Parañaque City, Philippines',
    submissionDate: '2024-03-11',
    lastActive: '4 days ago',
    status: RegistrationStatus.FURTHER_INFO,
    idDocumentUrl: 'https://picsum.photos/seed/rodrigo/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/rodrigo-tax/600/400',
    // No registrationId - doesn't want to verify holdings
  },
  {
    id: '206678',
    fullName: 'Stephanie Marie Ocampo',
    email: 'stephanie.ocampo@gmail.com',
    phoneNumber: '+63 928 234 5678',
    location: 'Muntinlupa City, Philippines',
    submissionDate: '2024-03-12',
    lastActive: '5 days ago',
    status: RegistrationStatus.REJECTED,
    idDocumentUrl: 'https://picsum.photos/seed/stephanie/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/stephanie-tax/600/400',
    // No registrationId - doesn't want to verify holdings
  },
  {
    id: '206901',
    fullName: 'Antonio Luis Fernandez',
    email: 'antonio.fernandez@yahoo.com',
    phoneNumber: '+63 929 345 6789',
    location: 'San Juan City, Philippines',
    submissionDate: '2024-03-13',
    lastActive: '1 week ago',
    status: RegistrationStatus.APPROVED,
    idDocumentUrl: 'https://picsum.photos/seed/antonio/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/antonio-tax/600/400',
    // No registrationId - doesn't want to verify holdings
  },
  {
    id: '207234',
    fullName: 'Lourdes Isabel Gutierrez',
    email: 'lourdes.gutierrez@gmail.com',
    phoneNumber: '+63 930 456 7890',
    location: 'Malabon City, Philippines',
    submissionDate: '2024-03-14',
    lastActive: '2 weeks ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/lourdes-isabel/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/lourdes-isabel-tax/600/400',
    // No registrationId - doesn't want to verify holdings
  },
  {
    id: '207567',
    fullName: 'Emmanuel David Navarro',
    email: 'emmanuel.navarro@outlook.com',
    phoneNumber: '+63 931 567 8901',
    location: 'Navotas City, Philippines',
    submissionDate: '2024-03-15',
    lastActive: '3 weeks ago',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: 'https://picsum.photos/seed/emmanuel/600/400',
    taxDocumentUrl: 'https://picsum.photos/seed/emmanuel-tax/600/400',
    // No registrationId - doesn't want to verify holdings
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
    case '201890': { // Miguel Santos
      next = setWantsVerification(next, false);
      break;
    }

    // Scenario 2: Step 1: Yes, but no Step 2 submission yet (Registration Pending)
    case '202123': { // Lourdes Mendoza (PLDT)
      next = setWantsVerification(next, true);
      // No Step 2 submission - user agreed but hasn't submitted info yet
      break;
    }

    // Scenario 3: Step 1: Yes + Step 2: Submitted + Step 3: Auto check passed (Awaiting IRO Review)
    // Event-driven: submitShareholdingInfo automatically runs Step 3 verification
    case '201234': { // Fernando Reyes (BDO) - matching record
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '201234',
        companyName: 'BDO UNIBANK INC.',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS); // Pass shareholders for automatic verification
      break;
    }

    // Scenario 4: Step 1: Yes + Step 2: Submitted + Step 3: Auto check failed (Auto Check Failed)
    // Event-driven: submitShareholdingInfo automatically runs Step 3 verification
    case '201567': { // Cristina Villanueva (Metrobank) - wrong company name
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '201567',
        companyName: 'METROBANKK', // intentional mismatch
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS); // Pass shareholders for automatic verification
      break;
    }

    // Scenario 5: Step 1-4: Passed + Step 5: IRO approved -> VERIFIED (Phase 3 / Step 6)
    // Event-driven: submitShareholdingInfo automatically runs Step 4 verification
    case '199876': { // Ana Patricia Tan (Jollibee)
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '199876',
        companyName: 'JOLLIBEE FOODS CORPORATION',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS); // Pass shareholders for automatic verification
      next = recordManualReview(next, true); // IRO approved
      break;
    }

    // Scenario 6: Step 1-3: Failed 3 times (Locked 7 Days)
    // Event-driven: submitShareholdingInfo automatically runs Step 3 verification
    // For demo, we manually trigger 3 failed attempts to show lockout state
    case '202456': { // Ricardo Lim (Globe) - will be locked
      next = setWantsVerification(next, true);
      // First submission (will fail)
      next = submitShareholdingInfo(next, {
        shareholdingsId: '202456',
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
    case '202388': { // Maria Consuelo Ayala (Ayala Corporation)
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '202388',
        companyName: 'AYALA CORPORATION',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS); // Pass shareholders for automatic verification
      // Step 4 not done yet - awaiting IRO review
      break;
    }

    // Scenario 8: Step 1: Yes, but no Step 2 submission yet (Registration Pending) - Norelyn A. Golingan
    case '203012': { // Norelyn A. Golingan
      next = setWantsVerification(next, true);
      // No Step 2 submission - user agreed but hasn't submitted info yet
      break;
    }

    // New accounts - 7 trying to verify shareholdings
    // Scenario 9: Step 1: Yes + Step 2: Submitted + Step 3: Auto check passed (Awaiting IRO Review)
    case '203345': { // Jose Maria Bautista
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '123456',
        companyName: 'SM INVESTMENTS CORPORATION',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS);
      break;
    }

    // Scenario 10: Step 1: Yes + Step 2: Submitted + Step 3: Auto check passed (Awaiting IRO Review)
    case '203678': { // Maria Elena Ramos
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '234567',
        companyName: 'AYALA CORPORATION',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS);
      break;
    }

    // Scenario 11: Step 1: Yes + Step 2: Submitted + Step 3: Auto check failed (Resubmission Required)
    case '203901': { // Carlos Antonio Villanueva
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '345678',
        companyName: 'WRONG COMPANY NAME', // Intentional mismatch
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS);
      break;
    }

    // Scenario 12: Step 1: Yes + Step 2: Submitted + Step 3: Auto check passed + Step 4: IRO approved -> VERIFIED
    case '204234': { // Angela Grace Santos
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '456789',
        companyName: 'SAN MIGUEL CORPORATION',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS);
      next = recordManualReview(next, true); // IRO approved
      // Create holdings record for verified account
      const smcShareholder = MOCK_SHAREHOLDERS.find(sh => sh.name === 'SAN MIGUEL CORPORATION');
      if (smcShareholder) {
        next = {
          ...next,
          status: RegistrationStatus.APPROVED,
          holdingsRecord: {
            companyId: smcShareholder.id,
            companyName: smcShareholder.name,
            sharesHeld: Math.floor(Math.random() * 500000) + 100000, // Random shares between 100k-600k
            ownershipPercentage: Math.random() * 5 + 1, // Random percentage between 1-6%
            sharesClass: smcShareholder.accountType,
            registrationDate: next.submissionDate,
          },
        };
      }
      break;
    }

    // Scenario 13: Step 1: Yes, but no Step 2 submission yet (Registration Pending)
    case '204567': { // Rafael Domingo Cruz
      next = setWantsVerification(next, true);
      // No Step 2 submission - user agreed but hasn't submitted info yet
      break;
    }

    // Scenario 14: Step 1: Yes + Step 2: Submitted + Step 3: Auto check passed (Awaiting IRO Review)
    case '204890': { // Patricia Ann Reyes
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '678901',
        companyName: 'JOLLIBEE FOODS CORPORATION',
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS);
      break;
    }

    // Scenario 15: Step 1: Yes + Step 2: Submitted + Step 3: Failed 3 times (Locked 7 Days)
    case '205123': { // Michael Angelo Torres
      next = setWantsVerification(next, true);
      next = submitShareholdingInfo(next, {
        shareholdingsId: '789012',
        companyName: 'INVALID COMPANY', // Intentional mismatch
        country: 'Philippines',
      }, MOCK_SHAREHOLDERS);
      // Simulate 3 failed attempts to reach lockout threshold
      if (next.shareholdingsVerification) {
        const lockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        next = {
          ...next,
          shareholdingsVerification: {
            ...next.shareholdingsVerification,
            step3: {
              ...next.shareholdingsVerification.step3,
              failedAttempts: 3,
              lockedUntil,
            },
          },
        };
      }
      break;
    }

    // New accounts - 8 with various scenarios (no registration IDs - just want accounts)
    // Scenario 16: Step 1 decision: No (Unverified - didn't want to verify)
    case '205456': { // Catherine Rose Garcia
      next = setWantsVerification(next, false);
      break;
    }

    // Scenario 17: Step 1 decision: No (Unverified - didn't want to verify)
    case '205789': { // Francisco Javier Mendoza
      next = setWantsVerification(next, false);
      break;
    }

    // Scenario 18: Step 1 decision: No (Unverified - didn't want to verify)
    case '206012': { // Jennifer Lynn Dela Cruz
      next = setWantsVerification(next, false);
      break;
    }

    // Scenario 19: Step 1: Yes, but no Step 2 submission yet (Registration Pending)
    case '206345': { // Rodrigo Sebastian Aquino
      next = setWantsVerification(next, true);
      // No Step 2 submission - user agreed but hasn't submitted info yet
      break;
    }

    // Scenario 20: Step 1 decision: No (Unverified - didn't want to verify)
    case '206678': { // Stephanie Marie Ocampo
      next = setWantsVerification(next, false);
      break;
    }

    // Scenario 21: Step 1 decision: No (Unverified - didn't want to verify)
    case '206901': { // Antonio Luis Fernandez
      next = setWantsVerification(next, false);
      break;
    }

    // Scenario 22: Step 1 decision: No (Unverified - didn't want to verify)
    case '207234': { // Lourdes Isabel Gutierrez
      next = setWantsVerification(next, false);
      break;
    }

    // Scenario 23: Step 1 decision: No (Unverified - didn't want to verify)
    case '207567': { // Emmanuel David Navarro
      next = setWantsVerification(next, false);
      break;
    }

    default:
      // For other users, ensure they have workflow but don't force any specific state
      // They'll show as "Not Started" or default states
      break;
  }

  return next;
});

