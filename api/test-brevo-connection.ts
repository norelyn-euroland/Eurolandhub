import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Test endpoint to verify Brevo API connection and template access
 * GET /api/test-brevo-connection
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
    return;
  }

  const apiKey = process.env.BREVO_API_KEY;
  const templateOtpId = process.env.BREVO_TEMPLATE_EMAIL_OTP_ID;
  const templateVerifiedId = process.env.BREVO_TEMPLATE_ACCOUNT_VERIFIED_ID;

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    envVars: {
      BREVO_API_KEY: apiKey ? `${apiKey.substring(0, 20)}...` : 'MISSING',
      BREVO_TEMPLATE_EMAIL_OTP_ID: templateOtpId || 'MISSING',
      BREVO_TEMPLATE_ACCOUNT_VERIFIED_ID: templateVerifiedId || 'MISSING',
    },
    tests: {},
  };

  // Test 1: Check if API key exists
  if (!apiKey) {
    results.tests.apiKeyExists = { success: false, error: 'BREVO_API_KEY not found in environment' };
    res.status(500).json(results);
    return;
  }
  results.tests.apiKeyExists = { success: true };

  // Test 2: Check if template IDs exist
  if (!templateOtpId || !templateVerifiedId) {
    results.tests.templateIdsExist = {
      success: false,
      error: `Missing template IDs. OTP: ${templateOtpId || 'MISSING'}, Verified: ${templateVerifiedId || 'MISSING'}`,
    };
  } else {
    results.tests.templateIdsExist = { success: true, otpId: templateOtpId, verifiedId: templateVerifiedId };
  }

  // Test 3: Try to fetch account info from Brevo (validates API key)
  try {
    const accountRes = await fetch('https://api.brevo.com/v3/account', {
      method: 'GET',
      headers: {
        'api-key': apiKey,
        accept: 'application/json',
      },
    });

    const accountData = await accountRes.json();
    if (accountRes.ok) {
      results.tests.brevoApiConnection = {
        success: true,
        accountEmail: accountData.email || 'N/A',
        firstName: accountData.firstName || 'N/A',
        lastName: accountData.lastName || 'N/A',
      };
    } else {
      results.tests.brevoApiConnection = {
        success: false,
        error: `Brevo API returned ${accountRes.status}`,
        details: accountData,
      };
    }
  } catch (e: any) {
    results.tests.brevoApiConnection = {
      success: false,
      error: 'Failed to connect to Brevo API',
      detail: String(e?.message ?? e),
    };
  }

  // Test 4: Try to get template details (validates template IDs)
  if (templateOtpId) {
    try {
      const templateRes = await fetch(`https://api.brevo.com/v3/smtp/templates/${templateOtpId}`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          accept: 'application/json',
        },
      });

      const templateData = await templateRes.json();
      if (templateRes.ok) {
        results.tests.templateOtpAccess = {
          success: true,
          templateName: templateData.name || 'N/A',
          templateId: templateData.id,
        };
      } else {
        results.tests.templateOtpAccess = {
          success: false,
          error: `Failed to fetch template ${templateOtpId}`,
          status: templateRes.status,
          details: templateData,
        };
      }
    } catch (e: any) {
      results.tests.templateOtpAccess = {
        success: false,
        error: 'Failed to fetch OTP template',
        detail: String(e?.message ?? e),
      };
    }
  }

  if (templateVerifiedId) {
    try {
      const templateRes = await fetch(`https://api.brevo.com/v3/smtp/templates/${templateVerifiedId}`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          accept: 'application/json',
        },
      });

      const templateData = await templateRes.json();
      if (templateRes.ok) {
        results.tests.templateVerifiedAccess = {
          success: true,
          templateName: templateData.name || 'N/A',
          templateId: templateData.id,
        };
      } else {
        results.tests.templateVerifiedAccess = {
          success: false,
          error: `Failed to fetch template ${templateVerifiedId}`,
          status: templateRes.status,
          details: templateData,
        };
      }
    } catch (e: any) {
      results.tests.templateVerifiedAccess = {
        success: false,
        error: 'Failed to fetch Verified template',
        detail: String(e?.message ?? e),
      };
    }
  }

  // Determine overall success
  const allTestsPassed =
    results.tests.apiKeyExists?.success &&
    results.tests.templateIdsExist?.success &&
    results.tests.brevoApiConnection?.success &&
    results.tests.templateOtpAccess?.success &&
    results.tests.templateVerifiedAccess?.success;

  results.overall = {
    connected: allTestsPassed,
    message: allTestsPassed
      ? '✅ All tests passed! Brevo is connected and templates are accessible.'
      : '⚠️ Some tests failed. Check the details above.',
  };

  res.status(allTestsPassed ? 200 : 500).json(results);
}


