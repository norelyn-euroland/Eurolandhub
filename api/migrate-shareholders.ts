/**
 * Migration API Endpoint
 * Migrates all shareholders from the legacy 'shareholders' collection to 'officialShareholders'
 * This consolidates all IRO-uploaded investors into a single collection
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { shareholderService, officialShareholderService } from '../lib/firestore-service.js';
import { OfficialShareholder, ShareholderStatusType } from '../lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    console.log('Starting migration from shareholders to officialShareholders...');
    
    // Get all shareholders from legacy collection
    const shareholders = await shareholderService.getAll({ limitCount: 10000 });
    console.log(`Found ${shareholders.length} shareholders to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const shareholder of shareholders) {
      try {
        // Check if already exists in officialShareholders
        const existing = await officialShareholderService.getById(shareholder.id);
        
        if (existing) {
          // Update existing record with missing fields from legacy collection
          const holdings = existing.holdings || shareholder.holdings || undefined;
          const ownershipPercentage = holdings ? (holdings / 25_381_100) * 100 : existing.ownershipPercentage;
          
          const updateData: Partial<OfficialShareholder> = {
            firstName: existing.firstName || shareholder.firstName,
            coAddress: existing.coAddress || shareholder.coAddress,
            rank: existing.rank || shareholder.rank,
            holdings,
            ownershipPercentage,
            accountType: existing.accountType || shareholder.accountType,
            country: existing.country || shareholder.country,
            // Update status to PRE-VERIFIED if it's currently NULL (migrated investors should be pre-verified)
            status: existing.status === 'NULL' ? 'PRE-VERIFIED' as ShareholderStatusType : existing.status,
            // Preserve original timestamps
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
          };
          
          await officialShareholderService.update(shareholder.id, updateData);
          migrated++;
        } else {
          // Create new official shareholder with PRE-VERIFIED status (IRO-uploaded investors)
          const holdings = shareholder.holdings || undefined;
          const ownershipPercentage = holdings ? (holdings / 25_381_100) * 100 : undefined;
          
          const officialShareholder: OfficialShareholder = {
            id: shareholder.id,
            name: shareholder.name,
            firstName: shareholder.firstName,
            country: shareholder.country || undefined,
            coAddress: shareholder.coAddress || undefined,
            rank: shareholder.rank,
            status: 'PRE-VERIFIED' as ShareholderStatusType, // IRO-uploaded investors are pre-verified
            holdings,
            ownershipPercentage,
            accountType: shareholder.accountType || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(), // IRO upload date
          };

          await officialShareholderService.create(officialShareholder);
          migrated++;
        }
      } catch (error) {
        errors++;
        const errorMsg = `Error migrating shareholder ${shareholder.id}: ${error instanceof Error ? error.message : String(error)}`;
        errorDetails.push(errorMsg);
        console.error(errorMsg);
      }
    }

    res.status(200).json({
      success: true,
      message: `Migration completed: ${migrated} migrated, ${skipped} skipped, ${errors} errors`,
      stats: {
        total: shareholders.length,
        migrated,
        skipped,
        errors,
      },
      errors: errors > 0 ? errorDetails : undefined,
    });
  } catch (error) {
    console.error('Error in migration API:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

