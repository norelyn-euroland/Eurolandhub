import { Document, DocumentType, DocumentStatus } from '../lib/types';
import { documentService } from '../lib/document-service';

/**
 * Extended document interface for dashboard display
 * Includes analytics fields that may come from a separate analytics service
 */
export interface ReleasedDocument {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  publishDate: string; // ISO date string (YYYY-MM-DD)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  summary: string;
  // Analytics fields (may come from separate analytics service)
  views?: number;
  comments?: number;
  downloads?: number;
}

/**
 * Document type to display label mapping
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  earnings: 'Earnings',
  dividend: 'Dividend',
  disclosure: 'Disclosure',
  press_release: 'Press Release',
  agm: 'AGM',
  governance: 'Governance',
  esg: 'ESG',
  presentation: 'Presentation',
  silent_period: 'Silent Period',
};

/**
 * All document tags for filtering (includes 'All')
 */
export const DOCUMENT_TAGS = ['All', ...Object.values(DOCUMENT_TYPE_LABELS)] as const;

/**
 * Convert DocumentType to display label
 */
export const getDocumentTypeLabel = (type: DocumentType): string => {
  return DOCUMENT_TYPE_LABELS[type] || type;
};

/**
 * Convert display label back to DocumentType
 */
export const getDocumentTypeFromLabel = (label: string): DocumentType | null => {
  const entry = Object.entries(DOCUMENT_TYPE_LABELS).find(([_, displayLabel]) => displayLabel === label);
  return entry ? (entry[0] as DocumentType) : null;
};

/**
 * Convert real Document to ReleasedDocument format
 * This function can be extended to merge analytics data from a separate service
 */
const documentToReleasedDocument = (doc: Document, analytics?: {
  views?: number;
  comments?: number;
  downloads?: number;
}): ReleasedDocument => {
  return {
    id: doc.id,
    title: doc.title,
    type: doc.type,
    status: doc.status,
    publishDate: doc.publishDate,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    summary: doc.summary,
    views: analytics?.views,
    comments: analytics?.comments,
    downloads: analytics?.downloads,
  };
};

/**
 * Released Documents Service
 * 
 * This service provides an abstraction layer for fetching released documents.
 * Currently uses dummy data, but designed to easily switch to real document service
 * and analytics service when ready.
 * 
 * Migration path:
 * 1. Replace getDummyDocuments() with documentService.getAll()
 * 2. Add analytics service integration for views/comments/downloads
 * 3. Update documentToReleasedDocument to merge analytics data
 */
export const releasedDocumentsService = {
  /**
   * Get all published documents (ready for frontend display)
   * 
   * Currently: Returns dummy data
   * Future: Fetch from documentService.getAll({ status: 'published' })
   *         and merge with analytics service data
   */
  async getPublishedDocuments(): Promise<ReleasedDocument[]> {
    // TODO: Replace with real service call when ready
    // const documents = await documentService.getAll({ status: 'published' });
    // const analytics = await analyticsService.getDocumentAnalytics(documents.map(d => d.id));
    // return documents.map(doc => documentToReleasedDocument(doc, analytics[doc.id]));
    
    return getDummyDocuments();
  },

  /**
   * Get published documents filtered by type
   */
  async getPublishedDocumentsByType(type: DocumentType): Promise<ReleasedDocument[]> {
    const all = await this.getPublishedDocuments();
    return all.filter(doc => doc.type === type);
  },

  /**
   * Search published documents by title
   */
  async searchPublishedDocuments(query: string): Promise<ReleasedDocument[]> {
    const all = await this.getPublishedDocuments();
    const lowerQuery = query.toLowerCase();
    return all.filter(doc => 
      doc.title.toLowerCase().includes(lowerQuery) ||
      doc.summary.toLowerCase().includes(lowerQuery)
    );
  },

  /**
   * Get recent published documents (limited count)
   */
  async getRecentPublishedDocuments(count: number): Promise<ReleasedDocument[]> {
    const all = await this.getPublishedDocuments();
    return all
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
      .slice(0, count);
  },
};

