'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Applicant, EngagementRecord, IREvent, IREventType, ParticipantMode } from '../lib/types';
import { eventService } from '../services/eventService';
import CreateEventModal from './CreateEventModal';
import { generateEngagementRecords } from '../lib/engagementService';

// ── Constants ───────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const DOCUMENT_TITLES = [
  'Q4 2025 Earnings Report',
  'ESG Impact Report 2025',
  'Dividend Declaration – FY2025',
  'Board Governance Charter Update',
  'Annual General Meeting Notice 2026',
  'Strategic Partnership Press Release',
  'Q3 2025 Investor Presentation',
  'Material Information Disclosure',
  'Sustainability Roadmap 2026',
  'Corporate Governance Report',
];

const EVENT_TYPE_LABELS: Record<IREventType, string> = {
  meeting: 'Meeting',
  briefing: 'Briefing',
  webinar: 'Webinar',
  earnings_discussion: 'Earnings',
  other: 'Other',
};

// ── Helper Functions ───────────────────────────────────────────────────

const formatEventDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ── Main Component ──────────────────────────────────────────────────────

interface EventsPageProps {
  applicants: Applicant[];
  applicantsLoading: boolean;
}

const EventsPage: React.FC<EventsPageProps> = ({ applicants, applicantsLoading }) => {
  // ─ State ─
  const [engagementRecords, setEngagementRecords] = useState<EngagementRecord[]>([]);

  // Event management state
  const [events, setEvents] = useState<IREvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [eventToast, setEventToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });


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

  // Toast auto-hide
  useEffect(() => {
    if (eventToast.show) {
      const timer = setTimeout(() => setEventToast((prev) => ({ ...prev, show: false })), 3000);
      return () => clearTimeout(timer);
    }
  }, [eventToast.show]);


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

      setEventToast({ show: true, message: `Event "${data.title}" created successfully`, type: 'success' });
    },
    [applicants, engagementRecords]
  );

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    try {
      await eventService.delete(eventId);
      setEventToast({ show: true, message: 'Event deleted', type: 'success' });
    } catch (error) {
      setEventToast({ show: true, message: 'Failed to delete event', type: 'error' });
    }
  }, []);


  // ─ Loading state ─
  if (applicantsLoading) {
    return (
      <div className="space-y-8 max-w-screen-2xl mx-auto">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">Events</h2>
            <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
              Create and manage investor engagement events
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl h-[400px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto pb-12">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">
            Events
          </h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Create and manage investor engagement events
          </p>
        </div>
        <div className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
          {events.length} events scheduled
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          EVENT & MEETING MANAGEMENT
         ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Event & Meeting Management
            </h3>
            <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em] mt-0.5">
              Schedule and manage investor events
            </p>
          </div>
          <button
            onClick={() => setIsCreateEventOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Event
          </button>
        </div>

        {eventsLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-3 border border-dashed border-neutral-200 dark:border-neutral-700">
              <svg className="w-7 h-7 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">No events yet</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Create your first investor event or meeting
            </p>
            <button
              onClick={() => setIsCreateEventOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Create Event
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {events.map((event) => {
              const totalInvited = event.invitations.invited.length;
              const accepted = event.invitations.accepted.length;
              const declined = event.invitations.declined.length;
              const pending = event.invitations.pending.length;
              const isPast = new Date(event.dateTime) < new Date();

              return (
                <div key={event.id} className="px-5 py-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Event type icon */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPast ? 'bg-neutral-100 dark:bg-neutral-700' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
                        <svg className={`w-4.5 h-4.5 ${isPast ? 'text-neutral-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                            {event.title}
                          </h4>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isPast
                              ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          }`}>
                            {isPast ? 'Past' : 'Upcoming'}
                          </span>
                          <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                            {EVENT_TYPE_LABELS[event.eventType]}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">
                          {formatEventDate(event.dateTime)}
                          {event.location && ` · ${event.location}`}
                        </p>
                        {/* Invitation metrics */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400">Invited:</span>
                            <span className="text-[10px] font-bold text-neutral-900 dark:text-neutral-100">{totalInvited}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{accepted} accepted</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{declined} declined</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{pending} pending</span>
                          </div>
                        </div>
                        {/* RSVP progress bar */}
                        {totalInvited > 0 && (
                          <div className="flex h-1.5 rounded-full overflow-hidden mt-2 max-w-xs bg-neutral-100 dark:bg-neutral-700">
                            <div className="bg-emerald-500 transition-all" style={{ width: `${(accepted / totalInvited) * 100}%` }} />
                            <div className="bg-red-400 transition-all" style={{ width: `${(declined / totalInvited) * 100}%` }} />
                            <div className="bg-amber-400 transition-all" style={{ width: `${(pending / totalInvited) * 100}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                      title="Delete event"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* ── Create Event Modal ─────────────────────────────────────── */}
      <CreateEventModal
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        onSave={handleCreateEvent}
        applicants={applicants}
      />

      {/* ── Event Toast ────────────────────────────────────────────── */}
      {eventToast.show && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 transition-all duration-300 ${
          eventToast.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400'
        }`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {eventToast.type === 'success' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            )}
          </svg>
          <span className="text-xs font-bold">{eventToast.message}</span>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
