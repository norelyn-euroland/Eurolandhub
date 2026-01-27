'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { batchService } from '../lib/firestore-service';
import { Applicant } from '../lib/types';
import { MOCK_APPLICANTS } from '../lib/mockApplicants';

/**
 * Firebase Console Component
 * Combines connection testing and data migration in one place
 */
const FirebaseConsole: React.FC = () => {
  const [testResults, setTestResults] = useState<{
    config: 'testing' | 'success' | 'error';
    firestore: 'testing' | 'success' | 'error';
    auth: 'testing' | 'success' | 'error';
  }>({
    config: 'testing',
    firestore: 'testing',
    auth: 'testing'
  });
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [firestoreData, setFirestoreData] = useState<any>(null);
  const [envCheck, setEnvCheck] = useState<Record<string, boolean>>({});
  
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  useEffect(() => {
    runConnectionTests();
  }, []);

  const runConnectionTests = async () => {
    const errors: string[] = [];
    const envVars: Record<string, boolean> = {};

    // Check environment variables
    const requiredEnvVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ];

    requiredEnvVars.forEach(varName => {
      const value = import.meta.env[varName];
      envVars[varName] = !!value && value !== '';
      if (!value || value === '') {
        errors.push(`Missing environment variable: ${varName}`);
      }
    });
    setEnvCheck(envVars);

    // Test 1: Check Firebase Config
    try {
      if (!auth) {
        throw new Error('Firebase Auth not initialized');
      }
      if (!db) {
        throw new Error('Firestore not initialized');
      }
      setTestResults(prev => ({ ...prev, config: 'success' }));
    } catch (error: any) {
      const msg = `Config Error: ${error.message}`;
      errors.push(msg);
      setTestResults(prev => ({ ...prev, config: 'error' }));
    }

    // Test 2: Test Firestore Connection
    try {
      const testCollection = collection(db, 'test');
      const snapshot = await getDocs(testCollection);
      setTestResults(prev => ({ ...prev, firestore: 'success' }));
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        setTestResults(prev => ({ ...prev, firestore: 'success' }));
      } else {
        const msg = `Firestore Error: ${error.message} (Code: ${error.code || 'unknown'})`;
        errors.push(msg);
        setTestResults(prev => ({ ...prev, firestore: 'error' }));
      }
    }

    // Test 3: Test Auth Connection
    try {
      if (auth && typeof auth.currentUser === 'object') {
        setTestResults(prev => ({ ...prev, auth: 'success' }));
      } else {
        throw new Error('Auth object is not properly initialized');
      }
    } catch (error: any) {
      const msg = `Auth Error: ${error.message}`;
      errors.push(msg);
      setTestResults(prev => ({ ...prev, auth: 'error' }));
    }

    // Test 4: Try to read applicants collection
    try {
      const applicantsRef = collection(db, 'applicants');
      const snapshot = await getDocs(applicantsRef);
      setFirestoreData({
        collection: 'applicants',
        count: snapshot.size,
        documents: snapshot.docs.map(doc => ({
          id: doc.id,
          fullName: doc.data().fullName,
          email: doc.data().email,
          status: doc.data().status
        })).slice(0, 5)
      });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        setFirestoreData({
          collection: 'applicants',
          count: 0,
          error: 'Permission denied - set up Firestore security rules'
        });
      } else {
        setFirestoreData({
          collection: 'applicants',
          count: 0,
          error: error.message
        });
      }
    }

    setErrorMessages(errors);
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationError(null);
    setMigrationStatus(null);

    try {
      await batchService.migrateApplicants(MOCK_APPLICANTS);
      setMigrationStatus({
        success: true,
        message: 'Successfully migrated all applicants to Firestore!',
        count: MOCK_APPLICANTS.length
      });
      // Refresh data after migration
      setTimeout(() => runConnectionTests(), 1000);
    } catch (err: any) {
      setMigrationError(err.message || 'Migration failed');
      setMigrationStatus({
        success: false,
        message: 'Migration failed. Check console for details.'
      });
      console.error('Migration error:', err);
    } finally {
      setMigrating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const allSuccess = Object.values(testResults).every(r => r === 'success');

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-black mb-2 text-neutral-900 uppercase tracking-tighter">
          Firebase Console
        </h1>
        <p className="text-neutral-400 text-sm">Test connection and manage data migration</p>
      </div>

      {/* Connection Status */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-black mb-4 text-neutral-900 uppercase tracking-tight">
          Connection Status
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-neutral-700">Firebase Configuration</span>
            <span className={`text-sm font-black ${getStatusColor(testResults.config)}`}>
              {getStatusIcon(testResults.config)} {testResults.config.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-neutral-700">Firestore Connection</span>
            <span className={`text-sm font-black ${getStatusColor(testResults.firestore)}`}>
              {getStatusIcon(testResults.firestore)} {testResults.firestore.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-neutral-700">Auth Connection</span>
            <span className={`text-sm font-black ${getStatusColor(testResults.auth)}`}>
              {getStatusIcon(testResults.auth)} {testResults.auth.toUpperCase()}
            </span>
          </div>
        </div>

        {allSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎉</span>
              <span className="text-sm font-black text-green-900">Firebase Connected Successfully!</span>
            </div>
          </div>
        )}

        {errorMessages.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-black text-red-900 mb-2 uppercase">Errors</h3>
            <ul className="space-y-1">
              {errorMessages.map((error, idx) => (
                <li key={idx} className="text-sm text-red-700 font-mono">{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Data Migration */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-black mb-4 text-neutral-900 uppercase tracking-tight">
          Data Migration
        </h2>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700 mb-2">
              <span className="font-bold">Total Applicants:</span> {MOCK_APPLICANTS.length}
            </p>
            <p className="text-sm text-blue-700">
              <span className="font-bold">Collection:</span> applicants
            </p>
          </div>

          <button
            onClick={handleMigrate}
            disabled={migrating}
            className={`w-full py-4 px-6 rounded-xl font-black uppercase tracking-widest transition-all ${
              migrating
                ? 'bg-neutral-400 cursor-not-allowed'
                : 'bg-black text-white hover:bg-neutral-800 shadow-lg'
            }`}
          >
            {migrating ? 'Migrating...' : `Migrate ${MOCK_APPLICANTS.length} Applicants to Firestore`}
          </button>

          {migrationStatus && (
            <div
              className={`border rounded-lg p-4 ${
                migrationStatus.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{migrationStatus.success ? '✅' : '❌'}</span>
                <div>
                  <h3
                    className={`text-sm font-black uppercase mb-1 ${
                      migrationStatus.success ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {migrationStatus.success ? 'Migration Successful!' : 'Migration Failed'}
                  </h3>
                  <p
                    className={`text-sm ${
                      migrationStatus.success ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {migrationStatus.message}
                    {migrationStatus.count && (
                      <span className="block mt-1 font-bold">
                        {migrationStatus.count} applicants added to Firestore.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {migrationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-black text-red-900 mb-2 uppercase">Error</h3>
              <p className="text-sm text-red-700 font-mono">{migrationError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Firestore Data Status */}
      {firestoreData && (
        <div className={`bg-white border rounded-xl p-6 shadow-sm ${
          firestoreData.error 
            ? 'border-yellow-200 bg-yellow-50' 
            : 'border-green-200 bg-green-50'
        }`}>
          <h2 className={`text-lg font-black mb-4 uppercase tracking-tight ${
            firestoreData.error ? 'text-yellow-900' : 'text-green-900'
          }`}>
            Firestore Data Status
          </h2>
          <p className={`text-sm mb-2 ${firestoreData.error ? 'text-yellow-700' : 'text-green-700'}`}>
            Collection: <span className="font-bold">{firestoreData.collection}</span>
          </p>
          {firestoreData.error ? (
            <div>
              <p className={`text-sm mb-2 ${firestoreData.error ? 'text-yellow-700' : 'text-green-700'}`}>
                <span className="font-bold">Error:</span> {firestoreData.error}
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                To fix: Set up Firestore security rules in Firebase Console. See FIREBASE_SETUP.md for rules.
              </p>
            </div>
          ) : (
            <>
              <p className={`text-sm mb-2 ${firestoreData.error ? 'text-yellow-700' : 'text-green-700'}`}>
                Document Count: <span className="font-bold">{firestoreData.count}</span>
              </p>
              {firestoreData.documents && firestoreData.documents.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-black text-green-900 mb-2 uppercase">Sample Documents:</p>
                  <div className="bg-white p-3 rounded text-xs border border-green-200 max-h-60 overflow-auto">
                    {firestoreData.documents.map((doc: any, idx: number) => (
                      <div key={idx} className="mb-3 pb-3 border-b border-neutral-100 last:border-0">
                        <p className="font-bold text-neutral-900">{doc.fullName || doc.id}</p>
                        <p className="text-neutral-600">Email: {doc.email || 'N/A'}</p>
                        <p className="text-neutral-600">Status: {doc.status || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Next Steps */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-sm font-black text-blue-900 mb-2 uppercase">Next Steps</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>If all tests show ✅, Firebase is connected successfully!</li>
          <li>Set up Firestore security rules in Firebase Console (see FIREBASE_SETUP.md)</li>
          <li>After migration, verify data in Firebase Console</li>
          <li>Check browser console (F12) for detailed logs</li>
        </ul>
      </div>
    </div>
  );
};

export default FirebaseConsole;

