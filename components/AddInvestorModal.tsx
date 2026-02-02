'use client';

import React, { useState, useRef, useEffect } from 'react';
import { parseDocument } from '../lib/document-parser';

interface InvestorFormData {
  investorName: string;
  holdingId: string;
  email: string;
  phone: string;
  ownershipPercent: string;
}

type Step = 'UPLOAD' | 'PARSING' | 'REVIEW' | 'CONFIRMATION';

interface AddInvestorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InvestorFormData) => void;
}

const AddInvestorModal: React.FC<AddInvestorModalProps> = ({ isOpen, onClose, onSave }) => {
  const [currentStep, setCurrentStep] = useState<Step>('UPLOAD');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [parsedMarkdown, setParsedMarkdown] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');
  const [parseSuccess, setParseSuccess] = useState(false);
  const [formData, setFormData] = useState<InvestorFormData>({
    investorName: '',
    holdingId: '',
    email: '',
    phone: '',
    ownershipPercent: '',
  });
  const [isManualMode, setIsManualMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset modal when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('UPLOAD');
      setUploadedFile(null);
      setIsManualMode(false);
      setIsProcessing(false);
      setIsAutofilling(false);
      setShowExitConfirm(false);
      setParsedMarkdown('');
      setParseError('');
      setParseSuccess(false);
      setFormData({
        investorName: '',
        holdingId: '',
        email: '',
        phone: '',
        ownershipPercent: '',
      });
    }
  }, [isOpen]);

  // Check if current step is a processing step
  const isProcessingStep = currentStep === 'PARSING' || isProcessing;

  // Handle step navigation
  const handlePrevious = () => {
    if (isProcessingStep) return;
    
    const stepOrder: Step[] = ['UPLOAD', 'PARSING', 'REVIEW', 'CONFIRMATION'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      // Allow navigation to PARSING step for preview
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (isProcessingStep) return;
    
    const stepOrder: Step[] = ['UPLOAD', 'PARSING', 'REVIEW', 'CONFIRMATION'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      // If on UPLOAD and file is uploaded, allow manual navigation
      if (currentStep === 'UPLOAD' && uploadedFile && !isManualMode) {
        // Allow manual navigation to PARSING for preview
        setCurrentStep('PARSING');
        return;
      }
      if (currentStep === 'REVIEW') {
        handleSubmit();
        return;
      }
      // Allow navigation to all steps for preview
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  // Handle exit confirmation
  const handleExitClick = () => {
    setShowExitConfirm(true);
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onClose();
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // File size limit: 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      alert(`File size exceeds 10MB limit. Your file is ${fileSizeMB}MB. Please upload a smaller file.`);
      return;
    }

    // Validate file type - Only allow PNG, JPG, CSV, and PDF
    const validTypes = ['application/pdf', 'text/csv', 'image/png', 'image/jpeg', 'image/jpg'];
    const validExtensions = ['.pdf', '.csv', '.png', '.jpg', '.jpeg'];
    const isValidType = validTypes.includes(file.type);
    const isValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType && !isValidExtension) {
      alert('Only PNG, JPG, CSV, and PDF files are allowed. Please upload a supported file type.');
      return;
    }

    setUploadedFile(file);
    setIsProcessing(true);
    setCurrentStep('PARSING');
    setParseError('');
    setParseSuccess(false);

    try {
      // Parse document using Docling (or fallback parser)
      const result = await parseDocument(file);
      
      if (!result.success) {
        setParseError(result.error || 'Failed to parse document');
        setIsProcessing(false);
        setParseSuccess(false);
        return;
      }

      // Store parsed markdown
      setParsedMarkdown(result.markdown || '');
      
      // Show success message for 1 second
      setIsProcessing(false);
      setParseSuccess(true);
      
      // Wait 1 second before moving to next step
      setTimeout(() => {
        setParseSuccess(false);
        setCurrentStep('REVIEW');
        
        // Start AI field mapping with real-time updates using the parsed markdown
        simulateAIFieldMapping(file, result.markdown);
      }, 1000);
    } catch (error: any) {
      console.error('File upload error:', error);
      setParseError(error?.message || 'Failed to process document');
      setIsProcessing(false);
      setParseSuccess(false);
    }
  };

  // Simulate AI-powered field mapping with real-time field updates
  // In production, this would use an LLM to extract fields from the markdown
  const simulateAIFieldMapping = async (file: File, markdown?: string) => {
    setIsAutofilling(true);
    
    // TODO: In production, send markdown to LLM API for field extraction
    // For now, simulate progressive field filling
    // The markdown would be sent to an LLM that extracts:
    // - Investor Name
    // - Holding ID / Passport
    // - Email
    // - Phone
    // - Ownership %
    
    // Simulate LLM processing with progressive field filling
    // In real implementation, this would stream from an API that processes the markdown
    
    // Field 1: Investor Name
    await new Promise(resolve => setTimeout(resolve, 500));
    setFormData(prev => ({ ...prev, investorName: 'F. LAEISZ GMBH' }));
    
    // Field 2: Holding ID
    await new Promise(resolve => setTimeout(resolve, 500));
    setFormData(prev => ({ ...prev, holdingId: '8319668' }));
    
    // Field 3: Email
    await new Promise(resolve => setTimeout(resolve, 500));
    setFormData(prev => ({ ...prev, email: 'investor@example.com' }));
    
    // Field 4: Ownership %
    await new Promise(resolve => setTimeout(resolve, 500));
    setFormData(prev => ({ ...prev, ownershipPercent: '28.40929' }));
    
    // Field 5: Phone (optional, might be empty)
    await new Promise(resolve => setTimeout(resolve, 300));
    setFormData(prev => ({ ...prev, phone: '' }));
    
    setIsAutofilling(false);
  };

  // Handle manual entry mode
  const handleManualEntry = () => {
    setIsManualMode(true);
    setCurrentStep('REVIEW');
  };

  // Handle form field changes
  const handleFieldChange = (field: keyof InvestorFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSubmit = () => {
    // Validate required fields
    if (!formData.investorName || !formData.holdingId || !formData.email) {
      alert('Please fill in all required fields');
      return;
    }

    onSave(formData);
    setCurrentStep('CONFIRMATION');
  };

  // Steps configuration
  const steps: { id: Step; label: string }[] = [
    { id: 'UPLOAD', label: 'UPLOAD' },
    { id: 'PARSING', label: 'PARSING' },
    { id: 'REVIEW', label: 'REVIEW' },
    { id: 'CONFIRMATION', label: 'CONFIRMATION' },
  ];

  const getStepIndex = (step: Step): number => {
    return steps.findIndex(s => s.id === step);
  };

  const getStepStatus = (step: Step): 'active' | 'completed' | 'pending' => {
    const currentIndex = getStepIndex(currentStep);
    const stepIndex = getStepIndex(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ left: '256px' }}>
      {/* Blurred background - covers only content area, not sidebar */}
      <div 
        className="fixed top-0 right-0 bottom-0 left-64 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Modal container */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col z-50">
        {/* Header */}
        <div className="px-8 py-6 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-2xl font-black text-neutral-900">Investor details</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              Save as draft
            </button>
            <button
              onClick={handleExitClick}
              className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="px-8 py-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const status = getStepStatus(step.id);
              const isLast = index === steps.length - 1;
              
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        status === 'active'
                          ? 'bg-purple-600 border-purple-600'
                          : status === 'completed'
                          ? 'bg-green-500 border-green-500'
                          : 'bg-white border-neutral-300'
                      }`}
                    >
                      {status === 'completed' ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : status === 'active' ? (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      ) : (
                        <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${
                        status === 'active'
                          ? 'text-purple-600'
                          : status === 'completed'
                          ? 'text-neutral-600'
                          : 'text-neutral-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${
                        status === 'completed' || getStepStatus(steps[index + 1].id) === 'active' || getStepStatus(steps[index + 1].id) === 'completed'
                          ? 'bg-neutral-300'
                          : 'bg-neutral-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {currentStep === 'UPLOAD' && (
            <div className="space-y-6">
              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-neutral-900">Shareholder Upload</h3>
                  <button className="text-purple-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* File Upload Section */}
                  <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.csv,.png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-700">
                          Drag and drop a file here, or{' '}
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-purple-600 hover:text-purple-700 font-bold"
                          >
                            browse
                          </button>
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Supported formats: PDF, CSV, PNG, JPG only (Max 10MB per file)
                        </p>
                      </div>
                      {uploadedFile && (
                        <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm font-medium text-purple-700">
                            {uploadedFile.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-neutral-200" />
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">OR</span>
                    <div className="flex-1 h-px bg-neutral-200" />
                  </div>

                  {/* Manual Entry Button */}
                  <button
                    onClick={handleManualEntry}
                    className="w-full py-4 px-6 bg-white border-2 border-neutral-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="text-sm font-bold text-neutral-700">Manually Add Investor</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'PARSING' && (
            <div className="flex flex-col items-center justify-center py-12">
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-sm font-bold text-neutral-900">Processing document...</p>
                  <p className="text-xs text-neutral-500 mt-2">Extracting text and converting to markdown with Docling</p>
                  <div className="mt-4 w-64 bg-neutral-200 rounded-full h-1.5">
                    <div className="bg-purple-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </>
              ) : parseSuccess ? (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-scale-in">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-base font-bold text-green-600">Done parsing document!</p>
                  <p className="text-xs text-neutral-500 mt-2">Document successfully processed and ready for review</p>
                </>
              ) : parseError ? (
                <>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-red-600">Parsing Failed</p>
                  <div className="text-xs text-neutral-400 mt-2 max-w-md text-center">
                    {parseError.split('\n').map((line, idx) => (
                      <p key={idx} className={idx > 0 ? 'mt-1' : ''}>{line}</p>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setParseError('');
                      setCurrentStep('UPLOAD');
                      setUploadedFile(null);
                    }}
                    className="mt-4 px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700"
                  >
                    Try Again
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-600">Document Parsing</p>
                  <p className="text-xs text-neutral-400 mt-2">This step processes uploaded documents using Docling to extract text and convert to markdown format</p>
                </>
              )}
            </div>
          )}

          {currentStep === 'REVIEW' && (
            <div className="space-y-6">
              {/* Autofill Status Banner */}
              {isAutofilling && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                  <div>
                    <p className="text-sm font-bold text-purple-900">AI-powered field mapping in progress...</p>
                    <p className="text-xs text-purple-700 mt-1">Fields are being automatically filled from the document</p>
                  </div>
                </div>
              )}

              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-neutral-900">Personal information</h3>
                    {isAutofilling && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                        Auto-filling
                      </span>
                    )}
                  </div>
                  <button className="text-purple-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Investor Name */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                      INVESTOR NAME <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.investorName}
                      onChange={(e) => handleFieldChange('investorName', e.target.value)}
                      disabled={isAutofilling && !formData.investorName}
                      className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                        isAutofilling && formData.investorName 
                          ? 'border-purple-300 bg-purple-50 animate-pulse' 
                          : 'border-neutral-200'
                      }`}
                      placeholder="Enter investor name"
                    />
                    {isAutofilling && formData.investorName && (
                      <div className="absolute right-3 top-9">
                        <svg className="w-4 h-4 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Holding ID / Passport */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                      HOLDING ID / PASSPORT <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.holdingId}
                      onChange={(e) => handleFieldChange('holdingId', e.target.value)}
                      disabled={isAutofilling && !formData.holdingId}
                      className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                        isAutofilling && formData.holdingId 
                          ? 'border-purple-300 bg-purple-50 animate-pulse' 
                          : 'border-neutral-200'
                      }`}
                      placeholder="Enter holding ID or passport"
                    />
                    {isAutofilling && formData.holdingId && (
                      <div className="absolute right-3 top-9">
                        <svg className="w-4 h-4 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div className="col-span-2 relative">
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                      EMAIL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      disabled={isAutofilling && !formData.email}
                      className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                        isAutofilling && formData.email 
                          ? 'border-purple-300 bg-purple-50 animate-pulse' 
                          : 'border-neutral-200'
                      }`}
                      placeholder="Enter email address"
                    />
                    {isAutofilling && formData.email && (
                      <div className="absolute right-3 top-9">
                        <svg className="w-4 h-4 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-start gap-2">
                      <svg className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-medium text-purple-700">
                        This email will be used for automatic invitation dispatch upon finalization.
                      </span>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                      PHONE
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      disabled={isAutofilling && !formData.phone}
                      className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                        isAutofilling && formData.phone 
                          ? 'border-purple-300 bg-purple-50 animate-pulse' 
                          : 'border-neutral-200'
                      }`}
                      placeholder="Enter phone number"
                    />
                    {isAutofilling && formData.phone && (
                      <div className="absolute right-3 top-9">
                        <svg className="w-4 h-4 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Ownership %} */}
                  <div className="col-span-2 relative">
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                      OWNERSHIP %
                    </label>
                    <input
                      type="text"
                      value={formData.ownershipPercent}
                      onChange={(e) => handleFieldChange('ownershipPercent', e.target.value)}
                      disabled={isAutofilling && !formData.ownershipPercent}
                      className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                        isAutofilling && formData.ownershipPercent 
                          ? 'border-purple-300 bg-purple-50 animate-pulse' 
                          : 'border-neutral-200'
                      }`}
                      placeholder="Enter ownership percentage"
                    />
                    {isAutofilling && formData.ownershipPercent && (
                      <div className="absolute right-3 top-9">
                        <svg className="w-4 h-4 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'CONFIRMATION' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Investor Added Successfully</h3>
              <p className="text-sm text-neutral-600 text-center max-w-md">
                The investor information has been saved. {formData.email && 'An invitation email will be sent automatically.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {currentStep !== 'CONFIRMATION' && (
          <div className="px-8 py-6 border-t border-neutral-200 flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={isProcessingStep || currentStep === 'UPLOAD'}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${
                isProcessingStep || currentStep === 'UPLOAD'
                  ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={isProcessingStep}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${
                isProcessingStep
                  ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {currentStep === 'REVIEW' ? 'Save & Continue' : 'Next'}
            </button>
          </div>
        )}

        {currentStep === 'CONFIRMATION' && (
          <div className="px-8 py-6 border-t border-neutral-200 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={handleCancelExit} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 z-50">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900">Confirm Exit</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-neutral-600 mb-1">
                Are you sure you want to exit?
              </p>
              <p className="text-sm text-neutral-500">
                Exiting will cancel the entire process and all progress will be lost.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-end gap-3">
              <button
                onClick={handleCancelExit}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExit}
                className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddInvestorModal;

