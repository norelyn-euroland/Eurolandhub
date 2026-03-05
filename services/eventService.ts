import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { IREvent, IREventType, ParticipantMode } from '../lib/types.js';

const EVENTS_COLLECTION = 'events';

/**
 * Convert Firestore Timestamp to ISO string
 */
const timestampToIso = (timestamp: any): string => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return new Date().toISOString();
};

/**
 * Convert Firestore document data to IREvent
 */
const docToEvent = (id: string, data: DocumentData): IREvent => {
  return {
    id,
    title: data.title || '',
    description: data.description || '',
    eventType: (data.eventType || 'other') as IREventType,
    dateTime: timestampToIso(data.dateTime),
    endDateTime: data.endDateTime ? timestampToIso(data.endDateTime) : undefined,
    location: data.location || undefined,
    meetingLink: data.meetingLink || undefined,
    createdBy: data.createdBy || '',
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    participantMode: (data.participantMode || 'all') as ParticipantMode,
    invitations: {
      invited: data.invitations?.invited || [],
      accepted: data.invitations?.accepted || [],
      declined: data.invitations?.declined || [],
      pending: data.invitations?.pending || [],
    },
  };
};

/**
 * Event Service - Firestore CRUD operations for events
 */
export const eventService = {
  /**
   * Create a new event
   */
  async create(event: Omit<IREvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<IREvent> {
    const eventsRef = collection(db, EVENTS_COLLECTION);
    const newDocRef = doc(eventsRef);
    const now = new Date().toISOString();

    const eventData = {
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      dateTime: event.dateTime,
      endDateTime: event.endDateTime || null,
      location: event.location || null,
      meetingLink: event.meetingLink || null,
      createdBy: event.createdBy,
      createdAt: now,
      updatedAt: now,
      participantMode: event.participantMode,
      invitations: {
        invited: event.invitations.invited,
        accepted: event.invitations.accepted,
        declined: event.invitations.declined,
        pending: event.invitations.pending,
      },
    };

    await setDoc(newDocRef, eventData);

    return {
      ...eventData,
      id: newDocRef.id,
      endDateTime: eventData.endDateTime || undefined,
      location: eventData.location || undefined,
      meetingLink: eventData.meetingLink || undefined,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Get all events ordered by dateTime descending
   */
  async getAll(): Promise<IREvent[]> {
    const eventsRef = collection(db, EVENTS_COLLECTION);
    const q = query(eventsRef, orderBy('dateTime', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => docToEvent(doc.id, doc.data()));
  },

  /**
   * Get a single event by ID
   */
  async getById(id: string): Promise<IREvent | null> {
    const docRef = doc(db, EVENTS_COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return docToEvent(snapshot.id, snapshot.data());
  },

  /**
   * Update an existing event
   */
  async update(id: string, updates: Partial<Omit<IREvent, 'id' | 'createdAt'>>): Promise<void> {
    const docRef = doc(db, EVENTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Delete an event
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, EVENTS_COLLECTION, id);
    await deleteDoc(docRef);
  },

  /**
   * Subscribe to real-time event updates
   */
  subscribe(onUpdate: (events: IREvent[]) => void): Unsubscribe {
    const eventsRef = collection(db, EVENTS_COLLECTION);
    const q = query(eventsRef, orderBy('dateTime', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map((doc) => docToEvent(doc.id, doc.data()));
      onUpdate(events);
    });
  },

  /**
   * Update invitation status for an investor
   */
  async updateInvitationStatus(
    eventId: string,
    investorId: string,
    status: 'accepted' | 'declined'
  ): Promise<void> {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');

    const invitations = { ...event.invitations };

    // Remove from pending
    invitations.pending = invitations.pending.filter((id) => id !== investorId);

    // Add to the appropriate list
    if (status === 'accepted') {
      invitations.declined = invitations.declined.filter((id) => id !== investorId);
      if (!invitations.accepted.includes(investorId)) {
        invitations.accepted.push(investorId);
      }
    } else {
      invitations.accepted = invitations.accepted.filter((id) => id !== investorId);
      if (!invitations.declined.includes(investorId)) {
        invitations.declined.push(investorId);
      }
    }

    await this.update(eventId, { invitations });
  },

  /**
   * Send invitations to investors
   */
  async sendInvitations(eventId: string, investorIds: string[]): Promise<void> {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');

    const invitations = { ...event.invitations };
    const existingIds = new Set([
      ...invitations.invited,
      ...invitations.accepted,
      ...invitations.declined,
      ...invitations.pending,
    ]);

    for (const id of investorIds) {
      if (!existingIds.has(id)) {
        invitations.invited.push(id);
        invitations.pending.push(id);
      }
    }

    await this.update(eventId, { invitations });
  },
};

