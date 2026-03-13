/**
 * Investor Verification Service
 * Checks if investors exist in the database and returns verification results
 * Now uses officialShareholders collection (consolidated)
 */

import { ExtractedInvestor } from './investor-extractor.js';
import { OfficialShareholder } from './types.js';
import { officialShareholderService } from './firestore-service.js';

export interface VerificationResult {
  existing: Array<{ investor: ExtractedInvestor; existingData: OfficialShareholder }>;
  new: ExtractedInvestor[];
  stats: { existingCount: number; newCount: number; totalCount: number };
}

/**
 * Verify investors against the database
 * Checks if each investor exists in the officialShareholders collection by holdingId
 * 
 * @param investors - Array of investors to verify
 * @returns Promise with verification results
 */
export async function verifyInvestors(
  investors: ExtractedInvestor[]
): Promise<VerificationResult> {
  const existing: Array<{ investor: ExtractedInvestor; existingData: OfficialShareholder }> = [];
  const newInvestors: ExtractedInvestor[] = [];

  // Check each investor against the database
  for (const investor of investors) {
    if (!investor.holdingId || investor.holdingId.trim() === '') {
      // If no holdingId, treat as new investor
      newInvestors.push(investor);
      continue;
    }

    try {
      // Check if official shareholder exists by holdingId
      const existingOfficialShareholder = await officialShareholderService.getById(investor.holdingId);
      
      if (existingOfficialShareholder) {
        // Investor exists in database
        existing.push({
          investor,
          existingData: existingOfficialShareholder,
        });
      } else {
        // Investor is new
        newInvestors.push(investor);
      }
    } catch (error) {
      // On error, treat as new investor (safer approach)
      console.warn(`Error checking investor ${investor.holdingId}:`, error);
      newInvestors.push(investor);
    }
  }

  return {
    existing,
    new: newInvestors,
    stats: {
      existingCount: existing.length,
      newCount: newInvestors.length,
      totalCount: investors.length,
    },
  };
}




