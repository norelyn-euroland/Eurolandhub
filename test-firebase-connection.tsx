import React, { useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

/**
 * Firebase Connection Test Component
 * This will test if Firebase is properly configured and connected
 */
const FirebaseConnectionTest: React.FC = () => {
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

  useEffect(() => {
    const runTests = async () => {
      const errors: string[] = [];

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
        // Try to read from a test collection (this will fail if not connected, but won't error if collection doesn't exist)
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
          const msg = `Firestore Error: ${error.message} (Code: ${error.code})`;
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
            data: doc.data()
          })).slice(0, 3) // Show first 3
        });
        console.log(`✅ Found ${snapshot.size} applicants in Firestore`);
      } catch (error: any) {
        if (error.code === 'permission-denied') {
          console.log('⚠️ Applicants collection: Permission denied (set up security rules)');
        } else {
          console.log('⚠️ Applicants collection: Not found or error:', error.message);
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-black mb-6 text-neutral-900 uppercase tracking-tighter">
        Firebase Connection Test
      </h1>

      <div className="space-y-4 mb-8">
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

        {errorMessages.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-sm font-black text-red-900 mb-2 uppercase">Errors</h3>
            <ul className="space-y-1">
              {errorMessages.map((error, idx) => (
                <li key={idx} className="text-sm text-red-700">{error}</li>
              ))}
            </ul>
          </div>
        )}

        {firestoreData && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="text-sm font-black text-green-900 mb-2 uppercase">
              Firestore Data Found
            </h3>
            <p className="text-sm text-green-700 mb-2">
              Collection: <span className="font-bold">{firestoreData.collection}</span>
            </p>
            <p className="text-sm text-green-700 mb-2">
              Document Count: <span className="font-bold">{firestoreData.count}</span>
            </p>
            {firestoreData.documents.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-black text-green-900 mb-2 uppercase">Sample Documents:</p>
                <pre className="bg-white p-3 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(firestoreData.documents, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-sm font-black text-blue-900 mb-2 uppercase">Next Steps</h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>If all tests show ✅, Firebase is connected successfully!</li>
            <li>Set up Firestore security rules in Firebase Console</li>
            <li>Set up Storage security rules if using file uploads</li>
            <li>Migrate your mock data using batchService.migrateApplicants()</li>
            <li>Check browser console for detailed logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FirebaseConnectionTest;



