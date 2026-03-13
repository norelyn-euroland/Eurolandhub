/**
 * API Endpoint to sync contact information from applicants to officialShareholders
 * This fixes the issue where officialShareholders might be missing email/contact info
 * that exists in the applicants collection
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { officialShareholderService, applicantService } from '../lib/firestore-service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    console.log('Starting sync of contact information from applicants to officialShareholders...');
    
    // Get all official shareholders and applicants
    const [allOfficialShareholders, allApplicants] = await Promise.all([
      officialShareholderService.getAll({ limitCount: 10000 }),
      applicantService.getAll({ limitCount: 10000 }),
    ]);
    
    console.log(`Found ${allOfficialShareholders.length} official shareholders and ${allApplicants.length} applicants`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const officialShareholder of allOfficialShareholders) {
      try {
        let needsUpdate = false;
        const updateData: any = {};

        // Try to find matching applicant by applicantId, email, or registrationId
        let matchingApplicant = null;
        
        if (officialShareholder.applicantId) {
          matchingApplicant = allApplicants.find(a => a.id === officialShareholder.applicantId);
        }
        
        if (!matchingApplicant && officialShareholder.email) {
          matchingApplicant = allApplicants.find(a => 
            a.email && a.email.toLowerCase() === officialShareholder.email.toLowerCase()
          );
        }
        
        if (!matchingApplicant) {
          matchingApplicant = allApplicants.find(a => a.registrationId === officialShareholder.id);
        }

        if (matchingApplicant) {
          // Update contact info from applicant if missing in officialShareholder
          if (!officialShareholder.email && matchingApplicant.email) {
            updateData.email = matchingApplicant.email;
            needsUpdate = true;
          }
          
          if (!officialShareholder.phone && matchingApplicant.phoneNumber) {
            updateData.phone = matchingApplicant.phoneNumber;
            needsUpdate = true;
          }
          
          if (!officialShareholder.country && matchingApplicant.location) {
            updateData.country = matchingApplicant.location;
            needsUpdate = true;
          }
          
          // Ensure applicantId is set
          if (!officialShareholder.applicantId) {
            updateData.applicantId = matchingApplicant.id;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await officialShareholderService.update(officialShareholder.id, updateData);
          updated++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        const errorMsg = `Error syncing contact info for ${officialShareholder.id}: ${error instanceof Error ? error.message : String(error)}`;
        errorDetails.push(errorMsg);
        console.error(errorMsg);
      }
    }

    res.status(200).json({
      success: true,
      message: `Sync completed: ${updated} updated, ${skipped} skipped (already synced), ${errors} errors`,
      stats: {
        total: allOfficialShareholders.length,
        updated,
        skipped,
        errors,
      },
      errors: errors > 0 ? errorDetails : undefined,
    });
  } catch (error) {
    console.error('Error in sync API:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

