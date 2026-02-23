/**
 * Investor validation utilities for Review & Confirm
 * - Registration ID: 6 digits only (last 6 of registration)
 * - Email: valid format with @ and domain
 * - Phone: international format support
 */

/** Registration ID: exactly 6 digits only */
export function isValidRegistrationId(value: string): boolean {
  const v = (value || '').trim();
  return /^\d{6}$/.test(v);
}

export function normalizeRegistrationId(value: string): string {
  return (value || '').replace(/\D/g, '').slice(0, 6);
}

/** Email: must contain @ and valid-looking format (not fake) */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isValidEmail(value: string): boolean {
  const v = (value || '').trim();
  if (!v) return true; // empty is allowed (no email)
  return EMAIL_REGEX.test(v) && v.includes('@') && v.length <= 254;
}

export function hasInvalidEmail(value: string): boolean {
  const v = (value || '').trim();
  if (!v) return false;
  return !isValidEmail(v);
}

/** Country to dial code + flag emoji */
export const COUNTRY_DIAL_CODES: Record<string, { code: string; flag: string }> = {
  'philippines': { code: '+63', flag: '🇵🇭' },
  'ph': { code: '+63', flag: '🇵🇭' },
  'japan': { code: '+81', flag: '🇯🇵' },
  'jp': { code: '+81', flag: '🇯🇵' },
  'usa': { code: '+1', flag: '🇺🇸' },
  'us': { code: '+1', flag: '🇺🇸' },
  'united states': { code: '+1', flag: '🇺🇸' },
  'mexico': { code: '+52', flag: '🇲🇽' },
  'mx': { code: '+52', flag: '🇲🇽' },
  'united kingdom': { code: '+44', flag: '🇬🇧' },
  'uk': { code: '+44', flag: '🇬🇧' },
  'gb': { code: '+44', flag: '🇬🇧' },
  'germany': { code: '+49', flag: '🇩🇪' },
  'de': { code: '+49', flag: '🇩🇪' },
  'france': { code: '+33', flag: '🇫🇷' },
  'fr': { code: '+33', flag: '🇫🇷' },
  'china': { code: '+86', flag: '🇨🇳' },
  'cn': { code: '+86', flag: '🇨🇳' },
  'hong kong': { code: '+852', flag: '🇭🇰' },
  'hk': { code: '+852', flag: '🇭🇰' },
  'singapore': { code: '+65', flag: '🇸🇬' },
  'sg': { code: '+65', flag: '🇸🇬' },
  'australia': { code: '+61', flag: '🇦🇺' },
  'au': { code: '+61', flag: '🇦🇺' },
  'india': { code: '+91', flag: '🇮🇳' },
  'in': { code: '+91', flag: '🇮🇳' },
  'canada': { code: '+1', flag: '🇨🇦' },
  'ca': { code: '+1', flag: '🇨🇦' },
  'sweden': { code: '+46', flag: '🇸🇪' },
  'se': { code: '+46', flag: '🇸🇪' },
  'netherlands': { code: '+31', flag: '🇳🇱' },
  'nl': { code: '+31', flag: '🇳🇱' },
  'switzerland': { code: '+41', flag: '🇨🇭' },
  'ch': { code: '+41', flag: '🇨🇭' },
};

export function getCountryDialInfo(country: string): { code: string; flag: string } | null {
  if (!country || !country.trim()) return null;
  const key = country.trim().toLowerCase();
  return COUNTRY_DIAL_CODES[key] || null;
}

/** Normalize phone: ensure it doesn't start with + when we'll add prefix, or strip leading zeros for national format */
export function formatPhoneWithCountry(phone: string, country: string): string {
  const p = (phone || '').trim().replace(/\s/g, '');
  if (!p) return '';
  const info = getCountryDialInfo(country);
  if (info) {
    // If phone already has + or country code, return as-is (user typed international)
    if (p.startsWith('+')) return p;
    const codeDigits = info.code.replace('+', '');
    if (p.startsWith(codeDigits)) return `+${p}`;
    return `${info.code} ${p.replace(/^0+/, '')}`;
  }
  return p;
}

/** Display phone with flag prefix for UI */
export function getPhoneDisplayPrefix(country: string): string {
  const info = getCountryDialInfo(country);
  if (!info) return '';
  return `${info.flag} ${info.code}`;
}

/** Format phone for display in table: "🇵🇭 +63 9123456789" */
export function formatPhoneForDisplay(phone: string, country: string): string {
  const p = (phone || '').trim();
  if (!p) return '—';
  const info = getCountryDialInfo(country);
  if (info) {
    const digits = p.replace(/\D/g, '');
    const codeDigits = info.code.replace(/\D/g, '');
    const national = digits.startsWith(codeDigits)
      ? digits.slice(codeDigits.length).replace(/^0+/, '') || digits
      : digits.replace(/^0+/, '') || digits;
    return `${info.flag} ${info.code} ${national}`.trim();
  }
  return p;
}

/** Phone invalid if has letters (should be digits, +, spaces only) */
export function hasInvalidPhone(value: string): boolean {
  const v = (value || '').trim();
  if (!v) return false;
  return /[a-zA-Z]/.test(v);
}

