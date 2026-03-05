'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Document, DocumentType, DocumentStatus } from '../lib/types';
import { documentService } from '../lib/document-service';
import DocumentUploadModal from './DocumentUploadModal';

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
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

const STATUS_LABELS: Record<DocumentStatus | 'scheduled', string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
  scheduled: 'Scheduled',
};

// Extended document interface for display (includes optional engagement metrics)
interface DocumentWithMetrics extends Document {
  tags?: string[];
  views?: number;
  downloads?: number;
  comments?: number;
  scheduledPublishDate?: string;
}

type SortField = 'title' | 'type' | 'publishDate' | 'createdAt' | 'status';
type SortDirection = 'asc' | 'desc';

const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all' | 'scheduled'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const allDocs = await documentService.getAll();
      setDocuments(allDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort documents
  const filteredAndSortedDocuments = React.useMemo(() => {
    let filtered = documents.filter((doc) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!doc.title.toLowerCase().includes(query) && !doc.summary.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && doc.type !== typeFilter) return false;

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'scheduled') {
          // Check if document has a future publishDate
          const publishDate = new Date(doc.publishDate);
          if (publishDate <= new Date() || doc.status !== 'draft') return false;
        } else if (doc.status !== statusFilter) {
          return false;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'publishDate':
          aValue = new Date(a.publishDate).getTime();
          bValue = new Date(b.publishDate).getTime();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [documents, searchQuery, typeFilter, statusFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedDocuments.length / itemsPerPage);
  const paginatedDocuments = filteredAndSortedDocuments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, statusFilter]);

  // Handle save from modal
  const handleSave = async (data: {
    title: string;
    type: DocumentType;
    publishDate: string;
    file: File;
    summary: string;
    status: 'draft' | 'published' | 'scheduled';
    tags?: string[];
    scheduledPublishDate?: string;
  }) => {
    try {
      const documentId = crypto.randomUUID();
      const now = new Date().toISOString();

      const document: Document = {
        id: documentId,
        title: data.title,
        type: data.type,
        status: data.status === 'scheduled' ? 'draft' : data.status,
        publishDate: data.scheduledPublishDate || data.publishDate,
        createdAt: now,
        updatedAt: now,
        summary: data.summary,
        summaryRegenerationCount: 0,
      };

      await documentService.create(document);
      await loadDocuments();
      setIsUploadModalOpen(false);
    } catch (error: any) {
      console.error('Error saving document:', error);
      throw error;
    }
  };

  // Handle delete
  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      await documentService.delete(documentId);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  // Handle publish/unpublish toggle
  const handleTogglePublish = async (doc: Document) => {
    try {
      const newStatus: DocumentStatus = doc.status === 'published' ? 'draft' : 'published';
      const updatedDoc: Document = {
        ...doc,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      await documentService.update(doc.id, updatedDoc);
      await loadDocuments();
    } catch (error) {
      console.error('Error toggling publish status:', error);
      alert('Failed to update document status. Please try again.');
    }
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get status badge color
  const getStatusBadgeClass = (doc: Document) => {
    const isScheduled = new Date(doc.publishDate) > new Date() && doc.status === 'draft';
    if (isScheduled) {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
    switch (doc.status) {
      case 'published':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'draft':
        return 'text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/20 border-neutral-200 dark:border-neutral-700';
      case 'archived':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default:
        return 'text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/20 border-neutral-200 dark:border-neutral-700';
    }
  };

  // Get status label
  const getStatusLabel = (doc: Document) => {
    const isScheduled = new Date(doc.publishDate) > new Date() && doc.status === 'draft';
    return isScheduled ? 'Scheduled' : STATUS_LABELS[doc.status];
  };

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      {/* ── Header Section ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight">
            Documents
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1.5 max-w-2xl">
            Manage investor-related documents such as financial reports, disclosures, presentations, and filings.
          </p>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="px-5 py-2.5 text-sm font-bold text-white bg-[#082b4a] dark:bg-[#00adf0] hover:bg-[#0a3a5f] dark:hover:bg-[#0099d6] rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Upload Document
        </button>
      </div>

      {/* ── Controls Section ── */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-white/[0.04] rounded-xl shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DocumentType | 'all')}
              className="px-4 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
            >
              <option value="all">All Types</option>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | 'all' | 'scheduled')}
              className="px-4 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Documents Table ── */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-white/[0.04] rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading documents...</p>
          </div>
        ) : filteredAndSortedDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'No documents match your filters.'
                : 'No documents found. Upload your first document to get started.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-white/[0.04]">
                  <tr>
                    <th className="px-6 py-3.5">
                      <button
                        onClick={() => handleSort('title')}
                        className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em] hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-2 transition-colors"
                      >
                        Document Title
                        {sortField === 'title' && (
                          <svg
                            className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3.5">
                      <button
                        onClick={() => handleSort('type')}
                        className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em] hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-2 transition-colors"
                      >
                        Type
                        {sortField === 'type' && (
                          <svg
                            className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em]">
                      Tags
                    </th>
                    <th className="px-6 py-3.5">
                      <button
                        onClick={() => handleSort('publishDate')}
                        className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em] hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-2 transition-colors"
                      >
                        Publish Date
                        {sortField === 'publishDate' && (
                          <svg
                            className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3.5">
                      <button
                        onClick={() => handleSort('createdAt')}
                        className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em] hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-2 transition-colors"
                      >
                        Created Date
                        {sortField === 'createdAt' && (
                          <svg
                            className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3.5">
                      <button
                        onClick={() => handleSort('status')}
                        className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em] hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-2 transition-colors"
                      >
                        Status
                        {sortField === 'status' && (
                          <svg
                            className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em]">
                      Engagement
                    </th>
                    <th className="px-6 py-3.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.12em] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {paginatedDocuments.map((doc) => {
                    const docWithMetrics = doc as DocumentWithMetrics;
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                            {doc.title}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-bold text-[#082b4a] dark:text-[#00adf0] bg-[#082b4a]/10 dark:bg-[#00adf0]/10 rounded uppercase">
                            {DOCUMENT_TYPE_LABELS[doc.type]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {docWithMetrics.tags && docWithMetrics.tags.length > 0 ? (
                              docWithMetrics.tags.slice(0, 2).map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded"
                                >
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-neutral-400 dark:text-neutral-600">—</span>
                            )}
                            {docWithMetrics.tags && docWithMetrics.tags.length > 2 && (
                              <span className="text-xs text-neutral-400 dark:text-neutral-600">
                                +{docWithMetrics.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {new Date(doc.publishDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {new Date(doc.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded border ${getStatusBadgeClass(doc)}`}
                          >
                            {getStatusLabel(doc)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {docWithMetrics.views !== undefined || docWithMetrics.downloads !== undefined ? (
                            <div className="flex items-center gap-3">
                              {docWithMetrics.views !== undefined && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                  </svg>
                                  {docWithMetrics.views.toLocaleString()}
                                </span>
                              )}
                              {docWithMetrics.downloads !== undefined && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                  </svg>
                                  {docWithMetrics.downloads.toLocaleString()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400 dark:text-neutral-600">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedDocument(doc);
                                setIsPreviewModalOpen(true);
                              }}
                              className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                              title="View"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </button>
                            {doc.status !== 'archived' && (
                              <button
                                onClick={() => handleTogglePublish(doc)}
                                className={`p-2 rounded transition-colors ${
                                  doc.status === 'published'
                                    ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                                }`}
                                title={doc.status === 'published' ? 'Unpublish' : 'Publish'}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {doc.status === 'published' ? (
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                    />
                                  ) : (
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M5 13l4 4L19 7"
                                    />
                                  )}
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/[0.04] flex items-center justify-between">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, filteredAndSortedDocuments.length)} of{' '}
                  {filteredAndSortedDocuments.length} documents
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Upload Modal ── */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSave={handleSave}
      />

      {/* ── Preview Modal ── */}
      {isPreviewModalOpen && selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300" style={{ marginLeft: '16rem' }}>
          <div className="fixed inset-0 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-40 transition-all duration-300" />
          <div
            className="relative bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 py-6 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
                {selectedDocument.title}
              </h2>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 text-xs font-bold text-[#082b4a] dark:text-[#00adf0] bg-[#082b4a]/10 dark:bg-[#00adf0]/10 rounded uppercase">
                  {DOCUMENT_TYPE_LABELS[selectedDocument.type]}
                </span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Published: {new Date(selectedDocument.publishDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider mb-2">
                  Summary
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                    {selectedDocument.summary}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
