'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Applicant, OfficialShareholder } from '../lib/types';
import { applicantService, officialShareholderService } from '../lib/firestore-service';

interface DataContextValue {
  applicants: Applicant[];
  officialShareholders: OfficialShareholder[];
  applicantsLoading: boolean;
  shareholdersLoading: boolean;
  refreshApplicants: () => Promise<void>;
  getApplicantById: (id: string) => Applicant | undefined;
  getApplicantByEmail: (email: string) => Applicant | undefined;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [officialShareholders, setOfficialShareholders] = useState<OfficialShareholder[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(true);
  const [shareholdersLoading, setShareholdersLoading] = useState(true);

  // Manual fetch for applicants (no real-time subscription)
  const fetchApplicants = useCallback(async () => {
    setApplicantsLoading(true);
    try {
      const data = await applicantService.getAll();
      setApplicants(data);
    } catch (error) {
      console.error('Error fetching applicants:', error);
      setApplicants([]);
    } finally {
      setApplicantsLoading(false);
    }
  }, []);

  // Initial fetch for applicants
  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  // Real-time subscription for officialShareholders
  useEffect(() => {
    setShareholdersLoading(true);
    const unsubscribe = officialShareholderService.subscribeToOfficialShareholders(
      (data) => {
        setOfficialShareholders(data);
        setShareholdersLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Lookup functions using array.find (can be optimized to Map in Step 6)
  const getApplicantById = useCallback((id: string): Applicant | undefined => {
    return applicants.find(a => a.id === id);
  }, [applicants]);

  const getApplicantByEmail = useCallback((email: string): Applicant | undefined => {
    if (!email) return undefined;
    const normalizedEmail = email.toLowerCase().trim();
    return applicants.find(a => a.email?.toLowerCase().trim() === normalizedEmail);
  }, [applicants]);

  const value: DataContextValue = useMemo(() => ({
    applicants,
    officialShareholders,
    applicantsLoading,
    shareholdersLoading,
    refreshApplicants: fetchApplicants,
    getApplicantById,
    getApplicantByEmail,
  }), [applicants, officialShareholders, applicantsLoading, shareholdersLoading, fetchApplicants, getApplicantById, getApplicantByEmail]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

