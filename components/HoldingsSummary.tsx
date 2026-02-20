'use client';

import React, { useEffect, useState } from 'react';
import { Applicant, RegistrationStatus, HoldingsSummary as HoldingsSummaryType } from '../lib/types';
import { fetchHoldingsData } from '../lib/mockHoldingsData';
import HoldingsChart from './HoldingsChart';
import { getWorkflowStatusInternal } from '../lib/shareholdingsVerification';

interface HoldingsSummaryProps {
  applicant: Applicant;
}

const HoldingsSummary: React.FC<HoldingsSummaryProps> = ({ applicant }) => {
  const [holdingsSummary, setHoldingsSummary] = useState<HoldingsSummaryType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const DEFAULT_SHARE_PRICE = 125.5;
    // Use an ID that exists in `MOCK_HOLDINGS_DATA` as a safe fallback
    const FALLBACK_COMPANY_ID = '201200512';
    const FALLBACK_COMPANY_NAME = 'SM Investment Corporation';

    const getTimeSeriesSafe = async (companyId: string): Promise<{ series: any[]; usedCompanyId: string }> => {
      const primary = await fetchHoldingsData(companyId, 'ALL');
      if (primary.length > 0) return { series: primary, usedCompanyId: companyId };
      if (companyId === FALLBACK_COMPANY_ID) return { series: primary, usedCompanyId: companyId };
      const fallback = await fetchHoldingsData(FALLBACK_COMPANY_ID, 'ALL');
      return { series: fallback, usedCompanyId: FALLBACK_COMPANY_ID };
    };

    const run = async () => {
      // Show holdings for verified accounts and pending accounts (AWAITING_IRO_REVIEW) with valid holdings
      // Don't show for RESUBMISSION_REQUIRED (invalid/wrong holdings)
      const internalStatus = getWorkflowStatusInternal(applicant);
      const isVerified = internalStatus === 'VERIFIED';
      const hasValidHoldings =
        (internalStatus === 'VERIFIED' || internalStatus === 'AWAITING_IRO_REVIEW') && applicant.holdingsRecord;

      // Nothing to load for non-verified users without holdings
      if (!hasValidHoldings && !(isVerified && !applicant.holdingsRecord)) {
        return;
      }

      setLoading(true);
      setHoldingsSummary(null);

      try {
        if (hasValidHoldings) {
          const holdingsRecord = applicant.holdingsRecord!;
          const { series, usedCompanyId } = await getTimeSeriesSafe(holdingsRecord.companyId);
          const currentSharePrice =
            series.length > 0 ? series[series.length - 1].share_price : DEFAULT_SHARE_PRICE;

          const summary: HoldingsSummaryType = {
            companyId: usedCompanyId,
            companyName: holdingsRecord.companyName || FALLBACK_COMPANY_NAME,
            sharesHeld: holdingsRecord.sharesHeld,
            ownershipPercentage: holdingsRecord.ownershipPercentage,
            sharesClass: holdingsRecord.sharesClass,
            registrationDate: holdingsRecord.registrationDate,
            currentSharePrice,
            currentMarketValue: holdingsRecord.sharesHeld * currentSharePrice,
            timeSeriesData: series,
          };

          if (!cancelled) setHoldingsSummary(summary);
          return;
        }

        // Verified investor without holdingsRecord → generate dummy holdings (but still show summary)
        const randomShares = Math.floor(Math.random() * 50_000) + 1_000; // 1,000–51,000
        const totalSharesOutstanding = 25_381_100; // Fixed value from issuer
        const randomOwnership = (randomShares / totalSharesOutstanding) * 100;
        const sharesClass = 'Ordinary';
        const registrationDate = applicant.submissionDate || new Date().toISOString();

        const { series, usedCompanyId } = await getTimeSeriesSafe(FALLBACK_COMPANY_ID);
        const currentSharePrice = series.length > 0 ? series[series.length - 1].share_price : DEFAULT_SHARE_PRICE;

        const summary: HoldingsSummaryType = {
          companyId: usedCompanyId,
          companyName: FALLBACK_COMPANY_NAME,
          sharesHeld: randomShares,
          ownershipPercentage: randomOwnership,
          sharesClass,
          registrationDate,
          currentSharePrice,
          currentMarketValue: randomShares * currentSharePrice,
          timeSeriesData: series,
        };

        if (!cancelled) setHoldingsSummary(summary);
      } catch (error) {
        console.error('Error loading holdings summary:', error);

        // Even if data fetch fails, avoid infinite loading for verified investors
        const internalStatus = getWorkflowStatusInternal(applicant);
        const isVerified = internalStatus === 'VERIFIED';
        if (!isVerified) return;

        const sharesHeld = applicant.holdingsRecord?.sharesHeld ?? 10_000;
        const companyId = applicant.holdingsRecord?.companyId ?? FALLBACK_COMPANY_ID;
        const companyName = applicant.holdingsRecord?.companyName ?? FALLBACK_COMPANY_NAME;
        const sharesClass = applicant.holdingsRecord?.sharesClass ?? 'Ordinary';
        const registrationDate = applicant.holdingsRecord?.registrationDate ?? applicant.submissionDate ?? new Date().toISOString();
        const currentSharePrice = DEFAULT_SHARE_PRICE;

        const summary: HoldingsSummaryType = {
          companyId,
          companyName,
          sharesHeld,
          ownershipPercentage: applicant.holdingsRecord?.ownershipPercentage ?? (sharesHeld / 25_381_100) * 100,
          sharesClass,
          registrationDate,
          currentSharePrice,
          currentMarketValue: sharesHeld * currentSharePrice,
          timeSeriesData: [],
        };

        if (!cancelled) setHoldingsSummary(summary);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [applicant]);

  // Show verification message for accounts without holdings (only for non-verified or resubmission required)
  const internalStatus = getWorkflowStatusInternal(applicant);
  const isVerified = internalStatus === 'VERIFIED';
  
  // Don't show message for verified investors (they'll have random data generated)
  if (!isVerified && (!applicant.holdingsRecord || (internalStatus !== 'AWAITING_IRO_REVIEW'))) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center max-w-md">
          <p className="text-neutral-600 dark:text-neutral-300 font-medium text-base leading-relaxed">
            {internalStatus === 'RESUBMISSION_REQUIRED' 
              ? 'This investor\'s holdings require resubmission. Holdings information will be available after verification.'
              : 'This investor has not yet verified their holdings. Holdings information will be available once verification is complete.'}
          </p>
        </div>
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
            Registration Date
          </p>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {new Date(holdingsSummary.registrationDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
            Current Share Price
          </p>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            ${holdingsSummary.currentSharePrice.toFixed(2)}
          </p>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
            Current Market Value
          </p>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            ${holdingsSummary.currentMarketValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-8">
        <HoldingsChart companyId={holdingsSummary.companyId} />
      </div>
    </div>
  );
};

export default HoldingsSummary;







