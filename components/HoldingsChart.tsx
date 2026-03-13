'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import '../lib/chartjs-setup';
import { HoldingsDataPoint } from '../lib/types';

interface HoldingsChartProps {
  companyId: string;
  currentSharesHeld?: number;
  timeSeriesData?: HoldingsDataPoint[];
  currentSharePrice?: number;
}

type Timeframe = '1w' | '1M' | '3M' | '6M' | 'YTD' | 'ALL';

function fmtShares(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + 'K';
  return v.toLocaleString();
}

function filterByTimeframe(data: HoldingsDataPoint[], tf: Timeframe): HoldingsDataPoint[] {
  if (tf === 'ALL') return data;
  const now = new Date();
  const cutoff = new Date(now);
  switch (tf) {
    case '1w':  cutoff.setDate(now.getDate() - 7);                            break;
    case '1M':  cutoff.setMonth(now.getMonth() - 1);                          break;
    case '3M':  cutoff.setMonth(now.getMonth() - 3);                          break;
    case '6M':  cutoff.setMonth(now.getMonth() - 6);                          break;
    case 'YTD': cutoff.setMonth(0); cutoff.setDate(1); cutoff.setHours(0, 0, 0, 0); break;
  }
  const filtered = data.filter(pt => new Date(pt.timestamp) >= cutoff);
  return filtered.length >= 2 ? filtered : data.slice(-2);
}

