/**
 * Holdings Update Logger
 * 
 * Helper functions to log holdings updates to history with snapshots
 */

import { HoldingsUpdateHistoryEntry } from './types.js';

/**
 * Add a new timestamp entry to holdings update history
 * 
 * @param existingHistory - Current history array (or undefined)
 * @returns Updated history array with new timestamp
 */
export function addHoldingsUpdateTimestamp(
  existingHistory?: HoldingsUpdateHistoryEntry[]
): HoldingsUpdateHistoryEntry[] {
  const history = existingHistory || [];
  const newEntry: HoldingsUpdateHistoryEntry = {
    updatedAt: new Date().toISOString(),
  };
  
  // Add new entry to the beginning (most recent first)
  return [newEntry, ...history];
}

/**
 * Add a holdings update snapshot to history
 * Creates a history entry with before/after values to track changes
 * 
 * @param existingHistory - Current history array (or undefined)
 * @param sharesHeldBefore - Shares held before the update
 * @param sharesHeldAfter - Shares held after the update
 * @param updatedBy - Who made the update ('IRO' or 'INVESTOR')
 * @returns Updated history array with new snapshot entry
 */
export function addHoldingsUpdateSnapshot(
  existingHistory: HoldingsUpdateHistoryEntry[] | undefined,
  sharesHeldBefore: number,
  sharesHeldAfter: number,
  updatedBy: 'IRO' | 'INVESTOR' = 'IRO'
): HoldingsUpdateHistoryEntry[] {
  const history = existingHistory || [];
  const newEntry: HoldingsUpdateHistoryEntry = {
    updatedAt: new Date().toISOString(),
    sharesHeldBefore,
    sharesHeldAfter,
    updatedBy,
  };
  
  // Add new entry to the beginning (most recent first)
  return [newEntry, ...history];
}

