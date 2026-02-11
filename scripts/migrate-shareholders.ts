/**
 * Migration script to upload mock shareholders data to Firebase
 * Run this once to migrate MOCK_SHAREHOLDERS to Firestore
 * 
 * Usage: Import and call this function from browser console or a component
 */

import { MOCK_SHAREHOLDERS } from '../lib/mockShareholders';
import { batchService } from '../lib/firestore-service';

/**
 * Migrate mock shareholders to Firestore
 * This will upload all shareholders from MOCK_SHAREHOLDERS to the shareholders collection
 */
export async function migrateShareholdersToFirebase(): Promise<void> {
  try {
    console.log('Starting shareholders migration...');
    console.log(`Migrating ${MOCK_SHAREHOLDERS.length} shareholders...`);
    
    await batchService.migrateShareholders(MOCK_SHAREHOLDERS);
    
    console.log('✅ Successfully migrated all shareholders to Firebase!');
    console.log(`Total shareholders migrated: ${MOCK_SHAREHOLDERS.length}`);
  } catch (error) {
    console.error('❌ Error migrating shareholders:', error);
    throw error;
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).migrateShareholders = migrateShareholdersToFirebase;
}