/** Smart x-axis label: shorter when the span is large, full date+time when zoomed in */
function labelForPoint(timestamp: string, spanMs: number): string {
  const d = new Date(timestamp);
  const oneMonthMs  = 30 * 24 * 3600 * 1000;
  const oneWeekMs   =  7 * 24 * 3600 * 1000;

  if (spanMs > oneMonthMs) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }
  if (spanMs > oneWeekMs) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  // Within a week – show date + time
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const HoldingsChart: React.FC<HoldingsChartProps> = ({
  companyId,
  currentSharesHeld,
  timeSeriesData: providedTimeSeriesData,
  currentSharePrice,
}) => {
  const isDark =
    typeof window !== 'undefined' &&
    window.document.documentElement.classList.contains('dark');

  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');
  const [loading, setLoading]     = useState(true);
  const [allData, setAllData]     = useState<HoldingsDataPoint[]>([]);

  useEffect(() => {
    if (providedTimeSeriesData && providedTimeSeriesData.length > 0) {
      setAllData(providedTimeSeriesData);
      setLoading(false);
      return;
    }
    if (currentSharesHeld !== undefined && currentSharesHeld > 0) {
      const now = new Date();
      const pts: HoldingsDataPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        pts.push({
          timestamp: d.toISOString(),
          share_price: currentSharePrice || 0,
          shares_held: currentSharesHeld,
          total_shares_outstanding: 25_381_100,
        });
      }
      setAllData(pts);
    } else {
      setAllData([]);
    }
    setLoading(false);
  }, [providedTimeSeriesData, currentSharesHeld, currentSharePrice, companyId]);

  const data = useMemo(
    () => filterByTimeframe(allData, timeframe),
    [allData, timeframe]
  );

  /* ─── header stats ─── */
  const currentValues = useMemo(() => {
    if (!data.length) return null;
    const last = data[data.length - 1];
    return { sharePrice: last.share_price, sharesHeld: last.shares_held };
  }, [data]);

  const previousValues = useMemo(() => {
    if (data.length < 2) return null;
    const lastShares = data[data.length - 1].shares_held;
    for (let i = data.length - 2; i >= 0; i--) {
      if (data[i].shares_held !== lastShares) {
        return { sharePrice: data[i].share_price, sharesHeld: data[i].shares_held };
      }
    }
    return { sharePrice: data[0].share_price, sharesHeld: data[0].shares_held };
  }, [data]);

  /* ─── chart datasets ─── */
  const chartData = useMemo(() => {
    if (!data.length) return null;

    const spanMs =
      data.length > 1
        ? new Date(data[data.length - 1].timestamp).getTime() -
          new Date(data[0].timestamp).getTime()
        : 0;

    const labels = data.map(pt => labelForPoint(pt.timestamp, spanMs));

    // Mark which indices are actual change points (shares_held differs from previous)
    const changeIndices = new Set<number>();
    for (let i = 1; i < data.length; i++) {
      if (data[i].shares_held !== data[i - 1].shares_held) {
        changeIndices.add(i);
      }
    }
    // Always mark first and last
    if (data.length > 0) { changeIndices.add(0); changeIndices.add(data.length - 1); }

    const sharesPointRadius = data.map((_, i) => (changeIndices.has(i) ? 5 : 0));
    const pricePointRadius  = data.map((_, i) => (changeIndices.has(i) ? 4 : 0));

    return {
      labels,
      datasets: [
        {
          label: 'Share Price',
          data: data.map(pt => pt.share_price),
          borderColor: '#60a5fa',
          backgroundColor: 'transparent',
          yAxisID: 'y',
          borderWidth: 2,
          borderDash: [],
          fill: false,
          tension: 0.35,
          pointRadius: pricePointRadius,
          pointBackgroundColor: '#60a5fa',
          pointBorderColor: isDark ? '#1e293b' : '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#60a5fa',
        },
        {
          label: 'Shares Held',
          data: data.map(pt => pt.shares_held),
          borderColor: '#10b981',
          backgroundColor: isDark
            ? 'rgba(16,185,129,0.06)'
            : 'rgba(16,185,129,0.08)',
          yAxisID: 'y1',
          borderWidth: 2.5,
          fill: 'origin',
          tension: 0.35,          // smooth curve — no stepped/cliff look
          pointRadius: sharesPointRadius,
          pointBackgroundColor: '#10b981',
          pointBorderColor: isDark ? '#1e293b' : '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#10b981',
        },
      ],
    };
  }, [data, isDark]);

  /* ─── chart options ─── */
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeInOutQuart' as const },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyleWidth: 14,
          padding: 20,
          font: { size: 12, weight: 'bold' as const },
          color: isDark ? '#d4d4d4' : '#262626',
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.92)',
        titleColor: '#f5f5f5',
        bodyColor: '#d4d4d4',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 14,
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 12 },
        callbacks: {
          label(ctx: any) {
            const lbl = ctx.dataset.label || '';
            if (ctx.datasetIndex === 0) {
              return `  ${lbl}: ₱${Number(ctx.parsed.y).toFixed(2)}`;
            }
            return `  ${lbl}: ${Number(ctx.parsed.y).toLocaleString()} shares`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          drawBorder: false,
        },
        ticks: {
          font: { size: 11 },
          color: isDark ? '#737373' : '#737373',
          maxRotation: 30,
          maxTicksLimit: 8,
          padding: 8,
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Share Price (₱)',
          color: '#60a5fa',
          font: { size: 11, weight: 'bold' as const },
          padding: { bottom: 8 },
        },
        grid: {
          color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          drawBorder: false,
        },
        ticks: {
          font: { size: 11 },
          color: '#60a5fa',
          padding: 8,
          callback: (v: any) => '₱' + Number(v).toFixed(2),
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Shares Held',
          color: '#34d399',
          font: { size: 11, weight: 'bold' as const },
          padding: { bottom: 8 },
        },
        grid: { drawOnChartArea: false, drawBorder: false },
        ticks: {
          font: { size: 11 },
          color: '#34d399',
          padding: 8,
          callback: (v: any) => fmtShares(Number(v)),
        },
        // Give a little headroom above/below the actual min/max
        grace: '5%',
      },
    },
  }), [isDark]);

  const timeframes: Timeframe[] = ['1w', '1M', '3M', '6M', 'YTD', 'ALL'];

  const calcChange = (cur: number, prev: number) => {
    if (!prev) return { value: 0, percent: 0 };
    const diff = cur - prev;
    return { value: diff, percent: (diff / prev) * 100 };
  };

  const shChange = previousValues
    ? calcChange(currentValues?.sharesHeld ?? 0, previousValues.sharesHeld)
    : { value: 0, percent: 0 };
  const spChange = previousValues
    ? calcChange(currentValues?.sharePrice ?? 0, previousValues.sharePrice)
    : { value: 0, percent: 0 };

  const fmtChange = (c: { value: number; percent: number }, isPrice = false) => {
    const sign = c.value >= 0 ? '+' : '';
    if (isPrice) {
      return `${sign}₱${Math.abs(c.value).toFixed(2)} (${c.percent >= 0 ? '+' : ''}${c.percent.toFixed(2)}%)`;
    }
    return `${sign}${c.value.toLocaleString()} (${c.percent >= 0 ? '+' : ''}${c.percent.toFixed(2)}%)`;
  };

  /* ─── render ─── */
  return (
    <div className="w-full">

      {/* Timeframe selector */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              timeframe === tf
                ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Stats header */}
      {currentValues && (
        <div className="flex flex-wrap gap-6 mb-5 pb-4 border-b border-neutral-100 dark:border-neutral-700">
          {/* Share Price */}
          <div>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-0.5">
              Share Price
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-blue-500">
                ₱{currentValues.sharePrice.toFixed(2)}
              </span>
              {previousValues && previousValues.sharePrice !== currentValues.sharePrice && (
                <span
                  className="text-xs font-bold"
                  style={{ color: spChange.percent >= 0 ? '#10b981' : '#ef4444' }}
                >
                  {spChange.percent >= 0 ? '▲' : '▼'} {fmtChange(spChange, true)}
                </span>
              )}
            </div>
          </div>

          {/* Shares Held */}
          <div>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-0.5">
              Holdings
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-emerald-500">
                {currentValues.sharesHeld.toLocaleString()}
              </span>
              {previousValues && previousValues.sharesHeld !== currentValues.sharesHeld && (
                <span
                  className="text-xs font-bold"
                  style={{ color: shChange.percent >= 0 ? '#10b981' : '#ef4444' }}
                >
                  {shChange.percent >= 0 ? '▲' : '▼'} {fmtChange(shChange)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Line chart */}
      <div className="relative w-full" style={{ height: '360px' }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
              Loading chart…
            </div>
          </div>
        ) : chartData ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
              No data available
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HoldingsChart;
