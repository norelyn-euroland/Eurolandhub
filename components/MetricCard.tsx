'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { ResponsiveContainer, AreaChart, Area, Tooltip, TooltipProps, XAxis } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend: {
    percent: number;
    direction: 'up' | 'down' | 'neutral';
  };
  chartData?: number[];
  chartColor?: string;
  subtitle?: string;
}

/**
 * Custom Tooltip component for the Sparkline.
 * Positions itself near the hover point on the chart, outside the card boundaries.
 */
const CustomTooltip = ({
  active,
  payload,
  themeColor,
  coordinate,
  containerRef,
}: TooltipProps<number, string> & {
  themeColor: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const [tooltipSize, setTooltipSize] = React.useState({ w: 0, h: 0 });

  React.useLayoutEffect(() => {
    if (!active) return;
    if (!tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    setTooltipSize({ w: rect.width, h: rect.height });
  }, [active, payload?.[0]?.value, payload?.[0]?.payload?.date]);

  if (active && payload && payload.length && coordinate) {
    const data = payload[0].payload;

    // Render into a portal to guarantee it stays above charts/cards regardless of stacking contexts.
    if (typeof document === 'undefined') return null;

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return null;

    const pointX = containerRect.left + coordinate.x;
    const pointY = containerRect.top + coordinate.y;

    const GAP = 12;
    const EDGE = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Prefer above; flip below when we don't have room.
    const wouldOverflowTop = pointY - GAP - tooltipSize.h < EDGE;
    const wouldOverflowBottom = pointY + GAP + tooltipSize.h > viewportH - EDGE;
    const placeBelow = wouldOverflowTop && !wouldOverflowBottom;

    const transform = placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
    const top = placeBelow ? pointY + GAP : pointY - GAP;

    const halfW = tooltipSize.w ? tooltipSize.w / 2 : 0;
    const minLeft = EDGE + halfW;
    const maxLeft = viewportW - EDGE - halfW;
    const left = Math.min(Math.max(pointX, minLeft), maxLeft);

    return createPortal(
      <div
        ref={tooltipRef}
        className="bg-white dark:bg-[#262626] border border-neutral-200 dark:border-white/10 px-3 py-2 rounded-lg shadow-2xl backdrop-blur-md pointer-events-none" 
        style={{ 
          position: 'fixed',
          zIndex: 2147483647,
          left: `${left}px`,
          top: `${top}px`,
          transform,
          whiteSpace: 'nowrap'
        }}
      >
        <p className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-gray-400 font-bold mb-0.5">
          {data.date}
        </p>
        <p className="text-sm font-bold" style={{ color: themeColor }}>
          {payload[0].value?.toLocaleString()}
        </p>
      </div>
    , document.body);
  }
  return null;
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  chartData,
  chartColor = '#7C3AED',
  subtitle = 'compared to last week',
}) => {
  const chartContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Map chartColor to colorTheme
  const getColorTheme = (color: string): 'pink' | 'blue' | 'emerald' | 'amber' => {
    const colorMap: Record<string, 'pink' | 'blue' | 'emerald' | 'amber'> = {
      '#EC4899': 'pink',
      '#ec4899': 'pink',
      '#3b82f6': 'blue',
      '#10B981': 'emerald',
      '#10b981': 'emerald',
      '#F59E0B': 'amber',
      '#f59e0b': 'amber',
      '#EF4444': 'pink',
      '#ef4444': 'pink',
      '#7C3AED': 'pink',
      '#7c3aed': 'pink',
    };
    return colorMap[color] || 'pink';
  };

  const colorTheme = getColorTheme(chartColor);

  // Theme definition mapping
  const themes = {
    pink: {
      stroke: '#ec4899',
      fill: 'rgba(236, 72, 153, 0.2)',
      trendDown: 'text-orange-500',
      trendUp: 'text-emerald-500',
      bgTrendDown: 'bg-orange-500/10',
      bgTrendUp: 'bg-emerald-500/10',
    },
    blue: {
      stroke: '#3b82f6',
      fill: 'rgba(59, 130, 246, 0.2)',
      trendDown: 'text-red-500',
      trendUp: 'text-sky-400',
      bgTrendDown: 'bg-red-500/10',
      bgTrendUp: 'bg-sky-400/10',
    },
    emerald: {
      stroke: '#10b981',
      fill: 'rgba(16, 185, 129, 0.2)',
      trendDown: 'text-orange-400',
      trendUp: 'text-emerald-400',
      bgTrendDown: 'bg-orange-400/10',
      bgTrendUp: 'bg-emerald-400/10',
    },
    amber: {
      stroke: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.2)',
      trendDown: 'text-red-400',
      trendUp: 'text-amber-400',
      bgTrendDown: 'bg-red-400/10',
      bgTrendUp: 'bg-amber-400/10',
    }
  };

  const theme = themes[colorTheme];

  // Use a stable unique ID for gradient (avoid special chars)
  const gradientId = React.useId();
  const borderGradientId = `border-${gradientId}`;
  const flareId = `flare-${gradientId}`;

  // Deterministic seeded random — same seed always produces the same value.
  // Charts only change when the week number changes (every 7 days).
  const seededRandom = (seed: number): number => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };

  // Convert 7-day chartData (array of numbers) to format expected by recharts
  const convertChartData = React.useMemo(() => {
    if (!chartData || chartData.length === 0) {
      const now = new Date();
      const weekSeed = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(now.getDate() - (6 - i));
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return {
          value: Math.round(50 + seededRandom(weekSeed + i) * 50),
          date: dateStr
        };
      });
    }

    const now = new Date();
    return chartData.map((val, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (chartData.length - 1 - i));
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        value: Math.round(val),
        date: dateStr
      };
    });
  }, [chartData]);

  // Trend display
  const trendValue = trend.direction === 'neutral'
    ? '0%'
    : `${Math.abs(trend.percent).toFixed(trend.percent < 10 ? 1 : 0)}%`;
  const isUp = trend.direction === 'up';

  return (
    <div className="group relative rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-xl border border-neutral-200 dark:border-white/5 flex flex-col justify-between transition-all duration-300 hover:border-neutral-300 dark:hover:border-white/10 hover:bg-neutral-50 dark:hover:bg-[#1e1e1e] hover:-translate-y-1 h-[260px] overflow-visible">

      {/* Micro-texture overlay for dark mode */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
        <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.08]">
          <filter id={`noise-${gradientId}`}>
            <feTurbulence 
              type="fractalNoise" 
              baseFrequency="0.9" 
              numOctaves="4" 
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#noise-${gradientId})`} />
        </svg>
      </div>

      {/* Metric Header Section */}
      <div className="z-10 relative pointer-events-none" style={{ zIndex: 10 }}>
        <h3 className="text-neutral-500 dark:text-gray-400 text-xs font-semibold mb-2 tracking-widest uppercase opacity-70">
          {title}
        </h3>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          <div className={`flex items-center px-2 py-0.5 rounded-full text-[11px] font-black ${isUp ? theme.trendUp + ' ' + theme.bgTrendUp : theme.trendDown + ' ' + theme.bgTrendDown}`}>
            <span>{isUp ? '↑' : '↓'}</span>
            <span className="ml-0.5">{trendValue}</span>
          </div>
        </div>
        <p className="text-neutral-600 dark:text-gray-500 text-xs font-medium italic opacity-80">
          {subtitle}
        </p>
      </div>

      {/* Animated Sparkline Section — full-width, bottom section */}
      <div className="absolute bottom-0 left-0 right-0 h-[42%] transition-opacity duration-500 group-hover:opacity-100 opacity-60 overflow-visible" style={{ zIndex: 5 }}>
        <div ref={chartContainerRef} className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={convertChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.stroke} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={theme.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <Tooltip
                content={<CustomTooltip themeColor={theme.stroke} containerRef={chartContainerRef} />}
                cursor={{ stroke: theme.stroke, strokeWidth: 1.5, strokeDasharray: '4 4' }}
                allowEscapeViewBox={{ x: true, y: true }}
                offset={10}
                wrapperStyle={{ pointerEvents: 'none', outline: 'none' }}
                animationDuration={0}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={theme.stroke}
                strokeWidth={3}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                isAnimationActive={true}
                animationDuration={1500}
                animationEasing="cubic-bezier(0.16, 1, 0.3, 1)"
                activeDot={{
                  r: 6,
                  fill: theme.stroke,
                  stroke: '#ffffff',
                  strokeWidth: 2,
                  className: "dark:stroke-[#1a1a1a] drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
