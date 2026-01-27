import { useState, useEffect, useCallback } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import { applicantService } from '../lib/firestore-service';

interface UseApplicantsOptions {
  status?: RegistrationStatus;
  limitCount?: number;
  autoFetch?: boolean;
}

/**
 * Custom hook for managing applicants data from Firestore
 */
export const useApplicants = (options: UseApplicantsOptions = { autoFetch: true }) => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchApplicants();
    }
  }, [fetchApplicants, options.autoFetch]);

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


