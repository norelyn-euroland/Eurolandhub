import { useCallback } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import { applicantService } from '../lib/firestore-service';
import { useData } from './useData';

interface UseApplicantsOptions {
  status?: RegistrationStatus;
  limitCount?: number;
  autoFetch?: boolean;
  realTime?: boolean; // Deprecated - kept for backward compatibility
}

/**
 * Custom hook for managing applicants data - now wraps centralized DataProvider
 * @deprecated The real-time subscription is handled by DataProvider. This hook is kept for backward compatibility.
 */
export const useApplicants = (options: UseApplicantsOptions = { autoFetch: true, realTime: true }) => {
  const { 
    applicants, 
    applicantsLoading, 
    refreshApplicants,
    getApplicantById 
  } = useData();

  // Filter applicants by status if provided (client-side filtering)
  const filteredApplicants = options.status 
    ? applicants.filter(a => a.status === options.status)
    : applicants;

  // Apply limit if provided
  const limitedApplicants = options.limitCount
    ? filteredApplicants.slice(0, options.limitCount)
    : filteredApplicants;

  const createApplicant = useCallback(async (applicant: Applicant) => {
    try {
      await applicantService.create(applicant);
      await refreshApplicants(); // Refresh from DataProvider
    } catch (err) {
      throw err;
    }
  }, [refreshApplicants]);

  const updateApplicant = useCallback(async (applicantId: string, updates: Partial<Applicant>) => {
    try {
      await applicantService.update(applicantId, updates);
      await refreshApplicants(); // Refresh from DataProvider
    } catch (err) {
      throw err;
    }
  }, [refreshApplicants]);

  const updateApplicantStatus = useCallback(async (applicantId: string, status: RegistrationStatus) => {
    try {
      await applicantService.updateStatus(applicantId, status);
      await refreshApplicants(); // Refresh from DataProvider
    } catch (err) {
      throw err;
    }
  }, [refreshApplicants]);

  const deleteApplicant = useCallback(async (applicantId: string) => {
    try {
      await applicantService.delete(applicantId);
      await refreshApplicants(); // Refresh from DataProvider
    } catch (err) {
      throw err;
    }
  }, [refreshApplicants]);

  return {
    applicants: limitedApplicants,
    loading: applicantsLoading,
    error: null, // Errors are handled by DataProvider
    fetchApplicants: refreshApplicants,
    createApplicant,
    updateApplicant,
    updateApplicantStatus,
    deleteApplicant
  };
};
