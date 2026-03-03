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

export interface BatchEmailRecipient {
  email: string;
  firstName?: string;
  lastName?: string;
  customData?: Record<string, any>; // For personalization
}

export interface BatchEmailOptions {
  recipients: BatchEmailRecipient[];
  subject: string | ((recipient: BatchEmailRecipient) => string); // Can be dynamic per recipient
  html: string | ((recipient: BatchEmailRecipient) => string); // Can be dynamic per recipient
  text?: string | ((recipient: BatchEmailRecipient) => string);
  from?: string;
  fromName?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  batchSize?: number; // Default: 50
  delayBetweenBatches?: number; // Milliseconds, default: 1000 (1 second)
  delayBetweenEmails?: number; // Milliseconds, default: 100 (for rate limiting)
}

export interface BatchEmailResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    email: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
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
    
    // Log the sender email being used (for debugging)
    console.log('Resend sender email:', {
      fromEmail,
      fromName,
      from,
      replyTo,
      envFromEmail: process.env.RESEND_FROM_EMAIL
    });
    
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

/**
 * Send emails to unlimited recipients with automatic batching and rate limiting
 * First batch is limited to 50 recipients, subsequent batches can be configured
 * 
 * @param options - Batch email options
 * @returns Batch result with success/failure counts
 */
export async function sendBatchEmails(options: BatchEmailOptions): Promise<BatchEmailResult> {
  const {
    recipients,
    subject,
    html,
    text,
    from,
    fromName,
    replyTo,
    tags,
    batchSize = 50, // Default batch size (limited to 50 for first batch)
    delayBetweenBatches = 1000, // 1 second between batches
    delayBetweenEmails = 100, // 100ms between individual emails (for rate limiting)
  } = options;

  // Ensure batch size doesn't exceed 50
  const effectiveBatchSize = Math.min(batchSize, 50);

  const results: BatchEmailResult['results'] = [];
  let successful = 0;
  let failed = 0;

  console.log(`Starting batch email send: ${recipients.length} total recipients, ${effectiveBatchSize} per batch`);

  // Process recipients in batches
  for (let i = 0; i < recipients.length; i += effectiveBatchSize) {
    const batch = recipients.slice(i, i + effectiveBatchSize);
    const batchNumber = Math.floor(i / effectiveBatchSize) + 1;
    const totalBatches = Math.ceil(recipients.length / effectiveBatchSize);
    
    console.log(`Processing batch ${batchNumber}/${totalBatches}: ${batch.length} recipients`);

    // Process each recipient in the batch
    for (let j = 0; j < batch.length; j++) {
      const recipient = batch[j];
      
      try {
        // Resolve dynamic subject/html if they're functions
        const resolvedSubject = typeof subject === 'function' 
          ? subject(recipient) 
          : subject;
        
        const resolvedHtml = typeof html === 'function' 
          ? html(recipient) 
          : html;
        
        const resolvedText = text 
          ? (typeof text === 'function' ? text(recipient) : text)
          : undefined;

        // Send individual email for privacy
        const result = await sendEmail({
          to: recipient.email,
          subject: resolvedSubject,
          html: resolvedHtml,
          text: resolvedText,
          from,
          fromName,
          replyTo,
          tags,
        });

        if (result.success) {
          successful++;
          results.push({
            email: recipient.email,
            success: true,
            messageId: result.messageId,
          });
          console.log(`✓ Email sent to ${recipient.email} (${successful}/${recipients.length})`);
        } else {
          failed++;
          results.push({
            email: recipient.email,
            success: false,
            error: result.error,
          });
          console.error(`✗ Failed to send email to ${recipient.email}:`, result.error);
        }

        // Rate limiting: delay between individual emails (except for the last email in the last batch)
        if (delayBetweenEmails > 0 && (i + j + 1 < recipients.length)) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
        }
      } catch (error: any) {
        failed++;
        const errorMessage = error?.message || String(error);
        results.push({
          email: recipient.email,
          success: false,
          error: errorMessage,
        });
        console.error(`✗ Exception sending email to ${recipient.email}:`, errorMessage);
      }
    }

    // Delay between batches (except for the last batch)
    if (i + effectiveBatchSize < recipients.length && delayBetweenBatches > 0) {
      console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(`Batch email send completed: ${successful} successful, ${failed} failed out of ${recipients.length} total`);

  return {
    total: recipients.length,
    successful,
    failed,
    results,
  };
}

/**
 * Send one email to multiple recipients (all recipients see each other)
 * Use this only if privacy is not a concern
 * Limited to 50 recipients per API call
 * 
 * @param recipients - Array of email addresses
 * @param subject - Email subject
 * @param html - Email HTML content
 * @param options - Additional options
 * @returns Batch result with success/failure counts
 */
export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string,
  options?: {
    from?: string;
    fromName?: string;
    replyTo?: string;
    tags?: Array<{ name: string; value: string }>;
    batchSize?: number; // Max recipients per API call (default: 50, max: 50)
  }
): Promise<BatchEmailResult> {
  const batchSize = Math.min(options?.batchSize || 50, 50); // Enforce 50 limit
  const results: BatchEmailResult['results'] = [];
  let successful = 0;
  let failed = 0;

  console.log(`Starting bulk email send: ${recipients.length} total recipients, ${batchSize} per batch`);

  // Split into batches
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(recipients.length / batchSize);
    
    console.log(`Processing bulk batch ${batchNumber}/${totalBatches}: ${batch.length} recipients`);
    
    try {
      const result = await sendEmail({
        to: batch, // Array of emails
        subject,
        html,
        from: options?.from,
        fromName: options?.fromName,
        replyTo: options?.replyTo,
        tags: options?.tags,
      });

      if (result.success) {
        successful += batch.length;
        batch.forEach(email => {
          results.push({
            email,
            success: true,
            messageId: result.messageId,
          });
        });
        console.log(`✓ Bulk email sent to batch ${batchNumber}: ${batch.length} recipients`);
      } else {
        failed += batch.length;
        batch.forEach(email => {
          results.push({
            email,
            success: false,
            error: result.error,
          });
        });
        console.error(`✗ Failed to send bulk email batch ${batchNumber}:`, result.error);
      }
    } catch (error: any) {
      failed += batch.length;
      const errorMessage = error?.message || String(error);
      batch.forEach(email => {
        results.push({
          email,
          success: false,
          error: errorMessage,
        });
      });
      console.error(`✗ Exception sending bulk email batch ${batchNumber}:`, errorMessage);
    }

    // Rate limiting between batches
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`Bulk email send completed: ${successful} successful, ${failed} failed out of ${recipients.length} total`);

  return {
    total: recipients.length,
    successful,
    failed,
    results,
  };
}

