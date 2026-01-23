'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

/**
 * Firebase Connection Test Page
 * Access at: /test-firebase
 */
export default function FirebaseTestPage() {
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

  useEffect(() => {
    const runTests = async () => {
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
        console.log('Testing Firebase configuration...');
        if (!auth) {
          throw new Error('Firebase Auth not initialized');
        }
        if (!db) {
          throw new Error('Firestore not initialized');
        }
        setTestResults(prev => ({ ...prev, config: 'success' }));
        console.log('✅ Firebase configuration: SUCCESS');
      } catch (error: any) {
        const msg = `Config Error: ${error.message}`;
        errors.push(msg);
        setTestResults(prev => ({ ...prev, config: 'error' }));
        console.error('❌ Firebase configuration: FAILED', error);
      }

      // Test 2: Test Firestore Connection
      try {
        console.log('Testing Firestore connection...');
        // Try to read from a test collection
        const testCollection = collection(db, 'test');
        const snapshot = await getDocs(testCollection);
        setTestResults(prev => ({ ...prev, firestore: 'success' }));
        console.log('✅ Firestore connection: SUCCESS');
        console.log(`Found ${snapshot.size} documents in test collection`);
      } catch (error: any) {
        // Check if it's a permissions error (which means we're connected but need rules)
        if (error.code === 'permission-denied') {
          setTestResults(prev => ({ ...prev, firestore: 'success' }));
          console.log('✅ Firestore connection: SUCCESS (permission denied is expected without rules)');
        } else {
          const msg = `Firestore Error: ${error.message} (Code: ${error.code || 'unknown'})`;
          errors.push(msg);
          setTestResults(prev => ({ ...prev, firestore: 'error' }));
          console.error('❌ Firestore connection: FAILED', error);
        }
      }

      // Test 3: Test Auth Connection
      try {
        console.log('Testing Auth connection...');
        // Just check if auth object exists and has expected properties
        if (auth && typeof auth.currentUser === 'object') {
          setTestResults(prev => ({ ...prev, auth: 'success' }));
          console.log('✅ Auth connection: SUCCESS');
          console.log('Current user:', auth.currentUser?.email || 'Not signed in');
        } else {
          throw new Error('Auth object is not properly initialized');
        }
      } catch (error: any) {
        const msg = `Auth Error: ${error.message}`;
        errors.push(msg);
        setTestResults(prev => ({ ...prev, auth: 'error' }));
        console.error('❌ Auth connection: FAILED', error);
      }

      // Test 4: Try to read applicants collection (if it exists)
      try {
        console.log('Testing applicants collection access...');
        const applicantsRef = collection(db, 'applicants');
        const snapshot = await getDocs(applicantsRef);
        setFirestoreData({
          collection: 'applicants',
          count: snapshot.size,
          documents: snapshot.docs.map(doc => ({
            id: doc.id,
            fullName: doc.data().fullName,
            email: doc.data().email,
            status: doc.data().status,
            type: doc.data().type
          })).slice(0, 5) // Show first 5
        });
        console.log(`✅ Found ${snapshot.size} applicants in Firestore`);
      } catch (error: any) {
        if (error.code === 'permission-denied') {
          console.log('⚠️ Applicants collection: Permission denied (set up security rules)');
          setFirestoreData({
            collection: 'applicants',
            count: 0,
            error: 'Permission denied - set up Firestore security rules'
          });
        } else {
          console.log('⚠️ Applicants collection: Not found or error:', error.message);
          setFirestoreData({
            collection: 'applicants',
            count: 0,
            error: error.message
          });
        }
      }

      setErrorMessages(errors);
    };

    runTests();
  }, []);

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
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-black mb-6 text-neutral-900 uppercase tracking-tighter">
        Firebase Connection Test
      </h1>

      <div className="space-y-4 mb-8">
        {/* Environment Variables Check */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-black mb-4 text-neutral-900 uppercase tracking-tight">
            Environment Variables
          </h2>
          <div className="space-y-2">
            {Object.entries(envCheck).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-600 font-mono">{key}</span>
                <span className={value ? 'text-green-600' : 'text-red-600'}>
                  {value ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
            ))}
          </div>
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
        </div>

        {/* Overall Status */}
        {allSuccess && (
          <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🎉</span>
              <div>
                <h3 className="text-lg font-black text-green-900 uppercase mb-1">
                  Firebase Connected Successfully!
                </h3>
                <p className="text-sm text-green-700">
                  All services are properly configured and connected.
                </p>
              </div>
            </div>
          </div>
        )}

        {errorMessages.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-sm font-black text-red-900 mb-2 uppercase">Errors</h3>
            <ul className="space-y-1">
              {errorMessages.map((error, idx) => (
                <li key={idx} className="text-sm text-red-700 font-mono">{error}</li>
              ))}
            </ul>
          </div>
        )}

        {firestoreData && (
          <div className={`border rounded-xl p-6 ${
            firestoreData.error 
              ? 'bg-yellow-50 border-yellow-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <h3 className={`text-sm font-black mb-2 uppercase ${
              firestoreData.error ? 'text-yellow-900' : 'text-green-900'
            }`}>
              Firestore Data Status
            </h3>
            <p className={`text-sm mb-2 ${
              firestoreData.error ? 'text-yellow-700' : 'text-green-700'
            }`}>
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
                {firestoreData.count === 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    No data found. <a href="/migrate-data" className="underline font-bold">Migrate data here</a>
                  </p>
                )}
                {firestoreData.documents && firestoreData.documents.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-black text-green-900 mb-2 uppercase">Sample Documents:</p>
                    <div className="bg-white p-3 rounded text-xs border border-green-200 max-h-60 overflow-auto">
                      {firestoreData.documents.map((doc: any, idx: number) => (
                        <div key={idx} className="mb-3 pb-3 border-b border-neutral-100 last:border-0">
                          <p className="font-bold text-neutral-900">{doc.fullName || doc.id}</p>
                          <p className="text-neutral-600">Email: {doc.email || 'N/A'}</p>
                          <p className="text-neutral-600">Status: {doc.status || 'N/A'}</p>
                          <p className="text-neutral-600">Type: {doc.type || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-sm font-black text-blue-900 mb-2 uppercase">Next Steps</h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>If all tests show ✅, Firebase is connected successfully!</li>
            <li>Set up Firestore security rules in Firebase Console (see FIREBASE_SETUP.md)</li>
            <li>
              <a href="/migrate-data" className="underline font-bold">Migrate your mock data to Firestore</a>
            </li>
            <li>After migration, refresh this page to see your data</li>
            <li>Check browser console (F12) for detailed logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

