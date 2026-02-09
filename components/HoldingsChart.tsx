'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
// Side-effect: registers Chart.js scales/elements once
import '../lib/chartjs-setup';
import { fetchHoldingsData } from '../lib/mockHoldingsData';
import { HoldingsDataPoint } from '../lib/types';

interface HoldingsChartProps {
  companyId: string;
}

type Timeframe = '1d' | '1w' | '1M' | '3M' | '6M' | 'YTD' | 'ALL';

const HoldingsChart: React.FC<HoldingsChartProps> = ({ companyId }) => {
  const isDark =
    typeof window !== 'undefined' &&
    window.document.documentElement.classList.contains('dark');

  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HoldingsDataPoint[]>([]);
  const [currentValues, setCurrentValues] = useState<{
    sharePrice: number;
    sharesHeld: number;
  } | null>(null);

  const [previousValues, setPreviousValues] = useState<{
    sharePrice: number;
    sharesHeld: number;
  } | null>(null);

  // Fetch data when companyId or timeframe changes
  useEffect(() => {
    setLoading(true);
    fetchHoldingsData(companyId, timeframe)
      .then((fetchedData) => {
        setData(fetchedData);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching holdings data:', error);
        setLoading(false);
      });
  }, [companyId, timeframe]);

  // Update current values when data changes
  useEffect(() => {
    if (data.length > 0) {
      const latest = data[data.length - 1];
      const sp = latest.share_price;
      const sh = latest.shares_held / 1_000_000;

      if (currentValues) {
        setPreviousValues({ sharePrice: currentValues.sharePrice, sharesHeld: currentValues.sharesHeld });
      } else {
        setPreviousValues({ sharePrice: sp, sharesHeld: sh });
      }
      setCurrentValues({ sharePrice: sp, sharesHeld: sh });
    }
  }, [data]);

  /* ---------- chart config ---------- */
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const labels = data.map((pt) => {
      const d = new Date(pt.timestamp);
      return d.toLocaleDateString('en-US', { month: 'short' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Share Price',
          data: data.map((pt) => pt.share_price),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          yAxisID: 'y',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Shares Held (M)',
          data: data.map((pt) => pt.shares_held / 1_000_000),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          yAxisID: 'y1',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    };
  }, [data]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12, weight: 'bold' as const },
            color: isDark ? '#e5e5e5' : '#171717',
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(23,23,23,0.92)',
          padding: 12,
          titleFont: { size: 12, weight: 'bold' as const },
          bodyFont: { size: 11 },
          callbacks: {
            label(ctx: any) {
              const lbl = ctx.dataset.label || '';
              return ctx.datasetIndex === 0
                ? `${lbl}: $${ctx.parsed.y.toFixed(3)}`
                : `${lbl}: ${ctx.parsed.y.toFixed(2)}M`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.08)', drawBorder: false },
          ticks: { font: { size: 11 }, color: isDark ? '#9ca3af' : '#525252' },
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: { display: true, text: 'Share Price ($)', color: '#60a5fa', font: { size: 12, weight: 'bold' as const } },
          grid: { color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.08)', drawBorder: false },
          ticks: { font: { size: 11 }, color: '#60a5fa', callback: (v: any) => '$' + v.toFixed(2) },
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          title: { display: true, text: 'Shares Held (M)', color: '#34d399', font: { size: 12, weight: 'bold' as const } },
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 11 }, color: '#34d399', callback: (v: any) => v.toFixed(2) + 'M' },
        },
      },
    }),
    [isDark],
  );

  const timeframes: Timeframe[] = ['1d', '1w', '1M', '3M', '6M', 'YTD', 'ALL'];

  /* ---------- percentage helpers ---------- */
  const calcChange = (cur: number, prev: number) => {
    if (!prev || prev === 0) return { value: 0, percent: 0 };
    const change = cur - prev;
    return { value: change, percent: (change / prev) * 100 };
  };

  const spChange = previousValues ? calcChange(currentValues?.sharePrice || 0, previousValues.sharePrice) : { value: 0, percent: 0 };
  const shChange = previousValues ? calcChange(currentValues?.sharesHeld || 0, previousValues.sharesHeld) : { value: 0, percent: 0 };

  const fmtChange = (c: { value: number; percent: number }, isPrice = false) => {
    const sign = c.percent >= 0 ? '+' : '';
    const val = isPrice ? `$${Math.abs(c.value).toFixed(3)}` : Math.abs(c.value).toFixed(3);
    return `${val} (${sign}${c.percent.toFixed(2)}%)`;
  };

  /* ---------- render ---------- */
  return (
    <div className="w-full">
      {/* Timeframe buttons */}
      <div className="flex gap-2 mb-4">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded ${
              timeframe === tf
                ? 'bg-neutral-900 text-white border-2 border-neutral-900 dark:bg-black dark:border-black'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border-2 border-transparent dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Current values */}
      {currentValues && (
        <div className="flex gap-8 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Share Price:</span>
            <span className="text-lg font-black" style={{ color: '#3b82f6' }}>
              ${currentValues.sharePrice.toFixed(3)}
            </span>
            {previousValues && (
              <span className="text-sm font-bold" style={{ color: spChange.percent >= 0 ? '#10b981' : '#ef4444' }}>
                {fmtChange(spChange, true)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Holdings:</span>
            <span className="text-lg font-black" style={{ color: '#10b981' }}>
              {currentValues.sharesHeld.toFixed(2)}M
            </span>
            {previousValues && (
              <span className="text-sm font-bold" style={{ color: shChange.percent >= 0 ? '#10b981' : '#ef4444' }}>
                {fmtChange(shChange)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative w-full" style={{ height: '400px' }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-800/80">
            <div className="text-sm font-bold text-neutral-600 dark:text-neutral-300">Loading chart data...</div>
          </div>
        ) : chartData ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm font-bold text-neutral-600 dark:text-neutral-300">No data available</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HoldingsChart;
