'use client';

import React, { useState, useEffect, useRef } from 'react';
import { IREventType, ParticipantMode, Applicant } from '../lib/types';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    eventType: IREventType;
    dateTime: string;
    endDateTime?: string;
    location?: string;
    meetingLink?: string;
    participantMode: ParticipantMode;
    selectedParticipants: string[];
  }) => Promise<void>;
  applicants: Applicant[];
}

const EVENT_TYPES: { value: IREventType; label: string }[] = [
  { value: 'meeting', label: 'Investor Meeting' },
  { value: 'briefing', label: 'Shareholder Briefing' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'earnings_discussion', label: 'Earnings Discussion' },
  { value: 'other', label: 'Other' },
];

const PARTICIPANT_MODES: { value: ParticipantMode; label: string; description: string }[] = [
  { value: 'all', label: 'All Shareholders', description: 'Send to all verified shareholders' },
  { value: 'selected', label: 'Selected Investors', description: 'Choose specific investors' },
  { value: 'vip', label: 'VIP Investors', description: 'High-engagement investors only' },
];

const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  applicants,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<IREventType>('meeting');
  const [dateTime, setDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [participantMode, setParticipantMode] = useState<ParticipantMode>('all');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setHasUnsavedChanges(false);
      setShowCloseConfirm(false);
    } else {
      setTitle('');
      setDescription('');
      setEventType('meeting');
      setDateTime('');
      setEndDateTime('');
      setLocation('');
      setMeetingLink('');
      setParticipantMode('all');
      setSelectedParticipants([]);
      setParticipantSearch('');
      setHasUnsavedChanges(false);
    }
  }, [isOpen]);

  // Track unsaved changes
  useEffect(() => {
    if (isOpen && (title || description || dateTime)) {
      setHasUnsavedChanges(true);
    }
  }, [title, description, dateTime, isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasUnsavedChanges]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = (action: 'discard' | 'cancel') => {
    if (action === 'discard') {
      setHasUnsavedChanges(false);
      onClose();
    }
    setShowCloseConfirm(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !dateTime) return;

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        eventType,
        dateTime: new Date(dateTime).toISOString(),
        endDateTime: endDateTime ? new Date(endDateTime).toISOString() : undefined,
        location: location.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
        participantMode,
        selectedParticipants,
      });
      setHasUnsavedChanges(false);
      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const filteredApplicants = applicants.filter((a) => {
    if (!participantSearch.trim()) return true;
    const q = participantSearch.toLowerCase();
    return (
      a.fullName.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - covers main content area only, not sidebar */}
      <div
        className="fixed top-0 right-0 bottom-0 left-64 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-40 transition-all duration-300"
        onClick={handleClose}
      />

      {/* Modal Container - centered within content area (right of sidebar) */}
      <div className="fixed top-0 right-0 bottom-0 left-64 z-50 flex items-center justify-center transition-all duration-300">

      {/* Close confirmation overlay */}
      {showCloseConfirm && (
        <div className="fixed top-0 right-0 bottom-0 left-64 z-[60] flex items-center justify-center bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-6 max-w-sm mx-4 border border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Discard changes?
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              You have unsaved changes. Are you sure you want to close?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleConfirmClose('cancel')}
                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={() => handleConfirmClose('discard')}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col z-50"
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700">
          <div>
            <h2 className="text-lg font-black text-neutral-900 dark:text-neutral-100 tracking-tight uppercase">
              Create Event
            </h2>
            <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-0.5">
              Schedule investor meetings & events
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Event Title */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-[0.15em]">
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              placeholder="e.g. Q1 2026 Earnings Discussion"
            />
          </div>

          {/* Event Type & Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-[0.15em]">
                Event Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as IREventType)}
                className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              >
                {EVENT_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>
                    {et.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-[0.15em]">
                Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-[0.15em]">
              End Date & Time <span className="text-neutral-400 dark:text-neutral-500">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-[0.15em]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors resize-none"
              placeholder="Describe the event agenda and purpose..."
            />
          </div>

          {/* Location / Meeting Link Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-[0.15em]">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                placeholder="e.g. Conference Room A"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-[0.15em]">
                Meeting Link
              </label>
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                placeholder="https://zoom.us/j/..."
              />
            </div>
          </div>

          {/* Participant Selection */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-[0.15em]">
              Invite Participants
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PARTICIPANT_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setParticipantMode(mode.value)}
                  className={`px-3 py-2.5 rounded-lg border text-left transition-all ${
                    participantMode === mode.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/30'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <div className={`text-xs font-bold ${participantMode === mode.value ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                    {mode.label}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {mode.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Participants List (only when mode is 'selected') */}
          {participantMode === 'selected' && (
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-[0.15em]">
                Select Investors ({selectedParticipants.length} selected)
              </label>
              <input
                type="text"
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors mb-2"
                placeholder="Search investors by name or email..."
              />
              <div className="max-h-40 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredApplicants.slice(0, 50).map((applicant) => (
                  <label
                    key={applicant.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedParticipants.includes(applicant.id)}
                      onChange={() => toggleParticipant(applicant.id)}
                      className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-blue-500 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {applicant.fullName}
                      </div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                        {applicant.email}
                      </div>
                    </div>
                  </label>
                ))}
                {filteredApplicants.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
                    No investors found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim() || !dateTime}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              'Create Event'
            )}
          </button>
        </div>
      </div>
      </div>
    </>
  );
};

export default CreateEventModal;

