/**
 * Press Release Service Layer
 * 
 * Abstraction layer for press release data.
 * Currently fetches from local JSON. Designed for seamless migration
 * to an external API (e.g., fetch("https://api.touchmicro.com/press-releases"))
 * without changing any UI components.
 */

import pressReleasesData from '../data/pressReleases.json';

export interface PressRelease {
  id: string;
  title: string;
  date: string;
  category: 'Earnings' | 'ESG' | 'Innovation' | 'Corporate';
  excerpt: string;
  content: string;
  image: string;
  author: string;
}

export type PressReleaseCategory = 'All' | 'Earnings' | 'ESG' | 'Innovation' | 'Corporate';

// Cast imported JSON to typed array
const pressReleases: PressRelease[] = pressReleasesData as PressRelease[];

/**
 * Fetch all press releases, sorted by date (newest first).
 * Future: Replace with `fetch("https://api.touchmicro.com/press-releases")`
 */
export async function getAllPressReleases(): Promise<PressRelease[]> {
  // Simulate async fetch for future API compatibility
  return Promise.resolve(
    [...pressReleases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );
}

/**
 * Fetch a single press release by its slug/id.
 * Future: Replace with `fetch("https://api.touchmicro.com/press-releases/${slug}")`
 */
export async function getPressReleaseBySlug(slug: string): Promise<PressRelease | null> {
  const release = pressReleases.find(pr => pr.id === slug);
  return Promise.resolve(release || null);
}

/**
 * Fetch press releases filtered by category.
 * Future: Replace with `fetch("https://api.touchmicro.com/press-releases?category=${category}")`
 */
export async function getPressReleasesByCategory(category: PressReleaseCategory): Promise<PressRelease[]> {
  if (category === 'All') {
    return getAllPressReleases();
  }
  const filtered = pressReleases.filter(pr => pr.category === category);
  return Promise.resolve(
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );
}

/**
 * Search press releases by query string (title + excerpt).
 */
export async function searchPressReleases(query: string): Promise<PressRelease[]> {
  const q = query.toLowerCase().trim();
  if (!q) return getAllPressReleases();
  
  const results = pressReleases.filter(
    pr =>
      pr.title.toLowerCase().includes(q) ||
      pr.excerpt.toLowerCase().includes(q) ||
      pr.category.toLowerCase().includes(q)
  );
  return Promise.resolve(
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );
}

/**
 * Get the N most recent press releases.
 */
export async function getRecentPressReleases(count: number = 3): Promise<PressRelease[]> {
  const all = await getAllPressReleases();
  return all.slice(0, count);
}

/**
 * Get all available categories with counts.
 */
export async function getCategoryCounts(): Promise<Record<PressReleaseCategory, number>> {
  const counts: Record<string, number> = { All: pressReleases.length };
  for (const pr of pressReleases) {
    counts[pr.category] = (counts[pr.category] || 0) + 1;
  }
  return Promise.resolve(counts as Record<PressReleaseCategory, number>);
}




