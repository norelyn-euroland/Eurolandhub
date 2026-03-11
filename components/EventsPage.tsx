'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Applicant, EngagementRecord, IREvent, IREventType, ParticipantMode } from '../lib/types';
import { eventService } from '../services/eventService';
import CreateEventModal from './CreateEventModal';
import MiniCalendar from './MiniCalendar';
import WeeklyCalendar from './WeeklyCalendar';
import { generateEngagementRecords } from '../lib/engagementService';

interface EventsPageProps {
  applicants: Applicant[];
  applicantsLoading: boolean;
}

const EventsPage: React.FC<EventsPageProps> = ({ applicants, applicantsLoading }) => {
  // ─ State ─
  const [engagementRecords, setEngagementRecords] = useState<EngagementRecord[]>([]);
  const [events, setEvents] = useState<IREvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<IREvent | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [showNotesDropdown, setShowNotesDropdown] = useState(false);
  const [selectedEventTypeForCreate, setSelectedEventTypeForCreate] = useState<IREventType | null>(null);
  const [eventTypeFilters, setEventTypeFilters] = useState<Record<string, boolean>>({
    'Shareholder Meetings': true,
    'Internal Meetings': true,
    'Investor Calls': true,
    'Notes': true,
  });

  const eventTypeOptions = [
    { type: 'meeting' as IREventType, label: 'Shareholder Meeting', category: 'Shareholder Meetings' },
    { type: 'meeting' as IREventType, label: 'Investor Call', category: 'Investor Calls' },
    { type: 'briefing' as IREventType, label: 'Internal Strategy Meeting', category: 'Internal Meetings' },
    { type: 'webinar' as IREventType, label: 'Investor Webinar', category: 'Investor Calls' },
    { type: 'briefing' as IREventType, label: 'Board Meeting', category: 'Internal Meetings' },
    { type: 'other' as IREventType, label: 'General Note', category: 'Notes' },
  ];

  // ─ Data generation (for event participant selection) ─
  useEffect(() => {
    let isMounted = true;
    generateEngagementRecords(applicants).then((records) => {
      if (isMounted) {
        setEngagementRecords(records);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [applicants]);

  // ─ Load events from Firestore ─
  useEffect(() => {
    setEventsLoading(true);
    const unsubscribe = eventService.subscribe((fetchedEvents) => {
      setEvents(fetchedEvents);
      setEventsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ─ Filter events based on type filters ─
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Map event types to filter categories
      if (event.eventType === 'meeting' && !eventTypeFilters['Shareholder Meetings'] && !eventTypeFilters['Investor Calls']) {
        return false;
      }
      if (event.eventType === 'briefing' && !eventTypeFilters['Internal Meetings']) {
        return false;
      }
      if (event.eventType === 'other' && !eventTypeFilters['Notes']) {
        return false;
      }
      if (event.eventType === 'webinar' && !eventTypeFilters['Investor Calls']) {
        return false;
      }
      return true;
    });
  }, [events, eventTypeFilters]);

  const handleCreateEvent = useCallback(
    async (data: {
      title: string;
      description: string;
      eventType: IREventType;
      dateTime: string;
      endDateTime?: string;
      location?: string;
      meetingLink?: string;
      participantMode: ParticipantMode;
      selectedParticipants: string[];
    }) => {
      // Determine invited list based on participant mode
      let invited: string[] = [];
      if (data.participantMode === 'all') {
        invited = applicants.map((a) => a.id);
      } else if (data.participantMode === 'vip') {
        invited = engagementRecords
          .filter((r) => r.engagementLevel === 'high')
          .map((r) => r.investorId);
      } else {
        invited = data.selectedParticipants;
      }

      await eventService.create({
        title: data.title,
        description: data.description,
        eventType: data.eventType,
        dateTime: data.dateTime,
        endDateTime: data.endDateTime,
        location: data.location,
        meetingLink: data.meetingLink,
        createdBy: 'iro-admin',
        participantMode: data.participantMode,
        invitations: {
          invited,
          accepted: [],
          declined: [],
          pending: [...invited],
        },
      });

      setIsCreateEventOpen(false);
      setSelectedTimeSlot(null);
    },
    [applicants, engagementRecords]
  );

  const handleTimeSlotClick = (date: Date, hour: number) => {
    setSelectedTimeSlot({ date, hour });
    setIsCreateEventOpen(true);
  };

  const handleEventClick = (event: IREvent) => {
    setSelectedEvent(event);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleWeekNavigation = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction === 'prev' ? -7 : 7));
    setSelectedDate(newDate);
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  // Calculate week dates for highlighting in mini calendar
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

  // ─ Loading state ─
  if (applicantsLoading || eventsLoading) {
    return (
      <div className="space-y-8 max-w-screen-2xl mx-auto">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">Meetings</h2>
            <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
              Create and manage investor engagement meetings
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl h-[600px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto pb-12">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">
            Meetings
          </h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Create and manage investor engagement meetings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notes Button */}
          <button
            onClick={() => {
              setSelectedEventTypeForCreate('other');
              setIsCreateEventOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Notes
          </button>

          {/* Dropdown Menu for Event Types */}
          <div className="relative">
            <button
              onClick={() => setShowNotesDropdown(!showNotesDropdown)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showNotesDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNotesDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-20 py-1">
                  {eventTypeOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedEventTypeForCreate(option.type);
                        setShowNotesDropdown(false);
                        setIsCreateEventOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Calendar Layout ───────────────────────────────────────── */}
      <div className="flex gap-6">
        {/* Left Sidebar - Mini Calendar & Filters */}
        <div className="w-64 flex-shrink-0 space-y-4">
          {/* Mini Calendar */}
          <MiniCalendar selectedDate={selectedDate} onDateSelect={handleDateSelect} weekDates={weekDates} />

          {/* My Calendars Section */}
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider mb-3">
              My Calendars
            </h3>
            <div className="space-y-2">
              {Object.entries(eventTypeFilters).map(([type, enabled]) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) =>
                      setEventTypeFilters((prev) => ({
                        ...prev,
                        [type]: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors">
                    {type}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Main Calendar Area */}
        <div className="flex-1 min-w-0">
          <WeeklyCalendar
            selectedDate={selectedDate}
            events={filteredEvents}
            onEventClick={handleEventClick}
            onTimeSlotClick={handleTimeSlotClick}
            onWeekNavigate={handleWeekNavigation}
            onGoToToday={handleGoToToday}
          />
        </div>
      </div>

      {/* ── Create Event Modal ─────────────────────────────────────── */}
      <CreateEventModal
        isOpen={isCreateEventOpen}
        onClose={() => {
          setIsCreateEventOpen(false);
          setSelectedTimeSlot(null);
          setSelectedEventTypeForCreate(null);
        }}
        onSave={async (data) => {
          await handleCreateEvent(data);
          setSelectedEventTypeForCreate(null);
        }}
        applicants={applicants}
        initialDateTime={selectedTimeSlot ? (() => {
          const date = new Date(selectedTimeSlot.date);
          date.setHours(selectedTimeSlot.hour, 0, 0, 0);
          return date.toISOString().slice(0, 16);
        })() : undefined}
        initialEventType={selectedEventTypeForCreate}
      />

      {/* ── Event Detail Modal (placeholder for future) ──────────── */}
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
            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
              <p><strong>Date:</strong> {new Date(selectedEvent.dateTime).toLocaleString()}</p>
              {selectedEvent.location && <p><strong>Location:</strong> {selectedEvent.location}</p>}
              {selectedEvent.meetingLink && <p><strong>Meeting Link:</strong> <a href={selectedEvent.meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{selectedEvent.meetingLink}</a></p>}
              {selectedEvent.description && <p><strong>Description:</strong> {selectedEvent.description}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
