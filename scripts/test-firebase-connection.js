/**
 * Simple Node.js script to test Firebase connection
 * Run with: node scripts/test-firebase-connection.js
 * 
 * Note: This requires the Firebase Admin SDK for server-side testing
 * For client-side testing, use the test page at /test-firebase
 */

console.log('Firebase Connection Test Script');
console.log('================================\n');

// Check if environment variables are set
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

console.log('Checking environment variables...');
let allEnvSet = true;

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value && value !== '') {
    console.log(`✅ ${varName}: Set`);
  } else {
    console.log(`❌ ${varName}: Missing`);
    allEnvSet = false;
  }
});

console.log('\n================================');
if (allEnvSet) {
  console.log('✅ All environment variables are set!');
  console.log('\nTo test the actual connection:');
  console.log('1. Start the dev server: npm run dev');
  console.log('2. Navigate to: http://localhost:3000/test-firebase');
  console.log('3. Check the browser console for detailed logs');
} else {
  console.log('❌ Some environment variables are missing!');
  console.log('Make sure your .env.local file is properly configured.');
}

console.log('\nNote: For full connection testing, use the test page at /test-firebase');
console.log('The client-side test will verify actual Firebase connectivity.');

