/**
 * Investor Service
 * Handles saving investors to Firestore based on contact information
 */

import { ExtractedInvestor } from './investor-extractor';
import { Shareholder, Applicant, RegistrationStatus, WorkflowStage, AccountStatus, SystemStatus } from './types';
import { shareholderService } from './firestore-service';
import { applicantService } from './firestore-service';

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
function parseNumeric(value: string): number {
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
 * Convert ExtractedInvestor to Shareholder
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
 * - If email exists: Save to both shareholders and applicants collections
 * - If no email: Save only to shareholders collection
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
    // Always save to shareholders collection
    const shareholder = investorToShareholder(investor);
    
    // Check if shareholder already exists
    const existingShareholder = await shareholderService.getById(shareholder.id);
    if (existingShareholder) {
      // Update existing shareholder
      await shareholderService.update(shareholder.id, shareholder);
    } else {
      // Create new shareholder
      await shareholderService.create(shareholder);
    }
    
    const result: SaveInvestorResult = {
      shareholderId: shareholder.id,
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
          await applicantService.update(existingApplicant.id, {
            ...applicant,
            id: existingApplicant.id, // Keep existing ID
          });
          result.applicantId = existingApplicant.id;
        } else {
          // Create new applicant
          await applicantService.create(applicant);
          result.applicantId = applicant.id;
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