/**
 * Dummy data generator
 * This will be removed when real service is connected
 */
function getDummyDocuments(): ReleasedDocument[] {
  const now = new Date();
  const dummyData: ReleasedDocument[] = [
    {
      id: 'doc-1',
      title: 'Q4 2025 Earnings Report',
      type: 'earnings',
      status: 'published',
      publishDate: '2026-03-04',
      createdAt: new Date('2026-03-04T14:45:00').toISOString(),
      updatedAt: new Date('2026-03-04T14:45:00').toISOString(),
      summary: 'Quarterly earnings report for Q4 2025',
      views: 2480,
      comments: 34,
      downloads: 120,
    },
    {
      id: 'doc-2',
      title: 'ESG Impact Report 2025',
      type: 'esg',
      status: 'published',
      publishDate: '2026-03-03',
      createdAt: new Date('2026-03-03T09:30:00').toISOString(),
      updatedAt: new Date('2026-03-03T09:30:00').toISOString(),
      summary: 'Environmental, Social, and Governance impact report for 2025',
      views: 1820,
      comments: 18,
      downloads: 95,
    },
    {
      id: 'doc-3',
      title: 'Dividend Declaration – FY2025',
      type: 'dividend',
      status: 'published',
      publishDate: '2026-03-01',
      createdAt: new Date('2026-03-01T11:15:00').toISOString(),
      updatedAt: new Date('2026-03-01T11:15:00').toISOString(),
      summary: 'Annual dividend declaration for fiscal year 2025',
      views: 3120,
      comments: 42,
      downloads: 210,
    },
    {
      id: 'doc-4',
      title: 'Board Governance Charter Update',
      type: 'governance',
      status: 'published',
      publishDate: '2026-02-28',
      createdAt: new Date('2026-02-28T16:00:00').toISOString(),
      updatedAt: new Date('2026-02-28T16:00:00').toISOString(),
      summary: 'Updated board governance charter and policies',
      views: 890,
      comments: 7,
      downloads: 45,
    },
    {
      id: 'doc-5',
      title: 'Annual General Meeting Notice 2026',
      type: 'agm',
      status: 'published',
      publishDate: '2026-02-26',
      createdAt: new Date('2026-02-26T10:00:00').toISOString(),
      updatedAt: new Date('2026-02-26T10:00:00').toISOString(),
      summary: 'Notice for Annual General Meeting 2026',
      views: 4210,
      comments: 56,
      downloads: 280,
    },
    {
      id: 'doc-6',
      title: 'Strategic Partnership Press Release',
      type: 'press_release',
      status: 'published',
      publishDate: '2026-02-24',
      createdAt: new Date('2026-02-24T13:30:00').toISOString(),
      updatedAt: new Date('2026-02-24T13:30:00').toISOString(),
      summary: 'Announcement of new strategic partnership',
      views: 1540,
      comments: 21,
      downloads: 78,
    },
    {
      id: 'doc-7',
      title: 'Q3 2025 Investor Presentation',
      type: 'presentation',
      status: 'published',
      publishDate: '2026-02-20',
      createdAt: new Date('2026-02-20T08:00:00').toISOString(),
      updatedAt: new Date('2026-02-20T08:00:00').toISOString(),
      summary: 'Investor presentation for Q3 2025 results',
      views: 2100,
      comments: 15,
      downloads: 145,
    },
    {
      id: 'doc-8',
      title: 'Material Information Disclosure',
      type: 'disclosure',
      status: 'published',
      publishDate: '2026-02-18',
      createdAt: new Date('2026-02-18T17:00:00').toISOString(),
      updatedAt: new Date('2026-02-18T17:00:00').toISOString(),
      summary: 'Material information disclosure as required by regulations',
      views: 1680,
      comments: 9,
      downloads: 62,
    },
  ];

  return dummyData;
}



