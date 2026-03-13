/**
 * Investor Classifier
 * Classifies extracted investors as New, Existing, or Suspected Existing.
 * Suspected = similar name or registration ID (possible typo).
 */

import { ExtractedInvestor } from './investor-extractor.js';
import { officialShareholderService, applicantService } from './firestore-service.js';
import type { OfficialShareholder } from './types.js';
import type { Applicant } from './types.js';

export interface ClassifiedInvestor {
  investor: ExtractedInvestor;
  classification: 'new' | 'existing' | 'suspected';
  existingId?: string;
  suspectedReason?: string;
}

export interface ClassifyInvestorsResult {
  new: ExtractedInvestor[];
  existing: Array<{ investor: ExtractedInvestor; existingId: string }>;
  suspected: Array<{ investor: ExtractedInvestor; similarTo: string; reason: string; existingId: string }>;
}

/**
 * Match result with confidence scoring
 */
interface MatchResult {
  existingId: string;
  confidence: number; // 0-100
  matchType: 'exact' | 'high' | 'medium' | 'low';
  matchedFields: string[];
  source: 'shareholder' | 'applicant';
}

/** Normalize holdingId: digits only, last 6 digits (for matching) */
function normalizeHoldingId(value: string): string {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(-6) : digits;
}

/** Count differing digit positions (for 6-digit IDs). Returns -1 if lengths differ. */
function digitDiffCount(a: string, b: string): number {
  const na = (a || '').replace(/\D/g, '');
  const nb = (b || '').replace(/\D/g, '');
  if (na.length !== nb.length || na.length < 6) return -1;
  const sa = na.slice(-6);
  const sb = nb.slice(-6);
  let diff = 0;
  for (let i = 0; i < 6; i++) if (sa[i] !== sb[i]) diff++;
  return diff;
}

/** Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const sa = (a || '').toLowerCase();
  const sb = (b || '').toLowerCase();
  if (sa.length === 0) return sb.length;
  if (sb.length === 0) return sa.length;
  const m = sa.length;
  const n = sb.length;
  const d: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = sa[i - 1] === sb[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

/** Normalize name for better matching (removes titles, suffixes, punctuation) */
function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/[.,]/g, '') // Remove punctuation
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, '') // Remove suffixes
    .replace(/\b(mr|mrs|ms|miss|dr|prof|professor)\b/gi, '') // Remove titles
    .trim();
}

/** Name similarity: true if Levenshtein <= 2 or ratio > 0.85 */
function namesSimilar(name1: string, name2: string): boolean {
  const a = normalizeName(name1);
  const b = normalizeName(name2);
  if (!a || !b) return false;
  
  // Exact match after normalization
  if (a === b) return true;
  
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 4) return dist <= 1;
  if (maxLen <= 8) return dist <= 2;
  const ratio = 1 - dist / maxLen;
  
  // Higher threshold for longer names
  if (maxLen > 15) return ratio >= 0.90;
  if (maxLen > 10) return ratio >= 0.85;
  return ratio >= 0.80 || dist <= 2;
}

/** Normalize phone number for matching */
function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return '';
  
  // Common country codes to detect and remove
  const commonCodes = ['63', '1', '44', '49', '33', '86', '852', '65', '61', '91', '46', '31', '41'];
  
  // Try to detect and remove country code
  for (const code of commonCodes) {
    if (digits.startsWith(code) && digits.length - code.length >= 10) {
      return digits.slice(code.length);
    }
  }
  
  // If no country code detected, take last 10 digits (or all if less than 10)
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Normalize country name for matching */
function normalizeCountry(country: string): string {
  if (!country) return '';
  return country
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '');
}

/** Normalize address for matching */
function normalizeAddress(address: string): string {
  if (!address) return '';
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,#]/g, '')
    .replace(/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|wy)\b/gi, '')
    .trim();
}

/** Generate ID variations for stricter matching (handles format differences) */
function getIdVariations(holdingId: string): string[] {
  const raw = (holdingId || '').trim();
  const digits = raw.replace(/\D/g, '');
  const last6 = digits.length >= 6 ? digits.slice(-6) : digits;
  const variations = new Set<string>();

  if (last6) variations.add(last6);
  if (raw && raw !== last6) variations.add(raw);
  if (digits && digits !== last6) variations.add(digits);
  if (digits.length >= 6 && digits.length <= 9) variations.add(digits);

  // Padded variants (e.g. 130965 -> 0130965, 00130965) for systems that store with leading zeros
  for (let len = 7; len <= 10; len++) {
    if (last6.length === 6) {
      variations.add(last6.padStart(len, '0'));
    }
  }

  return [...variations];
}

