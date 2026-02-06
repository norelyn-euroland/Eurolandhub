/**
 * Resend Email Service
 * Helper functions for sending emails via Resend API
 */

import { Resend } from 'resend';

let resendClient: Resend | null = null;

/**
 * Initialize Resend client
 */
function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string; // Plain text version for better deliverability
  from?: string;
  fromName?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email via Resend
 * 
 * @param options - Email options
 * @returns Result with success status and optional messageId or error
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const client = getResendClient();
    
    // Get sender email and name from options or environment
    let fromEmail = options.from || process.env.RESEND_FROM_EMAIL || 'norelyn.golingan@eirl.ink';
    const fromName = options.fromName || process.env.RESEND_FROM_NAME || 'EurolandHUB';
    
    // Validate and fix sender email domain
    // Resend doesn't allow sending from unverified domains like gmail.com, yahoo.com, etc.
    const unverifiedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
    const emailDomain = fromEmail.split('@')[1]?.toLowerCase();
    
    if (emailDomain && unverifiedDomains.includes(emailDomain)) {
      console.warn(`Invalid sender domain detected: ${emailDomain}. Using verified domain fallback.`);
      // Use a verified domain or Resend's default domain
      // Change this to your verified domain email
      fromEmail = process.env.RESEND_VERIFIED_EMAIL || 'norelyn.golingan@eirl.ink';
      
      // If still using unverified domain, use Resend's default domain for testing
      const fallbackDomain = fromEmail.split('@')[1]?.toLowerCase();
      if (fallbackDomain && unverifiedDomains.includes(fallbackDomain)) {
        fromEmail = 'onboarding@resend.dev'; // Resend's default domain for testing
        console.warn('Using Resend default domain: onboarding@resend.dev');
      }
    }
    
    const from = `${fromName} <${fromEmail}>`;
    const replyTo = options.replyTo || fromEmail;
    
    // Normalize 'to' to array
    const toEmails = Array.isArray(options.to) ? options.to : [options.to];
    
    // Prepare email payload with transactional tags and headers
    const emailPayload: any = {
      from,
      to: toEmails,
      subject: options.subject,
      html: options.html,
      reply_to: replyTo,
    };

    // Add plain text version if provided (better deliverability)
    if (options.text) {
      emailPayload.text = options.text;
    }

    // Add tags for transactional emails (helps with deliverability)
    if (options.tags) {
      emailPayload.tags = options.tags;
    } else {
      // Default transactional tag
      emailPayload.tags = [
        { name: 'category', value: 'transactional' },
        { name: 'type', value: 'invitation' }
      ];
    }

    // Add headers to improve deliverability (removed problematic ones)
    emailPayload.headers = {
      'X-Mailer': 'EurolandHUB',
      'List-Unsubscribe': `<mailto:${replyTo}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...options.headers
    };

    const { data, error } = await client.emails.send(emailPayload);
    
    if (error) {
      console.error('Resend email send error:', error);
      return {
        success: false,
        error: typeof error === 'string' ? error : JSON.stringify(error),
      };
    }
    
    if (data?.id) {
      console.log('Resend email sent successfully:', {
        messageId: data.id,
        to: toEmails,
        subject: options.subject,
      });
      return {
        success: true,
        messageId: data.id,
      };
    }
    
    // Fallback if no error but no messageId
    return {
      success: true,
      messageId: undefined,
    };
  } catch (error: any) {
    console.error('Unexpected error sending email via Resend:', error);
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}

