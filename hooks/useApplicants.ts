import { useState, useEffect, useCallback, useRef } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import { applicantService } from '../lib/firestore-service';

interface UseApplicantsOptions {
  status?: RegistrationStatus;
  limitCount?: number;
  autoFetch?: boolean;
  realTime?: boolean; // Enable real-time updates
}

/**
 * Custom hook for managing applicants data from Firestore with real-time updates
 */
export const useApplicants = (options: UseApplicantsOptions = { autoFetch: true, realTime: true }) => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const fetchApplicants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await applicantService.getAll({
        status: options.status,
        limitCount: options.limitCount
      });
      setApplicants(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch applicants'));
      console.error('Error fetching applicants:', err);
    } finally {
      setLoading(false);
    }
  }, [options.status, options.limitCount]);

  // Set up real-time subscription
  useEffect(() => {
    if (options.autoFetch === false) return;
    
    if (options.realTime !== false) {
      // Use real-time subscription
      setLoading(true);
      setError(null);
      
      try {
        const unsubscribe = applicantService.subscribeToApplicants(
          (data) => {
            setApplicants(data);
            setLoading(false);
            setError(null);
          },
          {
            status: options.status,
            limitCount: options.limitCount
          }
        );
        
        unsubscribeRef.current = unsubscribe;
        
        return () => {
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
        };
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to subscribe to applicants'));
        console.error('Error setting up subscription:', err);
        setLoading(false);
        // Fallback to one-time fetch
        fetchApplicants();
      }
    } else {
      // Use one-time fetch
      fetchApplicants();
    }
  }, [options.status, options.limitCount, options.autoFetch, options.realTime, fetchApplicants]);

  const createApplicant = useCallback(async (applicant: Applicant) => {
    try {
      await applicantService.create(applicant);
      await fetchApplicants(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create applicant'));
      throw err;
    }
  }, [fetchApplicants]);

  const updateApplicant = useCallback(async (applicantId: string, updates: Partial<Applicant>) => {
    try {
      await applicantService.update(applicantId, updates);
      await fetchApplicants(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update applicant'));
      throw err;
    }
  }, [fetchApplicants]);

  const updateApplicantStatus = useCallback(async (applicantId: string, status: RegistrationStatus) => {
    try {
      await applicantService.updateStatus(applicantId, status);
      await fetchApplicants(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? new Error('Failed to update status') : err);
      throw err;
    }
  }, [fetchApplicants]);

  const deleteApplicant = useCallback(async (applicantId: string) => {
    try {
      await applicantService.delete(applicantId);
      await fetchApplicants(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete applicant'));
      throw err;
    }
  }, [fetchApplicants]);

  return {
    applicants,
    loading,
    error,
    fetchApplicants,
    createApplicant,
    updateApplicant,
    updateApplicantStatus,
    deleteApplicant
  };
};


