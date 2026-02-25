/**
 * Email Templates
 * HTML templates for all email types sent via Resend
 */

export interface EmailTemplate {
  subject: string;
  html: string;
}

/**
 * OTP Email Template
 * Variables: {{ first_name }}, {{ otp_code }}
 */
export const otpTemplate: EmailTemplate = {
  subject: 'Verify your email address',
  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello {{ first_name }},</p>
  <p>Your email verification code is: {{ otp_code }}</p>
  <p>If you did not request this verification, please ignore this email.</p>
  <p>Thanks,<br>Euroland Team</p>
</body>
</html>`,
};

/**
 * Account Verified Email Template
 * Variables: {{ first_name }}
 */
export const accountVerifiedTemplate: EmailTemplate = {
  subject: 'Your account is now verified!',
  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello {{ first_name }},</p>
  <p>Your account has been successfully verified.</p>
  <p>You can now access all features available to verified investors.</p>
  <p>To access your investor portal, please visit: <a href="https://eurohub.eurolandir.net/">https://eurohub.eurolandir.net/</a></p>
  <p>If you have any questions, feel free to contact us.</p>
  <p>Best regards,<br>Euroland Team</p>
</body>
</html>`,
};

/**
 * Invitation Email Template
 * Variables: {{ first_name }}, {{ registration_link }}, {{ registration_id }}
 */
export const invitationTemplate: EmailTemplate = {
  subject: 'Invitation to complete your verified investor registration',
  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello {{ first_name }},</p>
  <p>You have been identified as a shareholder based on our official records.</p>
  <p>An account has been pre-verified for you, and you are invited to complete a simple registration to gain access to exclusive investor features on our platform.</p>
  <p>To claim your verified account, please visit: <a href="{{ registration_link }}">{{ registration_link }}</a></p>
  <p>Once you complete the registration, you will have access to exclusive investor features, including real-time portfolio updates, detailed financial reports, investor communications, and priority support.</p>
  <p>Important: This invitation link is valid for 30 days from the date of this email. If the link expires, you may need to request a new invitation or register through the standard verification process.</p>
  <p>If you did not expect this invitation, you may safely ignore this message.</p>
  <p>Best regards,<br>Euroland Team</p>
</body>
</html>`,
};

/**
 * Account Rejected Email Template
 * Variables: {{ first_name }}
 * Sent when IRO rejects an applicant's holdings verification (Step 5: Manual IRO Verification)
 */
export const accountRejectedTemplate: EmailTemplate = {
  subject: 'Holdings Verification Update',
  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello {{ first_name }},</p>
  <p>Thank you for submitting your holdings verification request.</p>
  <p>After reviewing your submission, we were unable to verify your holdings at this time. Please double-check the information you provided, including your Registration/Shareholdings ID and Company Name.</p>
  <p>You may resubmit your verification request with corrected information. If you have any questions or need assistance, please contact our Investor Relations team.</p>
  <p>Best regards,<br>Euroland Team</p>
</body>
</html>`,
};

/**
 * Request Info Email Template
 * Variables: {{ first_name }}
 * Sent when IRO requests more information from an applicant (Step 5: Manual IRO Verification)
 */
export const requestInfoTemplate: EmailTemplate = {
  subject: 'Additional Information Required for Holdings Verification',
  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello {{ first_name }},</p>
  <p>Thank you for submitting your holdings verification request.</p>
  <p>Our Investor Relations team has reviewed your submission and requires additional information to complete the verification process.</p>
  <p>Please log in to your account and provide the requested information. Once you submit the additional details, we will continue with the verification process.</p>
  <p>If you have any questions or need assistance, please contact our Investor Relations team.</p>
  <p>Best regards,<br>Euroland Team</p>
</body>
</html>`,
};

/**
 * Replace variables in template HTML
 * Supports both {{ variable_name }} and {{variableName}} formats
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Replace {{ key }} format
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), value);
    // Replace {{key}} format (no spaces)
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
  }
  return result;
}