/**
 * Check if an investor exists by holdingId — stricter rules, multiple strategies.
 * Tries: exact id, normalized 6 digits, padded variants, applicant by registrationId,
 * applicant by email, full shareholder scan with flexible id matching.
 */
async function findExistingId(
  holdingId: string,
  investorEmail?: string,
  investorName?: string
): Promise<string | null> {
  const variations = getIdVariations(holdingId);
  if (variations.length === 0) return null;

  // 1) Official Shareholder by any ID variation
  for (const v of variations) {
    const officialShareholder = await officialShareholderService.getById(v);
    if (officialShareholder) return officialShareholder.id;
  }

  // 2) Applicant by registrationId (any variation)
  for (const v of variations) {
    const applicant = await applicantService.getByRegistrationId(v);
    if (applicant?.registrationId) return applicant.registrationId;
  }

  // 3) Match by email — same email = same person (treat as existing)
  // Returns registrationId so the update targets the correct shareholder
  if (investorEmail && investorEmail.includes('@')) {
    const applicant = await applicantService.getByEmail(investorEmail);
    if (applicant) {
      const appRid = (applicant.registrationId || applicant.id || '').replace(/\D/g, '').slice(-6);
      const inv6 = (holdingId || '').replace(/\D/g, '').slice(-6);
      if (appRid && inv6 && appRid === inv6) return applicant.registrationId || applicant.id;
      if (applicant.registrationId) return applicant.registrationId;
      if (appRid && inv6 && appRid !== inv6) return applicant.registrationId || applicant.id;
    }
  }

  // 4) Full scan: official shareholders and applicants with flexible id + name matching
  const [allOfficialShareholders, allApplicants] = await Promise.all([
    officialShareholderService.getAll({ limitCount: 5000 }),
    applicantService.getAll({ limitCount: 5000 }),
  ]);

  const norm6 = (holdingId || '').replace(/\D/g, '').slice(-6);
  if (!norm6) return null;

  for (const s of allOfficialShareholders) {
    const sid = (s.id || '').replace(/\D/g, '');
    const sidLast6 = sid.length >= 6 ? sid.slice(-6) : sid;
    if (sidLast6 === norm6 || sid === norm6 || variations.includes(s.id)) return s.id;
    if (sid.includes(norm6) || norm6.length === 6 && sid.endsWith(norm6)) return s.id;
  }

  for (const a of allApplicants) {
    const rid = (a.registrationId || '').replace(/\D/g, '').slice(-6);
    const aid = (a.id || '').replace(/\D/g, '').slice(-6);
    if (rid && rid === norm6) return a.registrationId || '';
    if (aid && aid === norm6) return a.registrationId || a.id;
    if (rid && rid.length >= 6 && norm6.endsWith(rid.slice(-6))) return a.registrationId || '';
  }

  if (investorName && investorName.trim()) {
    const invName = (investorName || '').trim().toLowerCase();
    for (const s of allOfficialShareholders) {
      const sName = (s.name || '').trim().toLowerCase();
      const sid = (s.id || '').replace(/\D/g, '').slice(-6);
      if (sid === norm6 && sName && (sName === invName || namesSimilar(invName, sName))) return s.id;
    }
    for (const a of allApplicants) {
      const aName = (a.fullName || '').trim().toLowerCase();
      const rid = (a.registrationId || '').replace(/\D/g, '').slice(-6);
      if (rid && rid === norm6 && aName && (aName === invName || namesSimilar(invName, aName))) return a.registrationId || '';
    }
  }

  return null;
}

