import { HoldingsDataPoint } from './types';

/**
 * Static sample time-series data structured like a backend API response
 * Keyed by companyId, each entry contains data points for different timeframes
 * 
 * To switch to API: Replace fetchHoldingsData implementation to call:
 * fetch(`/api/holdings?companyId=${companyId}&timeframe=${timeframe}`)
 */
export const MOCK_HOLDINGS_DATA: Record<string, HoldingsDataPoint[]> = {
  // SM INVESTMENTS CORPORATION (201200512)
  '201200512': generateCompanyData('201200512', 8319668, 29280000, 28.41, 45.0),
  
  // AYALA CORPORATION (201202388)
  '201202388': generateCompanyData('201202388', 3632265, 29280000, 12.40, 42.5),
  
  // SAN MIGUEL CORPORATION (201198216)
  '201198216': generateCompanyData('201198216', 2038782, 29280000, 6.96, 38.0),
  
  // JOLLIBEE FOODS CORPORATION (201199876)
  '201199876': generateCompanyData('201199876', 1555760, 29280000, 5.31, 35.5),
  
  // BDO UNIBANK INC. (201201234)
  '201201234': generateCompanyData('201201234', 1245678, 29280000, 4.26, 48.0),
  
  // METROBANK (201201567)
  '201201567': generateCompanyData('201201567', 1123456, 29280000, 3.84, 46.5),
  
  // BANK OF THE PHILIPPINE ISLANDS (201201890)
  '201201890': generateCompanyData('201201890', 987654, 29280000, 3.38, 44.0),
  
  // PLDT INC. (201202123)
  '201202123': generateCompanyData('201202123', 876543, 29280000, 2.99, 41.5),
  
  // GLOBE TELECOM INC. (201202456)
  '201202456': generateCompanyData('201202456', 765432, 29280000, 2.61, 39.0),
  
  // MEGAWORLD CORPORATION (201202789)
  '201202789': generateCompanyData('201202789', 654321, 29280000, 2.23, 36.5),
};

/**
 * Generate realistic time-series data for a company
 * Creates data points covering ~2 years with varying resolutions
 */
function generateCompanyData(
  companyId: string,
  currentShares: number,
  totalShares: number,
  currentOwnership: number,
  basePrice: number
): HoldingsDataPoint[] {
  const data: HoldingsDataPoint[] = [];
  const now = new Date();
  const startDate = new Date(now);
  startDate.setFullYear(startDate.getFullYear() - 2); // 2 years of data
  
  // Generate monthly data points for ALL timeframe
  // Then we can filter/aggregate for other timeframes
  let currentPrice = basePrice;
  let currentSharesHeld = currentShares * 0.85; // Start at 85% of current
  const totalSharesOutstanding = totalShares;
  
  const months = 24; // 2 years
  for (let i = 0; i <= months; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);
    
    // Simulate price movement (random walk with slight upward trend)
    const priceChange = (Math.random() - 0.45) * 3; // Slight upward bias
    currentPrice = Math.max(20, currentPrice + priceChange);
    
    // Simulate gradual share accumulation (approaching current)
    if (i < months) {
      const progress = i / months;
      currentSharesHeld = currentShares * (0.85 + progress * 0.15);
    } else {
      currentSharesHeld = currentShares;
    }
    
    const ownership = (currentSharesHeld / totalSharesOutstanding) * 100;
    
    data.push({
      timestamp: date.toISOString(),
      share_price: Math.round(currentPrice * 100) / 100,
      shares_held: Math.round(currentSharesHeld),
      total_shares_outstanding: totalSharesOutstanding,
    });
  }
  
  return data;
}

/**
 * Fetch holdings data for a company and timeframe
 * Currently returns from mock data, designed to easily switch to API
 */
