'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DocumentType } from '../lib/types';

interface SmartMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    type: DocumentType;
    publishDate: string;
    file: File;
    summary: string;
    status: 'draft' | 'published';
  }) => Promise<void>;
  uploadedFile: File | null;
  sidebarCollapsed?: boolean;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'earnings', label: 'Earnings' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'disclosure', label: 'Disclosure' },
  { value: 'press_release', label: 'Press Release' },
  { value: 'agm', label: 'AGM' },
  { value: 'governance', label: 'Governance' },
  { value: 'esg', label: 'ESG' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'silent_period', label: 'Silent Period' },
];

/**
 * Infer document type from filename keywords
 */
function inferDocumentType(filename: string): DocumentType | null {
  const lower = filename.toLowerCase();

  if (lower.includes('earnings') || lower.includes('financial') || lower.includes('results') || lower.includes('quarter')) {
    return 'earnings';
  }
  if (lower.includes('dividend')) {
    return 'dividend';
  }
  if (lower.includes('disclosure') || lower.includes('regulatory')) {
    return 'disclosure';
  }
  if (lower.includes('press') || lower.includes('release') || lower.includes('announcement')) {
    return 'press_release';
  }
  if (lower.includes('agm') || lower.includes('annual') || lower.includes('meeting')) {
    return 'agm';
  }
  if (lower.includes('governance')) {
    return 'governance';
  }
  if (lower.includes('esg') || lower.includes('sustainability') || lower.includes('environmental')) {
    return 'esg';
  }
  if (lower.includes('presentation') || lower.includes('investor')) {
    return 'presentation';
  }
  if (lower.includes('silent') || lower.includes('quiet')) {
    return 'silent_period';
  }

  return null;
}

/**
 * Infer title from filename (remove extension, clean up)
 */
function inferTitle(filename: string): string {
  let title = filename.replace(/\.pdf$/i, '');
  title = title.replace(/[_-]/g, ' ');
  title = title
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return title;
}


