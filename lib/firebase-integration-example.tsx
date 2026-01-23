/**
 * EXAMPLE: How to integrate Firebase with your existing components
 * 
 * This file shows examples of how to replace mock data with Firebase
 * You can use these patterns in your actual components
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApplicants } from '../hooks/useApplicants';
import { applicantService } from './firestore-service';
import { Applicant, RegistrationStatus } from './types';

// ============================================
// EXAMPLE 1: Replace MOCK_APPLICANTS with Firebase
// ============================================

/**
 * Example: Using useApplicants hook in a component
 */
export const ExampleDashboard: React.FC = () => {
  const { applicants, loading, error, updateApplicantStatus } = useApplicants({
    // Optional filters
    // status: RegistrationStatus.PENDING,
    // type: 'RETAIL',
    autoFetch: true
  });

  if (loading) return <div>Loading applicants...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const handleApprove = async (id: string) => {
    await updateApplicantStatus(id, RegistrationStatus.APPROVED);
  };

  return (
    <div>
      {applicants.map(applicant => (
        <div key={applicant.id}>
          <h3>{applicant.fullName}</h3>
          <button onClick={() => handleApprove(applicant.id)}>Approve</button>
        </div>
      ))}
    </div>
  );
};

// ============================================
// EXAMPLE 2: Authentication Integration
// ============================================

/**
 * Example: Protected component using authentication
 */
export const ExampleProtectedComponent: React.FC = () => {
  const { user, loading, isAuthenticated, signIn, signOut } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) {
    return (
      <div>
        <button onClick={() => signIn('admin@example.com', 'password')}>
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
};

// ============================================
// EXAMPLE 3: File Upload Integration
// ============================================
// NOTE: Storage is not enabled. File uploads are not available.
// If you need file storage, enable Firebase Storage and add storageService back.

// ============================================
// EXAMPLE 4: Migrating Mock Data to Firestore
// ============================================

/**
 * Example: One-time migration script
 * Run this once to migrate your MOCK_APPLICANTS to Firestore
 */
export const migrateMockDataToFirestore = async (mockApplicants: Applicant[]) => {
  try {
    const { batchService } = await import('./firestore-service');
    await batchService.migrateApplicants(mockApplicants);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

// ============================================
// EXAMPLE 5: Real-time Updates
// ============================================

/**
 * Example: Using real-time listeners (if needed)
 * Note: This requires additional Firestore onSnapshot setup
 */
export const ExampleRealtimeUpdates: React.FC = () => {
  const [applicant, setApplicant] = useState<Applicant | null>(null);

  useEffect(() => {
    const applicantId = 'INV-101';
    
    // This would require adding onSnapshot to firestore-service
    // For now, use polling or manual refresh
    const interval = setInterval(async () => {
      const data = await applicantService.getById(applicantId);
      setApplicant(data);
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return <div>{applicant?.fullName}</div>;
};

