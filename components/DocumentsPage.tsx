'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Document, DocumentType, DocumentStatus } from '../lib/types';
import { documentService } from '../lib/document-service';
import SmartMetadataModal from './SmartMetadataModal';

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

const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isModalOpen = !!uploadedFile;

  // Computed automation flag helpers (not stored in database)
  const isFeatured = (doc: Document) => {
    if (doc.type !== 'earnings') return false;
    const publishDate = new Date(doc.publishDate);
    const daysSince = Math.floor((Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince <= 5;
  };

  const isNewDisclosure = (doc: Document) => {
    if (doc.type !== 'disclosure') return false;
    const publishDate = new Date(doc.publishDate);
    const hoursSince = Math.floor((Date.now() - publishDate.getTime()) / (1000 * 60 * 60));
    return hoursSince <= 24;
  };

  const enableDividendBanner = (doc: Document) => doc.type === 'dividend';

  const enableMeetingCountdown = (doc: Document) => {
    if (doc.type !== 'agm') return false;
    const publishDate = new Date(doc.publishDate);
    return publishDate > new Date(); // Future date
  };

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

  // Handle file selection
  const handleFileSelect = (file: File) => {
    // Validate PDF
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are allowed.');
      return;
    }

    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`File size exceeds 10MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
      return;
    }

    setUploadedFile(file);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle save from modal
  const handleSave = async (data: {
    title: string;
    type: DocumentType;
    publishDate: string;
    file: File;
    summary: string;
    status: 'draft' | 'published';
  }) => {
    try {
      console.log('[DocumentsPage] Starting save process...', {
        title: data.title,
        type: data.type,
        status: data.status,
      });

      const documentId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Create document in Firestore (minimal schema, no file storage)
      const document: Document = {
        id: documentId,
        title: data.title,
        type: data.type,
        status: data.status,
        publishDate: data.publishDate,
        createdAt: now,
        updatedAt: now,
        summary: data.summary,
        summaryRegenerationCount: 0,
      };

      console.log('[DocumentsPage] Creating document in Firestore...');
      await documentService.create(document);
      console.log('[DocumentsPage] Document created successfully');
      
      // Reload documents
      await loadDocuments();
      
      // Reset state
      setUploadedFile(null);
      
      console.log('[DocumentsPage] Save process completed successfully');
    } catch (error: any) {
      console.error('[DocumentsPage] Error saving document:', error);
      // Re-throw with a more user-friendly message
      const errorMessage = error?.message || 'Unknown error occurred';
      throw new Error(errorMessage);
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

  // Handle archive
  const handleArchive = async (documentId: string) => {
    try {
      await documentService.archive(documentId);
      await loadDocuments();
    } catch (error) {
      console.error('Error archiving document:', error);
      alert('Failed to archive document. Please try again.');
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    return true;
  });

  // Get published documents for preview cards
  const publishedDocuments = filteredDocuments.filter(doc => doc.status === 'published');

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tighter uppercase">Documents</h2>
          <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-1">
            Manage and organize investor relations documents
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
        <div
          className={`p-12 border-2 border-dashed rounded-lg transition-colors ${
            isDragging
              ? 'border-[#082b4a] dark:border-[#00adf0] bg-neutral-50 dark:bg-neutral-900'
              : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-200 dark:border-neutral-700">
              <svg className="w-8 h-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <path d="M14 2v6h6"/>
                <path d="M16 13H8"/>
                <path d="M16 17H8"/>
                <path d="M10 9H8"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              {isDragging ? 'Drop PDF file here' : 'Upload PDF Document'}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              Drag and drop a PDF file here, or click to browse
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4">
              Maximum file size: 10MB • PDF files only
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 text-sm font-bold text-white bg-[#082b4a] dark:bg-[#00adf0] hover:bg-[#0a3a5f] dark:hover:bg-[#0099d6] rounded-lg transition-colors"
            >
              Select PDF File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file);
                }
                // Reset input to allow selecting the same file again
                if (e.target) {
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Frontend Simulation Cards */}
      {publishedDocuments.length > 0 && (
        <div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-tighter">
            Frontend Preview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publishedDocuments.slice(0, 6).map((doc) => (
              <div
                key={doc.id}
                className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedDocument(doc);
                  setIsPreviewModalOpen(true);
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="px-2 py-1 text-xs font-bold text-[#082b4a] dark:text-[#00adf0] bg-[#082b4a]/10 dark:bg-[#00adf0]/10 rounded uppercase">
                    {DOCUMENT_TYPE_LABELS[doc.type]}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {new Date(doc.publishDate).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-2 line-clamp-2">
                  {doc.title}
                </h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-4">
                  {doc.summary.split('\n')[0]}
                </p>
                <button className="text-sm font-bold text-[#082b4a] dark:text-[#00adf0] hover:underline">
                  Read More →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document History Table */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tighter">
            Document History
          </h3>
          <div className="flex items-center gap-4">
            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DocumentType | 'all')}
              className="px-4 py-2 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
            >
              <option value="all">All Types</option>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | 'all')}
              className="px-4 py-2 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No documents found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900 text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Publish Date</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100">{doc.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-bold text-[#082b4a] dark:text-[#00adf0] bg-[#082b4a]/10 dark:bg-[#00adf0]/10 rounded uppercase">
                        {DOCUMENT_TYPE_LABELS[doc.type]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-bold rounded uppercase ${
                        doc.status === 'published'
                          ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                          : doc.status === 'draft'
                          ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                          : 'text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/20'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                      {new Date(doc.publishDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedDocument(doc);
                            setIsPreviewModalOpen(true);
                          }}
                          className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                          title="View"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {doc.status !== 'archived' && (
                          <button
                            onClick={() => handleArchive(doc.id)}
                            className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                            title="Archive"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Smart Metadata Modal */}
      <SmartMetadataModal
        isOpen={isModalOpen}
        onClose={() => {
          setUploadedFile(null);
        }}
        onSave={handleSave}
        uploadedFile={uploadedFile}
        sidebarCollapsed={false}
      />

      {/* Preview Modal */}
      {isPreviewModalOpen && selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300" style={{ marginLeft: '16rem' }}>
          <div 
            className="fixed inset-0 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-40 transition-all duration-300"
          />
          <div 
            className="relative bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 py-6 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
                {selectedDocument.title}
              </h2>
              <button
                onClick={() => {
                  setIsPreviewModalOpen(false);
                }}
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
