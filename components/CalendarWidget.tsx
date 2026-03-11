'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { IREvent } from '../lib/types';
import { eventService } from '../services/eventService';
import { todoService } from '../services/todoService';
import MonthlyCalendar from './MonthlyCalendar';

interface CalendarWidgetProps {
  onEventClick?: (event: IREvent) => void;
}

interface DashboardCalendarItem {
  id: string;
  title: string;
  kind: 'task' | 'note';
  scheduledAt: string; // ISO datetime
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ onEventClick }) => {
  const [events, setEvents] = useState<IREvent[]>([]);
  const [dashboardItems, setDashboardItems] = useState<DashboardCalendarItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<IREvent | null>(null);

  // Load events from Firestore using the same service as Meetings page
  useEffect(() => {
    setEventsLoading(true);
    const unsubscribe = eventService.subscribe((fetchedEvents) => {
      setEvents(fetchedEvents);
      setEventsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load dashboard-local calendar entries (tasks/notes created from dashboard calendar)
  useEffect(() => {
    const loadItems = () => {
      try {
        const raw = localStorage.getItem('dashboard-calendar-items');
        if (raw) {
          const parsed = JSON.parse(raw) as DashboardCalendarItem[];
          setDashboardItems(Array.isArray(parsed) ? parsed : []);
        }
      } catch {
        setDashboardItems([]);
      }
    };

    loadItems();

    // Listen for updates from TodoTaskWidget
    const handleUpdate = () => {
      loadItems();
    };
    window.addEventListener('dashboard-calendar-updated', handleUpdate);
    return () => window.removeEventListener('dashboard-calendar-updated', handleUpdate);
  }, []);

  // Save dashboard items to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('dashboard-calendar-items', JSON.stringify(dashboardItems));
    } catch {
      // ignore localStorage issues
    }
  }, [dashboardItems]);

  const dashboardItemEvents = useMemo(() => {
    return dashboardItems.map((item) => {
      const start = new Date(item.scheduledAt);
      const end = new Date(start);
      end.setMinutes(start.getMinutes() + 30);
      const nowIso = new Date().toISOString();

      return {
        id: `dash-${item.id}`,
        title: `${item.kind === 'task' ? 'Task' : 'Note'}: ${item.title}`,
        description: item.kind === 'task' ? 'Dashboard task' : 'Dashboard note',
        eventType: 'other' as const,
        dateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        createdBy: 'iro-admin',
        createdAt: nowIso,
        updatedAt: nowIso,
        participantMode: 'selected' as const,
        invitations: {
          invited: [],
          accepted: [],
          declined: [],
          pending: [],
        },
      };
    });
  }, [dashboardItems]);

  const dashboardDisplayEvents = useMemo(() => {
    return [...events, ...dashboardItemEvents];
  }, [events, dashboardItemEvents]);

  const handleEventClick = (event: IREvent) => {
    setSelectedEvent(event);
    if (onEventClick) {
      onEventClick(event);
    }
  };

  // Check if event is a dashboard-created item (can be deleted)
  const isDashboardItem = (event: IREvent) => {
    return event.id.startsWith('dash-');
  };

  const handleDeleteDashboardItem = (event: IREvent) => {
    if (!isDashboardItem(event)) return;
    
    // Extract the original item ID from the event ID (dash-{id})
    const itemId = event.id.replace('dash-', '');
    setDashboardItems((prev) => prev.filter((item) => item.id !== itemId));
    setSelectedEvent(null);
  };


  const handleMonthNavigation = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setSelectedDate(newDate);
  };

  const handleDayClick = (date: Date) => {
    // Optional: Could show a modal with all events for that day
    // For now, just update selected date
    setSelectedDate(date);
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  if (eventsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading calendar events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <MonthlyCalendar
        selectedDate={selectedDate}
        events={dashboardDisplayEvents}
        onEventClick={handleEventClick}
        onDayClick={handleDayClick}
        onMonthNavigate={handleMonthNavigation}
        onGoToToday={handleGoToToday}
        compact={true}
      />

      {/* Event Detail Modal with Delete Option for Dashboard Items */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setIsAddOpen(false)}
        >
          <div
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-5 w-full max-w-md mx-4 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Add Calendar Item</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              {selectedSlot.toLocaleString()}
            </p>

            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setEntryKind('task')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${entryKind === 'task'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-neutral-50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-600'
                  }`}
              >
                Task
              </button>
              <button
                onClick={() => setEntryKind('note')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${entryKind === 'note'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-neutral-50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-600'
                  }`}
              >
                Note
              </button>
            </div>

            <input
              type="text"
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder={`Add ${entryKind} title...`}
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700/60 border border-neutral-200 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsAddOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEntry}
                disabled={!entryTitle.trim()}
                className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal with Delete Option for Dashboard Items */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-6 max-w-lg mx-4 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{selectedEvent.title}</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              <p><strong>Date:</strong> {new Date(selectedEvent.dateTime).toLocaleString()}</p>
              {selectedEvent.endDateTime && (
                <p><strong>End:</strong> {new Date(selectedEvent.endDateTime).toLocaleString()}</p>
              )}
              {selectedEvent.location && <p><strong>Location:</strong> {selectedEvent.location}</p>}
              {selectedEvent.meetingLink && (
                <p>
                  <strong>Meeting Link:</strong>{' '}
                  <a
                    href={selectedEvent.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {selectedEvent.meetingLink}
                  </a>
                </p>
              )}
              {selectedEvent.description && <p><strong>Description:</strong> {selectedEvent.description}</p>}
            </div>
            {isDashboardItem(selectedEvent) && (
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <button
                  onClick={() => handleDeleteDashboardItem(selectedEvent)}
                  className="w-full px-4 py-2 text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  Delete from Calendar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarWidget;

