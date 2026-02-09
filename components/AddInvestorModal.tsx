'use client';

import React, { useState, useRef, useEffect } from 'react';
import { parseDocument } from '../lib/document-parser';
import { extractInvestors, ExtractedInvestor } from '../lib/investor-extractor';
import { saveInvestors, SaveInvestorError } from '../lib/investor-service';

interface InvestorFormData {
  id: string;
  investorName: string;
  holdingId: string;
  email: string;
  phone: string;
  ownershipPercent: string;
  country: string;
  coAddress: string;
  accountType: string;
  holdings: string;
  stake: string;
}

type Step = 'UPLOAD' | 'PARSING' | 'REVIEW' | 'CONFIRMATION';

interface AddInvestorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<InvestorFormData, 'id'>) => void;
}

const AddInvestorModal: React.FC<AddInvestorModalProps> = ({ isOpen, onClose, onSave }) => {
  const [currentStep, setCurrentStep] = useState<Step>('UPLOAD');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [parsedCSV, setParsedCSV] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');
  const [parseSuccess, setParseSuccess] = useState(false);
  const [investorForms, setInvestorForms] = useState<InvestorFormData[]>([]);
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());
  const [extractedInvestors, setExtractedInvestors] = useState<ExtractedInvestor[]>([]);
  const [currentInvestorIndex, setCurrentInvestorIndex] = useState<number>(0);
  const [extractionError, setExtractionError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState<SaveInvestorError[]>([]);
  const [saveSuccessCount, setSaveSuccessCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset modal when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('UPLOAD');
      setUploadedFile(null);
      setIsProcessing(false);
      setIsAutofilling(false);
      setIsSaving(false);
      setSaveErrors([]);
      setSaveSuccessCount(0);
      setShowExitConfirm(false);
      setParsedCSV('');
      setParseError('');
      setParseSuccess(false);
      setInvestorForms([]);
      setExpandedForms(new Set());
      setExtractedInvestors([]);
      setCurrentInvestorIndex(0);
      setExtractionError('');
    }
  }, [isOpen]);

  // Check if current step is a processing step
  const isProcessingStep = isProcessing || isAutofilling;

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

  const handleNext = async () => {
    if (isProcessingStep || isSaving) return;
    
    const stepOrder: Step[] = ['UPLOAD', 'PARSING', 'REVIEW', 'CONFIRMATION'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      // If on UPLOAD and file is uploaded, allow manual navigation
      if (currentStep === 'UPLOAD' && uploadedFile) {
        // Allow manual navigation to PARSING for preview
        setCurrentStep('PARSING');
        return;
      }
      // If on PARSING and parsing is complete, move to REVIEW
      if (currentStep === 'PARSING' && parseSuccess && extractedInvestors.length > 0) {
        setCurrentStep('REVIEW');
        return;
      }
      if (currentStep === 'REVIEW') {
        await handleSubmit();
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

  // Handle template download
  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/investor-template.csv';
    link.download = 'investor-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    // Validate file type - Only allow CSV
    const validTypes = ['text/csv'];
    const validExtensions = ['.csv'];
    const isValidType = validTypes.includes(file.type);
    const isValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType && !isValidExtension) {
      alert('Only CSV files are allowed. Please download the template, fill it in, and upload it.');
      return;
    }

    setUploadedFile(file);
    setIsProcessing(true);
    setCurrentStep('PARSING');
    setParseError('');
    setParseSuccess(false);

    try {
      // Parse CSV file directly
      const result = await parseDocument(file, false);
      
      if (!result.success || !result.csvText) {
        setParseError(result.error || 'Failed to parse CSV file');
        setIsProcessing(false);
        setParseSuccess(false);
        return;
      }

      // Extract investors directly from CSV
      const extractionResult = await extractInvestors(result.csvText);
      
      if (!extractionResult.success) {
        setParseError(extractionResult.error || 'Failed to extract investors from CSV');
        setIsProcessing(false);
        setParseSuccess(false);
        return;
      }

      if (extractionResult.investors.length === 0) {
        setParseError('No investors found in the CSV file. Please check the file format matches the template.');
        setIsProcessing(false);
        setParseSuccess(false);
        return;
      }

      // Store extracted investors
      setExtractedInvestors(extractionResult.investors);
      setCurrentInvestorIndex(0);
      
      // Automatically create and populate forms
      await populateAllInvestorForms(extractionResult.investors);
      
      setIsProcessing(false);
      setParseSuccess(true);
      setCurrentStep('REVIEW');
      
    } catch (error: any) {
      console.error('File upload error:', error);
      setParseError(error?.message || 'Failed to process CSV file');
      setIsProcessing(false);
      setParseSuccess(false);
    }
  };

  // Create and populate forms for all extracted investors
  const populateAllInvestorForms = async (investors: ExtractedInvestor[]) => {
    setIsAutofilling(true);
    
    // Create forms for all investors with all extracted data
    const newForms: InvestorFormData[] = investors.map(investor => {
      const form = createNewInvestorForm();
      // Filter holding ID to numbers only, max 9 characters
      const filteredHoldingId = (investor.holdingId || '').replace(/\D/g, '').slice(0, 9);
      
      return {
        ...form,
        investorName: investor.investorName || '',
        holdingId: filteredHoldingId,
        email: investor.email || '',
        phone: investor.phone || '',
        ownershipPercent: investor.ownershipPercent || '',
        country: investor.country || '',
        coAddress: investor.coAddress || '',
        // Normalize account type to match dropdown options (case-insensitive)
        accountType: (() => {
          const accountType = (investor.accountType || '').trim();
          if (!accountType) return '';
          const upperType = accountType.toUpperCase();
          // Map common variations to standard values
          const typeMap: { [key: string]: string } = {
            'INDIVIDUAL': 'INDIVIDUAL',
            'JOINT': 'JOINT',
            'TRUST': 'TRUST',
            'CORPORATE': 'CORPORATE',
            'ORDINARY': 'ORDINARY',
            'NOMINEE': 'NOMINEE',
          };
          // Return mapped value if found, otherwise return original (will show as custom option)
          return typeMap[upperType] || accountType;
        })(),
        holdings: investor.holdings || '',
        stake: investor.stake || '',
      };
    });
    
    // Set all forms at once
    setInvestorForms(newForms);
    // Expand all forms by default
    setExpandedForms(new Set(newForms.map(f => f.id)));
    
    setIsAutofilling(false);
  };

  
  // Create a new empty investor form
  const createNewInvestorForm = (): InvestorFormData => {
    return {
      id: `investor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      investorName: '',
      holdingId: '',
      email: '',
      phone: '',
      ownershipPercent: '',
      country: '',
      coAddress: '',
      accountType: '',
      holdings: '',
      stake: '',
    };
  };

  // Add a new investor form
  const handleAddInvestor = () => {
    const newForm = createNewInvestorForm();
    setInvestorForms(prev => [...prev, newForm]);
    setExpandedForms(prev => new Set([...prev, newForm.id]));
  };

  // Remove an investor form
  const handleRemoveInvestor = (id: string) => {
    setInvestorForms(prev => prev.filter(form => form.id !== id));
    setExpandedForms(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  // Toggle form expansion
  const handleToggleForm = (id: string) => {
    setExpandedForms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Fill form with investor data (with progressive animation)
  const fillInvestorData = async (investor: ExtractedInvestor, formId?: string) => {
    setIsAutofilling(true);
    
    // If no form exists, create one
    if (investorForms.length === 0) {
      const newForm = createNewInvestorForm();
      setInvestorForms([newForm]);
      setExpandedForms(new Set([newForm.id]));
      
      // Field 1: Investor Name
      await new Promise(resolve => setTimeout(resolve, 300));
      setInvestorForms([{ ...newForm, investorName: investor.investorName || '' }]);
      
      // Field 2: Holding ID
      await new Promise(resolve => setTimeout(resolve, 300));
      setInvestorForms(prev => prev.map(f => f.id === newForm.id ? { ...f, holdingId: investor.holdingId || '' } : f));
      
      // Field 3: Email (leave blank if not detected)
      await new Promise(resolve => setTimeout(resolve, 300));
      setInvestorForms(prev => prev.map(f => f.id === newForm.id ? { ...f, email: investor.email || '' } : f));
      
      // Field 4: Ownership %
      await new Promise(resolve => setTimeout(resolve, 300));
      setInvestorForms(prev => prev.map(f => f.id === newForm.id ? { ...f, ownershipPercent: investor.ownershipPercent || '' } : f));
      
      // Field 5: Phone
      await new Promise(resolve => setTimeout(resolve, 200));
      setInvestorForms(prev => prev.map(f => f.id === newForm.id ? { ...f, phone: investor.phone || '' } : f));
    } else {
      const targetFormId = formId || investorForms[0].id;
      
      // Field 1: Investor Name
      await new Promise(resolve => setTimeout(resolve, 300));
      setInvestorForms(prev => prev.map(f => f.id === targetFormId ? { ...f, investorName: investor.investorName || '' } : f));
      
      // Field 2: Holding ID (filter to numbers only, max 9 characters)
      await new Promise(resolve => setTimeout(resolve, 300));
      const filteredHoldingId = (investor.holdingId || '').replace(/\D/g, '').slice(0, 9);
      setInvestorForms(prev => prev.map(f => f.id === targetFormId ? { ...f, holdingId: filteredHoldingId } : f));
      
      // Field 3: Email (leave blank if not detected)
      await new Promise(resolve => setTimeout(resolve, 300));
      setInvestorForms(prev => prev.map(f => f.id === targetFormId ? { ...f, email: investor.email || '' } : f));
      
      // Field 4: Ownership %
      await new Promise(resolve => setTimeout(resolve, 300));
      setInvestorForms(prev => prev.map(f => f.id === targetFormId ? { ...f, ownershipPercent: investor.ownershipPercent || '' } : f));
      
      // Field 5: Phone
      await new Promise(resolve => setTimeout(resolve, 200));
      setInvestorForms(prev => prev.map(f => f.id === targetFormId ? { ...f, phone: investor.phone || '' } : f));
    }
    
    setIsAutofilling(false);
  };
  
  // Handle selecting an investor from the list
  const handleSelectInvestor = (index: number) => {
    if (index >= 0 && index < extractedInvestors.length) {
      setCurrentInvestorIndex(index);
      // Create a new form for this investor or update existing
      if (investorForms.length === 0) {
        const newForm = createNewInvestorForm();
        setInvestorForms([newForm]);
        setExpandedForms(new Set([newForm.id]));
        fillInvestorData(extractedInvestors[index], newForm.id);
      } else {
        fillInvestorData(extractedInvestors[index], investorForms[0].id);
      }
    }
  };
  
  // Handle adding all investors at once
  const handleAddAllInvestors = async () => {
    setIsAutofilling(true);
    
    // Save all investors sequentially
    for (let i = 0; i < extractedInvestors.length; i++) {
      const investor = extractedInvestors[i];
      // Ensure email is blank if not detected
      const investorData: InvestorFormData = {
        investorName: investor.investorName || '',
        holdingId: investor.holdingId || '',
        email: investor.email || '', // Leave blank if not detected
        phone: investor.phone || '',
        ownershipPercent: investor.ownershipPercent || '',
      };
      
      onSave(investorData);
      
      // Small delay between saves to avoid overwhelming the system
      if (i < extractedInvestors.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    setIsAutofilling(false);
    // Move to confirmation step to show success
    setCurrentStep('CONFIRMATION');
  };


  // Handle form field changes
  const handleFieldChange = (formId: string, field: keyof Omit<InvestorFormData, 'id'>, value: string) => {
    setInvestorForms(prev => prev.map(form => 
      form.id === formId ? { ...form, [field]: value } : form
    ));
  };

  // Handle Holding ID field change (only numbers, max 9 characters)
  const handleHoldingIdChange = (formId: string, value: string) => {
    // Remove any non-numeric characters and limit to 9 characters
    const numericValue = value.replace(/\D/g, '').slice(0, 9);
    handleFieldChange(formId, 'holdingId', numericValue);
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate all forms
    const invalidForms = investorForms.filter(form => !form.investorName || !form.holdingId);
    if (invalidForms.length > 0) {
      alert(`Please fill in Investor Name and Registration ID (required fields) for all investors. ${invalidForms.length} form(s) incomplete.`);
      return;
    }

    if (investorForms.length === 0) {
      alert('Please add at least one investor.');
      return;
    }

    setIsSaving(true);
    setSaveErrors([]);
    setSaveSuccessCount(0);

    try {
      // Convert InvestorFormData to ExtractedInvestor format
      const investorsToSave: ExtractedInvestor[] = investorForms.map(form => ({
        investorName: form.investorName,
        holdingId: form.holdingId,
        email: form.email || '',
        phone: form.phone || '',
        ownershipPercent: form.ownershipPercent || '',
        country: form.country || '',
        coAddress: form.coAddress || '',
        accountType: form.accountType || '',
        holdings: form.holdings || '',
        stake: form.stake || '',
      }));

      // Save all investors to Firebase
      const result = await saveInvestors(investorsToSave);
      
      setSaveSuccessCount(result.success.length);
      setSaveErrors(result.errors);

      // Call onSave callback for backward compatibility (if provided)
      if (onSave && result.success.length > 0) {
        // Call onSave for each successfully saved investor
        result.success.forEach((successResult, index) => {
          const investor = investorsToSave[index];
          onSave({
            investorName: investor.investorName,
            holdingId: investor.holdingId,
            email: investor.email,
            phone: investor.phone,
            ownershipPercent: investor.ownershipPercent,
            country: investor.country,
            coAddress: investor.coAddress,
            accountType: investor.accountType,
            holdings: investor.holdings,
            stake: investor.stake,
          });
        });
      }

      // Move to confirmation step
      setCurrentStep('CONFIRMATION');
    } catch (error: any) {
      console.error('Error saving investors:', error);
      setSaveErrors([{
        investorName: 'Multiple investors',
        holdingId: '',
        error: error.message || 'Failed to save investors',
      }]);
    } finally {
      setIsSaving(false);
    }
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
        className="fixed top-0 right-0 bottom-0 left-64 bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-40"
      />
      
      {/* Modal container */}
      <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col z-50">
        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">Investor details</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
            >
              Save as draft
            </button>
            <button
              onClick={handleExitClick}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="px-8 py-6">
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
                          : 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600'
                      }`}
                    >
                      {status === 'completed' ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : status === 'active' ? (
                        <div className="w-2 h-2 rounded-full bg-white dark:bg-neutral-100" />
                      ) : (
                        <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${
                        status === 'active'
                          ? 'text-purple-600 dark:text-purple-400'
                          : status === 'completed'
                          ? 'text-neutral-600 dark:text-neutral-400'
                          : 'text-neutral-400 dark:text-neutral-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${
                        status === 'completed' || getStepStatus(steps[index + 1].id) === 'active' || getStepStatus(steps[index + 1].id) === 'completed'
                          ? 'bg-neutral-300 dark:bg-neutral-600'
                          : 'bg-neutral-200 dark:bg-neutral-700'
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
              {/* Template Download Section */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">Using the Template</h4>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      Download the CSV template, fill in investor information, then upload the completed file.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Template
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Shareholder Upload</h3>
                </div>

                {/* File Upload Section */}
                <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-8 text-center hover:border-purple-400 dark:hover:border-purple-500 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                    <div className="space-y-4">
                    <div className="flex justify-center">
                      <svg className="w-12 h-12 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Drag and drop a file here, or{' '}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-bold"
                        >
                          browse
                        </button>
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        Supported format: CSV only (Max 10MB per file)
                      </p>
                    </div>
                    {uploadedFile && (
                      <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          {uploadedFile.name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'PARSING' && (
            <div className="w-full">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Processing CSV file...</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">Extracting investor data from CSV</p>
                  <div className="mt-4 w-64 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                    <div className="bg-purple-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              ) : parseSuccess && extractedInvestors.length > 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">CSV processed successfully!</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    Found {extractedInvestors.length} investor{extractedInvestors.length !== 1 ? 's' : ''} in the file
                  </p>
                </div>
              ) : parseError ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Parsing Failed</p>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 max-w-md text-center">
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
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">CSV Processing</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">This step processes uploaded CSV files and extracts investor information</p>
                </div>
              )}
            </div>
          )}

          {currentStep === 'REVIEW' && (
            <div className="space-y-6">
              {/* Autofill Status Banner */}
              {isAutofilling && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                  <div>
                    <p className="text-sm font-bold text-purple-900 dark:text-purple-300">Extracting investors from document...</p>
                    <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">Analyzing document and mapping fields</p>
                  </div>
                </div>
              )}
              
              {/* Extraction Error */}
              {extractionError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900 dark:text-red-300">{extractionError}</p>
                </div>
              )}
              
              {/* Multiple Investors List */}
              {extractedInvestors.length > 1 && !isAutofilling && (
                <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                      Found {extractedInvestors.length} Investors
                    </h3>
                    <button
                      onClick={handleAddAllInvestors}
                      disabled={isAutofilling}
                      className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add All ({extractedInvestors.length})
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {extractedInvestors.map((investor, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectInvestor(index)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          currentInvestorIndex === index
                            ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700'
                            : 'bg-neutral-50 dark:bg-neutral-700/50 border-neutral-200 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                              {investor.investorName || `Investor ${index + 1}`}
                            </p>
                            {investor.holdingId && (
                              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">ID: {investor.holdingId}</p>
                            )}
                          </div>
                          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                            {index + 1} of {extractedInvestors.length}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Investor Forms List */}
              <div className="space-y-4">
                {/* Header with Add Investor Button */}
                <div className="flex items-center justify-end">
                  <div className="relative group">
                    <button
                      onClick={handleAddInvestor}
                      className="text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    {/* Tooltip */}
                    <div className="absolute right-0 top-full mt-2 px-3 py-2 bg-neutral-900 dark:bg-neutral-700 text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      Add investor
                      <div className="absolute bottom-full right-4">
                        <div className="border-4 border-transparent border-b-neutral-900 dark:border-b-neutral-700"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {investorForms.map((form, index) => {
                  const isExpanded = expandedForms.has(form.id);
                  const displayName = form.investorName || `Investor ${index + 1}`;
                  
                  return (
                    <div key={form.id} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                      {/* Collapsible Header */}
                      <div 
                        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                        onClick={() => handleToggleForm(form.id)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <svg 
                            className={`w-5 h-5 text-neutral-400 dark:text-neutral-500 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <div className="flex-1">
                            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{displayName}</h3>
                            {form.holdingId && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">ID: {form.holdingId}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAutofilling && index === 0 && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                              Auto-filling
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveInvestor(form.id);
                            }}
                            className="p-1.5 hover:bg-red-50 rounded-full transition-colors group"
                            title="Remove investor"
                          >
                            <svg className="w-4 h-4 text-neutral-400 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Form Content */}
                      {isExpanded && (
                        <div className="px-6 py-6 border-t border-neutral-100 dark:border-neutral-700">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Investor Name */}
                            <div className="relative">
                              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                INVESTOR NAME <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={form.investorName}
                                onChange={(e) => handleFieldChange(form.id, 'investorName', e.target.value)}
                                disabled={isAutofilling && !form.investorName && index === 0}
                                className={`w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                                  isAutofilling && form.investorName && index === 0
                                    ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 animate-pulse' 
                                    : 'border-neutral-200 dark:border-neutral-600'
                                }`}
                                placeholder="Enter investor name"
                              />
                              {isAutofilling && form.investorName && index === 0 && (
                                <div className="absolute right-3 top-9">
                                  <svg className="w-4 h-4 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Registration ID */}
                            <div className="relative">
                              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                REGISTRATION ID <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={9}
                                value={form.holdingId}
                                onChange={(e) => handleHoldingIdChange(form.id, e.target.value)}
                                disabled={isAutofilling && !form.holdingId && index === 0}
                                className={`w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                                  isAutofilling && form.holdingId && index === 0
                                    ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 animate-pulse' 
                                    : 'border-neutral-200 dark:border-neutral-600'
                                }`}
                                placeholder="Enter 9-digit registration ID"
                              />
                              {isAutofilling && form.holdingId && index === 0 && (
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
                                EMAIL {extractedInvestors.length === 0 && <span className="text-red-500">*</span>}
                              </label>
                              <input
                                type="email"
                                value={form.email}
                                onChange={(e) => handleFieldChange(form.id, 'email', e.target.value)}
                                disabled={isAutofilling && !form.email && index === 0}
                                className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                                  isAutofilling && form.email && index === 0
                                    ? 'border-purple-300 bg-purple-50 animate-pulse' 
                                    : 'border-neutral-200'
                                }`}
                                placeholder="Enter email address"
                              />
                              {isAutofilling && form.email && index === 0 && (
                                <div className="absolute right-3 top-9">
                                  <svg className="w-4 h-4 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                              {index === 0 && (
                                <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-start gap-2">
                                  <svg className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-xs font-medium text-purple-700">
                                    This email will be used for automatic invitation dispatch upon finalization.
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Phone */}
                            <div className="relative">
                              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                PHONE
                              </label>
                              <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => handleFieldChange(form.id, 'phone', e.target.value)}
                                disabled={isAutofilling && !form.phone && index === 0}
                                className={`w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                                  isAutofilling && form.phone && index === 0
                                    ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 animate-pulse' 
                                    : 'border-neutral-200 dark:border-neutral-600'
                                }`}
                                placeholder="Enter phone number"
                              />
                              {isAutofilling && form.phone && index === 0 && (
                                <div className="absolute right-3 top-9">
                                  <svg className="w-4 h-4 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Ownership %} */}
                            <div className="relative">
                              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                OWNERSHIP %
                              </label>
                              <input
                                type="text"
                                value={form.ownershipPercent}
                                onChange={(e) => handleFieldChange(form.id, 'ownershipPercent', e.target.value)}
                                disabled={isAutofilling && !form.ownershipPercent && index === 0}
                                className={`w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                                  isAutofilling && form.ownershipPercent && index === 0
                                    ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 animate-pulse' 
                                    : 'border-neutral-200 dark:border-neutral-600'
                                }`}
                                placeholder="Enter ownership percentage"
                              />
                              {isAutofilling && form.ownershipPercent && index === 0 && (
                                <div className="absolute right-3 top-9">
                                  <svg className="w-4 h-4 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Country */}
                            <div className="relative">
                              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                COUNTRY
                              </label>
                              <input
                                type="text"
                                value={form.country}
                                onChange={(e) => handleFieldChange(form.id, 'country', e.target.value)}
                                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="Enter country"
                              />
                            </div>

                            {/* CO Address */}
                            <div className="col-span-2 relative">
                              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                CO ADDRESS
                              </label>
                              <input
                                type="text"
                                value={form.coAddress}
                                onChange={(e) => handleFieldChange(form.id, 'coAddress', e.target.value)}
                                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="Enter company address"
                              />
                            </div>

                            {/* Account Type */}
                            <div className="relative">
                              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                TYPE OF ACCOUNT
                              </label>
                              <select
                                value={form.accountType}
                                onChange={(e) => handleFieldChange(form.id, 'accountType', e.target.value)}
                                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                              >
                                <option value="">Select account type</option>
                                <option value="INDIVIDUAL">Individual</option>
                                <option value="JOINT">Joint</option>
                                <option value="TRUST">Trust</option>
                                <option value="CORPORATE">Corporate</option>
                                <option value="ORDINARY">Ordinary</option>
                                <option value="NOMINEE">Nominee</option>
                                {/* Show current value if it's not in the predefined list (case-insensitive check) */}
                                {form.accountType && 
                                 form.accountType.trim() !== '' &&
                                 !['INDIVIDUAL', 'JOINT', 'TRUST', 'CORPORATE', 'ORDINARY', 'NOMINEE'].some(
                                   opt => opt.toLowerCase() === form.accountType.trim().toUpperCase()
                                 ) && (
                                  <option value={form.accountType}>{form.accountType}</option>
                                )}
                              </select>
                            </div>

                            {/* Holdings */}
                            <div className="relative">
                              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                HOLDINGS
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={form.holdings}
                                onChange={(e) => handleFieldChange(form.id, 'holdings', e.target.value)}
                                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="Enter holdings"
                              />
                            </div>

                            {/* Stake */}
                            <div className="relative">
                              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                STAKE %
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={form.stake}
                                onChange={(e) => handleFieldChange(form.id, 'stake', e.target.value)}
                                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="Enter stake percentage"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 'CONFIRMATION' && (
            <div className="flex flex-col items-center justify-center py-12">
              {saveSuccessCount > 0 && (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                    {saveSuccessCount > 1 
                      ? `${saveSuccessCount} Investors Saved Successfully`
                      : 'Investor Saved Successfully'}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center max-w-md mb-4">
                    {saveSuccessCount > 1
                      ? `${saveSuccessCount} investors have been saved to the system.`
                      : 'The investor information has been saved to the system.'}
                    {investorForms.some(f => f.email) && ' Investors with email addresses have been added to the pre-verified queue.'}
                  </p>
                </>
              )}
              
              {saveErrors.length > 0 && (
                <div className="w-full max-w-md mt-4">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-red-900 dark:text-red-300 mb-2">
                      {saveErrors.length} Error{saveErrors.length > 1 ? 's' : ''} Occurred
                    </h4>
                    <div className="space-y-2">
                      {saveErrors.map((error, index) => (
                        <div key={index} className="text-xs text-red-700 dark:text-red-400">
                          <span className="font-medium">{error.investorName}</span>
                          {error.holdingId && <span className="text-red-600 dark:text-red-500"> ({error.holdingId})</span>}
                          : {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {saveSuccessCount === 0 && saveErrors.length === 0 && (
                <div className="text-center">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">No investors were saved.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {currentStep !== 'CONFIRMATION' && (
          <div className="px-8 py-6 flex items-center justify-end">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevious}
                disabled={isProcessingStep || currentStep === 'UPLOAD'}
                className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                  isProcessingStep || currentStep === 'UPLOAD'
                    ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                    : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              {currentStep === 'REVIEW' ? (
                <button
                  onClick={handleNext}
                  disabled={isProcessingStep || isSaving}
                  className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                    isProcessingStep || isSaving
                      ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                      : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save & Exit'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={isProcessingStep || isSaving}
                  className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                    isProcessingStep || isSaving
                      ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Saving...
                    </>
                  ) : currentStep === 'PARSING' && parseSuccess ? (
                    <>
                      Continue to Review
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      Next
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 'CONFIRMATION' && (
          <div className="px-8 py-6 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end">
            <button
              onClick={() => {
                onClose();
                // Reset state when closing
                setSaveSuccessCount(0);
                setSaveErrors([]);
              }}
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
          <div className="absolute inset-0 bg-neutral-900/20 dark:bg-black/20" onClick={handleCancelExit} />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full mx-4 z-50">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Confirm Exit</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                Are you sure you want to exit?
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500">
                Exiting will cancel the entire process and all progress will be lost.
              </p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={handleCancelExit}
                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
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

