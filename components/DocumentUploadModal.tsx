'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DocumentType } from '../lib/types';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    type: DocumentType;
    publishDate: string;
    file: File;
    summary: string;
    status: 'draft' | 'published' | 'scheduled';
    tags?: string[];
    scheduledPublishDate?: string;
  }) => Promise<void>;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'earnings', label: 'Earnings Release' },
  { value: 'dividend', label: 'Dividend Declaration' },
  { value: 'disclosure', label: 'Material Disclosure' },
  { value: 'press_release', label: 'Press Release' },
  { value: 'agm', label: 'Annual General Meeting' },
  { value: 'governance', label: 'Governance' },
  { value: 'esg', label: 'ESG Report' },
  { value: 'presentation', label: 'Investor Presentation' },
  { value: 'silent_period', label: 'Silent Period' },
];

const ACCEPTED_FILE_TYPES = ['.pdf', '.docx', '.xlsx', '.ppt', '.csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
 * Infer title from filename
 */
function inferTitle(filename: string): string {
  let title = filename.replace(/\.(pdf|docx|xlsx|ppt|csv)$/i, '');
  title = title.replace(/[_-]/g, ' ');
  title = title
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return title;
}

const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DocumentType>('press_release');
  const [publishDate, setPublishDate] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'draft' | 'published' | 'scheduled'>('draft');
  const [scheduledPublishDate, setScheduledPublishDate] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setHasUnsavedChanges(false);
      setShowCloseConfirm(false);
    } else {
      // Reset all fields when closing
      setUploadedFile(null);
      setTitle('');
      setType('press_release');
      setPublishDate('');
      setSummary('');
      setTags([]);
      setTagInput('');
      setScheduledPublishDate('');
      setSaveStatus('draft');
      setHasUnsavedChanges(false);
    }
  }, [isOpen]);

  // Auto-fill fields when file is uploaded
  useEffect(() => {
    if (uploadedFile && isOpen) {
      const inferredType = inferDocumentType(uploadedFile.name);
      if (inferredType) {
        setType(inferredType);
      }
      const inferredTitle = inferTitle(uploadedFile.name);
      setTitle(inferredTitle);
      const today = new Date().toISOString().split('T')[0];
      setPublishDate(today);
      setHasUnsavedChanges(true);
    }
  }, [uploadedFile, isOpen]);

  // Track unsaved changes
  useEffect(() => {
    if (isOpen && (title || type || publishDate || summary || tags.length > 0 || uploadedFile)) {
      setHasUnsavedChanges(true);
    }
  }, [title, type, publishDate, summary, tags, uploadedFile, isOpen]);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FILE_TYPES.includes(fileExtension)) {
      alert(`File type not supported. Accepted formats: ${ACCEPTED_FILE_TYPES.join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      alert(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
      return;
    }

    setUploadedFile(file);
  };

  // Drag and drop handlers
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

  // Tag management
  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Generate summary
  const generateSummary = useCallback(async () => {
    if (!title || !type || !publishDate || !uploadedFile) {
      alert('Please fill in title, type, and publish date before generating summary.');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('title', title);
      formData.append('type', type);
      formData.append('publishDate', publishDate);

      const response = await fetch('/api/generate-document-summary', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.message || errorData.error || `API returned ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.summary) {
        setSummary(data.summary);
      } else {
        throw new Error(data.error || data.message || 'No summary returned');
      }
    } catch (error: any) {
      console.error('Summary generation failed:', error);
      const errorMessage = error?.message || 'Summary generation failed. Please try again or enter manually.';
      alert(errorMessage);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [title, type, publishDate, uploadedFile]);

  // Handle save
  const handleSave = async () => {
    if (!uploadedFile || !title || !type || !publishDate) {
      alert('Please fill in all required fields');
      return;
    }

    if (saveStatus === 'scheduled') {
      if (!scheduledPublishDate) {
        alert('Please select a scheduled publish date and time');
        return;
      }
      // Validate that scheduled date is in the future
      const scheduledDate = new Date(scheduledPublishDate);
      if (scheduledDate <= new Date()) {
        alert('Scheduled publish date must be in the future');
        return;
      }
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
        tags: tags.length > 0 ? tags : undefined,
        scheduledPublishDate: saveStatus === 'scheduled' ? scheduledPublishDate : undefined,
      });
      setHasUnsavedChanges(false);
      onClose();
    } catch (error: any) {
      console.error('Error saving document:', error);
      alert(`Failed to save document: ${error?.message || 'Unknown error occurred'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle close with confirmation
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = (action: 'save-draft' | 'discard' | 'cancel') => {
    if (action === 'save-draft') {
      setSaveStatus('draft');
      handleSave();
    } else if (action === 'discard') {
      setHasUnsavedChanges(false);
      onClose();
    }
    setShowCloseConfirm(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop - covers main content area only, not sidebar */}
      <div
        className="fixed top-0 right-0 bottom-0 left-64 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-40 transition-all duration-300"
        onClick={handleClose}
      />

      {/* Modal Container - centered within content area */}
      <div className="fixed top-0 right-0 bottom-0 left-64 z-50 flex items-center justify-center transition-all duration-300">
      {/* Modal Content */}
      <div
        className="relative bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-neutral-200 dark:border-white/[0.04] flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
              Upload Document
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Upload and configure your investor relations document
            </p>
          </div>
          <button
            onClick={handleClose}
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
          {/* ── Upload Section ── */}
          <div>
            <label className="block text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-3 uppercase tracking-wider">
              Upload File
            </label>
            <div
              ref={dropZoneRef}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragging
                  ? 'border-[#082b4a] dark:border-[#00adf0] bg-[#082b4a]/5 dark:bg-[#00adf0]/5'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {uploadedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{uploadedFile.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • {uploadedFile.type || 'Unknown type'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setUploadedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 bg-neutral-50 dark:bg-neutral-900 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
                      <svg className="w-8 h-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                      {isDragging ? 'Drop file here' : 'Drag and drop a file here, or click to browse'}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Accepted formats: {ACCEPTED_FILE_TYPES.join(', ')} • Max size: {MAX_FILE_SIZE / 1024 / 1024}MB
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-bold text-white bg-[#082b4a] dark:bg-[#00adf0] hover:bg-[#0a3a5f] dark:hover:bg-[#0099d6] rounded-lg transition-colors"
                  >
                    Select File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES.join(',')}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect(file);
                      }
                      if (e.target) {
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Document Metadata Form ── */}
          <div className="space-y-6">
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

            {/* Description/Summary */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                  Description / Summary
                </label>
                <button
                  onClick={generateSummary}
                  disabled={isGeneratingSummary || !title || !type || !publishDate || !uploadedFile}
                  className="px-3 py-1.5 text-xs font-bold text-[#082b4a] dark:text-[#00adf0] bg-[#082b4a]/10 dark:bg-[#00adf0]/10 hover:bg-[#082b4a]/20 dark:hover:bg-[#00adf0]/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGeneratingSummary ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate Summary
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] resize-y min-h-[100px]"
                placeholder="Enter document description or use AI to generate a summary..."
                disabled={isGeneratingSummary}
                style={{ minHeight: '100px' }}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2 uppercase tracking-wider">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 text-xs font-medium text-[#082b4a] dark:text-[#00adf0] bg-[#082b4a]/10 dark:bg-[#00adf0]/10 rounded-lg flex items-center gap-2"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  className="flex-1 px-4 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
                  placeholder="Add tags (e.g., Earnings, Sustainability, Governance)"
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-2.5 text-sm font-bold text-white bg-neutral-600 dark:bg-neutral-500 hover:bg-neutral-700 dark:hover:bg-neutral-400 rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
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
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-6 border-t border-neutral-200 dark:border-white/[0.04] flex items-center justify-between">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {hasUnsavedChanges && <span className="text-amber-600 dark:text-amber-400">You have unsaved changes</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
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
              disabled={isSaving || isGeneratingSummary || !title || !type || !publishDate || !uploadedFile}
              className="px-6 py-2.5 text-sm font-bold text-white bg-neutral-600 dark:bg-neutral-500 hover:bg-neutral-700 dark:hover:bg-neutral-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving…' : 'Save as Draft'}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (saveStatus === 'scheduled') {
                    // If already in scheduled mode, save it
                    handleSave();
                  } else {
                    // Switch to scheduled mode
                    setSaveStatus('scheduled');
                    if (!scheduledPublishDate) {
                      const now = new Date();
                      now.setHours(now.getHours() + 1); // Default to 1 hour from now
                      setScheduledPublishDate(now.toISOString().slice(0, 16));
                    }
                  }
                }}
                disabled={isSaving || isGeneratingSummary || !title || !type || !publishDate || !uploadedFile}
                className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveStatus === 'scheduled' ? (isSaving ? 'Scheduling…' : 'Save Schedule') : 'Schedule Publish'}
              </button>
              <button
                onClick={() => {
                  setSaveStatus('published');
                  handleSave();
                }}
                disabled={isSaving || isGeneratingSummary || !title || !type || !publishDate || !uploadedFile}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#082b4a] dark:bg-[#00adf0] hover:bg-[#0a3a5f] dark:hover:bg-[#0099d6] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Publishing…' : 'Publish Now'}
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Publish Date Picker (shown when Schedule is clicked) */}
        {saveStatus === 'scheduled' && (
          <div className="px-8 py-4 border-t border-neutral-200 dark:border-white/[0.04] bg-blue-50 dark:bg-blue-900/10">
            <label className="block text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Scheduled Publish Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledPublishDate}
              onChange={(e) => setScheduledPublishDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0]"
              required
            />
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              The document will be automatically published at the selected date and time.
            </p>
            <button
              onClick={() => {
                setSaveStatus('draft');
                setScheduledPublishDate('');
              }}
              className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 hover:underline"
            >
              Cancel scheduling
            </button>
          </div>
        )}

        {/* Close Confirmation Dialog */}
        {showCloseConfirm && (
          <div className="fixed top-0 right-0 bottom-0 left-64 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center transition-all duration-300">
            <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl p-6 max-w-md mx-4 border border-neutral-200 dark:border-white/[0.04]">
              <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100 mb-2">
                Discard Changes?
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                You have unsaved changes. What would you like to do?
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleConfirmClose('save-draft')}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-neutral-600 dark:bg-neutral-500 hover:bg-neutral-700 dark:hover:bg-neutral-400 rounded-lg transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => handleConfirmClose('discard')}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={() => handleConfirmClose('cancel')}
                  className="px-4 py-2.5 text-sm font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
};

export default DocumentUploadModal;

