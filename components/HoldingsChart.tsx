'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineStyle, Time, ColorType } from 'lightweight-charts';
import { fetchHoldingsData } from '../lib/mockHoldingsData';
import { HoldingsDataPoint } from '../lib/types';

interface HoldingsChartProps {
  companyId: string;
}

type Timeframe = '1d' | '1w' | '1M' | '3M' | '6M' | 'YTD' | 'ALL';

const HoldingsChart: React.FC<HoldingsChartProps> = ({ companyId }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const sharePriceSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sharesHeldSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ownershipSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HoldingsDataPoint[]>([]);
  const [currentValues, setCurrentValues] = useState<{
    sharePrice: number;
    sharesHeld: number;
    ownership: number;
  } | null>(null);
  
  // Track previous values for percentage change calculation
  const previousValuesRef = useRef<{
    sharePrice: number;
    sharesHeld: number;
    ownership: number;
  } | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#1f2937',
        padding: {
          left: 0,
          right: 0,
        },
      },
      width: chartContainerRef.current.clientWidth || 800,
      height: 400,
      grid: {
        vertLines: { color: '#e5e7eb' },
        horzLines: { color: '#e5e7eb' },
      },
      crosshair: {
        mode: 1, // normal
        vertLine: {
          visible: true,
          width: 1,
          color: '#E0E0E0',
          style: 1, // Dashed/broken line
          labelVisible: true, // Enable default crosshair labels
        },
        horzLine: {
          visible: true, // Enable horizontal crosshair line
          width: 1,
          color: '#E0E0E0',
          style: 1, // Dashed/broken line
          labelVisible: true, // Enable default crosshair labels
        },
      },
      rightPriceScale: {
        borderColor: '#d1d5db',
        entireTextOnly: false,
      },
      leftPriceScale: {
        borderColor: '#d1d5db',
        entireTextOnly: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: false, // Disable vertical scaling - only allow horizontal
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Create three line series - enable default tooltips
    const sharePriceSeries = chart.addLineSeries({
      color: '#3b82f6', // Blue
      lineWidth: 2,
      priceScaleId: 'left',
      title: 'Share Price',
      priceLineVisible: false,
      lastValueVisible: true, // Enable default value display
    });

    const sharesHeldSeries = chart.addLineSeries({
      color: '#10b981', // Green
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'Shares Held',
      priceLineVisible: false,
      lastValueVisible: true, // Enable default value display
    });

    const ownershipSeries = chart.addLineSeries({
      color: '#ef4444', // Red
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'right',
      title: 'Ownership %',
      priceLineVisible: false,
      lastValueVisible: true, // Enable default value display
    });

    sharePriceSeriesRef.current = sharePriceSeries;
    sharesHeldSeriesRef.current = sharesHeldSeries;
    ownershipSeriesRef.current = ownershipSeries;

    // Configure time scale to extend to edges
    chart.timeScale().applyOptions({
      rightBarStaysOnScroll: true,
      timeVisible: true,
      secondsVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
      borderVisible: false,
    });

    // Handle resize - ensure chart always takes full width
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const width = chartContainerRef.current.clientWidth;
        if (width > 0) {
          chartRef.current.applyOptions({
            width: width,
          });
        }
      }
    };

    // Initial resize to ensure proper width
    setTimeout(handleResize, 0);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

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

  // Update chart when data changes
  useEffect(() => {
    if (!sharePriceSeriesRef.current || !sharesHeldSeriesRef.current || !ownershipSeriesRef.current || data.length === 0) {
      return;
    }

    // Convert data to chart format
    const sharePriceData = data.map((point) => ({
      time: (new Date(point.timestamp).getTime() / 1000) as Time,
      value: point.share_price,
    }));

    const sharesHeldData = data.map((point) => ({
      time: (new Date(point.timestamp).getTime() / 1000) as Time,
      value: point.shares_held / 1_000_000, // Convert to millions
    }));

    const ownershipData = data.map((point) => ({
      time: (new Date(point.timestamp).getTime() / 1000) as Time,
      value: (point.shares_held / point.total_shares_outstanding) * 100, // Calculate percentage
    }));

    // Set all series data first
    sharePriceSeriesRef.current.setData(sharePriceData);
    sharesHeldSeriesRef.current.setData(sharesHeldData);
    ownershipSeriesRef.current.setData(ownershipData);

    // Update current values from latest data point
    if (data.length > 0) {
      const latest = data[data.length - 1];
      const currentSharePrice = latest.share_price;
      const currentSharesHeld = latest.shares_held / 1_000_000;
      const currentOwnership = (latest.shares_held / latest.total_shares_outstanding) * 100;
      
      // Store current values as previous before updating (for percentage change calculation)
      if (currentValues) {
        previousValuesRef.current = {
          sharePrice: currentValues.sharePrice,
          sharesHeld: currentValues.sharesHeld,
          ownership: currentValues.ownership,
        };
      } else {
        // First time - no previous values, so set current as previous
        previousValuesRef.current = {
          sharePrice: currentSharePrice,
          sharesHeld: currentSharesHeld,
          ownership: currentOwnership,
        };
      }
      
      // Update current values
      setCurrentValues({
        sharePrice: currentSharePrice,
        sharesHeld: currentSharesHeld,
        ownership: currentOwnership,
      });
    }

    // Fit content AFTER setting all data - this ensures chart extends to edges
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
      // Ensure chart uses full width
      if (chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    }
  }, [data]);

  // Default TradingView tooltip is now enabled via labelVisible: true in crosshair config
  // No custom tooltip needed - the library handles it automatically

  const timeframes: Timeframe[] = ['1d', '1w', '1M', '3M', '6M', 'YTD', 'ALL'];

  return (
    <div className="w-full">
      {/* Timeframe Filters */}
      <div className="flex gap-2 mb-4">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded ${
              timeframe === tf
                ? 'bg-black text-white border-2 border-black'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border-2 border-transparent'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Current Values Display - Below Filters with Percentage Change */}
      {currentValues && (() => {
        // Calculate percentage changes
        const prev = previousValuesRef.current;
        const calculateChange = (current: number, previous: number) => {
          if (!previous || previous === 0) return { value: 0, percent: 0 };
          const change = current - previous;
          const percent = (change / previous) * 100;
          return { value: change, percent };
        };

        const sharePriceChange = prev ? calculateChange(currentValues.sharePrice, prev.sharePrice) : { value: 0, percent: 0 };
        const sharesHeldChange = prev ? calculateChange(currentValues.sharesHeld, prev.sharesHeld) : { value: 0, percent: 0 };
        const ownershipChange = prev ? calculateChange(currentValues.ownership, prev.ownership) : { value: 0, percent: 0 };

        const formatChange = (change: { value: number; percent: number }, isPrice: boolean = false) => {
          const sign = change.percent >= 0 ? '+' : '';
          const valueStr = isPrice 
            ? `$${Math.abs(change.value).toFixed(3)}` 
            : Math.abs(change.value).toFixed(3);
          const percentStr = `${sign}${change.percent.toFixed(2)}%`;
          return `${valueStr} (${percentStr})`;
        };

        return (
          <div className="flex gap-8 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Share Price:</span>
              <span className="text-lg font-black" style={{ color: '#3b82f6' }}>
                ${currentValues.sharePrice.toFixed(3)}
              </span>
              {prev && (
                <span 
                  className="text-sm font-bold" 
                  style={{ color: sharePriceChange.percent >= 0 ? '#10b981' : '#ef4444' }}
                >
                  {formatChange(sharePriceChange, true)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Holdings:</span>
              <span className="text-lg font-black" style={{ color: '#10b981' }}>
                {currentValues.sharesHeld.toFixed(2)}M
              </span>
              {prev && (
                <span 
                  className="text-sm font-bold" 
                  style={{ color: sharesHeldChange.percent >= 0 ? '#10b981' : '#ef4444' }}
                >
                  {formatChange(sharesHeldChange)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Ownership:</span>
              <span className="text-lg font-black" style={{ color: '#ef4444' }}>
                {currentValues.ownership.toFixed(2)}%
              </span>
              {prev && (
                <span 
                  className="text-sm font-bold" 
                  style={{ color: ownershipChange.percent >= 0 ? '#10b981' : '#ef4444' }}
                >
                  {formatChange(ownershipChange)}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Chart Container */}
      <div className="relative w-full" style={{ position: 'relative', zIndex: 1 }}>
        <div 
          ref={chartContainerRef} 
          className="w-full" 
          style={{ 
            height: '400px', 
            minWidth: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        />

        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="text-sm font-bold text-neutral-600">Loading chart data...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HoldingsChart;

