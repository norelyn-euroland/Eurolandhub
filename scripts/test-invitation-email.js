/**
 * Quick test script for invitation email generation
 * Run with: node scripts/test-invitation-email.js
 * 
 * This tests the invitation email generation in preview mode (doesn't send actual email)
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function testInvitationEmail() {
  console.log('🧪 Testing Invitation Email Generation...\n');
  
  const testData = {
    toEmail: 'test@example.com',
    firstName: 'John',
    registrationId: '123456',
    messageStyle: 'default',
    preview: true, // Preview mode - generates but doesn't send
  };

  console.log('📤 Sending request to:', `${API_URL}/api/send-invitation-email`);
  console.log('📋 Test data:', JSON.stringify(testData, null, 2));
  console.log('\n');

  try {
    const response = await fetch(`${API_URL}/api/send-invitation-email`, {
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

    if (response.ok && data.subject && data.body) {
      console.log('✅ SUCCESS! Email generation works!\n');
      console.log('📧 Generated Subject:');
      console.log(`   ${data.subject}\n`);
      console.log('📝 Generated Body (first 200 chars):');
      console.log(`   ${data.body.substring(0, 200)}...\n`);
      console.log('🔗 Registration Link:');
      console.log(`   ${data.registrationLink}\n`);
      console.log('✅ You can now test invitation email generation in the frontend!');
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
      
      if (response.status === 500 && data.error?.includes('GROQ_API_KEY')) {
        console.error('\n💡 Tip: Make sure GROQ_API_KEY is set in .env.local (required for LLM style adaptation)');
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
    testInvitationEmail();
  })
  .catch(() => {
    console.error('❌ API server is not running!');
    console.error('\n💡 Please start the API server first:');
    console.error('   npm run dev:api');
    console.error('\n   Or start both frontend and API:');
    console.error('   npm run dev:all');
    process.exit(1);
  });

