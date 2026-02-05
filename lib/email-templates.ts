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

