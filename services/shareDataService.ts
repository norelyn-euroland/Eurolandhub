/**
 * Share Data Service Layer
 * 
 * Abstraction layer for stock/share market data.
 * Currently fetches from local JSON. Designed for seamless migration
 * to an external API (e.g., fetch("https://api.touchmicro.com/market-data"))
 * without changing any UI components.
 */

import shareDataRaw from '../data/shareData.json';

export interface ShareDataPoint {
  date: string;
  price: number;
  volume: number;
}

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

// Cast imported JSON to typed array
const shareData: ShareDataPoint[] = shareDataRaw as ShareDataPoint[];

/**
 * Get all historical share data, sorted by date ascending.
 * Future: Replace with `fetch("https://api.touchmicro.com/market-data")`
 */
export async function getAllData(): Promise<ShareDataPoint[]> {
  return Promise.resolve(
    [...shareData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  );
}

/**
 * Get share data filtered by time range.
 * Future: Replace with `fetch("https://api.touchmicro.com/market-data?range=${range}")`
 */
export async function getDataByRange(range: TimeRange): Promise<ShareDataPoint[]> {
  const allData = await getAllData();
  
  if (range === 'ALL') return allData;
  
  const now = new Date();
  let startDate: Date;
  
  switch (range) {
    case '1M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1Y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      return allData;
  }
  
  return allData.filter(d => new Date(d.date) >= startDate);
}

/**
 * Get the latest (most recent) share price data point.
 * Future: Replace with `fetch("https://api.touchmicro.com/market-data/latest")`
 */
export async function getLatestPrice(): Promise<ShareDataPoint | null> {
  const allData = await getAllData();
  return allData.length > 0 ? allData[allData.length - 1] : null;
}

/**
 * Get price change stats for a given range.
 */
export async function getPriceStats(range: TimeRange): Promise<{
  current: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  avgVolume: number;
}> {
  const data = await getDataByRange(range);
  
  if (data.length === 0) {
    return { current: 0, open: 0, high: 0, low: 0, change: 0, changePercent: 0, avgVolume: 0 };
  }
  
  const current = data[data.length - 1].price;
  const open = data[0].price;
  const high = Math.max(...data.map(d => d.price));
  const low = Math.min(...data.map(d => d.price));
  const change = current - open;
  const changePercent = (change / open) * 100;
  const avgVolume = Math.round(data.reduce((sum, d) => sum + d.volume, 0) / data.length);
  
  return { current, open, high, low, change, changePercent, avgVolume };
}



