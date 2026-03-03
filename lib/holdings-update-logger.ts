/**
 * Holdings Update Logger
 * 
 * Helper functions to log holdings updates to history
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

