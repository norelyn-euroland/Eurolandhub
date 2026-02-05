/**
 * Test script to send OTP email
 * Run with: node scripts/test-otp-email.js
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function testOTPEmail() {
  console.log('🧪 Testing OTP Email Sending...\n');
  
  const testData = {
    toEmail: 'ed.aramain@gmail.com',
    firstName: 'Norelyn',
  };

  console.log('📤 Sending request to:', `${API_URL}/api/send-email-otp`);
  console.log('📋 Test data:', JSON.stringify(testData, null, 2));
  console.log('\n');

  try {
    const response = await fetch(`${API_URL}/api/send-email-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse response as JSON');
      console.error('Response:', responseText);
      return;
    }

    if (response.ok && data.ok) {
      console.log('✅ SUCCESS! OTP email sent!\n');
      console.log('📧 Email Details:');
      console.log(`   To: ${testData.toEmail}`);
      console.log(`   Name: ${testData.firstName}`);
      console.log(`   Issued At: ${data.issuedAt}`);
      console.log(`   Expires At: ${data.expiresAt}`);
      console.log('\n✅ Check the inbox (and spam folder) for the OTP code!');
    } else {
      console.error('❌ FAILED!');
      console.error('Status:', response.status);
      console.error('Error:', data.error || data);
      
      if (data.details) {
        console.error('Details:', data.details);
      }
      
      if (response.status === 500 && data.error?.includes('RESEND_API_KEY')) {
        console.error('\n💡 Tip: Make sure RESEND_API_KEY is set in .env.local');
      }
    }
  } catch (error) {
    console.error('❌ Network Error:', error.message);
    console.error('\n💡 Make sure the API server is running:');
    console.error('   npm run dev:api');
  }
}

// Check if server is likely running
fetch(`${API_URL}/health`)
  .then(() => {
    console.log('✅ API server is running\n');
    testOTPEmail();
  })
  .catch(() => {
    console.error('❌ API server is not running!');
    console.error('\n💡 Please start the API server first:');
    console.error('   npm run dev:api');
    console.error('\n   Or start both frontend and API:');
    console.error('   npm run dev:all');
    process.exit(1);
  });

