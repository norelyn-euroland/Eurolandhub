
export enum RegistrationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FURTHER_INFO = 'FURTHER_INFO'
}

export enum InvestorType {
  RETAIL = 'RETAIL',
  ACCREDITED = 'ACCREDITED',
  INSTITUTIONAL = 'INSTITUTIONAL'
}

export enum AccountType {
  INDIVIDUAL = 'INDIVIDUAL',
  JOINT = 'JOINT',
  TRUST = 'TRUST',
  CORPORATE = 'CORPORATE',
  ORDINARY = 'ORDINARY'
}

// @google/genai guidelines: Define a shared ViewType for navigation consistency
export type ViewType = 'dashboard' | 'registrations' | 'detail' | 'shareholders' | 'compliance';

export interface SelfDeclaration {
  netWorth: string;
  annualIncome: string;
  isPEP: boolean;
  sourceOfWealth: string;
  investmentExperience: string;
  isShareholder: boolean;
  shareholdingDetails?: string;
}

export interface Applicant {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  location?: string;
  type: InvestorType;
  submissionDate: string;
  lastActive: string;
  status: RegistrationStatus;
  idDocumentUrl: string;
  taxDocumentUrl: string;
  declaration: SelfDeclaration;
}

export interface Shareholder {
  rank: number;
  holdings: number;
  stake: number;
  id: string;
  name: string;
  firstName?: string;
  coAddress: string;
  country: string;
  accountType: AccountType | string;
}

export interface AIAnalysisResult {
  riskScore: number;
  summary: string;
  discrepancies: string[];
  recommendation: string;
}
