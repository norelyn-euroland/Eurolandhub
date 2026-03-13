'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { applicantService } from '../lib/firestore-service';
import { Applicant } from '../lib/types';
import HoldingsResubmissionForm from './HoldingsResubmissionForm';
import Toast from './Toast';

const UserHoldingsResubmissionPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState<'success' | 'warning' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const fetchApplicant = async () => {
      if (authLoading) return;
      
      if (!user || !user.email) {
        setError('Please log in to access this page');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const applicantData = await applicantService.getByEmail(user.email);
        
        if (!applicantData) {
          setError('No account found for your email address');
          setLoading(false);
          return;
        }

        setApplicant(applicantData);
        setError(null);
      } catch (err) {
        console.error('Error fetching applicant:', err);
        setError('Failed to load your account information');
      } finally {
        setLoading(false);
      }
    };

    fetchApplicant();
  }, [user, authLoading]);

  const handleSuccess = () => {
    setToastMessage('Holdings information submitted successfully! The IRO will review your submission.');
    setToastVariant('success');
    setShowToast(true);
    
    // Refresh applicant data
    if (user?.email) {
      applicantService.getByEmail(user.email).then(setApplicant).catch(console.error);
    }
  };

  const handleError = (errorMsg: string) => {
    setToastMessage(errorMsg);
    setToastVariant('error');
    setShowToast(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#082b4a] dark:border-[#00adf0] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900 p-8">
        <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-black text-neutral-900 dark:text-neutral-100 mb-2">Error</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">{error}</p>
          {!user && (
            <a
              href="/"
              className="inline-block px-6 py-2.5 bg-[#082b4a] dark:bg-[#00adf0] text-white font-semibold rounded-md hover:bg-[#0a3a5a] dark:hover:bg-[#0099d6] transition-colors"
            >
              Go to Login
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900 p-8">
        <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-8 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            No account found. Please contact support if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-widest mb-2">
            Holdings Verification
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Welcome, {applicant.fullName}. Please update your holdings information below.
          </p>
        </div>

        <HoldingsResubmissionForm
          applicant={applicant}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </div>

      <Toast
        message={toastMessage}
        variant={toastVariant}
        show={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

export default UserHoldingsResubmissionPage;





