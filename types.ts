
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

export interface SelfDeclaration {
  netWorth: string;
  annualIncome: string;
  isPEP: boolean; // Politically Exposed Person
  sourceOfWealth: string;
  investmentExperience: string;
  isShareholder: boolean;
  shareholdingDetails?: string;
}

export interface Applicant {
  id: string;
  fullName: string;
  email: string;
  type: InvestorType;
  submissionDate: string;
  status: RegistrationStatus;
  idDocumentUrl: string;
  taxDocumentUrl: string;
  declaration: SelfDeclaration;
}

export interface AIAnalysisResult {
  riskScore: number;
  summary: string;
  discrepancies: string[];
  recommendation: string;
}
