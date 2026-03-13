/**
 * API Endpoint to update NULL status official shareholders to PRE-VERIFIED
 * This updates existing migrated investors that have NULL status to PRE-VERIFIED
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { officialShareholderService } from '../lib/firestore-service.js';
import { ShareholderStatusType } from '../lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    console.log('Starting update of NULL status to PRE-VERIFIED...');
    
    // Get all official shareholders
    const allOfficialShareholders = await officialShareholderService.getAll({ limitCount: 10000 });
    console.log(`Found ${allOfficialShareholders.length} official shareholders to check`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const shareholder of allOfficialShareholders) {
      try {
        // Only update if status is NULL
        if (shareholder.status === 'NULL') {
          await officialShareholderService.update(shareholder.id, {
            status: 'PRE-VERIFIED' as ShareholderStatusType,
            // Preserve all other fields and timestamps
          });
          updated++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        const errorMsg = `Error updating shareholder ${shareholder.id}: ${error instanceof Error ? error.message : String(error)}`;
        errorDetails.push(errorMsg);
        console.error(errorMsg);
      }
    }

    res.status(200).json({
      success: true,
      message: `Update completed: ${updated} updated to PRE-VERIFIED, ${skipped} skipped (already correct status), ${errors} errors`,
      stats: {
        total: allOfficialShareholders.length,
        updated,
        skipped,
        errors,
      },
      errors: errors > 0 ? errorDetails : undefined,
    });
  } catch (error) {
    console.error('Error in update API:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

