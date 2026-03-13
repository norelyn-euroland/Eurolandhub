'use client';

import React, { useEffect, useState } from 'react';
import { Applicant, RegistrationStatus, HoldingsSummary as HoldingsSummaryType, HoldingsDataPoint } from '../lib/types';
import HoldingsChart from './HoldingsChart';
import HoldingsUpdateHistory from './HoldingsUpdateHistory';
import { getWorkflowStatusInternal } from '../lib/shareholdingsVerification';
import { shareholderService } from '../lib/firestore-service';
import { getLatestPrice, getDataByRange } from '../services/shareDataService';

interface HoldingsSummaryProps {
  applicant: Applicant;
}

const HoldingsSummary: React.FC<HoldingsSummaryProps> = ({ applicant }) => {
  const [holdingsSummary, setHoldingsSummary] = useState<HoldingsSummaryType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const DEFAULT_SHARE_PRICE = 125.5;
    const FALLBACK_COMPANY_ID = '200512'; // SM Investment Corporation ID
    const FALLBACK_COMPANY_NAME = 'SM Investment Corporation';

    // Generate time-series data using actual update history snapshots + share price data
    const generateTimeSeriesData = async (
      sharesHeld: number,
      currentSharePrice: number,
      holdingsUpdateHistory?: Array<{ updatedAt: string; sharesHeldBefore?: number; sharesHeldAfter?: number }>
    ): Promise<HoldingsDataPoint[]> => {
      const totalSharesOutstanding = 25_381_100;
      const now = new Date().toISOString();

      try {
        // Fetch share price data for the last year
        const sharePriceData = await getDataByRange('1Y');

        // Helper: find nearest share price for a given ISO timestamp
        const findNearestPrice = (timestamp: string): number => {
          if (sharePriceData.length === 0) return currentSharePrice;
          const target = new Date(timestamp).getTime();
          let nearest = sharePriceData[0];
          let minDiff = Math.abs(new Date(sharePriceData[0].date).getTime() - target);
          for (const pt of sharePriceData) {
            const diff = Math.abs(new Date(pt.date).getTime() - target);
            if (diff < minDiff) { minDiff = diff; nearest = pt; }
          }
          return nearest.price;
        };

        const dataPoints: HoldingsDataPoint[] = [];

        if (holdingsUpdateHistory && holdingsUpdateHistory.length > 0) {
          // Sort chronologically (oldest → newest)
          const sorted = [...holdingsUpdateHistory].sort(
            (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          );

          // Determine the initial shares (value before the very first recorded update)
          const initialShares = sorted[0].sharesHeldBefore ?? sorted[0].sharesHeldAfter ?? sharesHeld;

          // Anchor point: 1 day before the first update so the "before" state is visible
          const firstUpdateTime = new Date(sorted[0].updatedAt);
          const anchorDate = new Date(firstUpdateTime);
          anchorDate.setDate(anchorDate.getDate() - 1);
          dataPoints.push({
            timestamp: anchorDate.toISOString(),
            share_price: findNearestPrice(anchorDate.toISOString()),
            shares_held: initialShares,
            total_shares_outstanding: totalSharesOutstanding,
          });

          // For every update in the history, add ONE data point at the update timestamp
          // showing the new (after) value. The line graph will draw diagonally from
          // the previous value to this new value, making the change clearly visible.
          for (const update of sorted) {
            if (update.sharesHeldAfter !== undefined) {
              dataPoints.push({
                timestamp: update.updatedAt,
                share_price: findNearestPrice(update.updatedAt),
                shares_held: update.sharesHeldAfter,
                total_shares_outstanding: totalSharesOutstanding,
              });
            }
          }
        } else {
          // No update history – add a starting anchor from registration/submission date
          const startDate =
            applicant.holdingsRecord?.registrationDate ||
            applicant.submissionDate;
          if (startDate) {
            dataPoints.push({
              timestamp: startDate,
              share_price: findNearestPrice(startDate),
              shares_held: sharesHeld,
              total_shares_outstanding: totalSharesOutstanding,
            });
          }
        }

        // Always add the current state as the final (rightmost) point
        dataPoints.push({
          timestamp: now,
          share_price: currentSharePrice,
          shares_held: sharesHeld,
          total_shares_outstanding: totalSharesOutstanding,
        });

        // Deduplicate by timestamp and sort chronologically
        const seen = new Set<string>();
        const unique = dataPoints
          .filter((pt) => {
            if (seen.has(pt.timestamp)) return false;
            seen.add(pt.timestamp);
            return true;
          })
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return unique.length > 0
          ? unique
          : [{
              timestamp: now,
              share_price: currentSharePrice,
              shares_held: sharesHeld,
              total_shares_outstanding: totalSharesOutstanding,
            }];
      } catch (error) {
        console.warn('Error building time-series data:', error);
        return [{
          timestamp: now,
          share_price: currentSharePrice,
          shares_held: sharesHeld,
          total_shares_outstanding: totalSharesOutstanding,
        }];
      }
    };

    const run = async () => {
      // Show holdings if:
      // 1. Applicant has holdingsRecord with sharesHeld > 0 (IRO uploaded/updated holdings)
      // 2. Pre-verified account with registrationId (can fetch from shareholder masterlist)
      const hasHoldingsRecord = applicant.holdingsRecord && 
        applicant.holdingsRecord.sharesHeld !== undefined && 
        applicant.holdingsRecord.sharesHeld > 0;
      const isPreVerified = applicant.isPreVerified === true;
      const hasRegistrationId = applicant.registrationId && applicant.registrationId.trim() !== '';

      // If no holdings data available at all, don't show summary
      if (!hasHoldingsRecord && !(isPreVerified && hasRegistrationId)) {
        if (!cancelled) {
          setHoldingsSummary(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setHoldingsSummary(null);

      try {
        // Fetch the latest share price
        const latestPriceData = await getLatestPrice();
        const currentSharePrice = latestPriceData?.price || DEFAULT_SHARE_PRICE;
        // For pre-verified accounts, try to fetch holdings from shareholder masterlist if not in holdingsRecord
        if (isPreVerified && !applicant.holdingsRecord && applicant.registrationId) {
          try {
            const shareholder = await shareholderService.getById(applicant.registrationId);
            if (shareholder) {
              // Create holdingsRecord from shareholder data
              // Calculate ownership percentage: (Shareholder shares / company total outstanding shares) * 100
              const totalSharesOutstanding = 25_381_100; // Fixed value from issuer
              const ownershipPercent = shareholder.holdings > 0 
                ? (shareholder.holdings / totalSharesOutstanding) * 100 
                : 0;
              
              const series = await generateTimeSeriesData(
                shareholder.holdings, 
                currentSharePrice,
                applicant.holdingsUpdateHistory
              );

              const summary: HoldingsSummaryType = {
                companyId: shareholder.id,
                companyName: shareholder.name,
                sharesHeld: shareholder.holdings,
                ownershipPercentage: ownershipPercent,
                sharesClass: shareholder.accountType || 'Ordinary',
                registrationDate: applicant.submissionDate || new Date().toISOString(),
                currentSharePrice,
                currentMarketValue: shareholder.holdings * currentSharePrice,
                timeSeriesData: series,
              };

              if (!cancelled) {
                setHoldingsSummary(summary);
                setLoading(false);
              }
              return;
            }
          } catch (error) {
            console.warn('Error fetching shareholder data for pre-verified account:', error);
            // Continue to fallback logic below
          }
        }

        // If holdingsRecord exists with valid sharesHeld, use it
        if (hasHoldingsRecord) {
          const holdingsRecord = applicant.holdingsRecord!;
          const series = await generateTimeSeriesData(
            holdingsRecord.sharesHeld, 
            currentSharePrice,
            applicant.holdingsUpdateHistory
          );

          const summary: HoldingsSummaryType = {
            companyId: holdingsRecord.companyId || FALLBACK_COMPANY_ID,
            companyName: holdingsRecord.companyName || FALLBACK_COMPANY_NAME,
            sharesHeld: holdingsRecord.sharesHeld,
            ownershipPercentage: holdingsRecord.ownershipPercentage,
            sharesClass: holdingsRecord.sharesClass,
            registrationDate: holdingsRecord.registrationDate,
            currentSharePrice,
            currentMarketValue: holdingsRecord.sharesHeld * currentSharePrice,
            timeSeriesData: series,
          };

          if (!cancelled) {
            setHoldingsSummary(summary);
            setLoading(false);
          }
          return;
        }

        // Verified investor without holdingsRecord → don't show summary (no real data)
        // Only show holdings summary if there's actual holdings data from IRO uploads/updates
        if (!cancelled) {
          setHoldingsSummary(null);
          setLoading(false);
        }
        return;
      } catch (error) {
        console.error('Error loading holdings summary:', error);

        // Only show holdings summary if there's actual holdings data
        // Don't generate dummy data - only use real values from IRO uploads/updates
        if (applicant.holdingsRecord && applicant.holdingsRecord.sharesHeld > 0) {
          // Try to fetch share price even in error case, fallback to default
          let errorSharePrice = DEFAULT_SHARE_PRICE;
          try {
            const latestPriceData = await getLatestPrice();
            errorSharePrice = latestPriceData?.price || DEFAULT_SHARE_PRICE;
          } catch (priceError) {
            console.warn('Error fetching share price in error handler:', priceError);
          }

          const sharesHeld = applicant.holdingsRecord.sharesHeld;
          const companyId = applicant.holdingsRecord.companyId || FALLBACK_COMPANY_ID;
          const companyName = applicant.holdingsRecord.companyName || FALLBACK_COMPANY_NAME;
          const sharesClass = applicant.holdingsRecord.sharesClass || 'Ordinary';
          const registrationDate = applicant.holdingsRecord.registrationDate || applicant.submissionDate || new Date().toISOString();
          const currentSharePrice = errorSharePrice;

          const series = await generateTimeSeriesData(
            sharesHeld, 
            currentSharePrice,
            applicant.holdingsUpdateHistory
          );

          const summary: HoldingsSummaryType = {
            companyId,
            companyName,
            sharesHeld,
            ownershipPercentage: applicant.holdingsRecord.ownershipPercentage,
            sharesClass,
            registrationDate,
            currentSharePrice,
            currentMarketValue: sharesHeld * currentSharePrice,
            timeSeriesData: series,
          };

          if (!cancelled) setHoldingsSummary(summary);
        } else {
          // No real holdings data available - don't show summary
          if (!cancelled) {
            setHoldingsSummary(null);
            setLoading(false);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    applicant.id,
    applicant.holdingsRecord?.sharesHeld,
    applicant.holdingsRecord?.ownershipPercentage,
    applicant.registrationId,
    applicant.isPreVerified,
    // Re-run whenever a new history snapshot is logged
    applicant.holdingsUpdateHistory?.length,
  ]);

  // Show verification message for accounts without holdings (only for non-verified or further info required)
  // Use state to store async status
  const [internalStatus, setInternalStatus] = useState<string>('REGISTRATION_PENDING');
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    getWorkflowStatusInternal(applicant).then(status => {
      setInternalStatus(status);
      setStatusLoading(false);
    });
  }, [applicant]);

  const isVerified = internalStatus === 'VERIFIED';
  const isPreVerified = applicant.isPreVerified === true;
  
  // Don't show message for verified investors or pre-verified accounts (they'll have data from masterlist or random data generated)
  // Pre-verified accounts should always show holdings if available from masterlist
  if (!statusLoading && !isVerified && !isPreVerified && (!applicant.holdingsRecord || (internalStatus !== 'UNDER_REVIEW'))) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center max-w-md">
          <p className="text-neutral-600 dark:text-neutral-300 font-medium text-base leading-relaxed">
            {internalStatus === 'FURTHER_INFO_REQUIRED' 
              ? 'This investor\'s holdings require resubmission. Holdings information will be available after verification.'
              : 'This investor has not yet verified their holdings. Holdings information will be available once verification is complete.'}
          </p>
        </div>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-sm font-bold text-neutral-600 dark:text-neutral-300">Loading status...</div>
      </div>
    );
  }

  // Show loading state
  if (loading || !holdingsSummary) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-sm font-bold text-neutral-600 dark:text-neutral-300">Loading holdings data...</div>
      </div>
    );
  }

  // Show holdings summary for verified investors
  return (
    <div className="space-y-8">
      {/* Metric Cards - Top Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
            Shares Held
          </p>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {holdingsSummary.sharesHeld.toLocaleString()}
          </p>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
            Ownership Percentage
          </p>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {holdingsSummary.ownershipPercentage.toFixed(2)}%
          </p>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
            Shares Class
          </p>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {holdingsSummary.sharesClass}
          </p>
        </div>
      </div>

      {/* Metric Cards - Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
            Current Share Price
          </p>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            ₱{holdingsSummary.currentSharePrice.toFixed(2)}
          </p>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
            Current Market Value
          </p>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            ₱{holdingsSummary.currentMarketValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-8">
        <HoldingsChart 
          companyId={holdingsSummary.companyId} 
          currentSharesHeld={holdingsSummary.sharesHeld}
          timeSeriesData={holdingsSummary.timeSeriesData}
          currentSharePrice={holdingsSummary.currentSharePrice}
        />
      </div>

      {/* Holdings Update History */}
      <HoldingsUpdateHistory 
        history={applicant.holdingsUpdateHistory || []}
      />
    </div>
  );
};

export default HoldingsSummary;







