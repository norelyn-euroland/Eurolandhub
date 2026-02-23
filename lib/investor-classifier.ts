/**
 * Investor Classifier
 * Classifies extracted investors as New, Existing, or Suspected Existing.
 * Suspected = similar name or registration ID (possible typo).
 */

import { ExtractedInvestor } from './investor-extractor.js';
import { shareholderService, applicantService } from './firestore-service.js';
import type { Shareholder } from './types.js';
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

/** Name similarity: true if Levenshtein <= 2 or ratio > 0.85 */
function namesSimilar(name1: string, name2: string): boolean {
  const a = (name1 || '').trim();
  const b = (name2 || '').trim();
  if (!a || !b) return false;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 4) return dist <= 1;
  if (maxLen <= 8) return dist <= 2;
  const ratio = 1 - dist / maxLen;
  return ratio >= 0.85 || dist <= 2;
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

  // 1) Shareholder by any ID variation
  for (const v of variations) {
    const shareholder = await shareholderService.getById(v);
    if (shareholder) return shareholder.id;
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

  // 4) Full scan: shareholders and applicants with flexible id + name matching
  const [allShareholders, allApplicants] = await Promise.all([
    shareholderService.getAll({ limitCount: 5000 }),
    applicantService.getAll({ limitCount: 5000 }),
  ]);

  const norm6 = (holdingId || '').replace(/\D/g, '').slice(-6);
  if (!norm6) return null;

  for (const s of allShareholders) {
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
    for (const s of allShareholders) {
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
  shareholders: Shareholder[],
  applicants: Applicant[]
): Promise<{ similarTo: string; reason: string; existingId: string } | null> {
  const holdingId = normalizeHoldingId(investor.holdingId || '');
  const investorName = (investor.investorName || '').trim();

  // Check shareholders
  for (const s of shareholders) {
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
 * Classify investors as New, Existing, or Suspected Existing.
 * Existing = exact match. Suspected = similar ID or name (possible typo).
 */
export async function classifyInvestors(
  investors: ExtractedInvestor[]
): Promise<ClassifyInvestorsResult> {
  const newInvestors: ExtractedInvestor[] = [];
  const existingInvestors: Array<{ investor: ExtractedInvestor; existingId: string }> = [];
  const suspectedInvestors: Array<{ investor: ExtractedInvestor; similarTo: string; reason: string }> = [];

  const [allShareholders, allApplicants] = await Promise.all([
    shareholderService.getAll({ limitCount: 5000 }),
    applicantService.getAll({ limitCount: 5000 }),
  ]);

  for (const investor of investors) {
    const holdingId = (investor.holdingId || '').trim();
    if (!holdingId) {
      newInvestors.push(investor);
      continue;
    }

    const existingId = await findExistingId(
      holdingId,
      investor.email,
      investor.investorName
    );
    if (existingId) {
      existingInvestors.push({ investor, existingId });
    } else {
      const suspected = await findSuspectedMatch(investor, allShareholders, allApplicants);
      if (suspected) {
        suspectedInvestors.push({ investor, ...suspected });
      } else {
        newInvestors.push(investor);
      }
    }
  }

  return { new: newInvestors, existing: existingInvestors, suspected: suspectedInvestors };
}