/** Check for suspected match: similar registration ID (1 digit diff) or similar name */
async function findSuspectedMatch(
  investor: ExtractedInvestor,
  officialShareholders: OfficialShareholder[],
  applicants: Applicant[]
): Promise<{ similarTo: string; reason: string; existingId: string } | null> {
  const holdingId = normalizeHoldingId(investor.holdingId || '');
  const investorName = (investor.investorName || '').trim();

  // Check official shareholders
  for (const s of officialShareholders) {
    const sid = (s.id || '').replace(/\D/g, '').slice(-6);
    if (sid.length < 6) continue;
    const diff = digitDiffCount(holdingId, sid);
    if (diff === 1) {
      return { similarTo: `${s.name} (ID: ${s.id})`, reason: 'Registration ID differs by 1 digit', existingId: s.id };
    }
    if (namesSimilar(investorName, s.name || '')) {
      return { similarTo: `${s.name} (ID: ${s.id})`, reason: 'Name is similar to existing investor', existingId: s.id };
    }
  }

  // Check applicants (by registrationId and fullName) — only add if we have a valid existingId
  for (const a of applicants) {
    const rid = (a.registrationId || '').replace(/\D/g, '').slice(-6);
    if (rid.length >= 6) {
      const diff = digitDiffCount(holdingId, rid);
      if (diff === 1) {
        const eid = (a.registrationId || '').trim();
        if (eid) return { similarTo: `${a.fullName} (ID: ${eid})`, reason: 'Registration ID differs by 1 digit', existingId: eid };
      }
    }
    if (namesSimilar(investorName, a.fullName || '')) {
      const eid = (a.registrationId || '').trim();
      if (eid) return { similarTo: `${a.fullName} (ID: ${eid})`, reason: 'Name is similar to existing investor', existingId: eid };
    }
  }

  return null;
}

/**
 * Comprehensive multi-field matching with confidence scoring
 * Uses ALL available fields: Registration ID, Name, Email, Phone, Country, Address, Account Type
 */
