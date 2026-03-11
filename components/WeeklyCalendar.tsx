'use client';

import React, { useMemo } from 'react';
import { IREvent } from '../lib/types';

interface WeeklyCalendarProps {
  selectedDate: Date;
  events: IREvent[];
  onEventClick: (event: IREvent) => void;
  onTimeSlotClick?: (date: Date, hour: number) => void; // Optional for view-only mode
  onWeekNavigate?: (direction: 'prev' | 'next') => void;
  onGoToToday?: () => void;
  readOnly?: boolean; // New prop: if true, disable create/edit functionality
  compact?: boolean; // Compact mode for dashboard usage
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  selectedDate,
  events,
  onEventClick,
  onTimeSlotClick,
  onWeekNavigate,
  onGoToToday,
  readOnly = false,
  compact = false,
}) => {
  // Get the week containing the selected date (Monday to Sunday)
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const dayOfWeek = selectedDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday = 0
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() + mondayOffset);

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [selectedDate]);

  // Time slots from 6 AM to 10 PM (or compact business hours for dashboard mini mode)
  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    const startHour = compact ? 9 : 6;
    const endHour = compact ? 16 : 22;
    for (let hour = startHour; hour <= endHour; hour++) {
      slots.push(hour);
    }
    return slots;
  }, [compact]);

  // Get events for a specific date and hour
  const getEventsForSlot = (date: Date, hour: number) => {
    return events.filter((event) => {
      const eventStart = new Date(event.dateTime);
      const eventEnd = event.endDateTime ? new Date(event.endDateTime) : new Date(eventStart.getTime() + 60 * 60 * 1000); // Default 1 hour
      const eventDay = eventStart.getDate();
      const eventMonth = eventStart.getMonth();
      const eventYear = eventStart.getFullYear();

      // Check if event is on this date
      if (eventDay !== date.getDate() || eventMonth !== date.getMonth() || eventYear !== date.getFullYear()) {
        return false;
      }

      // Check if event overlaps with this hour slot
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      return eventStart < slotEnd && eventEnd > slotStart;
    });
  };

  // Format date range for header
  const formatDateRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (start.getMonth() === end.getMonth()) {
      return `${monthNames[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
    } else {
      return `${monthNames[start.getMonth()]} ${start.getDate()} – ${monthNames[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
    }
  };

  // Navigate to previous/next week
  const navigateWeek = (direction: 'prev' | 'next') => {
    if (onWeekNavigate) {
      onWeekNavigate(direction);
    }
  };

  // Go to today
  const goToToday = () => {
    if (onGoToToday) {
      onGoToToday();
    }
  };

  const formatTime = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
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

  const headerPaddingClass = compact ? 'px-3 py-2' : 'px-6 py-4';
  const titleClass = compact ? 'text-sm font-bold' : 'text-lg font-bold';
  const buttonPaddingClass = compact ? 'px-2 py-1 text-[10px] font-bold' : 'px-3 py-1.5 text-xs font-bold';
  const navIconClass = compact ? 'w-4 h-4' : 'w-5 h-5';
  const dayHeaderHeightClass = compact ? 'h-10' : 'h-16';
  const slotHeightClass = compact ? 'h-8' : 'h-16';
  const dayNumberClass = compact
    ? 'text-xs font-bold mt-0.5'
    : 'text-lg font-bold mt-1';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      {/* Header with navigation */}
      <div className={`${headerPaddingClass} border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between`}>
        <div>
          <h3 className={`${titleClass} text-neutral-900 dark:text-neutral-100`}>{formatDateRange()}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
            aria-label="Previous week"
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
            onClick={() => navigateWeek('next')}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
            aria-label="Next week"
          >
            <svg className={`${navIconClass} text-neutral-600 dark:text-neutral-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        className={compact ? 'flex-1 overflow-hidden' : 'flex-1 overflow-auto'}
        style={compact ? undefined : { maxHeight: 'calc(100vh - 300px)' }}
      >
        <div className="grid grid-cols-8" style={compact ? undefined : { minWidth: '800px' }}>
          {/* Time column */}
          <div className="border-r border-neutral-200 dark:border-neutral-700">
            <div className={`${dayHeaderHeightClass} border-b border-neutral-200 dark:border-neutral-700`} /> {/* Header spacer */}
            {timeSlots.map((hour) => (
              <div
                key={hour}
                className={`${slotHeightClass} border-b border-neutral-100 dark:border-neutral-700/50 px-3 py-1`}
              >
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{formatTime(hour)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, dayIndex) => (
            <div key={dayIndex} className="border-r border-neutral-200 dark:border-neutral-700 last:border-r-0">
              {/* Day header */}
              <div className={`${dayHeaderHeightClass} border-b border-neutral-200 dark:border-neutral-700 px-2 py-2 flex items-center justify-center`}>
                <div className="text-center">
                  <div className={`text-xs font-bold uppercase tracking-wider ${date.toDateString() === new Date().toDateString() ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}
                  </div>
                  <div className={`${dayNumberClass} ${date.toDateString() === new Date().toDateString() ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                    {date.getDate()}
                  </div>
                </div>
              </div>

              {/* Time slots */}
              {timeSlots.map((hour) => {
                const slotEvents = getEventsForSlot(date, hour);
                const slotDate = new Date(date);
                slotDate.setHours(hour, 0, 0, 0);

                return (
                  <div
                    key={hour}
                    onClick={() => !readOnly && onTimeSlotClick && onTimeSlotClick(slotDate, hour)}
                    className={`${slotHeightClass} border-b border-neutral-100 dark:border-neutral-700/50 px-1 py-0.5 transition-colors relative group ${
                      readOnly || !onTimeSlotClick
                        ? 'cursor-default'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/30 cursor-pointer'
                    }`}
                  >
                    {!readOnly && onTimeSlotClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTimeSlotClick(slotDate, hour);
                        }}
                        className={`absolute top-0.5 right-0.5 rounded border border-neutral-300/80 dark:border-neutral-600/80 bg-white/90 dark:bg-neutral-800/90 text-neutral-500 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 px-1 leading-none opacity-0 group-hover:opacity-100 transition ${compact ? 'text-[9px]' : 'text-[10px]'}`}
                        aria-label="Add item"
                      >
                        +
                      </button>
                    )}
                    {slotEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className={`mb-1 ${compact ? 'px-1 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'} rounded font-medium border cursor-pointer hover:opacity-80 transition-opacity ${getEventColor(event.eventType)}`}
                        title={event.title}
                      >
                        <div className="font-bold truncate">{event.title}</div>
                        {event.meetingLink && (
                          <div className="text-[9px] opacity-75 truncate mt-0.5">
                            {event.meetingLink.includes('teams') ? 'Microsoft Teams' : event.meetingLink.includes('zoom') ? 'Zoom' : 'Meeting Link'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendar;

