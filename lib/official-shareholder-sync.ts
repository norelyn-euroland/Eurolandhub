/**
 * Official Shareholder Sync Utility
 * 
 * Syncs official shareholders collection when:
 * - Pre-verified accounts are created
 * - Accounts are claimed
 * - Account status changes
 * - Investors are added via batch upload
 */

import { Applicant, OfficialShareholder, ShareholderStatusType } from './types.js';
import { officialShareholderService, applicantService } from './firestore-service.js';
import { RegistrationStatus } from './types.js';

/**
 * Sync official shareholder when pre-verified account is created
 */
export async function syncOfficialShareholderOnCreate(applicant: Applicant): Promise<void> {
  if (!applicant.isPreVerified || !applicant.registrationId) {
    return; // Only sync pre-verified accounts with registration ID
  }

  try {
    const now = new Date().toISOString();
    const status: ShareholderStatusType = applicant.email ? 'PRE-VERIFIED' : 'NULL';

    const officialShareholder: OfficialShareholder = {
      id: applicant.registrationId,
      name: applicant.fullName,
      email: applicant.email || undefined,
      phone: applicant.phoneNumber || undefined,
      country: applicant.location || undefined,
      status,
      applicantId: applicant.id,
      createdAt: now,
      updatedAt: now,
      emailSentAt: applicant.emailSentAt || undefined,
    };

    await officialShareholderService.upsert(officialShareholder);
    console.log(`Synced official shareholder on create: ${applicant.registrationId} (${status})`);
  } catch (error) {
    console.error('Error syncing official shareholder on create:', error);
    // Don't throw - this is a sync operation, shouldn't block main flow
  }
}

/**
 * Sync official shareholder when account is claimed.
 *
 * Uses upsert (not update) so the record is created if it somehow doesn't exist yet,
 * preventing silent failures when the officialShareholders document is missing.
 */
export async function syncOfficialShareholderOnClaim(applicant: Applicant): Promise<void> {
  if (!applicant.isPreVerified || !applicant.registrationId) {
    return;
  }

  try {
    const now = new Date().toISOString();

    // Fetch existing record to preserve fields like holdings, stake, etc.
    const existing = await officialShareholderService.getById(applicant.registrationId);

    // Build the full record in case it needs to be created from scratch
    const record: OfficialShareholder = {
      id: applicant.registrationId,
      name: existing?.name || applicant.fullName,
      email: applicant.email || existing?.email || undefined,
      phone: applicant.phoneNumber || existing?.phone || undefined,
      country: applicant.location || existing?.country || undefined,
      status: 'VERIFIED',
      applicantId: applicant.id,
      holdings: existing?.holdings || undefined,
      stake: existing?.stake || undefined,
      accountType: existing?.accountType || undefined,
      createdAt: existing?.createdAt || applicant.submissionDate || now,
      updatedAt: now,
      emailSentAt: existing?.emailSentAt || applicant.emailSentAt || undefined,
      accountClaimedAt: applicant.accountClaimedAt || now,
    };

    // Upsert ensures the record is created even if it was never seeded
    await officialShareholderService.upsert(record);

    console.log(`Synced official shareholder on claim: ${applicant.registrationId} (PRE-VERIFIED → VERIFIED)`);
  } catch (error) {
    console.error('Error syncing official shareholder on claim:', error);
    // Don't throw - this is a sync operation
  }
}

/**
 * Sync official shareholder when account status changes
 */
