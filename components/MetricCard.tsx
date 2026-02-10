'use client';

import React from 'react';
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
const CustomTooltip = ({ active, payload, themeColor, coordinate }: TooltipProps<number, string> & { themeColor: string }) => {
  if (active && payload && payload.length && coordinate) {
    const data = payload[0].payload;
    
    return (
      <div 
        className="bg-white dark:bg-[#262626] border border-neutral-200 dark:border-white/10 px-3 py-2 rounded-lg shadow-2xl backdrop-blur-md pointer-events-none" 
        style={{ 
          position: 'absolute',
          zIndex: 99999,
          left: `${coordinate.x}px`,
          top: `${coordinate.y - 70}px`,
          transform: 'translate(-50%, 0)',
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
    );
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
    <div className="group relative rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-xl border border-neutral-200 dark:border-white/5 flex flex-col justify-between transition-all duration-300 hover:border-neutral-300 dark:hover:border-white/10 hover:bg-neutral-50 dark:hover:bg-[#1e1e1e] hover:-translate-y-1 h-[200px] overflow-visible">

      {/* Metric Header Section */}
      <div className="z-10 relative pointer-events-none">
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

      {/* Animated Sparkline Section — full-width, bottom half */}
      <div className="absolute bottom-0 left-0 right-0 h-[55%] transition-opacity duration-500 group-hover:opacity-100 opacity-60 overflow-visible" style={{ zIndex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={convertChartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.stroke} stopOpacity={0.4} />
                <stop offset="95%" stopColor={theme.stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <Tooltip
              content={<CustomTooltip themeColor={theme.stroke} />}
              cursor={{ stroke: theme.stroke, strokeWidth: 1.5, strokeDasharray: '4 4' }}
              allowEscapeViewBox={{ x: true, y: true }}
              offset={20}
              wrapperStyle={{ zIndex: 99999, pointerEvents: 'none', outline: 'none', overflow: 'visible' }}
              animationDuration={0}
              position={{ x: 'auto', y: 'auto' }}
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
  );
};

export default MetricCard;
