import { Shareholder } from './types';

/**
 * Sample Issuer Data - SM INVESTMENTS CORPORATION
 * This is used as fallback sample data for the issuer display only.
 * All actual shareholder data should come from Firestore.
 */
export const ISSUER_SAMPLE: Shareholder = {
  rank: 1,
  holdings: 8319668,
  stake: 28.40929,
  id: '200512',
  name: 'SM INVESTMENTS CORPORATION',
  firstName: '',
  coAddress: 'SM Corporate Offices, Pasay City',
  country: 'Philippines',
  accountType: 'Ordinary'
};

