/**
 * Investor Extraction Utility
 * Extracts investor data directly from CSV files using template structure
 */

import { parseCSV, normalizeHeaderName } from './csv-parser.js';

export interface ExtractedInvestor {
  investorName: string;
  holdingId: string;
  email: string;
  phone: string;
  ownershipPercent: string;
  country: string;
  coAddress: string;
  accountType: string;
  holdings: string;
  stake: string;
}

export interface ExtractInvestorsResponse {
  success: boolean;
  investors: ExtractedInvestor[];
  error?: string;
}

/**
 * Extract investors directly from CSV (no markdown conversion)
 */
function extractFromCSV(csvText: string): ExtractedInvestor[] {
  const { headers, rows } = parseCSV(csvText);
  
  if (headers.length === 0 || rows.length === 0) {
    return [];
  }

  // Normalize headers for matching
  const normalizedHeaders = headers.map(h => normalizeHeaderName(h));
  
  // Map template column names to investor fields
  const columnMap: { [key: number]: keyof ExtractedInvestor } = {};
  
  normalizedHeaders.forEach((normalizedHeader, index) => {
    // Map based on normalized header names
    if (normalizedHeader === 'no.' || normalizedHeader === 'no') {
      // Ignore row number column
      return;
    } else if (normalizedHeader === 'first_name' || normalizedHeader === 'firstname') {
      // First Name - will be combined with Last Name
      columnMap[index] = 'investorName' as any; // Special handling needed
    } else if (normalizedHeader === 'last_name' || normalizedHeader === 'lastname') {
      // Last Name - will be combined with First Name
      columnMap[index] = 'investorName' as any; // Special handling needed
    } else if (normalizedHeader === 'registration_id_last_6_digits' || 
               normalizedHeader === 'registrationidlast6digits' ||
               normalizedHeader.includes('registration') && normalizedHeader.includes('id')) {
      columnMap[index] = 'holdingId';
    } else if (normalizedHeader === 'country') {
      columnMap[index] = 'country';
    } else if (normalizedHeader === 'address') {
      columnMap[index] = 'coAddress';
    } else if (normalizedHeader === 'phone_number' || normalizedHeader === 'phonenumber' ||
               normalizedHeader === 'phone') {
      columnMap[index] = 'phone';
    } else if (normalizedHeader === 'email_address' || normalizedHeader === 'emailaddress' ||
               normalizedHeader === 'email') {
      columnMap[index] = 'email';
    } else if (normalizedHeader === 'ownershippercent' || normalizedHeader === 'ownership_percent' ||
               normalizedHeader === 'ownership_percentage' || normalizedHeader === 'ownershippercentage' ||
               normalizedHeader === 'ownership') {
      columnMap[index] = 'ownershipPercent';
    } else if (normalizedHeader === 'account_type' || normalizedHeader === 'accounttype' ||
               normalizedHeader === 'type' ||
               (normalizedHeader.includes('account') && normalizedHeader.includes('type'))) {
      columnMap[index] = 'accountType';
    } else if (normalizedHeader === 'holdings') {
      columnMap[index] = 'holdings';
    } else if (normalizedHeader === 'stake') {
      columnMap[index] = 'stake';
    }
    // Empty columns and unknown columns are ignored
  });

  // Find First Name and Last Name column indices
  const firstNameIndex = headers.findIndex((h, i) => {
    const norm = normalizeHeaderName(h);
    return norm === 'first_name' || norm === 'firstname';
  });
  const lastNameIndex = headers.findIndex((h, i) => {
    const norm = normalizeHeaderName(h);
    return norm === 'last_name' || norm === 'lastname';
  });

  // Extract investors from rows
  const investors: ExtractedInvestor[] = [];
  
  rows.forEach(row => {
    const investor: Partial<ExtractedInvestor> = {
      investorName: '',
      holdingId: '',
      email: '',
      phone: '',
      ownershipPercent: '',
      country: '',
      coAddress: '',
      accountType: '',
      holdings: '',
      stake: '',
    };

    // Combine First Name and Last Name
    if (firstNameIndex >= 0 && lastNameIndex >= 0) {
      const firstName = (row[firstNameIndex] || '').trim();
      const lastName = (row[lastNameIndex] || '').trim();
      investor.investorName = `${firstName} ${lastName}`.trim();
    } else if (firstNameIndex >= 0) {
      investor.investorName = (row[firstNameIndex] || '').trim();
    } else if (lastNameIndex >= 0) {
      investor.investorName = (row[lastNameIndex] || '').trim();
    }

    // Map each column value
    row.forEach((value, index) => {
      const field = columnMap[index];
      if (field && value) {
        const trimmedValue = value.trim();
        
        // Skip if this is First Name or Last Name (already handled above)
        if (index === firstNameIndex || index === lastNameIndex) {
          return;
        }
        
        // Apply transformations based on field type
        if (field === 'holdingId') {
          // Extract numbers only, max 9 digits
          investor[field] = trimmedValue.replace(/\D/g, '').slice(0, 9);
        } else if (field === 'email') {
          // Only set if it looks like an email
          investor[field] = trimmedValue.includes('@') ? trimmedValue : '';
        } else if (field === 'ownershipPercent') {
          // Remove % symbol
          investor[field] = trimmedValue.replace('%', '').trim();
        } else if (field === 'holdings') {
          // Remove commas from numbers
          investor[field] = trimmedValue.replace(/,/g, '').trim();
        } else if (field === 'stake') {
          // Remove % symbol
          investor[field] = trimmedValue.replace('%', '').trim();
        } else {
          investor[field] = trimmedValue;
        }
      }
    });

    // Only add if we have at least investor name or holding ID
    if (investor.investorName || investor.holdingId) {
      investors.push({
        investorName: investor.investorName || '',
        holdingId: investor.holdingId || '',
        email: investor.email || '',
        phone: investor.phone || '',
        ownershipPercent: investor.ownershipPercent || '',
        country: investor.country || '',
        coAddress: investor.coAddress || '',
        accountType: investor.accountType || '',
        holdings: investor.holdings || '',
        stake: investor.stake || '',
      });
    }
  });

  return investors;
}

/**
 * Extract investors from CSV file
 * @param csvText - CSV file content as string
 * @returns Array of extracted investors
 */
export async function extractInvestors(
  csvText: string
): Promise<ExtractInvestorsResponse> {
  try {
    const investors = extractFromCSV(csvText);
    
    return {
      success: true,
      investors: investors.filter(inv => inv.investorName || inv.holdingId),
    };
  } catch (error: any) {
    console.error('Error extracting investors:', error);
    return {
      success: false,
      investors: [],
      error: error?.message || 'Failed to extract investors from CSV',
    };
  }
}
