'use client';

import React from 'react';
import { Line } from 'react-chartjs-2';
// Side-effect: registers Chart.js scales/elements once
import '../lib/chartjs-setup';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend: {
    percent: number;
    direction: 'up' | 'down' | 'neutral';
  };
  chartData?: number[];
  chartColor?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  chartData,
  chartColor = '#7C3AED',
}) => {
  // Track mount time - changes on every component mount (page visit)
  const mountTimeRef = React.useRef(Date.now());
  
  // Track previous data to detect weekly changes
  const prevDataHashRef = React.useRef<string>('');
  const [animationTrigger, setAnimationTrigger] = React.useState(mountTimeRef.current);
  
  // Reset mount time on every mount (page visit) to trigger animation
  React.useEffect(() => {
    mountTimeRef.current = Date.now();
    setAnimationTrigger(mountTimeRef.current);
  }, []);
  
  /* ---------- chart data ---------- */
  const defaultChartData = React.useMemo(() => {
    if (chartData && chartData.length > 0) return chartData;
    return Array.from({ length: 7 }, () => Math.random() * 100);
  }, [chartData]);

  const normalizedData = React.useMemo(() => {
    if (defaultChartData.length === 0) return [50, 50, 50, 50, 50, 50, 50];
    const min = Math.min(...defaultChartData);
    const max = Math.max(...defaultChartData);
    return max === min
      ? defaultChartData.map(() => 50)
      : defaultChartData.map((v) => ((v - min) / (max - min)) * 100);
  }, [defaultChartData]);

  // Trigger animation when data changes (weekly update) - must be after normalizedData is defined
  React.useEffect(() => {
    const currentDataHash = normalizedData.join(',');
    if (prevDataHashRef.current && prevDataHashRef.current !== currentDataHash) {
      // Data changed - trigger new animation
      setAnimationTrigger(Date.now());
    }
    prevDataHashRef.current = currentDataHash;
  }, [normalizedData]);

  // Create a unique key that changes on mount (page visit) and when data changes
  // This ensures animation triggers on every page visit and weekly data updates
  const chartKey = React.useMemo(() => {
    const dataHash = normalizedData.join(',');
    return `${dataHash}-${animationTrigger}`;
  }, [normalizedData, animationTrigger]);

  const chartConfig = React.useMemo(() => ({
    labels: normalizedData.map((_, i) => String(i)),
    datasets: [
      {
        data: normalizedData,
        borderColor: chartColor,
        backgroundColor: `${chartColor}20`,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  }), [normalizedData, chartColor]);

  const chartOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false }, 
      tooltip: { enabled: false },
    },
    scales: { 
      x: { display: false }, 
      y: { display: false },
    },
    animation: {
      duration: 1200,
      easing: 'easeInOutQuad' as const,
    },
    transitions: {
      show: {
        animation: {
          duration: 1200,
          easing: 'easeInOutQuad' as const,
        },
      },
      hide: {
        animation: {
          duration: 0,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'nearest' as const,
    },
    elements: {
      point: {
        hoverRadius: 0,
        radius: 0,
      },
    },
  }), []);

  /* ---------- trend helpers ---------- */
  const trendColor =
    trend.direction === 'up'
      ? 'text-green-500'
      : trend.direction === 'down'
      ? 'text-orange-500'
      : 'text-neutral-400';

  const trendIconBgColor =
    trend.direction === 'up'
      ? 'bg-green-100'
      : trend.direction === 'down'
      ? 'bg-orange-100'
      : 'bg-neutral-100';

  const trendIcon =
    trend.direction === 'up' ? (
      <div className={`${trendIconBgColor} rounded-full p-1 flex items-center justify-center`}>
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ) : trend.direction === 'down' ? (
      <div className={`${trendIconBgColor} rounded-full p-1 flex items-center justify-center`}>
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ) : null;

  const trendText =
    trend.direction === 'neutral'
      ? '0%'
      : `${trend.percent.toFixed(0)}%`;

  /* ---------- render ---------- */
  return (
    <div className="bg-white p-5 border border-neutral-200 rounded-xl relative overflow-hidden min-h-[140px]">
      {/* Title */}
      <p className="text-sm font-medium text-neutral-500 mb-3">{title}</p>

      {/* Value + Trend row */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl font-bold text-neutral-900 leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        <div className={`flex items-center gap-0.5 ${trendColor}`}>
          {trendIcon}
          <span className="text-sm font-semibold">{trendText}</span>
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-xs text-neutral-400">compared to last week</p>

      {/* Mini chart — bottom-right */}
      <div className="absolute bottom-3 right-3 w-28 h-14 pointer-events-none">
        <Line 
          key={chartKey}
          data={chartConfig} 
          options={chartOptions}
        />
      </div>
    </div>
  );
};

export default MetricCard;