async function findExistingInvestorComprehensive(
  investor: ExtractedInvestor,
  allShareholders: Shareholder[],
  allApplicants: Applicant[]
): Promise<MatchResult | null> {
  const results: MatchResult[] = [];
  
  // Normalize input data
  const normHoldingId = normalizeHoldingId(investor.holdingId || '');
  const normName = normalizeName(investor.investorName || '');
  const normEmail = investor.email?.toLowerCase().trim() || '';
  const normPhone = normalizePhone(investor.phone || '');
  const normCountry = normalizeCountry(investor.country || '');
  const normAddress = normalizeAddress(investor.coAddress || '');
  const normAccountType = investor.accountType?.toUpperCase().trim() || '';
  
  // ============================================
  // EXACT MATCHES (100% confidence)
  // ============================================
  
  // 1. Exact Registration ID match
  for (const s of allShareholders) {
    const sId = normalizeHoldingId(s.id || '');
    if (sId === normHoldingId && sId.length >= 6) {
      results.push({
        existingId: s.id,
        confidence: 100,
        matchType: 'exact',
        matchedFields: ['registrationId'],
        source: 'shareholder'
      });
      break; // Highest confidence, return immediately
    }
  }
  
  for (const a of allApplicants) {
    const aRegId = normalizeHoldingId(a.registrationId || '');
    if (aRegId === normHoldingId && aRegId.length >= 6) {
      results.push({
        existingId: a.registrationId || a.id,
        confidence: 100,
        matchType: 'exact',
        matchedFields: ['registrationId'],
        source: 'applicant'
      });
      break;
    }
  }
  
  // If exact ID match found, return it
  if (results.length > 0 && results[0].confidence === 100) {
    return results[0];
  }
  
  // ============================================
  // HIGH CONFIDENCE MATCHES (90-99%)
  // ============================================
  
  // 2. Email + Name match (95% confidence)
  if (normEmail && normName) {
    for (const a of allApplicants) {
      if (a.email?.toLowerCase().trim() === normEmail) {
        const aName = normalizeName(a.fullName || '');
        if (aName && (aName === normName || namesSimilar(normName, aName))) {
          const matchedFields = ['email', 'name'];
          let confidence = 95;
          
          // Boost confidence if country also matches
          if (normCountry && a.location) {
            const aCountry = normalizeCountry(a.location);
            if (aCountry === normCountry) {
              matchedFields.push('country');
              confidence = 97;
            }
          }
          
          results.push({
            existingId: a.registrationId || a.id,
            confidence,
            matchType: 'high',
            matchedFields,
            source: 'applicant'
          });
        }
      }
    }
  }
  
  // 3. Phone + Name match (93% confidence)
  if (normPhone && normPhone.length >= 10 && normName) {
    for (const a of allApplicants) {
      if (a.phoneNumber) {
        const aPhone = normalizePhone(a.phoneNumber);
        if (aPhone === normPhone) {
          const aName = normalizeName(a.fullName || '');
          if (aName && (aName === normName || namesSimilar(normName, aName))) {
            const matchedFields = ['phone', 'name'];
            let confidence = 93;
            
            // Boost if country matches
            if (normCountry && a.location) {
              const aCountry = normalizeCountry(a.location);
              if (aCountry === normCountry) {
                matchedFields.push('country');
                confidence = 95;
              }
            }
            
            results.push({
              existingId: a.registrationId || a.id,
              confidence,
              matchType: 'high',
              matchedFields,
              source: 'applicant'
            });
          }
        }
      }
    }
  }
  
  // 4. Email + Phone match (92% confidence) - even without name
  if (normEmail && normPhone && normPhone.length >= 10) {
    for (const a of allApplicants) {
      if (a.email?.toLowerCase().trim() === normEmail && a.phoneNumber) {
        const aPhone = normalizePhone(a.phoneNumber);
        if (aPhone === normPhone) {
          results.push({
            existingId: a.registrationId || a.id,
            confidence: 92,
            matchType: 'high',
            matchedFields: ['email', 'phone'],
            source: 'applicant'
          });
        }
      }
    }
  }
  
  // ============================================
  // MEDIUM CONFIDENCE MATCHES (70-89%)
  // ============================================
  
  // 5. Registration ID (1 digit diff) + Name match (85% confidence)
  if (normHoldingId.length >= 6 && normName) {
    for (const s of allShareholders) {
      const sId = normalizeHoldingId(s.id || '');
      if (sId.length >= 6) {
        const diff = digitDiffCount(normHoldingId, sId);
        if (diff === 1) {
          const sName = normalizeName(s.name || '');
          if (sName && (sName === normName || namesSimilar(normName, sName))) {
            const matchedFields = ['registrationId', 'name'];
            let confidence = 85;
            
            // Boost if country matches
            if (normCountry && s.country) {
              const sCountry = normalizeCountry(s.country);
              if (sCountry === normCountry) {
                matchedFields.push('country');
                confidence = 88;
              }
            }
            
            results.push({
              existingId: s.id,
              confidence,
              matchType: 'medium',
              matchedFields,
              source: 'shareholder'
            });
          }
        }
      }
    }
  }
  
  // 6. Name + Country + Address match (80% confidence)
  if (normName && normCountry && normAddress) {
    for (const s of allShareholders) {
      const sName = normalizeName(s.name || '');
      const sCountry = normalizeCountry(s.country || '');
      const sAddress = normalizeAddress(s.coAddress || '');
      
      if (sName && sCountry === normCountry && sAddress) {
        const nameMatch = sName === normName || namesSimilar(normName, sName);
        const addressMatch = sAddress === normAddress || 
                            levenshtein(sAddress, normAddress) <= 5;
        
        if (nameMatch && addressMatch) {
          results.push({
            existingId: s.id,
            confidence: 80,
            matchType: 'medium',
            matchedFields: ['name', 'country', 'address'],
            source: 'shareholder'
          });
        }
      }
    }
  }
  
  // 7. Name + Country + Account Type match (75% confidence)
  if (normName && normCountry && normAccountType) {
    for (const s of allShareholders) {
      const sName = normalizeName(s.name || '');
      const sCountry = normalizeCountry(s.country || '');
      const sAccountType = (s.accountType || '').toUpperCase().trim();
      
      if (sName && sCountry === normCountry && sAccountType === normAccountType) {
        if (sName === normName || namesSimilar(normName, sName)) {
          results.push({
            existingId: s.id,
            confidence: 75,
            matchType: 'medium',
            matchedFields: ['name', 'country', 'accountType'],
            source: 'shareholder'
          });
        }
      }
    }
  }
  
  // 8. Email only match (70% confidence) - if no other fields match
  if (normEmail && results.length === 0) {
    for (const a of allApplicants) {
      if (a.email?.toLowerCase().trim() === normEmail) {
        results.push({
          existingId: a.registrationId || a.id,
          confidence: 70,
          matchType: 'medium',
          matchedFields: ['email'],
          source: 'applicant'
        });
        break; // Only one email match needed
      }
    }
  }
  
  // ============================================
  // LOW CONFIDENCE MATCHES (50-69%)
  // ============================================
  
  // 9. Name + Country match (65% confidence)
  if (normName && normCountry && results.length === 0) {
    for (const s of allShareholders) {
      const sName = normalizeName(s.name || '');
      const sCountry = normalizeCountry(s.country || '');
      
      if (sName && sCountry === normCountry) {
        if (sName === normName || namesSimilar(normName, sName)) {
          results.push({
            existingId: s.id,
            confidence: 65,
            matchType: 'low',
            matchedFields: ['name', 'country'],
            source: 'shareholder'
          });
        }
      }
    }
  }
  
  // 10. Phone only match (60% confidence) - if no other matches
  if (normPhone && normPhone.length >= 10 && results.length === 0) {
    for (const a of allApplicants) {
      if (a.phoneNumber) {
        const aPhone = normalizePhone(a.phoneNumber);
        if (aPhone === normPhone) {
          results.push({
            existingId: a.registrationId || a.id,
            confidence: 60,
            matchType: 'low',
            matchedFields: ['phone'],
            source: 'applicant'
          });
          break;
        }
      }
    }
  }
  
  // ============================================
  // RETURN BEST MATCH
  // ============================================
  
  if (results.length === 0) {
    return null;
  }
  
  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence);
  
  // Return highest confidence match
  // Only return if confidence >= 60 (threshold for "existing")
  const bestMatch = results[0];
  if (bestMatch.confidence >= 60) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Classify investors as New, Existing, or Suspected Existing.
 * Existing = exact match. Suspected = similar ID or name (possible typo).
 */