export async function syncOfficialShareholderOnStatusChange(applicant: Applicant): Promise<void> {
  if (!applicant.isPreVerified || !applicant.registrationId) {
    return;
  }

  try {
    const now = new Date().toISOString();
    let status: ShareholderStatusType = 'NULL';

    // Determine status based on applicant state
    if (applicant.status === RegistrationStatus.APPROVED && applicant.accountClaimedAt) {
      status = 'VERIFIED';
    } else if (applicant.email) {
      status = 'PRE-VERIFIED';
    } else {
      status = 'NULL';
    }

    await officialShareholderService.update(applicant.registrationId, {
      status,
      applicantId: applicant.id,
      email: applicant.email || undefined,
      phone: applicant.phoneNumber || undefined,
      country: applicant.location || undefined,
      updatedAt: now,
      accountClaimedAt: applicant.accountClaimedAt || undefined,
    });

    console.log(`Synced official shareholder on status change: ${applicant.registrationId} (${status})`);
  } catch (error) {
    console.error('Error syncing official shareholder on status change:', error);
    // Don't throw - this is a sync operation
  }
}

/**
 * Sync verified frontend applicant to official shareholders
 * Called when a frontend-registered applicant gets verified (status = APPROVED)
 * This transfers them to the official shareholders collection because their shareholdings are confirmed
 */
export async function syncVerifiedApplicantToOfficialShareholders(applicant: Applicant): Promise<void> {
  // Only sync if applicant is verified (APPROVED status)
  if (applicant.status !== RegistrationStatus.APPROVED) {
    return;
  }

  // Skip if already pre-verified (handled by other sync functions)
  if (applicant.isPreVerified) {
    return;
  }

  try {
    const now = new Date().toISOString();
    
    // Get registration ID from shareholdings verification or use applicant ID
    const registrationId = applicant.shareholdingsVerification?.step2?.shareholdingsId || 
                          applicant.registrationId || 
                          applicant.id;

    // Check if this investor exists in official shareholders collection
    let existingOfficialShareholder: OfficialShareholder | null = null;
    try {
      existingOfficialShareholder = await officialShareholderService.getById(registrationId);
    } catch (error) {
      // If not found by ID, try to find by name/email match
      const allOfficialShareholders = await officialShareholderService.getAll({ limitCount: 10000 });
      existingOfficialShareholder = allOfficialShareholders.find(sh => 
        sh.name === applicant.fullName ||
        (sh.name && applicant.fullName && sh.name.toLowerCase() === applicant.fullName.toLowerCase())
      ) || null;
    }

    // Create or update official shareholder record
    const officialShareholder: OfficialShareholder = {
      id: registrationId,
      name: applicant.fullName,
      firstName: existingOfficialShareholder?.firstName,
      email: applicant.email || undefined,
      phone: applicant.phoneNumber || undefined,
      country: applicant.location || undefined,
      coAddress: existingOfficialShareholder?.coAddress,
      rank: existingOfficialShareholder?.rank,
      status: 'VERIFIED', // Verified applicants are always VERIFIED
      applicantId: applicant.id,
      holdings: existingOfficialShareholder?.holdings || applicant.holdingsRecord?.sharesHeld || undefined,
      ownershipPercentage: existingOfficialShareholder?.ownershipPercentage || applicant.holdingsRecord?.ownershipPercentage || (existingOfficialShareholder?.holdings || applicant.holdingsRecord?.sharesHeld ? ((existingOfficialShareholder?.holdings || applicant.holdingsRecord?.sharesHeld || 0) / 25_381_100) * 100 : undefined),
      accountType: existingOfficialShareholder?.accountType || applicant.holdingsRecord?.sharesClass || undefined,
      createdAt: existingOfficialShareholder?.createdAt || applicant.submissionDate || now,
      updatedAt: existingOfficialShareholder?.updatedAt || applicant.submissionDate || now, // Preserve original upload date
      accountClaimedAt: applicant.shareholdingsVerification?.step6?.verifiedAt || now,
      emailSentAt: existingOfficialShareholder?.emailSentAt || applicant.emailSentAt,
    };

    await officialShareholderService.upsert(officialShareholder);
    console.log(`Synced verified applicant to official shareholders: ${applicant.id} → ${registrationId} (VERIFIED)`);
  } catch (error) {
    console.error('Error syncing verified applicant to official shareholders:', error);
    // Don't throw - this is a sync operation, shouldn't block main flow
  }
}

/**
 * Create official shareholder from masterlist shareholder (for no-contact investors)
 */
