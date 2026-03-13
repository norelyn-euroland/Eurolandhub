/**
 * Investor Service
 * Handles saving investors to Firestore based on contact information
 */

import { ExtractedInvestor } from './investor-extractor.js';
import { Shareholder, Applicant, RegistrationStatus, WorkflowStage, AccountStatus, SystemStatus, OfficialShareholder, ShareholderStatusType } from './types.js';
import { officialShareholderService, applicantService } from './firestore-service.js';
import { addHoldingsUpdateTimestamp, addHoldingsUpdateSnapshot } from './holdings-update-logger.js';

export interface SaveInvestorResult {
  shareholderId: string;
  applicantId?: string;
}

export interface SaveInvestorError {
  investorName: string;
  holdingId: string;
  error: string;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Parse numeric string to number, removing commas and percentage signs
 */
export function parseNumeric(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Remove commas, percentage signs, and other non-numeric characters except decimal point
  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extract first name from full name
 */
function extractFirstName(fullName: string): string | undefined {
  if (!fullName || fullName.trim() === '') return undefined;
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 0 ? parts[0] : undefined;
}

/**
 * Convert ExtractedInvestor to Shareholder (legacy - kept for backward compatibility)
 */
function investorToShareholder(investor: ExtractedInvestor): Shareholder {
  return {
    id: investor.holdingId,
    name: investor.investorName,
    firstName: extractFirstName(investor.investorName),
    holdings: parseNumeric(investor.holdings),
    stake: parseNumeric(investor.stake),
    rank: 0, // Will be calculated later
    coAddress: investor.coAddress || '',
    country: investor.country || '',
    accountType: investor.accountType || '',
  };
}

// Total shares outstanding for ownership percentage calculation
const TOTAL_SHARES_OUTSTANDING = 25_381_100;

/**
 * Calculate ownership percentage from holdings
 */
function calculateOwnershipPercentage(holdings: number): number | undefined {
  if (!holdings || holdings <= 0) return undefined;
  return (holdings / TOTAL_SHARES_OUTSTANDING) * 100;
}

/**
 * Convert ExtractedInvestor to OfficialShareholder
 * This is the new consolidated format - all IRO uploads go here
 * updatedAt reflects when IRO first uploaded the information or when pre-verified account was created
 */
function investorToOfficialShareholder(investor: ExtractedInvestor, hasEmail: boolean, uploadDate?: string): OfficialShareholder {
  const now = uploadDate || new Date().toISOString(); // Use provided upload date or current time
  const status: ShareholderStatusType = hasEmail ? 'PRE-VERIFIED' : 'NULL';
  const holdings = parseNumeric(investor.holdings) || undefined;
  
  return {
    id: investor.holdingId,
    name: investor.investorName,
    firstName: extractFirstName(investor.investorName),
    // Contact information
    email: investor.email && investor.email.trim() ? investor.email.trim() : undefined,
    phone: investor.phone && investor.phone.trim() ? investor.phone.trim() : undefined,
    country: investor.country || undefined,
    coAddress: investor.coAddress || undefined,
    // Status and ranking
    status,
    rank: 0, // Will be calculated later
    // Holdings information
    holdings,
    ownershipPercentage: calculateOwnershipPercentage(holdings || 0), // Computed from holdings
    accountType: investor.accountType || undefined,
    // Timestamps - both set to IRO upload date or pre-verified account creation date
    createdAt: now,
    updatedAt: now, // Reflects when IRO uploaded, not when record was last modified
  };
}

/**
 * Generate unique ID
 */
function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert ExtractedInvestor to Applicant (for pre-verified accounts)
 */
function investorToApplicant(investor: ExtractedInvestor): Applicant {
  const now = new Date();
  const applicantId = generateUniqueId(); // Generate unique ID to avoid conflicts with holdingId
  
  return {
    id: applicantId,
    fullName: investor.investorName,
    email: investor.email.trim(),
    phoneNumber: investor.phone && investor.phone.trim() ? investor.phone.trim() : undefined,
    location: investor.country || undefined,
    submissionDate: now.toISOString().split('T')[0],
    lastActive: 'Just now',
    status: RegistrationStatus.PENDING,
    idDocumentUrl: '',
    taxDocumentUrl: '',
    // Pre-verified workflow fields
    workflowStage: 'SEND_EMAIL' as WorkflowStage, // IRO has saved but not sent email yet
    accountStatus: 'PENDING' as AccountStatus,
    systemStatus: 'NULL' as SystemStatus, // NULL status for SEND_EMAIL stage
    statusInFrontend: '', // Empty for SEND_EMAIL stage
    isPreVerified: true, // Flag indicating manual provisioning origin
    registrationId: investor.holdingId, // Store registration ID for display
  };
}

/**
 * Validate investor data
 */
function validateInvestor(investor: ExtractedInvestor): { valid: boolean; error?: string } {
  // Required fields
  if (!investor.holdingId || investor.holdingId.trim() === '') {
    return { valid: false, error: 'Registration ID (Holding ID) is required' };
  }
  
  if (!investor.investorName || investor.investorName.trim() === '') {
    return { valid: false, error: 'Investor Name is required' };
  }
  
  // Validate email format if email exists
  if (investor.email && investor.email.trim() !== '') {
    if (!isValidEmail(investor.email)) {
      return { valid: false, error: 'Invalid email format' };
    }
  }
  
  return { valid: true };
}

/**
 * Save investor to Firestore
 * 
 * Logic:
 * - All IRO uploads go directly to officialShareholders collection (consolidated)
 * - If email exists: Also save to applicants collection (pre-verified account)
 * - Status: NULL (no email), PRE-VERIFIED (has email), VERIFIED (account claimed)
 * 
 * @param investor - The investor data to save
 * @returns Promise with shareholder ID and optional applicant ID
 */
export async function saveInvestor(investor: ExtractedInvestor): Promise<SaveInvestorResult> {
  // Validate investor data
  const validation = validateInvestor(investor);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid investor data');
  }
  
  const hasEmail = investor.email && investor.email.trim() !== '';
  
  try {
    // Check if official shareholder already exists
    const existingOfficialShareholder = await officialShareholderService.getById(investor.holdingId);
    const isUpdate = !!existingOfficialShareholder;
    
    // Determine the upload/creation date:
    // - For new records: use current time (IRO is uploading now)
    // - For updates: preserve original createdAt/updatedAt (when IRO first uploaded)
    // - If pre-verified account exists: use its submissionDate
    let uploadDate: string | undefined;
    if (hasEmail) {
      try {
        const allApplicants = await applicantService.getAll();
        const existingApplicant = allApplicants.find(a => 
          a.email && a.email.toLowerCase() === investor.email.toLowerCase().trim()
        );
        if (existingApplicant?.submissionDate) {
          uploadDate = existingApplicant.submissionDate; // Use pre-verified account creation date
        }
      } catch (error) {
        // If we can't find applicant, use current time
      }
    }
    
    // Always save to officialShareholders collection (consolidated - replaces shareholders)
    const officialShareholder = investorToOfficialShareholder(investor, hasEmail, uploadDate);
    
    if (isUpdate) {
      // Update existing official shareholder (preserve original timestamps and status)
      const updateData: Partial<OfficialShareholder> = {
        // Update contact information
        name: officialShareholder.name,
        firstName: officialShareholder.firstName,
        email: officialShareholder.email,
        phone: officialShareholder.phone,
        country: officialShareholder.country,
        coAddress: officialShareholder.coAddress,
        // Update holdings and computed ownership percentage
        holdings: officialShareholder.holdings,
        ownershipPercentage: officialShareholder.ownershipPercentage,
        accountType: officialShareholder.accountType,
        // Preserve original timestamps (when IRO first uploaded)
        createdAt: existingOfficialShareholder.createdAt,
        updatedAt: existingOfficialShareholder.updatedAt, // Keep original upload date
        // Preserve status and links
        status: existingOfficialShareholder.status,
        applicantId: existingOfficialShareholder.applicantId,
        emailSentAt: existingOfficialShareholder.emailSentAt,
        accountClaimedAt: existingOfficialShareholder.accountClaimedAt,
      };
      await officialShareholderService.update(officialShareholder.id, updateData);
    } else {
      // Create new official shareholder (timestamps set to IRO upload date or pre-verified account creation)
      await officialShareholderService.create(officialShareholder);
    }
    
    // Keep shareholder reference for applicant creation (legacy compatibility)
    const shareholder = investorToShareholder(investor);
    
    const result: SaveInvestorResult = {
      shareholderId: officialShareholder.id,
    };
    
    // If email exists, also save to applicants collection (pre-verified account)
    if (hasEmail) {
      const applicant = investorToApplicant(investor);
      
      // Check if applicant with this email already exists
      try {
        // Try to find existing applicant by email
        const allApplicants = await applicantService.getAll();
        const existingApplicant = allApplicants.find(a => 
          a.email && a.email.toLowerCase() === investor.email.toLowerCase().trim()
        );
        
        if (existingApplicant) {
          // Update existing applicant with pre-verified fields
          const applicantUpdate: Partial<Applicant> = {
            ...applicant,
            id: existingApplicant.id, // Keep existing ID
          };
          
          // If this is an update (existing shareholder), update holdingsRecord and log timestamp
          // Also update holdingsRecord for pre-verified accounts even if it's a new shareholder entry
          const isPreVerifiedAccount = applicant.isPreVerified === true || existingApplicant.isPreVerified === true;
          if (isUpdate || isPreVerifiedAccount) {
            // Calculate ownership percentage from holdings and stake
            const totalSharesOutstanding = 25_381_100; // Fixed value from issuer
            const holdings = parseNumeric(investor.holdings || '0');
            const ownershipPercent = holdings > 0 ? (holdings / totalSharesOutstanding) * 100 : 0;
            
            // Update or create holdingsRecord to match shareholder data
            applicantUpdate.holdingsRecord = {
              companyId: shareholder.id,
              companyName: shareholder.name,
              sharesHeld: holdings,
              ownershipPercentage: ownershipPercent,
              sharesClass: shareholder.accountType || 'Ordinary',
              registrationDate: existingApplicant.holdingsRecord?.registrationDate || existingApplicant.submissionDate || new Date().toISOString(),
            };
            
            // Log snapshot to holdings update history (only if this is an actual update, not initial creation)
            if (isUpdate && existingApplicant.holdingsRecord) {
              const previousSharesHeld = existingApplicant.holdingsRecord.sharesHeld || 0;
              const newSharesHeld = holdings;
              
              // Only log if shares actually changed
              if (previousSharesHeld !== newSharesHeld) {
                applicantUpdate.holdingsUpdateHistory = addHoldingsUpdateSnapshot(
                  existingApplicant.holdingsUpdateHistory,
                  previousSharesHeld,
                  newSharesHeld,
                  'IRO'
                );
              }
            }
          }
          
          await applicantService.update(existingApplicant.id, applicantUpdate);
          result.applicantId = existingApplicant.id;
          
          // Update official shareholder with applicant link
          try {
            await officialShareholderService.update(officialShareholder.id, {
              applicantId: existingApplicant.id,
              status: 'PRE-VERIFIED' as ShareholderStatusType,
            });
          } catch (syncError) {
            console.error('Error updating official shareholder with applicant link:', syncError);
          }
        } else {
          // Create new applicant
          // For pre-verified accounts, set holdingsRecord from shareholder data if available
          const holdings = parseNumeric(investor.holdings || '0');
          if (holdings > 0) {
            const totalSharesOutstanding = 25_381_100; // Fixed value from issuer
            const ownershipPercent = (holdings / totalSharesOutstanding) * 100;
            
            applicant.holdingsRecord = {
              companyId: shareholder.id,
              companyName: shareholder.name,
              sharesHeld: holdings,
              ownershipPercentage: ownershipPercent,
              sharesClass: shareholder.accountType || 'Ordinary',
              registrationDate: new Date().toISOString(),
            };
          }
          
          await applicantService.create(applicant);
          result.applicantId = applicant.id;
          
          // Update official shareholder with applicant link
          try {
            await officialShareholderService.update(officialShareholder.id, {
              applicantId: applicant.id,
              status: 'PRE-VERIFIED' as ShareholderStatusType,
            });
          } catch (syncError) {
            console.error('Error updating official shareholder with applicant link:', syncError);
          }
        }
      } catch (error: any) {
        // If there's an error creating/updating applicant, log it but don't fail the whole operation
        console.error('Error saving applicant for investor:', investor.investorName, error);
        // Continue without applicant ID - shareholder was saved successfully
      }
    }
    
    return result;
  } catch (error: any) {
    console.error('Error saving investor:', error);
    throw new Error(`Failed to save investor ${investor.investorName}: ${error.message}`);
  }
}

/**
 * Save multiple investors
 * 
 * @param investors - Array of investors to save
 * @returns Promise with results and errors
 */
export async function saveInvestors(
  investors: ExtractedInvestor[]
): Promise<{
  success: SaveInvestorResult[];
  errors: SaveInvestorError[];
}> {
  const success: SaveInvestorResult[] = [];
  const errors: SaveInvestorError[] = [];
  
  for (const investor of investors) {
    try {
      const result = await saveInvestor(investor);
      success.push(result);
    } catch (error: any) {
      errors.push({
        investorName: investor.investorName,
        holdingId: investor.holdingId,
        error: error.message || 'Unknown error',
      });
    }
  }
  
  return { success, errors };
}

/**
 * Update existing investor with only editable fields
 * Only updates: Holdings (ownershipPercentage is computed automatically)
 * Note: Ownership % is calculated from holdings: (holdings / totalSharesOutstanding) * 100
 * Also automatically updates applicant's holdingsRecord if an applicant exists
 * Preserves original updatedAt timestamp (when IRO first uploaded)
 * 
 * @param holdingId - The holding ID of the investor to update
 * @param updates - Partial shareholder data with only editable fields
 * @returns Promise<void>
 */
export async function updateExistingInvestor(
  holdingId: string,
  updates: { ownershipPercent?: string; holdings?: string; stake?: string }
): Promise<void> {
  if (!holdingId || holdingId.trim() === '') {
    throw new Error('Holding ID is required');
  }

  try {
    // Check if official shareholder exists
    const existingOfficialShareholder = await officialShareholderService.getById(holdingId);
    if (!existingOfficialShareholder) {
      throw new Error(`Shareholder with ID ${holdingId} not found`);
    }

    // Prepare update data with only editable fields converted to numbers
    const updateData: Partial<OfficialShareholder> = {};
    
    // Only update holdings (ownershipPercentage is computed automatically)
    if (updates.holdings !== undefined) {
      const updatedHoldings = parseNumeric(updates.holdings);
      updateData.holdings = updatedHoldings;
      // Calculate ownership percentage from holdings
      updateData.ownershipPercentage = calculateOwnershipPercentage(updatedHoldings);
    }
    
    // Note: stake parameter is deprecated but kept for backward compatibility
    // ownershipPercentage is now computed from holdings, not from stake

    // Only update if there are actual changes
    if (Object.keys(updateData).length === 0) {
      return; // No updates to make
    }

    // Preserve original timestamps (don't change updatedAt when updating holdings)
    // updatedAt should remain as when IRO first uploaded the information
    updateData.createdAt = existingOfficialShareholder.createdAt;
    updateData.updatedAt = existingOfficialShareholder.updatedAt;

    // Update official shareholder with only the editable fields
    await officialShareholderService.update(holdingId, updateData);

    // Also update applicant's holdingsRecord if an applicant exists for this shareholder
    // Find applicant by registrationId (holdingId) or by matching shareholder data
    try {
      const allApplicants = await applicantService.getAll();
      const matchingApplicant = allApplicants.find(a => 
        a.registrationId === holdingId || 
        (a.email && existingOfficialShareholder.name && a.fullName === existingOfficialShareholder.name)
      );

      if (matchingApplicant) {
        // Calculate ownership percentage from updated holdings
        const updatedHoldings = updateData.holdings !== undefined 
          ? updateData.holdings 
          : existingOfficialShareholder.holdings || 0;
        const ownershipPercent = calculateOwnershipPercentage(updatedHoldings) || 0;

        // Update applicant's holdingsRecord to match updated shareholder data
        const applicantUpdate: Partial<Applicant> = {
          holdingsRecord: {
            companyId: holdingId,
            companyName: existingOfficialShareholder.name,
            sharesHeld: updatedHoldings,
            ownershipPercentage: ownershipPercent,
            sharesClass: existingOfficialShareholder.accountType || matchingApplicant.holdingsRecord?.sharesClass || 'Ordinary',
            registrationDate: matchingApplicant.holdingsRecord?.registrationDate || matchingApplicant.submissionDate || new Date().toISOString(),
          },
        };

        // Log snapshot to holdings update history if holdings actually changed
        if (updateData.holdings !== undefined && matchingApplicant.holdingsRecord) {
          const previousSharesHeld = matchingApplicant.holdingsRecord.sharesHeld || 0;
          const newSharesHeld = updatedHoldings;
          
          // Only log if shares actually changed
          if (previousSharesHeld !== newSharesHeld) {
            applicantUpdate.holdingsUpdateHistory = addHoldingsUpdateSnapshot(
              matchingApplicant.holdingsUpdateHistory,
              previousSharesHeld,
              newSharesHeld,
              'IRO'
            );
          }
        }

        await applicantService.update(matchingApplicant.id, applicantUpdate);
        console.log(`Updated applicant holdingsRecord for ${matchingApplicant.id} to match shareholder ${holdingId}`);
      }
    } catch (applicantUpdateError) {
      // Log error but don't fail the shareholder update
      console.warn('Error updating applicant holdingsRecord after shareholder update:', applicantUpdateError);
    }
  } catch (error: any) {
    console.error('Error updating existing investor:', error);
    throw new Error(`Failed to update investor ${holdingId}: ${error.message}`);
  }
}

