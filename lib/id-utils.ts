/**
 * Utility functions for formatting registration/investor IDs
 */

/**
 * Formats a registration/investor ID to show only the last 6 digits
 * @param id - The full registration/investor ID
 * @returns The last 6 digits of the ID, or the original ID if it's 6 digits or less
 */
export function formatIdToLast6Digits(id: string | undefined | null): string {
  if (!id) return 'N/A';
  const idStr = String(id).trim();
  if (idStr.length <= 6) return idStr;
  return idStr.slice(-6);
}

/**
 * Formats a registration/investor ID to show only the last 6 digits with ellipsis prefix
 * @param id - The full registration/investor ID
 * @returns The formatted ID with ellipsis (e.g., "...123456")
 */
export function formatIdWithEllipsis(id: string | undefined | null): string {
  if (!id) return 'N/A';
  const idStr = String(id).trim();
  if (idStr.length <= 6) return idStr;
  return `...${idStr.slice(-6)}`;
}