export async function createOfficialShareholderFromMasterlist(
  shareholderId: string,
  name: string,
  email?: string,
  phone?: string,
  country?: string,
  holdings?: number,
  stake?: number,
  accountType?: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const status: ShareholderStatusType = email ? 'PRE-VERIFIED' : 'NULL';

    const officialShareholder: OfficialShareholder = {
      id: shareholderId,
      name,
      email: email || undefined,
      phone: phone || undefined,
      country: country || undefined,
      status,
      holdings: holdings || undefined,
      stake: stake || undefined,
      accountType: accountType || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await officialShareholderService.upsert(officialShareholder);
    console.log(`Created official shareholder from masterlist: ${shareholderId} (${status})`);
  } catch (error) {
    console.error('Error creating official shareholder from masterlist:', error);
    throw error;
  }
}

/**
 * Migrate existing data to official shareholders collection
 * This should be run once to populate the collection from existing applicants and shareholders
 */
export async function migrateToOfficialShareholders(): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  try {
    console.log('Starting migration to official shareholders collection...');

    // Get all applicants
    const applicants = await applicantService.getAll();
    console.log(`Found ${applicants.length} applicants to process`);

    // Get all shareholders from masterlist (legacy collection - will be migrated)
    // Note: After consolidation, this will be empty as all data moves to officialShareholders
    let shareholders: Array<{ id: string; name: string; holdings?: number; stake?: number; accountType?: string; firstName?: string; coAddress?: string; country?: string; rank?: number }> = [];
    try {
      // Try to import shareholderService for migration (backward compatibility)
      const { shareholderService } = await import('./firestore-service.js');
      shareholders = await shareholderService.getAll({ limitCount: 10000 }) as any[];
      console.log(`Found ${shareholders.length} shareholders from masterlist to migrate`);
    } catch (error) {
      console.warn('Shareholders collection not found or already migrated:', error);
    }

    // Process applicants:
    // 1. Pre-verified applicants (IRO created)
    // 2. Verified applicants (frontend-registered, now verified)
    for (const applicant of applicants) {
      try {
        // Case 1: Pre-verified applicants (IRO created)
        if (applicant.isPreVerified && applicant.registrationId) {
          // Determine status
          let status: ShareholderStatusType = 'NULL';
          if (applicant.status === RegistrationStatus.APPROVED && applicant.accountClaimedAt) {
            status = 'VERIFIED';
          } else if (applicant.email) {
            status = 'PRE-VERIFIED';
          }

          // Find matching shareholder data for additional fields
          const matchingShareholder = shareholders.find(sh => sh.id === applicant.registrationId);
          
          const holdings = matchingShareholder?.holdings || applicant.holdingsRecord?.sharesHeld || undefined;
          const ownershipPercentage = holdings ? (holdings / 25_381_100) * 100 : (applicant.holdingsRecord?.ownershipPercentage || undefined);
          
          const officialShareholder: OfficialShareholder = {
            id: applicant.registrationId,
            name: applicant.fullName,
            firstName: matchingShareholder?.firstName,
            email: applicant.email || undefined,
            phone: applicant.phoneNumber || undefined,
            country: applicant.location || undefined,
            coAddress: matchingShareholder?.coAddress,
            rank: matchingShareholder?.rank,
            status,
            applicantId: applicant.id,
            holdings,
            ownershipPercentage,
            accountType: matchingShareholder?.accountType || applicant.holdingsRecord?.sharesClass || undefined,
            createdAt: applicant.submissionDate || new Date().toISOString(),
            updatedAt: applicant.submissionDate || new Date().toISOString(), // Use pre-verified account creation date
            emailSentAt: applicant.emailSentAt || undefined,
            accountClaimedAt: applicant.accountClaimedAt || undefined,
          };

          const existing = await officialShareholderService.getById(applicant.registrationId);
          await officialShareholderService.upsert(officialShareholder);
          
          if (existing) {
            updated++;
          } else {
            created++;
          }
        }
        // Case 2: Verified frontend applicants (not pre-verified, but verified)
        else if (applicant.status === RegistrationStatus.APPROVED && !applicant.isPreVerified) {
          // Get registration ID from shareholdings verification
          const registrationId = applicant.shareholdingsVerification?.step2?.shareholdingsId || 
                                applicant.registrationId || 
                                applicant.id;

          // Check if already exists
          const existing = await officialShareholderService.getById(registrationId);
          
          // Find matching shareholder from masterlist (legacy - for migration only)
          let shareholder: { holdings?: number; stake?: number; accountType?: string; firstName?: string; coAddress?: string; rank?: number } | null = null;
          try {
            const { shareholderService } = await import('./firestore-service.js');
            shareholder = await shareholderService.getById(registrationId) as any;
          } catch (error) {
            // Try to find by name match in shareholders list (if available)
            if (shareholders.length > 0) {
              shareholder = shareholders.find(sh => 
                sh.name === applicant.fullName ||
                (sh.name && applicant.fullName && sh.name.toLowerCase() === applicant.fullName.toLowerCase())
              ) || null;
            }
          }

          const holdings = shareholder?.holdings || applicant.holdingsRecord?.sharesHeld || undefined;
          const ownershipPercentage = holdings ? (holdings / 25_381_100) * 100 : (applicant.holdingsRecord?.ownershipPercentage || undefined);
          
          const officialShareholder: OfficialShareholder = {
            id: registrationId,
            name: applicant.fullName,
            firstName: shareholder?.firstName,
            email: applicant.email || undefined,
            phone: applicant.phoneNumber || undefined,
            country: applicant.location || undefined,
            coAddress: shareholder?.coAddress,
            rank: shareholder?.rank,
            status: 'VERIFIED',
            applicantId: applicant.id,
            holdings,
            ownershipPercentage,
            accountType: shareholder?.accountType || applicant.holdingsRecord?.sharesClass || undefined,
            createdAt: applicant.submissionDate || new Date().toISOString(),
            updatedAt: applicant.submissionDate || new Date().toISOString(), // Use account creation date
            accountClaimedAt: applicant.shareholdingsVerification?.step6?.verifiedAt || undefined,
          };

          await officialShareholderService.upsert(officialShareholder);
          
          if (existing) {
            updated++;
          } else {
            created++;
          }
        }
      } catch (error) {
        console.error(`Error processing applicant ${applicant.id}:`, error);
        errors++;
      }
    }

    // Process shareholders from masterlist that don't have applicant records
    for (const shareholder of shareholders) {
      try {
        const existing = await officialShareholderService.getById(shareholder.id);
        
        // Only create if doesn't exist and has no email (NULL status)
        if (!existing) {
          // Check if there's an applicant with this registration ID
          const matchingApplicant = applicants.find(a => 
            a.registrationId === shareholder.id ||
            (a.email && shareholder.name && a.fullName === shareholder.name)
          );

          if (!matchingApplicant) {
            // This is a NULL status investor (no contact, no account)
            const holdings = shareholder.holdings || undefined;
            const ownershipPercentage = holdings ? (holdings / 25_381_100) * 100 : undefined;
            
            const officialShareholder: OfficialShareholder = {
              id: shareholder.id,
              name: shareholder.name,
              firstName: shareholder.firstName,
              email: undefined,
              phone: undefined,
              country: shareholder.country || undefined,
              coAddress: shareholder.coAddress,
              rank: shareholder.rank,
              status: 'NULL',
              holdings,
              ownershipPercentage,
              accountType: shareholder.accountType || undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await officialShareholderService.upsert(officialShareholder);
            created++;
          }
        }
      } catch (error) {
        console.error(`Error processing shareholder ${shareholder.id}:`, error);
        errors++;
      }
    }

    console.log(`Migration completed: ${created} created, ${updated} updated, ${errors} errors`);
    return { created, updated, errors };
  } catch (error) {
    console.error('Fatal error during migration:', error);
    throw error;
  }
}

