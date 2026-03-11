import React, { useState, useEffect, useMemo } from 'react';
import { IREvent, TodoTask } from '../lib/types';
import { eventService } from '../services/eventService';
import { todoService } from '../services/todoService';
import MonthlyCalendar from './MonthlyCalendar';

interface CalendarWidgetProps {
  onEventClick?: (event: IREvent) => void;
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ onEventClick }) => {
  const [events, setEvents] = useState<IREvent[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<IREvent | null>(null);

  // Load events and tasks from Firestore
  useEffect(() => {
    setLoading(true);
    
    // Subscribe to events (meetings, briefings, etc.)
    const unsubscribeEvents = eventService.subscribe((fetchedEvents) => {
      setEvents(fetchedEvents);
    });

    // Subscribe to tasks (IRO to-do tasks)
    const unsubscribeTasks = todoService.subscribe('iro-admin', (fetchedTasks) => {
      setTasks(fetchedTasks);
    });

    // We can't easily wait for both since they are separate subscriptions,
    // but we can set loading to false after a short delay or when first data arrives
    const timer = setTimeout(() => setLoading(false), 800);

    return () => {
      unsubscribeEvents();
      unsubscribeTasks();
      clearTimeout(timer);
    };
  }, []);

  // Map tasks to IREvent objects so they can be displayed on the calendar
  const taskEvents = useMemo(() => {
    return tasks.map((task) => {
      const date = task.scheduledDate ? new Date(task.scheduledDate) : new Date(task.createdAt);
      // Ensure it's a valid date
      const validDate = isNaN(date.getTime()) ? new Date() : date;
      
      const nowIso = new Date().toISOString();

      return {
        id: `task-${task.id}`,
        title: task.title, // Show only title, no "Task:" prefix
        description: task.description || 'IRO to-do task',
        eventType: 'other' as const,
        dateTime: validDate.toISOString(),
        createdBy: task.createdBy,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completed: task.completed, // Custom property for rendering
        participantMode: 'selected' as const,
        invitations: { invited: [], accepted: [], declined: [], pending: [] },
      } as any; // Cast to any to allow extra properties like 'completed'
    });
  }, [tasks]);

  const allDisplayEvents = useMemo(() => {
    return [...events, ...taskEvents];
  }, [events, taskEvents]);

  const handleEventClick = (event: IREvent) => {
    setSelectedEvent(event);
    if (onEventClick) {
      onEventClick(event);
    }
  };

  const handleMonthNavigation = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setSelectedDate(newDate);
  };

  const handleDayClick = (date: Date) => {
    // Dispatch custom event for TodoTaskWidget to set active date (NOT open modal)
    const event = new CustomEvent('calendar-day-selected', { 
      detail: { date: date.toISOString().split('T')[0] } 
    });
    window.dispatchEvent(event);
    setSelectedDate(date);
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  if (loading && events.length === 0 && tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <MonthlyCalendar
        selectedDate={selectedDate}
        events={allDisplayEvents}
        onEventClick={handleEventClick}
        onDayClick={handleDayClick}
        onMonthNavigate={handleMonthNavigation}
        onGoToToday={handleGoToToday}
        compact={true}
      />

      {/* Detail Modal for Calendar Events/Tasks */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-neutral-200 dark:border-neutral-700 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 inline-block ${
                  selectedEvent.id.startsWith('task-') 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                }`}>
                  {selectedEvent.id.startsWith('task-') ? 'To-do Task' : selectedEvent.eventType}
                </span>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{new Date(selectedEvent.dateTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              
              {selectedEvent.description && (
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-neutral-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  <p className="flex-1">{selectedEvent.description}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 text-sm font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarWidget;

