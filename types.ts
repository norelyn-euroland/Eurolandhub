
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

export interface Applicant {
  id: string;
  fullName: string;
  email: string;
  type: InvestorType;
  submissionDate: string;
  status: RegistrationStatus;
  idDocumentUrl: string;
  taxDocumentUrl: string;
}

export interface AIAnalysisResult {
  riskScore: number;
  summary: string;
  discrepancies: string[];
  recommendation: string;
}
