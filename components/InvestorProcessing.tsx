'use client';

import React, { useState, useRef, useEffect } from 'react';
import { parseDocument } from '../lib/document-parser';
import { extractInvestors, ExtractedInvestor } from '../lib/investor-extractor';
import { saveInvestors, SaveInvestorError, saveInvestor, parseNumeric, updateExistingInvestor } from '../lib/investor-service';
import { verifyInvestors, VerificationResult } from '../lib/investor-verification-service';
import { applicantService } from '../lib/firestore-service';
import { Shareholder } from '../lib/types';
import Toast from './Toast';

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
  isExisting?: boolean;
  existingData?: Shareholder;
  emailSent?: boolean;
  emailSentAt?: string;
}

interface PendingInvestorData {
  investor: ExtractedInvestor;
  isExisting: boolean;
  existingData?: Shareholder;
  emailSent: boolean;
  emailSentAt?: string;
  hasEmail: boolean;
}

interface ProcessingProgressState {
  currentStep: string;
  currentItem: number;
  totalItems: number;
  percentage: number;
  status: 'idle' | 'updating-existing' | 'saving-new' | 'updating-emails' | 'finalizing' | 'complete' | 'error';
  message: string;
}

type Step = 'SELECTION' | 'UPLOAD' | 'PROCESSING' | 'VALIDATION' | 'REVIEW' | 'SEND_INVITATION' | 'CONFIRMATION';
type UploadType = 'batch' | 'individual' | null;

interface InvestorProcessingProps {
  sidebarCollapsed?: boolean;
}

