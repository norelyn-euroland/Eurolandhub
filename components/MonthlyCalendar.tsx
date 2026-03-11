'use client';

import React, { useMemo } from 'react';
import { IREvent } from '../lib/types';

interface MonthlyCalendarProps {
  selectedDate: Date;
  events: IREvent[];
  onEventClick: (event: IREvent) => void;
  onDayClick?: (date: Date) => void; // Optional for clicking on a day
  onMonthNavigate?: (direction: 'prev' | 'next') => void;
  onGoToToday?: () => void;
  compact?: boolean; // Compact mode for dashboard usage
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  selectedDate,
  events,
  onEventClick,
  onDayClick,
  onMonthNavigate,
  onGoToToday,
  compact = false,
}) => {
  // Get all days in the month
  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDay.getDay();
    
    // Get the last day of the previous month to fill the first week
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    const days: (Date | null)[] = [];
    
    // Add days from previous month to fill the first week
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }
    
    // Add all days of the current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    // Fill remaining days to complete the last week (next month)
    const remainingDays = 42 - days.length; // 6 weeks × 7 days = 42
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day));
    }
    
    return days;
  }, [selectedDate]);

  // Get events for a specific date
  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];
    
    return events.filter((event) => {
      const eventDate = new Date(event.dateTime);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Format month and year for header
  const formatMonthYear = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  };

  // Navigate to previous/next month
  const navigateMonth = (direction: 'prev' | 'next') => {
    if (onMonthNavigate) {
      onMonthNavigate(direction);
    }
  };

  // Go to today
  const goToToday = () => {
    if (onGoToToday) {
      onGoToToday();
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'meeting':
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100';
      case 'briefing':
        return 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100';
      case 'webinar':
        return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100';
      case 'earnings_discussion':
        return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100';
      default:
        return 'bg-neutral-100 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100';
    }
  };

  const isCurrentMonth = (date: Date | null) => {
    if (!date) return false;
    return date.getMonth() === selectedDate.getMonth() && date.getFullYear() === selectedDate.getFullYear();
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const headerPaddingClass = compact ? 'px-3 py-2' : 'px-4 py-3';
  const titleClass = compact ? 'text-sm font-bold' : 'text-base font-bold';
  const buttonPaddingClass = compact ? 'px-2 py-1 text-[10px] font-bold' : 'px-3 py-1.5 text-xs font-bold';
  const navIconClass = compact ? 'w-4 h-4' : 'w-5 h-5';
  const dayCellClass = compact ? 'h-12' : 'h-16';
  const dayNumberClass = compact ? 'text-xs' : 'text-sm';
  const eventTextClass = compact ? 'text-[8px]' : 'text-[9px]';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      {/* Header with navigation */}
      <div className={`${headerPaddingClass} border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between`}>
        <div>
          <h3 className={`${titleClass} text-neutral-900 dark:text-neutral-100`}>{formatMonthYear()}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
            aria-label="Previous month"
          >
            <svg className={`${navIconClass} text-neutral-600 dark:text-neutral-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className={`${buttonPaddingClass} text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors`}
          >
            Today
          </button>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
            aria-label="Next month"
          >
            <svg className={`${navIconClass} text-neutral-600 dark:text-neutral-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day names header */}
      <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
          <div
            key={dayName}
            className={`${compact ? 'px-1 py-1.5' : 'px-2 py-2'} text-center border-r border-neutral-200 dark:border-neutral-700 last:border-r-0`}
          >
            <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400`}>
              {dayName}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {monthDays.map((date, index) => {
          const dayEvents = getEventsForDate(date);
          const isCurrentMonthDay = isCurrentMonth(date);
          const isTodayDay = isToday(date);

          return (
            <div
              key={index}
              onClick={() => date && onDayClick && onDayClick(date)}
              className={`${dayCellClass} border-r border-b border-neutral-200 dark:border-neutral-700 last:border-r-0 p-1 overflow-hidden ${
                !isCurrentMonthDay
                  ? 'bg-neutral-50/50 dark:bg-neutral-900/30'
                  : isTodayDay
                  ? 'bg-blue-50/50 dark:bg-blue-900/10'
                  : 'bg-white dark:bg-neutral-800'
              } ${onDayClick && date ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/30' : ''} transition-colors relative`}
            >
              {/* Day number */}
              <div
                className={`${dayNumberClass} font-bold mb-0.5 ${
                  !isCurrentMonthDay
                    ? 'text-neutral-300 dark:text-neutral-600'
                    : isTodayDay
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-neutral-900 dark:text-neutral-100'
                }`}
              >
                {date ? date.getDate() : ''}
              </div>

              {/* Events list */}
              <div className="space-y-0.5 overflow-y-auto max-h-full">
                {dayEvents.slice(0, compact ? 2 : 3).map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={`${eventTextClass} px-1 py-0.5 rounded font-medium border cursor-pointer hover:opacity-80 transition-opacity truncate ${getEventColor(event.eventType)}`}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > (compact ? 2 : 3) && (
                  <div className={`${eventTextClass} px-1 py-0.5 text-neutral-500 dark:text-neutral-400 font-medium`}>
                    +{dayEvents.length - (compact ? 2 : 3)} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthlyCalendar;

