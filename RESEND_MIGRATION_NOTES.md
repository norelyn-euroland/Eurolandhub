# Resend Migration - Environment Variables Update

## Required Changes to `.env.local`

Please update your `.env.local` file with the following changes:

### Remove these Brevo variables:
```
BREVO_API_KEY
BREVO_TEMPLATE_EMAIL_OTP_ID
BREVO_TEMPLATE_ACCOUNT_VERIFIED_ID
AUTO_GENERATED_INVITATION_MESSAGE
```

### Add these Resend variables:
```
RESEND_API_KEY=re_UAJNA91w_KBWyGrm4itaAtYv1ofBzLV7d
RESEND_FROM_EMAIL=norelyn.golingan@eirl.ink
RESEND_FROM_NAME=EurolandHUB
```

## Migration Summary

✅ All Brevo dependencies have been removed
✅ Resend SDK installed and configured
✅ Email templates stored locally in `lib/email-templates.ts`
✅ All three email endpoints updated (OTP, Account Verified, Invitation)
✅ Local development server (`server.js`) updated
✅ LLM style adaptation for invitation emails preserved
✅ All Brevo references removed from code comments
✅ Test files cleaned up

## Next Steps

1. Update `.env.local` with the Resend variables above
2. Update Vercel environment variables (if deploying):
   - Add `RESEND_API_KEY`
   - Add `RESEND_FROM_EMAIL`
   - Add `RESEND_FROM_NAME`
   - Remove all Brevo-related variables
3. Test email sending:
   - OTP emails
   - Account verified emails
   - Invitation emails (all styles: default, formal, professional, casual, friendly)

## Notes

- All email templates are now stored in code (`lib/email-templates.ts`)
- Templates are version-controlled and can be easily modified
- LLM style adaptation for invitation emails continues to work as before
- Preview mode for invitation emails is preserved