const InvestorProcessing: React.FC<InvestorProcessingProps> = ({ sidebarCollapsed = false }) => {
  const [currentStep, setCurrentStep] = useState<Step>('SELECTION');
  const [uploadType, setUploadType] = useState<UploadType>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [processingSuccessAt, setProcessingSuccessAt] = useState<number | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [showProcessingSuccess, setShowProcessingSuccess] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [autofillProgress, setAutofillProgress] = useState<{ current: number; total: number } | null>(null);
  const [autofillActiveFormId, setAutofillActiveFormId] = useState<string | null>(null);
  const [autofillActiveField, setAutofillActiveField] = useState<keyof Omit<InvestorFormData, 'id'> | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSaveQuitConfirm, setShowSaveQuitConfirm] = useState(false);
  const [saveQuitPendingRemaining, setSaveQuitPendingRemaining] = useState<number>(0);
  const [showBackFromSummaryWarning, setShowBackFromSummaryWarning] = useState(false);
  const [parsedCSV, setParsedCSV] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');
  const [parseSuccess, setParseSuccess] = useState(false);
  const [investorForms, setInvestorForms] = useState<InvestorFormData[]>([]);
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());
  const [editableForms, setEditableForms] = useState<Set<string>>(new Set()); // Track which forms are in edit mode
  const [extractedInvestors, setExtractedInvestors] = useState<ExtractedInvestor[]>([]);
  const [currentInvestorIndex, setCurrentInvestorIndex] = useState<number>(0);
  const [extractionError, setExtractionError] = useState<string>('');
  const [investorsAdded, setInvestorsAdded] = useState<boolean>(false); // Track if "Add All" has been clicked
  const [registrationIdErrors, setRegistrationIdErrors] = useState<Map<string, { hasInvalidChars: boolean; isIncomplete: boolean }>>(new Map()); // Track registration ID validation errors per form
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState<SaveInvestorError[]>([]);
  const [saveSuccessCount, setSaveSuccessCount] = useState<number>(0);
  const [selectedInvestorsForEmail, setSelectedInvestorsForEmail] = useState<Set<string>>(new Set()); // Multiple selection
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false); // Track if in "Send To" selection mode
  const [sentEmailsTo, setSentEmailsTo] = useState<Set<string>>(new Set());
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [generatedSubject, setGeneratedSubject] = useState<string>('');
  const [generatedMessage, setGeneratedMessage] = useState<string>('');
  const [messageStyle, setMessageStyle] = useState<string>('default');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingInvestors, setPendingInvestors] = useState<PendingInvestorData[]>([]);
  const [emailTab, setEmailTab] = useState<'with-email' | 'no-email'>('with-email');
  const [isConfirmProcessing, setIsConfirmProcessing] = useState(false);
  const [confirmProcessingProgress, setConfirmProcessingProgress] = useState<ProcessingProgressState>({
    currentStep: '',
    currentItem: 0,
    totalItems: 0,
    percentage: 0,
    status: 'idle',
    message: '',
  });
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState<boolean>(false);
  const [privacyCheckboxChecked, setPrivacyCheckboxChecked] = useState<boolean>(false);
  const [isMessageExpanded, setIsMessageExpanded] = useState<boolean>(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState<'success' | 'warning' | 'error' | 'info'>('success');
  const toastHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [recipientPage, setRecipientPage] = useState(0); // Track which page of recipients we're viewing
  const [isNavigatingToReview, setIsNavigatingToReview] = useState(false); // Track if navigating to REVIEW with loading
  const [navigationProgress, setNavigationProgress] = useState(0); // Progress for navigation loading
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageBodyRef = useRef<HTMLDivElement>(null);
  const autofillRunIdRef = useRef(0);
  const formContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Loading messages that rotate during processing
  const loadingMessages = [
    'Scanning document...',
    'Reading through file...',
    'Extracting data...',
    'Processing CSV structure...',
    'Analyzing investor information...',
    'Validating file format...',
    'Parsing data fields...',
    'Organizing records...'
  ];

  // Verification messages for Validation & Classification step
  const verificationMessages = [
    'Scanning database...',
    'Checking investor records...',
    'Validating data...',
    'Cross-referencing records...',
    'Classifying investors...',
    'Processing verification...',
    'Analyzing results...'
  ];

  // Note: Removed contentEditable sync effect since we're now using textarea with processed placeholders

  // Component initialization - no reset needed for page component


  // Check if current step is a processing step
  const isProcessingStep = isProcessing;

  // Handle privacy notice acceptance
  const handlePrivacyNoticeAccept = () => {
    setPrivacyNoticeAccepted(true);
    // Optional: Log privacy notice acceptance (operational logging)
    try {
      const timestamp = new Date().toISOString();
      const userId = typeof window !== 'undefined' && window.localStorage 
        ? localStorage.getItem('eurolandhub_user_id') || 'unknown'
        : 'unknown';
      console.log('Privacy notice accepted:', {
        timestamp,
        userId,
        action: 'add_investor_attempt'
      });
    } catch (error) {
      // Silently fail if logging fails
    }
  };

  // Toggle privacy details visibility
  const togglePrivacyDetails = () => {
    setShowPrivacyDetails(prev => !prev);
  };

  // Handle upload type selection
  const handleSelectUploadType = (type: 'batch' | 'individual') => {
    setUploadType(type);
    if (type === 'individual') {
      // For individual, create a single empty form and go straight to REVIEW
      const newForm = createNewInvestorForm();
      setInvestorForms([newForm]);
      setExpandedForms(new Set([newForm.id]));
      setCurrentStep('REVIEW');
    } else {
      // For batch, go to UPLOAD step
      setCurrentStep('UPLOAD');
    }
  };

  // Handle database verification
  const handleVerification = async (investors: ExtractedInvestor[]) => {
    setIsVerifying(true);
    setProcessingProgress(0);
    setLoadingMessageIndex(0);

    // Start rotating loading messages
    const loadingMessageInterval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % verificationMessages.length);
    }, 1500);

    // Update progress bar smoothly
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 95) return 95;
        return prev + 2;
      });
    }, 100);

    try {
      const result = await verifyInvestors(investors);
      setVerificationResult(result);

      // Build pending investors data structure
      const pending: PendingInvestorData[] = investors.map(inv => {
        const existing = result.existing.find(e => e.investor.holdingId === inv.holdingId);
        return {
          investor: inv,
          isExisting: !!existing,
          existingData: existing?.existingData,
          emailSent: false,
          hasEmail: !!(inv.email && inv.email.trim()),
        };
      });

      setPendingInvestors(pending);

      // Update investor forms with existing status and existing data
      setInvestorForms(prev => prev.map(form => {
        const matchingPending = pending.find(p => p.investor.holdingId === form.holdingId);
        if (matchingPending && matchingPending.isExisting && matchingPending.existingData) {
          return {
            ...form,
            isExisting: true,
            existingData: matchingPending.existingData,
            // Pre-fill editable fields with existing data if form fields are empty
            ownershipPercent: form.ownershipPercent || '',
            holdings: form.holdings || (matchingPending.existingData.holdings ? String(matchingPending.existingData.holdings) : ''),
            stake: form.stake || (matchingPending.existingData.stake ? String(matchingPending.existingData.stake) : ''),
          };
        }
        return form;
      }));

      // Complete progress
      setProcessingProgress(100);
      clearInterval(loadingMessageInterval);
      clearInterval(progressInterval);
      setProcessingSuccessAt(Date.now());
      setShowProcessingSuccess(true);
    } catch (error: any) {
      clearInterval(loadingMessageInterval);
      clearInterval(progressInterval);
      setProcessingProgress(0);
      setExtractionError(error.message || 'Failed to verify investors');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle step navigation
  const handlePrevious = () => {
    if (isProcessingStep) return;
    
    if (currentStep === 'REVIEW' && uploadType === 'individual') {
      // Go back to selection if individual
      setCurrentStep('SELECTION');
      setUploadType(null);
      setInvestorForms([]);
      setExpandedForms(new Set());
      return;
    }
    
    if (currentStep === 'UPLOAD') {
      // Go back to selection from upload - but preserve file if processing was successful
      // Only clear if user explicitly wants to start over
      setCurrentStep('SELECTION');
      setUploadType(null);
      // Don't clear uploadedFile, parseSuccess, or extractedInvestors here
      // They will be cleared when modal is closed or user selects new upload type
      setParseError(''); // Clear errors when going back
      return;
    }
    
    // When going back to VALIDATION, show the success state if verification was already completed
    if (currentStep === 'REVIEW' && uploadType === 'batch') {
      // Going back to VALIDATION - show success state if already verified
      setCurrentStep('VALIDATION');
      return;
    }

    if (currentStep === 'VALIDATION' && uploadType === 'batch') {
      // Going back to PROCESSING
      setCurrentStep('PROCESSING');
      return;
    }
    
    const stepOrder: Step[] = uploadType === 'batch' 
      ? ['SELECTION', 'UPLOAD', 'PROCESSING', 'VALIDATION', 'REVIEW', 'SEND_INVITATION', 'CONFIRMATION']
      : ['SELECTION', 'REVIEW', 'VALIDATION', 'SEND_INVITATION', 'CONFIRMATION'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleNext = async () => {
    if (isProcessingStep || isSaving || isVerifying) return;
    
    if (currentStep === 'SELECTION') {
      // Should not happen - selection is handled by handleSelectUploadType
      return;
    }

    // For individual entry, trigger verification after REVIEW
    if (currentStep === 'REVIEW' && uploadType === 'individual') {
      // Convert forms to ExtractedInvestor format
      const investors: ExtractedInvestor[] = investorForms.map(form => ({
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

      setCurrentStep('VALIDATION');
      await handleVerification(investors);
      return;
    }
    
    const stepOrder: Step[] = uploadType === 'batch'
      ? ['SELECTION', 'UPLOAD', 'PROCESSING', 'VALIDATION', 'REVIEW', 'SEND_INVITATION', 'CONFIRMATION']
      : ['SELECTION', 'REVIEW', 'VALIDATION', 'SEND_INVITATION', 'CONFIRMATION'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      // If on UPLOAD and file is uploaded, allow manual navigation
      if (currentStep === 'UPLOAD' && uploadedFile) {
        // Allow manual navigation to PROCESSING for preview
        setCurrentStep('PROCESSING');
        return;
      }
      if (currentStep === 'REVIEW') {
        // Allow previewing the next processes even if the review forms are still empty
        const isReviewEmpty =
          investorForms.length === 0 ||
          investorForms.every(form => {
            return (
              !String(form.investorName || '').trim() &&
              !String(form.holdingId || '').trim() &&
              !String(form.email || '').trim() &&
              !String(form.phone || '').trim() &&
              !String(form.ownershipPercent || '').trim() &&
              !String(form.country || '').trim() &&
              !String(form.coAddress || '').trim() &&
              !String(form.accountType || '').trim() &&
              !String(form.holdings || '').trim() &&
              !String(form.stake || '').trim()
            );
          });

        if (isReviewEmpty) {
          setCurrentStep('SEND_INVITATION');
          return;
        }

        // Validate that all investor forms have a 6-digit registration ID
        const formsWithInvalidIds = investorForms.filter(form => {
          const holdingId = (form.holdingId || '').trim();
          return holdingId.length !== 6 || !/^\d{6}$/.test(holdingId);
        });
        
        if (formsWithInvalidIds.length > 0) {
          // Mark forms with incomplete IDs for red border display
          formsWithInvalidIds.forEach(form => {
            setRegistrationIdErrors(prev => {
              const newMap = new Map(prev);
              const holdingId = (form.holdingId || '').trim();
              newMap.set(form.id, {
                hasInvalidChars: /[^0-9]/.test(holdingId),
                isIncomplete: holdingId.length === 0 || holdingId.length < 6
              });
              return newMap;
            });
          });
          
          // Show toast notification
          triggerToast(
            'Please double-check and fill up the registration/investor ID field. Registration ID must be exactly 6 digits.',
            'warning'
          );
          return; // Prevent navigation
        }
        
        // Move to SEND_INVITATION step
        // Don't auto-select, let user click "Send To" to start selection
        setCurrentStep('SEND_INVITATION');
        return;
      }
      if (currentStep === 'SEND_INVITATION') {
        // Navigate to CONFIRMATION step
        setCurrentStep('CONFIRMATION');
        return;
      }
      // Allow navigation to all steps for preview
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  // Handle exit confirmation - removed for page component

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
    setCurrentStep('PROCESSING');
    setParseError('');
    setParseSuccess(false);
    setShowProcessingSuccess(false);
    setLoadingMessageIndex(0);
    setProcessingProgress(0);

    // Start rotating loading messages
    const loadingMessageInterval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 1500); // Change message every 1.5 seconds

    // Update progress bar smoothly
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 95) return 95; // Cap at 95% until processing completes
        return prev + 2; // Increment progress
      });
    }, 100); // Update every 100ms

    try {
      // Parse CSV file directly
      const result = await parseDocument(file, false);
      
      if (!result.success || !result.csvText) {
        clearInterval(loadingMessageInterval);
        clearInterval(progressInterval);
        setProcessingProgress(0);
        setParseError(result.error || 'Failed to process CSV file');
        setIsProcessing(false);
        setParseSuccess(false);
        return;
      }

      // Extract investors directly from CSV
      const extractionResult = await extractInvestors(result.csvText);
      
      if (!extractionResult.success) {
        clearInterval(loadingMessageInterval);
        clearInterval(progressInterval);
        setProcessingProgress(0);
        setParseError(extractionResult.error || 'Failed to extract investors from CSV');
        setIsProcessing(false);
        setParseSuccess(false);
        return;
      }

      if (extractionResult.investors.length === 0) {
        clearInterval(loadingMessageInterval);
        clearInterval(progressInterval);
        setProcessingProgress(0);
        setParseError('No investors found in the CSV file. Please check the file format matches the template.');
        setIsProcessing(false);
        setParseSuccess(false);
        return;
      }

      // Complete the progress bar to 100%
      setProcessingProgress(100);

      clearInterval(loadingMessageInterval);
      clearInterval(progressInterval);

      // Store extracted investors
      setExtractedInvestors(extractionResult.investors);
      setCurrentInvestorIndex(0);
      setProcessingSuccessAt(Date.now());
      
      // Reset investorsAdded flag when processing a new file
      setInvestorsAdded(false);
      // Clear any existing forms
      setInvestorForms([]);
      setExpandedForms(new Set());
      
      // Create forms immediately with extracted data for preview
      const newForms: InvestorFormData[] = extractionResult.investors.map((investor) => {
        const form = createNewInvestorForm();
        // Filter holding ID to numbers only, max 6 characters
        const filteredHoldingId = (investor.holdingId || '').replace(/\D/g, '').slice(0, 6);
        
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
      
      // Set all forms at once with data for preview
      setInvestorForms(newForms);
      // Forms are collapsed by default - user must expand to see details
      setExpandedForms(new Set());
      // Forms are read-only by default - user must click Edit to make changes
      setEditableForms(new Set());
      
      setIsProcessing(false);
      setParseSuccess(true);
      setShowProcessingSuccess(true);
      
      // Move to VALIDATION step and perform database verification
      setCurrentStep('VALIDATION');
      await handleVerification(extractionResult.investors);
      
    } catch (error: any) {
      clearInterval(loadingMessageInterval);
      if (typeof progressInterval !== 'undefined') {
        clearInterval(progressInterval);
      }
      setProcessingProgress(0);
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
      const filteredHoldingId = (investor.holdingId || '').replace(/\D/g, '').slice(0, 6);
      
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

  // Toggle edit mode for a form
  const handleToggleEdit = (id: string) => {
    setEditableForms(prev => {
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
      const filteredHoldingId = (investor.holdingId || '').replace(/\D/g, '').slice(0, 6);
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
  
  // Handle adding all investors at once - immediately create forms with data (no animation)
  // This is for preview only - does NOT save to database
  const handleAddAllInvestors = () => {
    // Ensure autofill state is false
    setIsAutofilling(false);
    setAutofillProgress(null);
    setAutofillActiveFormId(null);
    setAutofillActiveField(null);
    
    setInvestorsAdded(true); // Mark that investors have been added to forms
    
    // Create forms immediately with all extracted data - NO ANIMATION, NO DELAYS
    const newForms: InvestorFormData[] = extractedInvestors.map((investor, index) => {
      const form = createNewInvestorForm();
      // Filter holding ID to numbers only, max 6 characters
      const filteredHoldingId = (investor.holdingId || '').replace(/\D/g, '').slice(0, 6);
      
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
    
    // Set all forms at once with data - INSTANTLY, NO ANIMATION
    setInvestorForms(newForms);
    // Forms are collapsed by default - user must expand to see details
    setExpandedForms(new Set());
    // Forms are read-only by default - user must click Edit to make changes
    setEditableForms(new Set());
  };


  // Handle form field changes
  const handleFieldChange = (formId: string, field: keyof Omit<InvestorFormData, 'id'>, value: string) => {
    setInvestorForms(prev => prev.map(form => 
      form.id === formId ? { ...form, [field]: value } : form
    ));
  };

  // Handle Holding ID field change (only numbers, max 6 characters)
  const handleHoldingIdChange = (formId: string, value: string) => {
    // Check if input contains letters or special characters
    const hasInvalidChars = /[^0-9]/.test(value);
    
    // Remove any non-numeric characters and limit to 6 characters
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    handleFieldChange(formId, 'holdingId', numericValue);
    
    // Update validation errors
    setRegistrationIdErrors(prev => {
      const newMap = new Map(prev);
      const currentValue = numericValue.trim();
      newMap.set(formId, {
        hasInvalidChars: hasInvalidChars,
        isIncomplete: currentValue.length > 0 && currentValue.length < 6
      });
      // Clear error if field is empty or valid
      if (currentValue.length === 0 || (currentValue.length === 6 && !hasInvalidChars)) {
        newMap.delete(formId);
      }
      return newMap;
    });
  };

  // Handle generating invitation message
  const handleGenerateMessage = async () => {
    setIsGeneratingMessage(true);
    try {
      // Generate a TEMPLATE with raw placeholders (no real names/links baked in)
      const response = await fetch('/api/generate-invitation-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageStyle,
        }),
      });

      const rawText = await response.text();
      const data = rawText ? (() => { try { return JSON.parse(rawText); } catch { return null; } })() : null;

      if (response.ok && data?.subject && data?.body) {
        setGeneratedSubject(data.subject);
        setGeneratedMessage(data.body);
      } else {
        triggerToast(`Failed to generate message: ${data?.error || response.status || 'Unknown error'}`);
      }
    } catch (error: any) {
      triggerToast(`Error: ${error.message || 'Failed to generate message'}`);
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  // Helper function to trigger toast notification
  const triggerToast = (message: string, variant: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    if (toastHideTimeoutRef.current) {
      clearTimeout(toastHideTimeoutRef.current);
    }
    setToastMessage(message);
    setToastVariant(variant);
    setShowToast(true);
    toastHideTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 5000);
  };

  // Handle "Send To" button click - enters selection mode
  const handleSendToClick = () => {
    setIsSelectionMode(true);
  };

  // Handle canceling selection mode
  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedInvestorsForEmail(new Set());
  };

  // Handle select all recipients
  const handleSelectAll = () => {
    const investorsWithEmails = investorForms.filter(f => f.email && f.email.trim() && !sentEmailsTo.has(f.id));
    setSelectedInvestorsForEmail(new Set(investorsWithEmails.map(f => f.id)));
  };

  // Handle sending invitations to selected investors
  const handleSendInvitations = async () => {
    const investorsToSend = investorForms.filter(f => 
      f.email && f.email.trim() && 
      !sentEmailsTo.has(f.id) && 
      selectedInvestorsForEmail.has(f.id)
    );

    if (investorsToSend.length === 0) {
      triggerToast('Please select at least one recipient to send the invitation.');
      return;
    }

    if (!generatedSubject.trim() || !generatedMessage.trim()) {
      triggerToast('Please generate a message first before sending invitations.');
      return;
    }

    setIsSendingEmails(true);

    try {
      const sendPromises = investorsToSend.map(async (investor) => {
        const nameParts = (investor.investorName || '').trim().split(/\s+/);
        const firstName = nameParts[0] || investor.investorName || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        const registrationId = investor.holdingId || '';

        const response = await fetch('/api/send-invitation-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            toEmail: investor.email,
            firstName,
            lastName,
            registrationId,
            messageStyle,
            // IMPORTANT: Send the raw template with placeholders.
            // The server replaces placeholders per-recipient right before sending,
            // which prevents "first recipient name bleed" in batch sends.
            customSubject: generatedSubject,
            customBody: generatedMessage,
          }),
        });

        const rawText = await response.text();
        const data = rawText ? (() => { try { return JSON.parse(rawText); } catch { return null; } })() : null;

        if (response.ok && data?.ok) {
          return { success: true, investorId: investor.id };
        } else {
          return { success: false, investorId: investor.id, error: data?.error || 'Unknown error' };
        }
      });

      const results = await Promise.all(sendPromises);
      const successful = results.filter(r => r.success);
      
      // Update local state only - NO database writes
      const sentIds = new Set(successful.map(r => r.investorId));
      setSentEmailsTo(prev => new Set([...prev, ...sentIds]));
      
      // Update pending investors state with email sent status
      setPendingInvestors(prev => prev.map(pending => {
        const form = investorForms.find(f => f.id === pending.investor.holdingId || 
          (f.email && pending.investor.email && f.email.toLowerCase() === pending.investor.email.toLowerCase()));
        if (form && sentIds.has(form.id)) {
          return {
            ...pending,
            emailSent: true,
            emailSentAt: new Date().toISOString(),
          };
        }
        return pending;
      }));
      
      // Update investor forms with email sent status
      setInvestorForms(prev => prev.map(form => {
        if (sentIds.has(form.id)) {
          return {
            ...form,
            emailSent: true,
            emailSentAt: new Date().toISOString(),
          };
        }
        return form;
      }));
      
      // Clear selection and exit selection mode
      setSelectedInvestorsForEmail(new Set());
      setIsSelectionMode(false);
      
      if (successful.length > 0) {
        triggerToast(`Successfully sent ${successful.length} invitation${successful.length > 1 ? 's' : ''}.`);
      }
      
      if (results.length > successful.length) {
        triggerToast(`Failed to send ${results.length - successful.length} email(s).`);
      }
    } catch (error: any) {
      triggerToast(`Error sending invitations: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSendingEmails(false);
    }
  };

  // Handle form submission - DEPRECATED: This is no longer used
  // Data is now saved only when "Confirm and Process" is clicked
  const handleSubmit = async () => {
    // This function is kept for backward compatibility but should not be called
    // All saving now happens in handleConfirmAndProcess
    console.warn('handleSubmit called - this should not happen. Use handleConfirmAndProcess instead.');
  };

  // Handle Confirm and Process - Final database commit
  const handleConfirmAndProcess = async () => {
    setIsConfirmProcessing(true);
    
    // Build investors from forms (use latest form data)
    const investorsFromForms: ExtractedInvestor[] = investorForms.map(form => ({
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

    // Update pending investors with latest form data
    const updatedPending: PendingInvestorData[] = investorsFromForms.map(inv => {
      const existingPending = pendingInvestors.find(p => p.investor.holdingId === inv.holdingId);
      const form = investorForms.find(f => f.holdingId === inv.holdingId);
      return {
        investor: inv,
        isExisting: form?.isExisting || existingPending?.isExisting || false,
        existingData: form?.existingData || existingPending?.existingData,
        emailSent: form?.emailSent || existingPending?.emailSent || false,
        emailSentAt: form?.emailSentAt || existingPending?.emailSentAt,
        hasEmail: !!(inv.email && inv.email.trim()),
      };
    });
    setPendingInvestors(updatedPending);
    
    const existingInvestors = updatedPending.filter(p => p.isExisting);
    const newInvestors = updatedPending.filter(p => !p.isExisting);
    const investorsWithEmailSent = updatedPending.filter(p => p.emailSent && p.hasEmail);
    
    const saveErrors: SaveInvestorError[] = [];
    let saveSuccessCount = 0;
    
    try {
      // Step 1: Update Existing Investors
      setConfirmProcessingProgress({
        currentStep: 'updating-existing',
        currentItem: 0,
        totalItems: existingInvestors.length,
        percentage: 0,
        status: 'updating-existing',
        message: `Updating ${existingInvestors.length} existing investors...`
      });
      
      for (let i = 0; i < existingInvestors.length; i++) {
        const pending = existingInvestors[i];
        try {
          await updateExistingInvestor(pending.investor.holdingId, {
            ownershipPercent: pending.investor.ownershipPercent,
            holdings: pending.investor.holdings,
            stake: pending.investor.stake,
          });
          saveSuccessCount++;
        } catch (error: any) {
          saveErrors.push({
            investorName: pending.investor.investorName,
            holdingId: pending.investor.holdingId,
            error: error.message || 'Failed to update investor',
          });
        }
        
        setConfirmProcessingProgress({
          currentStep: 'updating-existing',
          currentItem: i + 1,
          totalItems: existingInvestors.length,
          percentage: Math.round(((i + 1) / existingInvestors.length) * 25),
          status: 'updating-existing',
          message: `Updating existing investor ${i + 1} of ${existingInvestors.length}...`
        });
      }
      
      // Step 2: Save New Investors
      setConfirmProcessingProgress({
        currentStep: 'saving-new',
        currentItem: 0,
        totalItems: newInvestors.length,
        percentage: 25,
        status: 'saving-new',
        message: `Saving ${newInvestors.length} new investors...`
      });
      
      for (let i = 0; i < newInvestors.length; i++) {
        const pending = newInvestors[i];
        try {
          await saveInvestor(pending.investor);
          saveSuccessCount++;
        } catch (error: any) {
          saveErrors.push({
            investorName: pending.investor.investorName,
            holdingId: pending.investor.holdingId,
            error: error.message || 'Failed to save investor',
          });
        }
        
        setConfirmProcessingProgress({
          currentStep: 'saving-new',
          currentItem: i + 1,
          totalItems: newInvestors.length,
          percentage: 25 + Math.round(((i + 1) / newInvestors.length) * 50),
          status: 'saving-new',
          message: `Saving new investor ${i + 1} of ${newInvestors.length}...`
        });
      }
      
      // Step 3: Update Email Status
      setConfirmProcessingProgress({
        currentStep: 'updating-emails',
        currentItem: 0,
        totalItems: investorsWithEmailSent.length,
        percentage: 75,
        status: 'updating-emails',
        message: `Updating email tracking for ${investorsWithEmailSent.length} investors...`
      });
      
      for (let i = 0; i < investorsWithEmailSent.length; i++) {
        const pending = investorsWithEmailSent[i];
        try {
          const applicant = await applicantService.getByEmail(pending.investor.email);
          if (applicant) {
            await applicantService.update(applicant.id, {
              emailSentAt: pending.emailSentAt,
              emailSentCount: 1,
              workflowStage: 'SENT_EMAIL',
              accountStatus: 'PENDING',
              systemStatus: 'ACTIVE',
            });
          }
        } catch (error: any) {
          console.error(`Error updating email status for ${pending.investor.email}:`, error);
          // Don't add to errors - email status update is not critical
        }
        
        setConfirmProcessingProgress({
          currentStep: 'updating-emails',
          currentItem: i + 1,
          totalItems: investorsWithEmailSent.length,
          percentage: 75 + Math.round(((i + 1) / investorsWithEmailSent.length) * 20),
          status: 'updating-emails',
          message: `Updating email status ${i + 1} of ${investorsWithEmailSent.length}...`
        });
      }
      
      // Step 4: Finalizing
      setConfirmProcessingProgress({
        currentStep: 'finalizing',
        currentItem: 0,
        totalItems: 1,
        percentage: 95,
        status: 'finalizing',
        message: 'Finalizing database updates...'
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 5: Complete
      setConfirmProcessingProgress({
        currentStep: 'complete',
        currentItem: 1,
        totalItems: 1,
        percentage: 100,
        status: 'complete',
        message: 'Processing complete!'
      });
      
      setSaveSuccessCount(saveSuccessCount);
      setSaveErrors(saveErrors);
      
      setTimeout(() => {
        setIsConfirmProcessing(false);
        triggerToast(`Successfully processed ${saveSuccessCount} investor${saveSuccessCount !== 1 ? 's' : ''}.`, 'success');
      }, 2000);
      
    } catch (error: any) {
      setConfirmProcessingProgress({
        currentStep: 'error',
        currentItem: 0,
        totalItems: 0,
        percentage: 0,
        status: 'error',
        message: `Error: ${error.message}`
      });
      setIsConfirmProcessing(false);
      triggerToast(`Error processing investors: ${error.message}`, 'error');
    }
  };

  // Steps configuration - dynamic based on upload type
  // Show full batch process by default so users can see the whole workflow
  const getSteps = (): { id: Step; label: string }[] => {
    if (uploadType === 'individual') {
      return [
        { id: 'SELECTION', label: 'Selection' },
        { id: 'REVIEW', label: 'Review & Confirm' },
        { id: 'VALIDATION', label: 'Validation & Classification' },
        { id: 'SEND_INVITATION', label: 'Email Generation' },
        { id: 'CONFIRMATION', label: 'Summary' },
      ];
    } else {
      // Show full batch process (default) so users can see all steps
      return [
        { id: 'SELECTION', label: 'Selection' },
        { id: 'UPLOAD', label: 'Upload' },
        { id: 'PROCESSING', label: 'Processing' },
        { id: 'VALIDATION', label: 'Validation & Classification' },
        { id: 'REVIEW', label: 'Review & Confirm' },
        { id: 'SEND_INVITATION', label: 'Email Generation' },
        { id: 'CONFIRMATION', label: 'Summary' },
      ];
    }
  };

  const steps = getSteps();

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

  return (
    <div className="w-full">
      {/* Privacy Notice - shown before main content if not accepted */}
      {!privacyNoticeAccepted && (
        <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-lg w-full max-w-4xl mx-auto overflow-hidden flex flex-col">
            {/* Privacy Notice Header */}
            <div className="px-8 py-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
                Investor Privacy & Data Use Notice
              </h2>
            </div>

            {/* Privacy Notice Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                  Investor Data Use & Consent
                </h3>
                
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                  When adding an investor to the platform, you confirm that you are authorized to provide the investor's information for investor-relations purposes.
                </p>

                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2">
                  What Data Is Collected
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                  The information collected may include (depending on what is provided):
                </p>
                <ul className="list-disc list-inside text-sm text-neutral-700 dark:text-neutral-300 mb-4 space-y-1 ml-2">
                  <li>Investor's name</li>
                  <li>Email address</li>
                  <li>Shareholder or registration identifiers</li>
                  <li>Investment-related metadata required for verification and investor access</li>
                </ul>

                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2">
                  Why It Is Collected
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                  This data is collected to support investor-relations operations and facilitate secure investor onboarding and communication.
                </p>

                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2">
                  How It Is Used
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                  The investor's information is used <strong>solely</strong> for the following purposes:
                </p>
                <ul className="list-disc list-inside text-sm text-neutral-700 dark:text-neutral-300 mb-4 space-y-1 ml-2">
                  <li>Verifying investor identity and shareholder status</li>
                  <li>Sending account invitations and onboarding communications</li>
                  <li>Delivering important investor-related notifications, disclosures, and updates</li>
                  <li>Supporting investor access to verified features within the platform</li>
                  <li>Managing investor account status and workflow progression</li>
                  <li>Operational tracking necessary to support investor onboarding, account access, and communication delivery</li>
                </ul>

                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2">
                  What It Is NOT Used For
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                  The investor's information will <strong>not</strong> be used for:
                </p>
                <ul className="list-disc list-inside text-sm text-neutral-700 dark:text-neutral-300 mb-4 space-y-1 ml-2">
                  <li>Marketing or promotional communications unrelated to investor relations</li>
                  <li>Advertising or third-party solicitations</li>
                  <li>Sharing with third parties outside of authorized investor-relations operations</li>
                  <li>Any purpose other than those explicitly stated above</li>
                </ul>

                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2">
                  Who Can Access It
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                  Investor data is stored securely and accessed only by:
                </p>
                <ul className="list-disc list-inside text-sm text-neutral-700 dark:text-neutral-300 mb-2 space-y-1 ml-2">
                  <li>Authorized Investor Relations Officers (IROs) who are authenticated users of the platform</li>
                  <li>Authorized personnel with proper authentication credentials</li>
                  <li>System administrators for technical support and maintenance purposes</li>
                </ul>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                  All access is logged and monitored to ensure data security and compliance.
                </p>

                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2">
                  How Long It Is Stored
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                  Investor data is stored for as long as necessary to fulfill investor-relations purposes and maintain accurate shareholder records. Data may be retained:
                </p>
                <ul className="list-disc list-inside text-sm text-neutral-700 dark:text-neutral-300 mb-4 space-y-1 ml-2">
                  <li>For the duration of the investor's relationship with the company</li>
                  <li>As required by applicable regulations and compliance standards</li>
                  <li>Until the investor requests deletion (subject to legal and regulatory requirements)</li>
                </ul>

                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2">
                  Security & Confidentiality
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                  All investor data is:
                </p>
                <ul className="list-disc list-inside text-sm text-neutral-700 dark:text-neutral-300 mb-4 space-y-1 ml-2">
                  <li>Stored securely in encrypted cloud infrastructure using industry-standard security controls</li>
                  <li>Protected by authentication and authorization controls</li>
                  <li>Transmitted over secure, encrypted connections</li>
                  <li>Subject to regular security audits and monitoring</li>
                  <li>Handled in accordance with applicable data protection and confidentiality standards</li>
                </ul>

                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2">
                  Right to Ignore / Opt Out
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                  If an investor receives an invitation or communication in error, they may safely disregard the message and no further action will be required. Investors who do not wish to proceed with account creation may simply ignore the invitation email.
                </p>

                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2">
                  By proceeding, you acknowledge that:
                </h4>
                <ul className="list-disc list-inside text-sm text-neutral-700 dark:text-neutral-300 mb-6 space-y-1 ml-2">
                  <li>You are authorized to submit this investor's information</li>
                  <li>The data will be used strictly for investor-relations purposes as described above</li>
                  <li>The information will be handled securely and responsibly</li>
                  <li>You understand the data collection, usage, and storage practices outlined in this notice</li>
                </ul>

                {/* Checkbox - at the end of the content */}
                <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                  <label className="flex items-start gap-3 cursor-pointer select-none group">
                    <div
                      className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${
                        privacyCheckboxChecked ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600 group-hover:bg-neutral-400 dark:group-hover:bg-neutral-500'
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        setPrivacyCheckboxChecked(!privacyCheckboxChecked);
                      }}
                    >
                      {privacyCheckboxChecked && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                      I confirm that I am authorized to submit this investor's information and that it will be used in accordance with the Investor Data Use & Consent.
                    </span>
                  </label>
                  
                  {/* Continue button - only appears when checkbox is checked */}
                  {privacyCheckboxChecked && (
                    <div className="flex items-center justify-end mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <button
                        onClick={handlePrivacyNoticeAccept}
                        className="px-6 py-2.5 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 bg-purple-600 text-white hover:bg-purple-700"
                      >
                        Continue
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
        </div>
      )}
      
      {/* Main content - only show when privacy notice is accepted */}
      {privacyNoticeAccepted && (
        <div className="w-full max-w-7xl mx-auto">
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
                      className={`mt-2 text-[10px] font-bold tracking-wider ${
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
            {currentStep === 'SELECTION' && (
              <div className="w-full">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                    Choose Upload Method
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Select how you want to add investors
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                  {/* Batch Upload Option */}
                  <button
                    onClick={() => handleSelectUploadType('batch')}
                    className="group relative bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl p-8 hover:border-purple-500 dark:hover:border-purple-500 transition-all hover:shadow-lg text-left"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                        <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                        Batch Upload
                      </h4>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Upload a CSV file with multiple investors
                      </p>
                    </div>
                  </button>

                  {/* Individual Upload Option */}
                  <button
                    onClick={() => handleSelectUploadType('individual')}
                    className="group relative bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl p-8 hover:border-purple-500 dark:hover:border-purple-500 transition-all hover:shadow-lg text-left"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                        <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                        Individual
                      </h4>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Manually enter a single investor
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

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
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Add Investors</h3>
                </div>

                {/* File Upload Section */}
                <div 
                  className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-8 text-center hover:border-purple-400 dark:hover:border-purple-500 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
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
                        <span className="text-purple-600 dark:text-purple-400 font-bold">
                          browse
                        </span>
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        Supported format: CSV only (Max 10MB per file)
                      </p>
                    </div>
                    {uploadedFile && (
                      <div 
                        className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                            {uploadedFile.name}
                          </p>
                          {parseSuccess && extractedInvestors.length > 0 && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              ({extractedInvestors.length} investor{extractedInvestors.length !== 1 ? 's' : ''} processed)
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFile(null);
                            setParseSuccess(false);
                            setExtractedInvestors([]);
                            setInvestorsAdded(false);
                            setInvestorForms([]);
                            setExpandedForms(new Set());
                            setParseError('');
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                          title="Remove file"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'PROCESSING' && (
            <div className="w-full min-h-[560px] flex items-center justify-center">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center w-full py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {loadingMessages[loadingMessageIndex]}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    Please wait while we process your file...
                  </p>
                  <div className="mt-4 w-64 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-purple-600 h-1.5 rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${processingProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (parseSuccess && extractedInvestors.length > 0) || (showProcessingSuccess && parseSuccess && extractedInvestors.length > 0) ? (
                <div className="flex flex-col items-center justify-center w-full py-12">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-green-700 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-black text-green-700 dark:text-green-400">
                    CSV processed successfully!
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                    Found {extractedInvestors.length} investor{extractedInvestors.length !== 1 ? 's' : ''} in the file
                  </p>
                  {uploadedFile && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                      File: {uploadedFile.name}
                    </p>
                  )}
                </div>
              ) : parseError ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">File Processing Failed</p>
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

          {currentStep === 'VALIDATION' && (
            <div className="w-full min-h-[560px] flex items-center justify-center">
              {isVerifying ? (
                <div className="flex flex-col items-center justify-center w-full py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {verificationMessages[loadingMessageIndex]}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    Please wait while we verify investors...
                  </p>
                  <div className="mt-4 w-64 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-purple-600 h-1.5 rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${processingProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : verificationResult ? (
                <div className="flex flex-col items-center justify-center w-full py-12 max-w-2xl mx-auto">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-green-700 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-black text-green-700 dark:text-green-400 mb-6">
                    Verification Complete!
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mb-1">
                        {verificationResult.stats.newCount}
                      </div>
                      <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        New Investors Found
                      </div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                      <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mb-1">
                        {verificationResult.stats.existingCount}
                      </div>
                      <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Existing Investors That Will Be Updated
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Validation & Classification</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">This step verifies investors against the database</p>
                </div>
              )}
            </div>
          )}

          {currentStep === 'REVIEW' && (
            <div className="space-y-6">
              {/* Extraction Error */}
              {extractionError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900 dark:text-red-300">{extractionError}</p>
                </div>
              )}
              
              {/* Header with Add Investor Button */}
              {(uploadType === 'batch' || uploadType === 'individual') && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    {investorForms.length > 0 && (
                      <span className="font-medium">
                        {investorForms.length} investor{investorForms.length !== 1 ? 's' : ''} ready for review
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <button
                      onClick={handleAddInvestor}
                      className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
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
              )}

              {/* Empty state */}
              {investorForms.length === 0 && (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                    No investors added yet
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">
                    Click the + button above to add an investor manually
                  </p>
                </div>
              )}

              {/* Investors Table */}
              {investorForms.length > 0 && (
                <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                            Investor Name <span className="text-red-500">*</span>
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                            Registration ID <span className="text-red-500">*</span>
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                            Ownership %
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                            Country
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                            Account Type
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider sticky right-0 bg-neutral-50 dark:bg-neutral-900/50">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                        {investorForms.map((form, index) => {
                          const isEditable = editableForms.has(form.id);
                          
                          return (
                            <tr
                              key={form.id}
                              className={`hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors ${
                                isEditable ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                              }`}
                            >
                              {/* Investor Name */}
                              <td className="px-6 py-4">
                                {isEditable && !form.isExisting ? (
                                  <input
                                    type="text"
                                    value={form.investorName}
                                    onChange={(e) => handleFieldChange(form.id, 'investorName', e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border rounded border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter investor name"
                                  />
                                ) : form.isExisting ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                      {form.existingData?.name || form.investorName || '-'}
                                    </span>
                                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded">
                                      Existing
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                    {form.investorName || '-'}
                                  </span>
                                )}
                              </td>

                              {/* Registration ID */}
                              <td className="px-6 py-4">
                                {isEditable ? (
                                  <div className="relative">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={6}
                                      value={form.holdingId}
                                      onChange={(e) => handleHoldingIdChange(form.id, e.target.value)}
                                      className={`w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 ${
                                        registrationIdErrors.has(form.id)
                                          ? 'border-red-500 focus:ring-red-500'
                                          : 'border-neutral-200 dark:border-neutral-600 focus:ring-purple-500'
                                      }`}
                                      placeholder="6 digits"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                    {form.holdingId || '-'}
                                  </span>
                                )}
                              </td>

                              {/* Email */}
                              <td className="px-6 py-4">
                                {isEditable ? (
                                  <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => handleFieldChange(form.id, 'email', e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border rounded border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter email"
                                  />
                                ) : (
                                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {form.email || '-'}
                                  </span>
                                )}
                              </td>

                              {/* Phone */}
                              <td className="px-6 py-4">
                                {isEditable ? (
                                  <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) => handleFieldChange(form.id, 'phone', e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border rounded border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter phone"
                                  />
                                ) : (
                                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {form.phone || '-'}
                                  </span>
                                )}
                              </td>

                              {/* Ownership %} */}
                              <td className="px-6 py-4">
                                {isEditable && !form.isExisting ? (
                                  <input
                                    type="text"
                                    value={form.ownershipPercent}
                                    onChange={(e) => handleFieldChange(form.id, 'ownershipPercent', e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border rounded border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="%"
                                  />
                                ) : form.isExisting && isEditable ? (
                                  <input
                                    type="text"
                                    value={form.ownershipPercent}
                                    onChange={(e) => handleFieldChange(form.id, 'ownershipPercent', e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border rounded border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="%"
                                    title="Editable field for existing investor"
                                  />
                                ) : (
                                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {form.ownershipPercent || '-'}
                                  </span>
                                )}
                              </td>

                              {/* Country */}
                              <td className="px-6 py-4">
                                {isEditable ? (
                                  <input
                                    type="text"
                                    value={form.country}
                                    onChange={(e) => handleFieldChange(form.id, 'country', e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border rounded border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter country"
                                  />
                                ) : (
                                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {form.country || '-'}
                                  </span>
                                )}
                              </td>

                              {/* Account Type */}
                              <td className="px-6 py-4">
                                {isEditable ? (
                                  <select
                                    value={form.accountType}
                                    onChange={(e) => handleFieldChange(form.id, 'accountType', e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border rounded border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  >
                                    <option value="">Select type</option>
                                    <option value="INDIVIDUAL">Individual</option>
                                    <option value="JOINT">Joint</option>
                                    <option value="TRUST">Trust</option>
                                    <option value="CORPORATE">Corporate</option>
                                    <option value="ORDINARY">Ordinary</option>
                                    <option value="NOMINEE">Nominee</option>
                                    {form.accountType && 
                                     form.accountType.trim() !== '' &&
                                     !['INDIVIDUAL', 'JOINT', 'TRUST', 'CORPORATE', 'ORDINARY', 'NOMINEE'].some(
                                       opt => opt.toLowerCase() === form.accountType.trim().toUpperCase()
                                     ) && (
                                      <option value={form.accountType}>{form.accountType}</option>
                                    )}
                                  </select>
                                ) : (
                                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {form.accountType || '-'}
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-6 py-4 sticky right-0 bg-inherit">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleToggleEdit(form.id)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                      isEditable
                                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                                    }`}
                                    title={isEditable ? 'Save changes' : 'Edit row'}
                                  >
                                    {isEditable ? 'Save' : 'Edit'}
                                  </button>
                                  <button
                                    onClick={() => handleRemoveInvestor(form.id)}
                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors group"
                                    title="Remove investor"
                                  >
                                    <svg className="w-4 h-4 text-neutral-400 dark:text-neutral-500 group-hover:text-red-600 dark:group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedForms);
                                      if (expandedForms.has(form.id)) {
                                        newExpanded.delete(form.id);
                                      } else {
                                        newExpanded.add(form.id);
                                      }
                                      setExpandedForms(newExpanded);
                                    }}
                                    className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors group"
                                    title={expandedForms.has(form.id) ? 'Hide details' : 'Show details'}
                                  >
                                    <svg 
                                      className={`w-4 h-4 text-neutral-400 dark:text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform ${
                                        expandedForms.has(form.id) ? 'rotate-180' : ''
                                      }`}
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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

                  {/* Additional fields in expandable section */}
                  {investorForms.some(form => expandedForms.has(form.id)) && (
                    <div className="border-t border-neutral-200 dark:border-neutral-700 p-6 space-y-4">
                      {investorForms
                        .filter(form => expandedForms.has(form.id))
                        .map((form) => {
                          const isEditable = editableForms.has(form.id);
                          return (
                            <div key={form.id} className="grid grid-cols-2 gap-4 p-4 bg-neutral-50 dark:bg-neutral-900/30 rounded-lg">
                              <div>
                                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                  CO ADDRESS
                                </label>
                                {isEditable ? (
                                  <input
                                    type="text"
                                    value={form.coAddress}
                                    onChange={(e) => handleFieldChange(form.id, 'coAddress', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border rounded border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter company address"
                                  />
                                ) : (
                                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {form.coAddress || '-'}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                  HOLDINGS {form.isExisting && <span className="text-purple-600 dark:text-purple-400">(Editable)</span>}
                                </label>
                                {isEditable && !form.isExisting ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.holdings}
                                    onChange={(e) => handleFieldChange(form.id, 'holdings', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border rounded border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter holdings"
                                  />
                                ) : form.isExisting && isEditable ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.holdings}
                                    onChange={(e) => handleFieldChange(form.id, 'holdings', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border rounded border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter holdings"
                                    title="Editable field for existing investor"
                                  />
                                ) : (
                                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {form.holdings || '-'}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                  STAKE % {form.isExisting && <span className="text-purple-600 dark:text-purple-400">(Editable)</span>}
                                </label>
                                {isEditable && !form.isExisting ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.stake}
                                    onChange={(e) => handleFieldChange(form.id, 'stake', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border rounded border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter stake percentage"
                                  />
                                ) : form.isExisting && isEditable ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.stake}
                                    onChange={(e) => handleFieldChange(form.id, 'stake', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border rounded border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter stake percentage"
                                    title="Editable field for existing investor"
                                  />
                                ) : (
                                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {form.stake || '-'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-end">
                                <button
                                  onClick={() => {
                                    const newExpanded = new Set(expandedForms);
                                    newExpanded.delete(form.id);
                                    setExpandedForms(newExpanded);
                                  }}
                                  className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                                >
                                  Collapse details
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 'SEND_INVITATION' && (
            <div className="grid" style={{ gridTemplateColumns: '40% 60%', gap: '1.5rem' }}>
              {/* Left Panel: Recipient List */}
              <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Recipients {Array.from(selectedInvestorsForEmail).filter(id => {
                        const inv = investorForms.find(f => f.id === id);
                        return !!(inv && inv.email && inv.email.trim() && !sentEmailsTo.has(inv.id));
                      }).length} of {investorForms.filter(f => f.email && f.email.trim() && !sentEmailsTo.has(f.id)).length}
                    </h3>
                    {(() => {
                      const allRecipients = investorForms;
                      const totalPages = Math.ceil(allRecipients.length / 10);
                      const hasMoreThan10 = allRecipients.length > 10;
                      
                      if (!hasMoreThan10) return null;
                      
                      return (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setRecipientPage(prev => Math.max(0, prev - 1))}
                            disabled={recipientPage === 0}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Previous"
                          >
                            <svg className="w-4 h-4 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setRecipientPage(prev => Math.min(totalPages - 1, prev + 1))}
                            disabled={recipientPage >= totalPages - 1}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Next"
                          >
                            <svg className="w-4 h-4 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                  {isSelectionMode && emailTab === 'with-email' && (
                    <div className="flex items-center justify-end gap-3 mt-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-bold"
                      >
                        Select All
                      </button>
                      <button
                        onClick={handleCancelSelection}
                        className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {emailTab === 'no-email' && (
                    <div className="mt-2">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                        Investors without email addresses cannot be selected for sending invitations.
                      </p>
                    </div>
                  )}
                </div>

                {/* Email Tabs */}
                <div className="border-b border-neutral-200 dark:border-neutral-700 px-4 pt-4">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setEmailTab('with-email')}
                      className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
                        emailTab === 'with-email'
                          ? 'bg-white dark:bg-neutral-800 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                      }`}
                    >
                      With Email ({investorForms.filter(f => f.email && f.email.trim()).length})
                    </button>
                    <button
                      onClick={() => setEmailTab('no-email')}
                      className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
                        emailTab === 'no-email'
                          ? 'bg-white dark:bg-neutral-800 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                      }`}
                    >
                      No Email ({investorForms.filter(f => !f.email || !f.email.trim()).length})
                    </button>
                  </div>
                </div>

                {/* Recipient List - Limited to 10 items per page */}
                <div className="overflow-y-auto p-4 space-y-2" style={{ maxHeight: 'calc(10 * (3.5rem + 0.5rem))' }}>
                  {(() => {
                    // Filter by tab
                    const filteredRecipients = emailTab === 'with-email'
                      ? investorForms.filter(f => f.email && f.email.trim())
                      : investorForms.filter(f => !f.email || !f.email.trim());
                    
                    const allRecipients = filteredRecipients;
                    const startIndex = recipientPage * 10;
                    const endIndex = startIndex + 10;
                    const currentPageInvestors = allRecipients.slice(startIndex, endIndex);
                    
                    // Reset page if current page is beyond available items
                    if (startIndex >= allRecipients.length && allRecipients.length > 0) {
                      setRecipientPage(0);
                    }
                    
                    return currentPageInvestors.map((investor) => {
                      const hasEmail = !!(investor.email && investor.email.trim());
                      const isSelected = selectedInvestorsForEmail.has(investor.id);
                      const isSent = sentEmailsTo.has(investor.id);
                      const isDisabled = isSent || (emailTab === 'no-email' ? true : !hasEmail);

                      const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                        e.stopPropagation();
                        if (isDisabled) return;
                        setSelectedInvestorsForEmail(prev => {
                          const newSet = new Set(prev);
                          if (isSelected) {
                            newSet.delete(investor.id);
                          } else {
                            newSet.add(investor.id);
                          }
                          return newSet;
                        });
                      };

                      const handleRowClick = () => {
                        if (isDisabled) return;
                        
                        if (isSelectionMode) {
                          // Multiple selection mode: toggle this investor
                          setSelectedInvestorsForEmail(prev => {
                            const newSet = new Set(prev);
                            if (isSelected) {
                              newSet.delete(investor.id);
                            } else {
                              newSet.add(investor.id);
                            }
                            return newSet;
                          });
                        } else {
                          // Single selection mode: select only this investor
                          setSelectedInvestorsForEmail(isSelected ? new Set() : new Set([investor.id]));
                        }
                      };

                      return (
                        <div
                          key={investor.id}
                          onClick={handleRowClick}
                          className={`p-3 rounded-lg border transition-all ${
                            isDisabled
                              ? 'bg-neutral-100 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 cursor-pointer hover:border-purple-400 dark:hover:border-purple-600'
                              : 'bg-neutral-50 dark:bg-neutral-700/50 border-neutral-200 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelectionMode && hasEmail && emailTab === 'with-email' && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={handleCheckboxChange}
                                disabled={isDisabled}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 text-purple-600 border-neutral-300 rounded focus:ring-purple-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                            )}
                            {emailTab === 'no-email' && (
                              <div className="w-4 h-4 flex items-center justify-center">
                                <svg className="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                                  {investor.investorName || 'Unnamed Investor'}
                                </p>
                                {isSent && (
                                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full flex-shrink-0 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Email sent
                                  </span>
                                )}
                                {!hasEmail && (
                                  <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 text-xs font-bold rounded-full flex-shrink-0">
                                    No email
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 truncate">
                                {hasEmail ? investor.email : 'No email address provided'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  
                  {investorForms.filter(f => f.email && f.email.trim() && !sentEmailsTo.has(f.id)).length === 0 && (
                    <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400">
                      No investors with email addresses found.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Email Message Container */}
              <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Content
                  </h3>
                </div>

                {/* Message Editor - Free height */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
                  {/* Message Style */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                      MESSAGE STYLE
                    </label>
                    <select
                      value={messageStyle}
                      onChange={(e) => setMessageStyle(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="default">Default</option>
                      <option value="formal">Formal</option>
                      <option value="friendly">Friendly</option>
                      <option value="casual">Casual</option>
                      <option value="professional">Professional</option>
                    </select>
                  </div>

                  {/* Subject Line */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        SUBJECT LINE
                      </label>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {generatedSubject.length} characters
                      </span>
                    </div>
                    <input
                      type="text"
                      value={generatedSubject}
                      onChange={(e) => setGeneratedSubject(e.target.value)}
                      placeholder="Generate a subject or type your custom subject line here..."
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Message Body */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        MESSAGE BODY
                      </label>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {generatedMessage.length} characters
                      </span>
                    </div>
                    {(() => {
                      // Get first selected investor for preview (only if actually selected)
                      const selectedInvestorIds = Array.from(selectedInvestorsForEmail);
                      const hasSelection = selectedInvestorIds.length > 0;
                      const isSinglePreviewMode = !isSelectionMode && selectedInvestorIds.length === 1;
                      const firstSelectedId = hasSelection ? selectedInvestorIds[0] : null;
                      const previewInvestor = hasSelection && firstSelectedId
                        ? investorForms.find(f => f.id === firstSelectedId)
                        : null;
                      
                      // Extract first name and last name from preview investor
                      let firstName = '';
                      let lastName = '';
                      let registrationId = '';
                      
                      if (previewInvestor && hasSelection) {
                        const nameParts = (previewInvestor.investorName || '').trim().split(/\s+/);
                        firstName = nameParts[0] || previewInvestor.investorName || '';
                        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                        registrationId = previewInvestor.holdingId || '';
                      }
                      
                      // Process message: replace placeholders with actual values if recipient is selected
                      const processMessage = (message: string): string => {
                        // In selection mode (Send To): always show raw placeholders.
                        // In normal mode: show actual values only for single-selection preview.
                        const shouldShowActualValues =
                          isSinglePreviewMode && previewInvestor && firstName;
                        
                        if (!shouldShowActualValues) {
                          // Keep raw placeholders (Brevo-like) when not previewing a single recipient.
                          return message;
                        }
                        
                        // Replace placeholders with actual values (preview-only; does NOT mutate the template)
                        const previewLink = 'https://eurohub.eurolandir.net/';
                        return message
                          .replace(/\{\{ first_name \}\}/gi, firstName)
                          .replace(/\{\{firstName\}\}/gi, firstName)
                          .replace(/\{\{ last_name \}\}/gi, lastName)
                          .replace(/\{\{lastName\}\}/gi, lastName)
                          .replace(/\{\{ registration_link \}\}/gi, previewLink)
                          .replace(/\{\{registrationLink\}\}/gi, previewLink)
                          .replace(/\{\{ registration_id \}\}/gi, registrationId)
                          .replace(/\{\{registrationId\}\}/gi, registrationId)
                          .replace(/\[PROTECTED_FIRST_NAME\]/gi, firstName)
                          .replace(/\[PROTECTED_LAST_NAME\]/gi, lastName)
                          .replace(/\[PROTECTED_REGISTRATION_LINK\]/gi, previewLink)
                          .replace(/\[PROTECTED_REGISTRATION_ID\]/gi, registrationId);
                      };
                      
                      const displayMessage = processMessage(generatedMessage);
                      
                      return (
                        <div className="relative">
                          {/* In single-preview mode we show a read-only preview so we never overwrite the template */} 
                          <textarea
                            value={isSinglePreviewMode ? displayMessage : generatedMessage}
                            readOnly={isSinglePreviewMode}
                            onChange={(e) => {
                              if (isSinglePreviewMode) return;
                              setGeneratedMessage(e.target.value);
                            }}
                            placeholder="Generate a message or type your custom invitation message here..."
                            rows={12}
                            className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                          />
                          {isSinglePreviewMode && previewInvestor && (
                            <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                              Previewing for <span className="font-semibold">{previewInvestor.investorName || 'selected recipient'}</span>. Deselect to edit the template.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      Sending from: norelyn.golingan@eirl.ink
                    </p>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
                  <button
                    onClick={handleGenerateMessage}
                    disabled={isGeneratingMessage || isSelectionMode}
                    className="px-4 py-2.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  >
                    {isGeneratingMessage ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        GENERATE MESSAGE
                      </>
                    )}
                  </button>
                  {!isSelectionMode ? (
                    <button
                      onClick={handleSendToClick}
                      disabled={!generatedSubject.trim() || !generatedMessage.trim() || investorForms.filter(f => f.email && f.email.trim() && !sentEmailsTo.has(f.id)).length === 0}
                      className="px-4 py-2.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send To ({investorForms.filter(f => f.email && f.email.trim() && !sentEmailsTo.has(f.id)).length})
                    </button>
                  ) : (
                    <button
                      onClick={handleSendInvitations}
                      disabled={isSendingEmails || selectedInvestorsForEmail.size === 0 || !generatedSubject.trim() || !generatedMessage.trim()}
                      className="px-4 py-2.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      {isSendingEmails ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Send Invitation
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'CONFIRMATION' && (
            <div className="w-full max-w-4xl mx-auto py-12">
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                  Summary
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Review the summary before confirming and processing
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* Existing Investors */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mb-1">
                    {pendingInvestors.filter(p => p.isExisting).length}
                  </div>
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
                    Existing Investors to Update
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    Will have Ownership %, Holdings, and Stake % updated
                  </div>
                </div>

                {/* New Investors with Email Sent */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-2xl font-black text-green-700 dark:text-green-400">
                      {pendingInvestors.filter(p => !p.isExisting && p.hasEmail && p.emailSent).length}
                    </div>
                    <svg className="w-5 h-5 text-green-700 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
                    New Investors - Invitations Sent
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-300">
                    Have been sent invitation emails successfully
                  </div>
                </div>

                {/* New Investors without Email */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mb-1">
                    {pendingInvestors.filter(p => !p.isExisting && !p.hasEmail).length}
                  </div>
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                    New Investors - No Email
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    Will be saved to shareholders registry only
                  </div>
                </div>
              </div>

              {/* Success/Error Messages */}
              {saveSuccessCount > 0 && !isConfirmProcessing && (
                <div className="mt-8 text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                    {saveSuccessCount > 1 
                      ? `${saveSuccessCount} Investors Processed Successfully`
                      : 'Investor Processed Successfully'}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center max-w-md mx-auto">
                    All investors have been saved to the system and are now visible in dashboards and registries.
                  </p>
                </div>
              )}

              {saveErrors.length > 0 && (
                <div className="w-full max-w-md mx-auto mt-8">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-red-900 dark:text-red-300 mb-2">
                      {saveErrors.length} Error{saveErrors.length > 1 ? 's' : ''} Occurred
                    </h4>
                    <div className="space-y-2">
                      {saveErrors.map((error, index) => (
                        <div key={index} className="text-xs text-red-700 dark:text-red-400">
                          <span className="font-medium">{error.investorName}</span>
                          {error.holdingId && <span className="text-red-600 dark:text-red-500"> ({error.holdingId.length > 6 ? error.holdingId.slice(-6) : error.holdingId})</span>}
                          : {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing Progress Overlay */}
          {isConfirmProcessing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
                <div className="text-center mb-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                    Processing Investors
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    {confirmProcessingProgress.message}
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mb-4">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${confirmProcessingProgress.percentage}%` }}
                    ></div>
                  </div>
                  
                  {/* Progress Details */}
                  {confirmProcessingProgress.totalItems > 0 && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {confirmProcessingProgress.currentItem} of {confirmProcessingProgress.totalItems} {confirmProcessingProgress.currentStep === 'updating-existing' ? 'investors updated' : confirmProcessingProgress.currentStep === 'saving-new' ? 'investors saved' : confirmProcessingProgress.currentStep === 'updating-emails' ? 'email statuses updated' : 'items processed'}
                    </p>
                  )}
                  
                  {/* Step Indicators */}
                  <div className="mt-6 flex items-center justify-center gap-2">
                    {['updating-existing', 'saving-new', 'updating-emails', 'finalizing'].map((step, index) => {
                      const stepStatus = 
                        confirmProcessingProgress.status === step ? 'current' :
                        ['updating-existing', 'saving-new', 'updating-emails', 'finalizing'].indexOf(confirmProcessingProgress.status) > index ? 'completed' : 'pending';
                      
                      return (
                        <div key={step} className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            stepStatus === 'completed' ? 'bg-green-500' :
                            stepStatus === 'current' ? 'bg-purple-600' :
                            'bg-neutral-300 dark:bg-neutral-600'
                          }`}>
                            {stepStatus === 'completed' ? (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : stepStatus === 'current' ? (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-neutral-400"></div>
                            )}
                          </div>
                          {index < 3 && (
                            <div className={`w-8 h-0.5 ${
                              stepStatus === 'completed' ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'
                            }`}></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {currentStep !== 'CONFIRMATION' && currentStep !== 'SELECTION' && (
          <div className="px-8 py-6 flex items-center justify-end">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevious}
                disabled={isProcessingStep}
                className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                  isProcessingStep
                    ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                    : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              {currentStep === 'SEND_INVITATION' ? (
                <button
                  onClick={handleNext}
                  disabled={isProcessingStep || isSaving}
                  className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                    isProcessingStep || isSaving
                      ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
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
                  ) : (
                    <>
                      Next
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={isProcessingStep || isSaving || isNavigatingToReview}
                  className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 relative overflow-hidden ${
                    isProcessingStep || isSaving || isNavigatingToReview
                      ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-500'
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
                  ) : currentStep === 'PROCESSING' && parseSuccess ? (
                    <>
                      {isNavigatingToReview ? (
                        <>
                          <div className="absolute inset-0 bg-purple-600 rounded-lg overflow-hidden">
                            <div 
                              className="h-full bg-purple-700 transition-all duration-300 ease-out"
                              style={{ width: `${navigationProgress}%` }}
                            ></div>
                          </div>
                          <span className="relative z-10 flex items-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Proceeding to Review...
                          </span>
                        </>
                      ) : (
                        <>
                          Continue to Review
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </>
                      )}
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
          <div className="px-8 py-6 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <button
              onClick={() => setShowBackFromSummaryWarning(true)}
              disabled={isConfirmProcessing}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                isConfirmProcessing
                  ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                  : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <button
              onClick={handleConfirmAndProcess}
              disabled={isConfirmProcessing || pendingInvestors.length === 0}
              className="px-8 py-3 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isConfirmProcessing ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm and Process
                </>
              )}
            </button>
          </div>
        )}
        </div>
      )}

      {/* Exit Confirmation Dialog - removed for page component */}

      {/* Warning modal when going back from Summary */}
      {showBackFromSummaryWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-neutral-900/20 dark:bg-black/20"
            onClick={() => setShowBackFromSummaryWarning(false)}
          />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full mx-4 z-50">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Go back to previous step?</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                If you go back and make changes to investor data, email selections, or any other information, the summary results will be recalculated.
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500">
                This may affect the counts of existing investors, new investors with emails, and new investors without emails shown in the summary.
              </p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setShowBackFromSummaryWarning(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowBackFromSummaryWarning(false);
                  handlePrevious();
                }}
                className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save & Exit confirmation (when some investors with emails are still unsent) */}
      {showSaveQuitConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-neutral-900/20 dark:bg-black/20"
            onClick={() => {
              setShowSaveQuitConfirm(false);
              setSaveQuitPendingRemaining(0);
            }}
          />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full mx-4 z-50">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Save &amp; Exit now?</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                You still have <span className="font-bold">{saveQuitPendingRemaining}</span> investor{saveQuitPendingRemaining !== 1 ? 's' : ''} with an email address who haven&apos;t received an invitation yet.
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500">
                If you save and exit now, those investors will stay unsent. Please double-check before continuing.
              </p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => {
                  setShowSaveQuitConfirm(false);
                  setSaveQuitPendingRemaining(0);
                }}
                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                Go back
              </button>
              <button
                onClick={async () => {
                  setShowSaveQuitConfirm(false);
                  try {
                    await handleSubmit();
                  } finally {
                    setSaveQuitPendingRemaining(0);
                  }
                }}
                className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Save &amp; Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast 
        message={toastMessage}
        isVisible={showToast}
        onClose={() => {
          setShowToast(false);
          if (toastHideTimeoutRef.current) {
            clearTimeout(toastHideTimeoutRef.current);
          }
        }}
        duration={5000}
        variant={toastVariant}
      />
    </div>
  );
};

export default InvestorProcessing;

