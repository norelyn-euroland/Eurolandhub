'use client';

import React, { useEffect, useState } from 'react';
import { Applicant, RegistrationStatus, HoldingsSummary as HoldingsSummaryType } from '../lib/types';
import { fetchHoldingsData } from '../lib/mockHoldingsData';
import HoldingsChart from './HoldingsChart';

interface HoldingsSummaryProps {
  applicant: Applicant;
}

const HoldingsSummary: React.FC<HoldingsSummaryProps> = ({ applicant }) => {
  const [holdingsSummary, setHoldingsSummary] = useState<HoldingsSummaryType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (applicant.status === RegistrationStatus.APPROVED && applicant.holdingsRecord) {
      setLoading(true);
      // Fetch time-series data to get current share price
      fetchHoldingsData(applicant.holdingsRecord.companyId, 'ALL')
        .then((timeSeriesData) => {
          if (timeSeriesData.length > 0) {
            const latest = timeSeriesData[timeSeriesData.length - 1];
            const currentSharePrice = latest.share_price;
            const currentMarketValue = applicant.holdingsRecord!.sharesHeld * currentSharePrice;

            setHoldingsSummary({
              companyId: applicant.holdingsRecord.companyId,
              companyName: applicant.holdingsRecord.companyName,
              sharesHeld: applicant.holdingsRecord.sharesHeld,
              ownershipPercentage: applicant.holdingsRecord.ownershipPercentage,
              sharesClass: applicant.holdingsRecord.sharesClass,
              registrationDate: applicant.holdingsRecord.registrationDate,
              currentSharePrice,
              currentMarketValue,
              timeSeriesData,
            });
          }
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error loading holdings summary:', error);
          setLoading(false);
        });
    }
  }, [applicant]);

  // Show verification message for unverified/pending investors
  if (applicant.status !== RegistrationStatus.APPROVED || !applicant.holdingsRecord) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center max-w-md">
          <p className="text-neutral-600 font-medium text-base leading-relaxed">
            This investor has not yet verified their holdings. Holdings information will be available once verification is complete.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading || !holdingsSummary) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-sm font-bold text-neutral-600">Loading holdings data...</div>
      </div>
    );
  }

  // Show holdings summary for verified investors
  return (
    <div className="space-y-8">
      {/* Company Header */}
      <div>
        <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">
          {holdingsSummary.companyName}
        </h2>
      </div>

      {/* Metric Cards - Top Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">
            Shares Held
          </p>
          <p className="text-2xl font-black text-neutral-900">
            {holdingsSummary.sharesHeld.toLocaleString()}
          </p>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">
            Ownership Percentage
          </p>
          <p className="text-2xl font-black text-neutral-900">
            {holdingsSummary.ownershipPercentage.toFixed(2)}%
          </p>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">
            Shares Class
          </p>
          <p className="text-2xl font-black text-neutral-900">
            {holdingsSummary.sharesClass}
          </p>
        </div>
      </div>

      {/* Metric Cards - Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">
            Registration Date
          </p>
          <p className="text-2xl font-black text-neutral-900">
            {new Date(holdingsSummary.registrationDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">
            Current Share Price
          </p>
          <p className="text-2xl font-black text-neutral-900">
            ${holdingsSummary.currentSharePrice.toFixed(2)}
          </p>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">
            Current Market Value
          </p>
          <p className="text-2xl font-black text-neutral-900">
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