export async function fetchHoldingsData(
  companyId: string,
  timeframe: string
): Promise<HoldingsDataPoint[]> {
  // Current: return from mock data
  const allData = MOCK_HOLDINGS_DATA[companyId] || [];
  
  // Filter and aggregate based on timeframe
  const now = new Date();
  let cutoffDate: Date;
  
  switch (timeframe) {
    case '1d':
      cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - 1);
      // Return hourly data for 1d
      return filterAndResample(allData, cutoffDate, 'hourly');
      
    case '1w':
      cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      // Return hourly data for 1w
      return filterAndResample(allData, cutoffDate, 'hourly');
      
    case '1M':
      cutoffDate = new Date(now);
      cutoffDate.setMonth(cutoffDate.getMonth() - 1);
      // Return daily data for 1M
      return filterAndResample(allData, cutoffDate, 'daily');
      
    case '3M':
      cutoffDate = new Date(now);
      cutoffDate.setMonth(cutoffDate.getMonth() - 3);
      return filterAndResample(allData, cutoffDate, 'daily');
      
    case '6M':
      cutoffDate = new Date(now);
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);
      return filterAndResample(allData, cutoffDate, 'daily');
      
    case 'YTD':
      cutoffDate = new Date(now.getFullYear(), 0, 1); // Start of year
      return filterAndResample(allData, cutoffDate, 'daily');
      
    case 'ALL':
    default:
      // Return monthly data for ALL
      return allData;
  }
  
  // Future: Switch to API call
  // return fetch(`/api/holdings?companyId=${companyId}&timeframe=${timeframe}`)
  //   .then(r => r.json())
  //   .then(data => data.timeSeriesData);
}

/**
 * Filter data points after cutoff date and resample if needed
 */
function filterAndResample(
  data: HoldingsDataPoint[],
  cutoffDate: Date,
  resolution: 'hourly' | 'daily' | 'monthly'
): HoldingsDataPoint[] {
  const filtered = data.filter(point => new Date(point.timestamp) >= cutoffDate);
  
  if (resolution === 'hourly' && filtered.length > 0) {
    // For hourly view, create hourly points by interpolating between data points
    const hourlyData: HoldingsDataPoint[] = [];
    for (let i = 0; i < filtered.length - 1; i++) {
      const start = new Date(filtered[i].timestamp);
      const end = new Date(filtered[i + 1].timestamp);
      const hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
      
      for (let h = 0; h < hours; h++) {
        const date = new Date(start);
        date.setHours(date.getHours() + h);
        
        // Linear interpolation
        const ratio = h / hours;
        const price = filtered[i].share_price + 
          (filtered[i + 1].share_price - filtered[i].share_price) * ratio;
        const shares = Math.round(
          filtered[i].shares_held + 
          (filtered[i + 1].shares_held - filtered[i].shares_held) * ratio
        );
        
        hourlyData.push({
          timestamp: date.toISOString(),
          share_price: Math.round(price * 100) / 100,
          shares_held: shares,
          total_shares_outstanding: filtered[i].total_shares_outstanding,
        });
      }
    }
    
    // Add last point
    if (filtered.length > 0) {
      hourlyData.push(filtered[filtered.length - 1]);
    }
    
    return hourlyData;
  }
  
  if (resolution === 'daily' && filtered.length > 60) {
    // For daily view, if we have too many monthly points, interpolate
    // Create daily points by interpolating between monthly points
    const dailyData: HoldingsDataPoint[] = [];
    for (let i = 0; i < filtered.length - 1; i++) {
      const start = new Date(filtered[i].timestamp);
      const end = new Date(filtered[i + 1].timestamp);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      for (let d = 0; d < days; d++) {
        const date = new Date(start);
        date.setDate(date.getDate() + d);
        
        // Linear interpolation
        const ratio = d / days;
        const price = filtered[i].share_price + 
          (filtered[i + 1].share_price - filtered[i].share_price) * ratio;
        const shares = Math.round(
          filtered[i].shares_held + 
          (filtered[i + 1].shares_held - filtered[i].shares_held) * ratio
        );
        
        dailyData.push({
          timestamp: date.toISOString(),
          share_price: Math.round(price * 100) / 100,
          shares_held: shares,
          total_shares_outstanding: filtered[i].total_shares_outstanding,
        });
      }
    }
    
    // Add last point
    if (filtered.length > 0) {
      dailyData.push(filtered[filtered.length - 1]);
    }
    
    return dailyData;
  }
  
  return filtered;
}

