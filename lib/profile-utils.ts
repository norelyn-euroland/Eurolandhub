/**
 * Profile Utilities
 * Functions to fetch profile data from email providers (e.g., Gravatar)
 */

import crypto from 'crypto';

/**
 * Generate Gravatar URL from email address
 * @param email - Email address
 * @param size - Image size in pixels (default: 200)
 * @returns Gravatar URL
 */
export function getGravatarUrl(email: string, size: number = 200): string {
  if (!email) return '';
  
  // Normalize email: trim and convert to lowercase
  const normalizedEmail = email.trim().toLowerCase();
  
  // Create MD5 hash of the email
  const hash = crypto.createHash('md5').update(normalizedEmail).digest('hex');
  
  // Return Gravatar URL
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404&r=pg`;
}

/**
 * Check if a Gravatar image exists for the given email
 * @param email - Email address
 * @returns Promise that resolves to the Gravatar URL if exists, or null if not
 */
export async function fetchGravatarProfile(email: string): Promise<string | null> {
  if (!email) return null;
  
  try {
    const gravatarUrl = getGravatarUrl(email, 200);
    
    // Check if the image exists by making a HEAD request
    const response = await fetch(gravatarUrl, { 
      method: 'HEAD',
      // Add a timeout to avoid hanging
      signal: AbortSignal.timeout(5000)
    });
    
    // If status is 200, the image exists
    if (response.ok) {
      return gravatarUrl;
    }
    
    // If 404, no Gravatar exists for this email
    return null;
  } catch (error) {
    // Network error or timeout - return null
    console.warn('Error checking Gravatar:', error);
    return null;
  }
}


