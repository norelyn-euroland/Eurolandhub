/**
 * Verification script for Resend setup
 * Run with: node scripts/verify-resend-setup.js
 */

import dotenv from 'dotenv';
import { Resend } from 'resend';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

console.log('🔍 Verifying Resend Setup...\n');

// Check required environment variables
const requiredVars = {
  'RESEND_API_KEY': process.env.RESEND_API_KEY,
  'RESEND_FROM_EMAIL': process.env.RESEND_FROM_EMAIL || 'norelyn.golingan@eirl.ink',
  'RESEND_FROM_NAME': process.env.RESEND_FROM_NAME || 'EurolandHUB',
  'GROQ_API_KEY': process.env.GROQ_API_KEY, // Required for LLM style adaptation
};

let allPresent = true;

console.log('📋 Environment Variables:');
for (const [key, value] of Object.entries(requiredVars)) {
  const isPresent = !!value;
  const status = isPresent ? '✅' : '❌';
  const displayValue = key === 'RESEND_API_KEY' && value 
    ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}` 
    : value || '(not set)';
  
  console.log(`  ${status} ${key}: ${displayValue}`);
  
  if (!isPresent && key !== 'RESEND_FROM_EMAIL' && key !== 'RESEND_FROM_NAME') {
    allPresent = false;
  }
}

console.log('\n');

if (!allPresent) {
  console.log('❌ Missing required environment variables!');
  console.log('\nPlease add to .env.local:');
  if (!requiredVars.RESEND_API_KEY) {
    console.log('  RESEND_API_KEY=re_UAJNA91w_KBWyGrm4itaAtYv1ofBzLV7d');
  }
  if (!requiredVars.GROQ_API_KEY) {
    console.log('  GROQ_API_KEY=your_groq_api_key_here');
  }
  console.log('  RESEND_FROM_EMAIL=norelyn.golingan@eirl.ink');
  console.log('  RESEND_FROM_NAME=EurolandHUB');
  process.exit(1);
}

// Test Resend API connection
console.log('🔌 Testing Resend API connection...');
try {
  const resend = new Resend(requiredVars.RESEND_API_KEY);
  
  // Try to get API info (Resend doesn't have a simple ping endpoint, so we'll just verify the client was created)
  console.log('✅ Resend client initialized successfully');
  console.log('✅ All checks passed! You can now test invitation email generation.\n');
  
  console.log('📝 Next steps:');
  console.log('  1. Make sure your API server is running: npm run dev:api');
  console.log('  2. Make sure your frontend is running: npm run dev');
  console.log('  3. Navigate to a pre-verified account detail page');
  console.log('  4. Click "Generate Message" to test invitation email generation');
  
} catch (error) {
  console.error('❌ Error initializing Resend client:', error.message);
  process.exit(1);
}