export async function classifyInvestors(
  investors: ExtractedInvestor[]
): Promise<ClassifyInvestorsResult> {
  const newInvestors: ExtractedInvestor[] = [];
  const existingInvestors: Array<{ investor: ExtractedInvestor; existingId: string }> = [];
  const suspectedInvestors: Array<{ investor: ExtractedInvestor; similarTo: string; reason: string; existingId: string }> = [];

  // Load all data once at the start (shared across all investors)
  const [allShareholders, allApplicants] = await Promise.all([
    officialShareholderService.getAll({ limitCount: 5000 }),
    applicantService.getAll({ limitCount: 5000 }),
  ]);

  for (const investor of investors) {
    const holdingId = (investor.holdingId || '').trim();
    if (!holdingId) {
      newInvestors.push(investor);
      continue;
    }

    // First try comprehensive multi-field matching
    const comprehensiveMatch = await findExistingInvestorComprehensive(
      investor,
      allShareholders,
      allApplicants
    );

    if (comprehensiveMatch) {
      if (comprehensiveMatch.confidence >= 90) {
        // High confidence = existing
        existingInvestors.push({ 
          investor, 
          existingId: comprehensiveMatch.existingId 
        });
      } else if (comprehensiveMatch.confidence >= 70) {
        // Medium confidence = existing (with note)
        existingInvestors.push({ 
          investor, 
          existingId: comprehensiveMatch.existingId 
        });
      } else {
        // Low confidence = suspected
        suspectedInvestors.push({
          investor,
          similarTo: `Matched by: ${comprehensiveMatch.matchedFields.join(', ')}`,
          reason: `${comprehensiveMatch.confidence}% confidence match (${comprehensiveMatch.matchType})`,
          existingId: comprehensiveMatch.existingId
        });
      }
    } else {
      // Fallback to legacy matching for backward compatibility
      const existingId = await findExistingId(
        holdingId,
        investor.email,
        investor.investorName
      );
      
      if (existingId) {
        existingInvestors.push({ investor, existingId });
      } else {
        // Check for suspected matches
        const suspected = await findSuspectedMatch(investor, allShareholders, allApplicants);
        if (suspected) {
          suspectedInvestors.push({ investor, ...suspected });
        } else {
          newInvestors.push(investor);
        }
      }
    }
  }

  return { new: newInvestors, existing: existingInvestors, suspected: suspectedInvestors };
}