const SmartMetadataModal: React.FC<SmartMetadataModalProps> = ({
  isOpen,
  onClose,
  onSave,
  uploadedFile,
  sidebarCollapsed = false,
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DocumentType>('press_release');
  const [publishDate, setPublishDate] = useState('');
  const [summary, setSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [regenerationCount, setRegenerationCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'draft' | 'published'>('draft');

  // Auto-fill fields when file is uploaded
  useEffect(() => {
    if (uploadedFile && isOpen) {
      // Infer type
      const inferredType = inferDocumentType(uploadedFile.name);
      if (inferredType) {
        setType(inferredType);
      }

      // Infer title
      const inferredTitle = inferTitle(uploadedFile.name);
      setTitle(inferredTitle);

      // Set publish date to today
      const today = new Date().toISOString().split('T')[0];
      setPublishDate(today);

      // Reset
      setSummary('');
      setRegenerationCount(0);
    }
  }, [uploadedFile, isOpen]);

  // Auto-generate summary once metadata is filled
  useEffect(() => {
    if (isOpen && title && type && publishDate && uploadedFile && !summary && !isGeneratingSummary) {
      generateSummary();
    }
  }, [isOpen, title, type, publishDate, uploadedFile, summary, isGeneratingSummary]);

  const generateSummary = useCallback(
    async (isRegeneration: boolean = false) => {
      if (!title || !type || !publishDate || !uploadedFile) return;

      console.log('[SmartMetadata] Generating summary…', {
        title,
        type,
        publishDate,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        isRegeneration,
        regenerationCount,
      });

      setIsGeneratingSummary(true);
      try {
        // Create FormData
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('title', title);
        formData.append('type', type);
        formData.append('publishDate', publishDate);
        formData.append('regenerationCount', (isRegeneration ? regenerationCount : 0).toString());

        const response = await fetch('/api/generate-document-summary', {
          method: 'POST',
          body: formData, // No Content-Type header (browser sets it with boundary)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[SmartMetadata] API error:', response.status, errorData);
          throw new Error(errorData.message || errorData.error || `API returned ${response.status}`);
        }

        const data = await response.json();
        console.log('[SmartMetadata] Summary generated ✓', {
          success: data.success,
          summaryLength: data.summary?.length || 0,
          extractedTextLength: data.extractedTextLength || 0,
          model: data.model,
        });

        if (data.success && data.summary) {
          setSummary(data.summary);
          if (isRegeneration) {
            setRegenerationCount(data.regenerationCount || regenerationCount + 1);
          }
        } else {
          throw new Error(data.error || data.message || 'No summary returned');
        }
      } catch (error: any) {
        console.error('[SmartMetadata] Summary generation failed:', error);
        const errorMessage = error?.message || 'Summary generation failed. Please try again or enter manually.';
        setSummary(`Error: ${errorMessage}`);
      } finally {
        setIsGeneratingSummary(false);
      }
    },
    [title, type, publishDate, uploadedFile, regenerationCount]
  );

  const handleRegenerateSummary = useCallback(() => {
    generateSummary(true);
  }, [generateSummary]);

  const handleSave = async () => {
    if (!uploadedFile || !title || !type || !publishDate) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        title,
        type,
        publishDate,
        file: uploadedFile,
        summary: summary || 'No summary available.',
        status: saveStatus,
      });
      // Reset form
      setTitle('');
      setType('press_release');
      setPublishDate('');
      setSummary('');
      setRegenerationCount(0);
      setSaveStatus('draft');
      onClose();
    } catch (error: any) {
      console.error('[SmartMetadata] Error saving document:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Failed to save document: ${errorMessage}\n\nPlease check the browser console for more details.`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const sidebarWidthClass = sidebarCollapsed ? 'left-20' : 'left-64';

  return (
    <div className={`fixed top-0 right-0 bottom-0 ${sidebarWidthClass} z-50 flex items-center justify-center transition-all duration-300`}>
      {/* Blurred background */}
      <div
        className={`fixed top-0 right-0 bottom-0 ${sidebarWidthClass} bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-40 transition-all duration-300`}
      />

      {/* Modal Content */}
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
              Smart Document Metadata
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Auto-filled fields are editable. Complete required fields to generate AI summary.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Document Type */}
          <div>
            <label className="block text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2 uppercase tracking-wider">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
            >
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt.value} value={dt.value}>
                  {dt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Document Title */}
          <div>
            <label className="block text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2 uppercase tracking-wider">
              Document Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
              placeholder="Enter document title"
            />
          </div>

          {/* Publish Date */}
          <div>
            <label className="block text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2 uppercase tracking-wider">
              Publish Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
            />
          </div>

          {/* File Upload Preview */}
          {uploadedFile && (
            <div>
              <label className="block text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2 uppercase tracking-wider">
                Uploaded File
              </label>
              <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{uploadedFile.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Summary Section */}
          <div>
            <label className="block text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2 uppercase tracking-wider">
              Auto-Generated Summary
              {regenerationCount > 0 && (
                <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  (Regenerated {regenerationCount} time{regenerationCount !== 1 ? 's' : ''})
                </span>
              )}
            </label>
            <div className="relative">
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] resize-none"
                placeholder={
                  isGeneratingSummary
                    ? 'Generating summary from PDF content…'
                    : 'Summary will be generated automatically when required fields are completed.'
                }
                disabled={isGeneratingSummary}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {summary && (
                  <button
                    onClick={handleRegenerateSummary}
                    disabled={isGeneratingSummary}
                    className="p-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Regenerate summary"
                  >
                    <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {isGeneratingSummary && (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Extracting text &amp; generating AI summary from document content…
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 text-sm font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setSaveStatus('draft');
              handleSave();
            }}
            disabled={isSaving || isGeneratingSummary || !title || !type || !publishDate}
            className="px-6 py-2.5 text-sm font-bold text-white bg-neutral-600 dark:bg-neutral-500 hover:bg-neutral-700 dark:hover:bg-neutral-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            onClick={() => {
              setSaveStatus('published');
              handleSave();
            }}
            disabled={isSaving || isGeneratingSummary || !title || !type || !publishDate}
            className="px-6 py-2.5 text-sm font-bold text-white bg-[#082b4a] dark:bg-[#00adf0] hover:bg-[#0a3a5f] dark:hover:bg-[#0099d6] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Publishing…' : 'Save & Publish'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartMetadataModal;
