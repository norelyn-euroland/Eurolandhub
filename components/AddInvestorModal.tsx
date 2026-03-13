'use client';

import React, { useState, useRef, useEffect } from 'react';
import { parseDocument } from '../lib/document-parser';
import { extractInvestors, ExtractedInvestor } from '../lib/investor-extractor';
import { classifyInvestors } from '../lib/investor-classifier';
import { saveInvestors, SaveInvestorError } from '../lib/investor-service';
import { officialShareholderService, applicantService } from '../lib/firestore-service';
import Toast from './Toast';
import InfoTooltip from './InfoTooltip';
import {
  isValidRegistrationId,
  normalizeRegistrationId,
  hasInvalidEmail,
  hasInvalidPhone,
  getPhoneDisplayPrefix,
  formatPhoneForDisplay,
} from '../lib/investor-validation';

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
  classification?: 'new' | 'existing' | 'suspected';
  existingId?: string;
  suspectedReason?: string;
  suspectedSimilarTo?: string;
  suspectedExistingId?: string;
}

type Step = 'SELECTION' | 'UPLOAD' | 'PROCESSING' | 'VALIDATION_CLASSIFICATION' | 'REVIEW' | 'SEND_INVITATION' | 'CONFIRMATION';
type UploadType = 'batch' | 'individual' | null;

interface AddInvestorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<InvestorFormData, 'id'>) => void;
  sidebarCollapsed?: boolean;
}

/** Expandable row fields for Review & Confirm — strict validation for Registration ID, Email, Phone */
const ReviewRowFields: React.FC<{
  form: InvestorFormData;
  onFieldChange: (id: string, field: keyof InvestorFormData, value: string) => void;
  onHoldingIdChange: (id: string, value: string) => void;
}> = ({ form, onFieldChange, onHoldingIdChange }) => {
  const normalizedRegId = normalizeRegistrationId(form.holdingId || '');
  const regIdValid = isValidRegistrationId(normalizedRegId);
  const regIdTouched = normalizedRegId.length > 0;
  const regIdInvalid = regIdTouched && !regIdValid;
  const emailInvalid = hasInvalidEmail(form.email);
  const emailTouched = (form.email || '').trim().length > 0;
  const emailInvalidShow = emailTouched && emailInvalid;
  const phoneInvalid = hasInvalidPhone(form.phone);
  const phoneTouched = (form.phone || '').trim().length > 0;
  const phoneInvalidShow = phoneTouched && phoneInvalid;
  const phonePrefix = getPhoneDisplayPrefix(form.country);

  return (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
    <div>
      <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">Name</label>
      <input type="text" value={form.investorName} onChange={(e) => onFieldChange(form.id, 'investorName', e.target.value)} className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900" />
    </div>
    <div className={regIdInvalid ? 'rounded-lg p-2 -m-2 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-500' : ''}>
      <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">Registration ID <span className="text-neutral-400">(6 digits only)</span></label>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={form.holdingId}
        onChange={(e) => onHoldingIdChange(form.id, e.target.value)}
        placeholder="e.g. 130965"
        className={`w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900 ${regIdInvalid ? 'border-red-500 ring-red-500' : ''}`}
      />
      {regIdInvalid && (
        <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">Exactly 6 digits required (last 6 of registration)</p>
      )}
    </div>
    <div className={emailInvalidShow ? 'rounded-lg p-2 -m-2 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-500' : ''}>
      <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">Email</label>
      <input
        type="email"
        value={form.email}
        onChange={(e) => onFieldChange(form.id, 'email', e.target.value)}
        placeholder="name@example.com"
        maxLength={254}
        className={`w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900 ${emailInvalidShow ? 'border-red-500 ring-red-500' : ''}`}
      />
      {emailInvalidShow && (
        <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">Enter a valid email with @ and domain</p>
      )}
    </div>
    <div className={phoneInvalidShow ? 'rounded-lg p-2 -m-2 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-500' : ''}>
      <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">Phone</label>
      <div className={`flex overflow-hidden rounded border bg-white dark:bg-neutral-900 ${phoneInvalidShow ? 'border-red-500' : ''}`}>
        {phonePrefix ? (
          <span className="px-2 py-2 bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-400 flex items-center shrink-0">
            {phonePrefix}
          </span>
        ) : (
          <span className="px-2 py-2 bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-400 flex items-center shrink-0">+?</span>
        )}
        <input
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => onFieldChange(form.id, 'phone', e.target.value)}
          placeholder="912 345 6789"
          className="flex-1 min-w-0 px-3 py-2 bg-transparent border-0 focus:ring-0 focus:outline-none"
        />
      </div>
      {phoneInvalidShow && (
        <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">Phone should contain only numbers, + or spaces</p>
      )}
    </div>
    <div>
      <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">Country</label>
      <input type="text" value={form.country} onChange={(e) => onFieldChange(form.id, 'country', e.target.value)} className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900" />
    </div>
    <div className="col-span-2">
      <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">Address</label>
      <input type="text" value={form.coAddress} onChange={(e) => onFieldChange(form.id, 'coAddress', e.target.value)} className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900" />
    </div>
    <div>
      <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">Holdings</label>
      <input type="text" inputMode="numeric" value={form.holdings} onChange={(e) => onFieldChange(form.id, 'holdings', e.target.value)} className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900" />
    </div>
    <div>
      <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">Account Type</label>
      <select value={form.accountType} onChange={(e) => onFieldChange(form.id, 'accountType', e.target.value)} className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900">
        <option value="">Select</option>
        <option value="INDIVIDUAL">Individual</option>
        <option value="JOINT">Joint</option>
        <option value="TRUST">Trust</option>
        <option value="CORPORATE">Corporate</option>
        <option value="ORDINARY">Ordinary</option>
        <option value="NOMINEE">Nominee</option>
      </select>
    </div>
  </div>
  );
};

const AddInvestorModal: React.FC<AddInvestorModalProps> = ({ isOpen, onClose, onSave, sidebarCollapsed = false }) => {
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
  const [parsedCSV, setParsedCSV] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');
  const [parseSuccess, setParseSuccess] = useState(false);
  const [investorForms, setInvestorForms] = useState<InvestorFormData[]>([]);
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());
  const [editableForms, setEditableForms] = useState<Set<string>>(new Set()); // Track which forms are in edit mode
  const [extractedInvestors, setExtractedInvestors] = useState<ExtractedInvestor[]>([]);
  const [currentInvestorIndex, setCurrentInvestorIndex] = useState<number>(0);
  const [extractionError, setExtractionError] = useState<string>('');
  const [investorsAdded, setInvestorsAdded] = useState<boolean>(false); // Track if "Add All" has been clicked (batch) or forms populated (individual)
  const [classificationResult, setClassificationResult] = useState<{ newCount: number; existingCount: number; suspectedCount: number }>({ newCount: 0, existingCount: 0, suspectedCount: 0 });
  const [registrationIdErrors, setRegistrationIdErrors] = useState<Map<string, { hasInvalidChars: boolean; isIncomplete: boolean }>>(new Map()); // Track registration ID validation errors per form
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState<SaveInvestorError[]>([]);
  const [saveSuccessCount, setSaveSuccessCount] = useState<number>(0);
  const [selectedInvestorsForEmail, setSelectedInvestorsForEmail] = useState<Set<string>>(new Set()); // Multiple selection
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false); // Track if in "Send To" selection mode
  const [sentEmailsTo, setSentEmailsTo] = useState<Set<string>>(new Set());
  const [sentEmailContent, setSentEmailContent] = useState<Map<string, { subject: string; message: string; sentAt: string }>>(new Map()); // Store email content for preview
  const [previewEmailInvestorId, setPreviewEmailInvestorId] = useState<string | null>(null); // Track which investor's email to preview
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [generatedSubject, setGeneratedSubject] = useState<string>('');
  const [generatedMessage, setGeneratedMessage] = useState<string>('');
  const [messageStyle, setMessageStyle] = useState<string>('default');
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState<boolean>(false);
  const [privacyCheckboxChecked, setPrivacyCheckboxChecked] = useState<boolean>(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState<boolean>(false);
  const [isMessageExpanded, setIsMessageExpanded] = useState<boolean>(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState<'success' | 'warning' | 'error' | 'info'>('success');
  const toastHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isGeneratingRef = useRef<boolean>(false);
  const lastGeneratedStyleRef = useRef<string | null>(null);
  const [recipientPage, setRecipientPage] = useState(0); // Track which page of recipients we're viewing
  const [emailRecipientTab, setEmailRecipientTab] = useState<'with-email' | 'no-email' | 'existing'>('with-email');
  const [isFinalExecuting, setIsFinalExecuting] = useState(false);
  const [finalExecutionStatus, setFinalExecutionStatus] = useState<string>('');
  const [isVerifyingSuspected, setIsVerifyingSuspected] = useState(false);
  const [expandedReviewRowId, setExpandedReviewRowId] = useState<string | null>(null);
  const [showPotentialMatchesConfirm, setShowPotentialMatchesConfirm] = useState(false);
  const [showEmailReminderModal, setShowEmailReminderModal] = useState(false);
  const [isNavigatingToReview, setIsNavigatingToReview] = useState(false); // Track if navigating to REVIEW with loading

  const DRAFT_KEY = 'addInvestorModal_draft';
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

  // Note: Removed contentEditable sync effect since we're now using textarea with processed placeholders

  // Reset modal when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('SELECTION');
      setUploadType(null);
      setUploadedFile(null);
      setIsProcessing(false);
      setIsAutofilling(false);
      setProcessingSuccessAt(null);
      setProcessingProgress(0);
      setAutofillProgress(null);
      setAutofillActiveFormId(null);
      setAutofillActiveField(null);
      autofillRunIdRef.current += 1; // cancel any in-flight autofill
      setIsSaving(false);
      setSaveErrors([]);
      setSaveSuccessCount(0);
      setShowExitConfirm(false);
      setShowSaveQuitConfirm(false);
      setSaveQuitPendingRemaining(0);
      setParsedCSV('');
      setParseError('');
      setParseSuccess(false);
      setInvestorForms([]);
      setExpandedForms(new Set());
      setEditableForms(new Set()); // Reset editable forms
      setExtractedInvestors([]);
      setCurrentInvestorIndex(0);
      setExtractionError('');
      setInvestorsAdded(false); // Reset investors added flag
      setClassificationResult({ newCount: 0, existingCount: 0, suspectedCount: 0 });
      setRegistrationIdErrors(new Map()); // Clear registration ID errors
      setSelectedInvestorsForEmail(new Set());
      setIsSelectionMode(false);
      setSentEmailsTo(new Set());
      setIsGeneratingMessage(false);
      setIsSendingEmails(false);
      setGeneratedSubject('');
      setGeneratedMessage('');
      setMessageStyle('default');
      setPrivacyNoticeAccepted(false);
      setPrivacyCheckboxChecked(false);
      setShowPrivacyDetails(false);
      setIsMessageExpanded(true);
      setShowToast(false); // Reset toast state
      setToastMessage(''); // Reset toast message
      setToastVariant('success');
      if (toastHideTimeoutRef.current) {
        clearTimeout(toastHideTimeoutRef.current);
        toastHideTimeoutRef.current = null;
      }
      setRecipientPage(0); // Reset recipient page
      setEmailRecipientTab('with-email'); // Reset email recipient tab
      setIsFinalExecuting(false);
      setFinalExecutionStatus('');
      setIsVerifyingSuspected(false);
      setShowPotentialMatchesConfirm(false);
      setShowEmailReminderModal(false);
      setExpandedReviewRowId(null);
      setIsNavigatingToReview(false); // Reset navigation loading state
      setNavigationProgress(0); // Reset navigation progress
    }
  }, [isOpen]);

  // Auto-populate suspectedExistingId from similarTo when missing (avoids "No match ID available")
  useEffect(() => {
    if (!isOpen || investorForms.length === 0) return;
    const needsUpdate = investorForms.some(
      f => f.classification === 'suspected' && !f.suspectedExistingId && f.suspectedSimilarTo
    );
    if (!needsUpdate) return;
    const match = /\(ID:\s*([^)]+)\)/;
    setInvestorForms(prev => prev.map(f => {
      if (f.classification !== 'suspected' || f.suspectedExistingId) return f;
      const m = (f.suspectedSimilarTo || '').match(match);
      if (m) return { ...f, suspectedExistingId: m[1].trim() };
      return f;
    }));
  }, [isOpen, investorForms]);

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
      // For individual, create a single empty form (default classification: new) and go straight to REVIEW
      const newForm: InvestorFormData = { ...createNewInvestorForm(), classification: 'new' };
      setInvestorForms([newForm]);
      setExpandedForms(new Set([newForm.id]));
      setClassificationResult({ newCount: 1, existingCount: 0, suspectedCount: 0 });
      setCurrentStep('REVIEW');
    } else {
      // For batch, go to UPLOAD step
      setCurrentStep('UPLOAD');
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
    
    // When going back from REVIEW (batch), go to VALIDATION_CLASSIFICATION
    if (currentStep === 'REVIEW' && uploadType === 'batch') {
      setCurrentStep('VALIDATION_CLASSIFICATION');
      return;
    }
    // When going back from VALIDATION_CLASSIFICATION, go to PROCESSING
    if (currentStep === 'VALIDATION_CLASSIFICATION' && uploadType === 'batch') {
      setCurrentStep('PROCESSING');
      return;
    }
    
    const stepOrder: Step[] = uploadType === 'batch' 
      ? ['SELECTION', 'UPLOAD', 'PROCESSING', 'VALIDATION_CLASSIFICATION', 'REVIEW', 'SEND_INVITATION', 'CONFIRMATION']
      : ['SELECTION', 'REVIEW', 'SEND_INVITATION', 'CONFIRMATION'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleNext = async () => {
    if (isProcessingStep || isSaving) return;
    
    if (currentStep === 'SELECTION') {
      // Should not happen - selection is handled by handleSelectUploadType
      return;
    }
    
    const stepOrder: Step[] = uploadType === 'batch'
      ? ['SELECTION', 'UPLOAD', 'PROCESSING', 'VALIDATION_CLASSIFICATION', 'REVIEW', 'SEND_INVITATION', 'CONFIRMATION']
      : ['SELECTION', 'REVIEW', 'SEND_INVITATION', 'CONFIRMATION'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      // If on UPLOAD and file is uploaded, allow manual navigation to PROCESSING
      if (currentStep === 'UPLOAD' && uploadedFile) {
        setCurrentStep('PROCESSING');
        return;
      }
      // PROCESSING auto-navigates to VALIDATION_CLASSIFICATION on completion (no manual Next)
      // VALIDATION_CLASSIFICATION -> REVIEW (batch only) — show confirm if potential matches
      if (currentStep === 'VALIDATION_CLASSIFICATION' && uploadType === 'batch') {
        if (classificationResult.suspectedCount > 0) {
          setShowPotentialMatchesConfirm(true);
          return;
        }
        setCurrentStep('REVIEW');
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

        // Validate Registration ID: exactly 6 digits only
        // Normalize the value first (extract digits, limit to 6) before validation
        const formsWithInvalidIds = investorForms.filter(form => {
          const normalizedId = normalizeRegistrationId(form.holdingId || '');
          return normalizedId.length > 0 && !isValidRegistrationId(normalizedId);
        });
        if (formsWithInvalidIds.length > 0) {
          formsWithInvalidIds.forEach(form => {
            setRegistrationIdErrors(prev => {
              const newMap = new Map(prev);
              const holdingId = normalizeRegistrationId(form.holdingId || '');
              newMap.set(form.id, {
                hasInvalidChars: /[^0-9]/.test(form.holdingId || ''),
                isIncomplete: holdingId.length === 0 || holdingId.length < 6
              });
              return newMap;
            });
          });
          triggerToast('Registration ID must be exactly 6 digits (last 6 of registration). Please correct and try again.', 'warning');
          return;
        }

        // Validate Email: if provided, must be valid format (contains @ and domain)
        const formsWithInvalidEmail = investorForms.filter(form => hasInvalidEmail(form.email || ''));
        if (formsWithInvalidEmail.length > 0) {
          triggerToast(`${formsWithInvalidEmail.length} investor(s) have invalid email. Enter a valid email with @ and domain.`, 'warning');
          return;
        }
        
        // For individual flow, run classification before proceeding
        if (uploadType === 'individual' && investorForms.length === 1) {
          const form = investorForms[0];
          const holdingId = (form.holdingId || '').trim();
          if (holdingId) {
            const extracted: ExtractedInvestor = {
              investorName: form.investorName || '',
              holdingId,
              email: form.email || '',
              phone: form.phone || '',
              ownershipPercent: form.ownershipPercent || '',
              country: form.country || '',
              coAddress: form.coAddress || '',
              accountType: form.accountType || '',
              holdings: form.holdings || '',
              stake: form.stake || '',
            };
            const classified = await classifyInvestors([extracted]);
            setClassificationResult({
              newCount: classified.new.length,
              existingCount: classified.existing.length,
              suspectedCount: classified.suspected.length,
            });
            const newClass = classified.existing.length > 0 ? 'existing' : classified.suspected.length > 0 ? 'suspected' : 'new';
            const sus = classified.suspected[0];
            setInvestorForms(prev =>
              prev.map(f =>
                f.id === form.id
                  ? {
                      ...f,
                      classification: newClass,
                      existingId: classified.existing[0]?.existingId,
                      suspectedReason: sus?.reason,
                      suspectedSimilarTo: sus?.similarTo,
                      suspectedExistingId: sus?.existingId,
                    }
                  : f
              )
            );
          }
        }

        // Move to SEND_INVITATION step
        setCurrentStep('SEND_INVITATION');
        return;
      }
      if (currentStep === 'SEND_INVITATION') {
        const newWithEmail = investorForms.filter(
          f => (f.classification === 'new' || f.classification === 'suspected') && f.email && f.email.trim()
        );
        const unsentCount = newWithEmail.filter(f => !sentEmailsTo.has(f.id)).length;
        if (unsentCount > 0) {
          setShowEmailReminderModal(true);
          return;
        }
        setCurrentStep('CONFIRMATION');
        return;
      }
      // Allow navigation to all steps for preview
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  // Handle exit confirmation — X button always shows confirm modal
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

  const handleSaveAsDraft = () => {
    try {
      const draft = {
        currentStep,
        uploadType,
        investorForms,
        classificationResult,
        parsedCSV,
        extractedInvestors: extractedInvestors.slice(0, 500),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setShowExitConfirm(false);
      triggerToast('Draft saved. You can resume later.', 'success');
      onClose();
    } catch (e) {
      triggerToast('Could not save draft.', 'error');
    }
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

    const startTime = Date.now();
    const MIN_LOADING_DURATION = 10000; // 10 seconds minimum

    // Update progress bar smoothly
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(95, (elapsed / MIN_LOADING_DURATION) * 100); // Cap at 95% until processing completes
      setProcessingProgress(progress);
    }, 50); // Update every 50ms for smooth animation

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

      // Classify investors (New, Existing, Suspected) by holdingId and similarity
      const classified = await classifyInvestors(extractionResult.investors);
      setClassificationResult({
        newCount: classified.new.length,
        existingCount: classified.existing.length,
        suspectedCount: classified.suspected.length,
      });

      // Ensure minimum loading duration so loader is visible
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_LOADING_DURATION) {
        await sleep(MIN_LOADING_DURATION - elapsed);
      }

      // Complete the progress bar to 100%
      setProcessingProgress(100);
      await sleep(200); // Brief pause to show 100%

      clearInterval(loadingMessageInterval);
      clearInterval(progressInterval);

      // Store extracted investors
      setExtractedInvestors(extractionResult.investors);
      setCurrentInvestorIndex(0);
      setProcessingSuccessAt(Date.now());

      // Populate forms from classified result (with classification per row)
      const allClassified = [
        ...classified.new.map(inv => ({ investor: inv, classification: 'new' as const, existingId: undefined, suspectedReason: undefined, suspectedSimilarTo: undefined, suspectedExistingId: undefined })),
        ...classified.existing.map(({ investor, existingId }) => ({ investor, classification: 'existing' as const, existingId, suspectedReason: undefined, suspectedSimilarTo: undefined, suspectedExistingId: undefined })),
        ...classified.suspected.map(({ investor, similarTo, reason, existingId: sid }) => ({ investor, classification: 'suspected' as const, existingId: undefined, suspectedReason: reason, suspectedSimilarTo: similarTo, suspectedExistingId: sid })),
      ];
      const newForms: InvestorFormData[] = allClassified.map(({ investor, classification, existingId, suspectedReason, suspectedSimilarTo, suspectedExistingId }) => {
        const form = createNewInvestorForm();
        const filteredHoldingId = (investor.holdingId || '').replace(/\D/g, '').slice(0, 6);
        const displayHoldingId = (classification === 'existing' && existingId)
          ? (existingId || '').replace(/\D/g, '').slice(-6)
          : filteredHoldingId;
        return {
          ...form,
          investorName: investor.investorName || '',
          holdingId: displayHoldingId,
          email: investor.email || '',
          phone: investor.phone || '',
          ownershipPercent: investor.ownershipPercent || '',
          country: investor.country || '',
          coAddress: investor.coAddress || '',
          accountType: (() => {
            const accountType = (investor.accountType || '').trim();
            if (!accountType) return '';
            const upperType = accountType.toUpperCase();
            const typeMap: { [key: string]: string } = {
              INDIVIDUAL: 'INDIVIDUAL', JOINT: 'JOINT', TRUST: 'TRUST',
              CORPORATE: 'CORPORATE', ORDINARY: 'ORDINARY', NOMINEE: 'NOMINEE',
            };
            return typeMap[upperType] || accountType;
          })(),
          holdings: investor.holdings || '',
          stake: investor.stake || '',
          classification,
          existingId,
          suspectedReason,
          suspectedSimilarTo,
          suspectedExistingId,
        };
      });
      setInvestorForms(newForms);
      setExpandedForms(new Set(newForms.map(f => f.id)));
      setInvestorsAdded(true);

      setIsProcessing(false);
      setParseSuccess(true);

      // Auto-navigate to Validation & Classification (no success preview)
      setCurrentStep('VALIDATION_CLASSIFICATION');
      
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
    const newForm: InvestorFormData = { ...createNewInvestorForm(), classification: 'new' };
    setInvestorForms(prev => [...prev, newForm]);
    setExpandedForms(prev => new Set([...prev, newForm.id]));
    setClassificationResult(prev => ({ ...prev, newCount: prev.newCount + 1 }));
  };

  // Remove an investor form
  const handleRemoveInvestor = (id: string) => {
    const removed = investorForms.find(f => f.id === id);
    setInvestorForms(prev => prev.filter(form => form.id !== id));
    setExpandedForms(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setSelectedInvestorsForEmail(prev => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    if (removed?.classification) {
      setClassificationResult(prev => ({
        ...prev,
        newCount: Math.max(0, prev.newCount - (removed.classification === 'new' ? 1 : 0)),
        existingCount: Math.max(0, prev.existingCount - (removed.classification === 'existing' ? 1 : 0)),
        suspectedCount: Math.max(0, prev.suspectedCount - (removed.classification === 'suspected' ? 1 : 0)),
      }));
    }
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

  // "Confirm match" — use existing record's name & ID, keep other data
  const handleConfirmRightInvestor = async (formId: string) => {
    const form = investorForms.find(f => f.id === formId);
    if (!form || form.classification !== 'suspected') return;
    let rawId = (form.suspectedExistingId || '').trim();
    if (!rawId && form.suspectedSimilarTo) {
      const match = form.suspectedSimilarTo.match(/\(ID:\s*([^)]+)\)/);
      if (match) rawId = match[1].trim();
    }
    const normId = rawId.replace(/\D/g, '').slice(-6);
    if (!normId) {
      triggerToast('No match ID available. Try editing and saving manually.', 'warning');
      return;
    }
    setIsVerifyingSuspected(true);
    try {
      let correctName = '';
      let correctId = normId;
      // Try official shareholder by exact id, then normalized
      let officialShareholder = await officialShareholderService.getById(rawId);
      if (!officialShareholder && normId) officialShareholder = await officialShareholderService.getById(normId);
      if (officialShareholder) {
        correctName = officialShareholder.name || '';
        correctId = officialShareholder.id;
      } else {
        // Try applicant by registrationId
        let applicant = await applicantService.getByRegistrationId(rawId);
        if (!applicant && normId) applicant = await applicantService.getByRegistrationId(normId);
        if (applicant) {
          correctName = applicant.fullName || '';
          correctId = applicant.registrationId || normId;
        }
      }
      if (!correctName) {
        triggerToast('Could not load existing investor details.', 'error');
        return;
      }
      setInvestorForms(prev => prev.map(f =>
        f.id === formId
          ? {
              ...f,
              investorName: correctName,
              holdingId: correctId.replace(/\D/g, '').slice(-6),
              classification: 'existing' as const,
              existingId: correctId,
              suspectedReason: undefined,
              suspectedSimilarTo: undefined,
              suspectedExistingId: undefined,
            }
          : f
      ));
      setClassificationResult(prev => ({
        ...prev,
        existingCount: prev.existingCount + 1,
        suspectedCount: prev.suspectedCount - 1,
      }));
      setExpandedReviewRowId(null);
      triggerToast('Updated name and Registration ID. Other data will be used for the update.', 'success');
    } catch (e: any) {
      triggerToast(`Failed: ${e?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsVerifyingSuspected(false);
    }
  };

  // Verify suspected investor: re-run classification and move to New or Existing
  const handleVerifySuspected = async (formId: string) => {
    const form = investorForms.find(f => f.id === formId);
    if (!form || form.classification !== 'suspected') return;
    const holdingId = (form.holdingId || '').trim();
    if (holdingId.length !== 6 || !/^\d{6}$/.test(holdingId)) {
      triggerToast('Registration ID must be exactly 6 digits before verifying.', 'warning');
      return;
    }
    setIsVerifyingSuspected(true);
    try {
      const extracted: ExtractedInvestor = {
        investorName: form.investorName || '',
        holdingId,
        email: form.email || '',
        phone: form.phone || '',
        ownershipPercent: form.ownershipPercent || '',
        country: form.country || '',
        coAddress: form.coAddress || '',
        accountType: form.accountType || '',
        holdings: form.holdings || '',
        stake: form.stake || '',
      };
      const classified = await classifyInvestors([extracted]);
      const newClass = classified.existing.length > 0 ? 'existing' : 'new';
      const existingId = classified.existing[0]?.existingId;
      setInvestorForms(prev => prev.map(f =>
        f.id === formId
          ? { ...f, classification: newClass, existingId, suspectedReason: undefined, suspectedSimilarTo: undefined }
          : f
      ));
      setClassificationResult(prev => ({
        newCount: prev.newCount + (newClass === 'new' ? 1 : 0),
        existingCount: prev.existingCount + (newClass === 'existing' ? 1 : 0),
        suspectedCount: prev.suspectedCount - 1,
      }));
      triggerToast(newClass === 'existing' ? 'Confirmed as existing investor.' : 'Confirmed as new investor.', 'success');
    } catch (e: any) {
      triggerToast(`Verification failed: ${e?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsVerifyingSuspected(false);
    }
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
  const handleAddAllInvestors = () => {
    // Ensure autofill state is false
    setIsAutofilling(false);
    setAutofillProgress(null);
    setAutofillActiveFormId(null);
    setAutofillActiveField(null);
    
    setInvestorsAdded(true); // Mark that investors have been added
    
    // Move to REVIEW step
    if (uploadType === 'batch') {
      setCurrentStep('REVIEW');
    }

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

  // Handle generating invitation message - only generates when user clicks the button
  const handleGenerateMessage = async () => {
    // Prevent multiple simultaneous generations
    if (isGeneratingRef.current || !messageStyle) {
      return;
    }

    // Check if we're on the correct step
    if (currentStep !== 'SEND_INVITATION') {
      triggerToast('Please navigate to the Send Invitation step first.', 'warning');
      return;
    }
    
    isGeneratingRef.current = true;
    setIsGeneratingMessage(true);
    lastGeneratedStyleRef.current = messageStyle; // Update ref to prevent auto-regeneration
    
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
        if (data.warning) {
          triggerToast(data.warning, 'warning');
        } else {
          triggerToast('Message generated successfully!', 'success');
        }
      } else {
        triggerToast(`Failed to generate message: ${data?.error || response.status || 'Unknown error'}`, 'error');
      }
    } catch (error: any) {
      triggerToast(`Error: ${error.message || 'Failed to generate message'}`, 'error');
    } finally {
      isGeneratingRef.current = false;
      setIsGeneratingMessage(false);
    }
  };

  // Reset generation refs when leaving SEND_INVITATION step
  useEffect(() => {
    if (currentStep !== 'SEND_INVITATION') {
      isGeneratingRef.current = false;
      lastGeneratedStyleRef.current = null;
    }
  }, [currentStep]);

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

  // Handle select all recipients (With Email tab - selection only, no send)
  // Only select investors who haven't received emails yet
  const handleSelectAll = () => {
    const newInvestorsWithEmail = investorForms.filter(
      f => (f.classification === 'new' || f.classification === 'suspected') && 
           f.email && f.email.trim() && 
           !sentEmailsTo.has(f.id) // Exclude already sent
    );
    setSelectedInvestorsForEmail(new Set(newInvestorsWithEmail.map(f => f.id)));
  };

  // Handle deselect all recipients
  const handleDeselectAll = () => {
    setSelectedInvestorsForEmail(new Set());
  };

  // Handle sending invitations to selected NEW investors (real-time, no delay)
  const handleSendInvitations = async () => {
    const investorsToSend = investorForms.filter(f =>
      (f.classification === 'new' || f.classification === 'suspected') &&
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
      
      // Mark successfully sent investors and store email content for preview
      const sentIds = new Set(successful.map(r => r.investorId));
      setSentEmailsTo(prev => new Set([...prev, ...sentIds]));
      
      // Store email content for each successfully sent investor
      const newEmailContent = new Map(sentEmailContent);
      successful.forEach((result) => {
        const investor = investorsToSend.find(inv => inv.id === result.investorId);
        if (investor) {
          newEmailContent.set(result.investorId, {
            subject: generatedSubject,
            message: generatedMessage,
            sentAt: new Date().toISOString(),
          });
        }
      });
      setSentEmailContent(newEmailContent);
      
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

  // Final execution: add, update, send — triggered only from Summary "Confirm & Process"
  const handleConfirmAndProcess = async () => {
    const invalidForms = investorForms.filter(form => !form.investorName || !form.holdingId);
    if (invalidForms.length > 0) {
      triggerToast(`Please fill in Investor Name and Registration ID for all investors. ${invalidForms.length} form(s) incomplete.`, 'warning');
      return;
    }
    const invalidRegId = investorForms.filter(f => {
      const normalizedId = normalizeRegistrationId(f.holdingId || '');
      return normalizedId.length > 0 && !isValidRegistrationId(normalizedId);
    });
    if (invalidRegId.length > 0) {
      triggerToast('Registration ID must be exactly 6 digits for all investors. Please correct and try again.', 'warning');
      return;
    }
    const invalidEmailForms = investorForms.filter(f => hasInvalidEmail(f.email || ''));
    if (invalidEmailForms.length > 0) {
      triggerToast(`${invalidEmailForms.length} investor(s) have invalid email. Enter a valid email with @ and domain.`, 'warning');
      return;
    }
    if (investorForms.length === 0) {
      triggerToast('Please add at least one investor.', 'warning');
      return;
    }

    setIsFinalExecuting(true);
    setSaveErrors([]);
    let totalSaved = 0;
    const allErrors: SaveInvestorError[] = [];

    const toExtracted = (f: InvestorFormData): ExtractedInvestor => ({
      investorName: f.investorName,
      holdingId: f.holdingId,
      email: f.email || '',
      phone: f.phone || '',
      ownershipPercent: f.ownershipPercent || '',
      country: f.country || '',
      coAddress: f.coAddress || '',
      accountType: f.accountType || '',
      holdings: f.holdings || '',
      stake: f.stake || '',
    });

    try {
      const processInvestorsWithProgress = async (
        investors: ExtractedInvestor[],
        label: 'Adding new investors' | 'Updating existing investors'
      ) => {
        for (let i = 0; i < investors.length; i++) {
          const investor = investors[i];
          setFinalExecutionStatus(`${label}... (${i + 1}/${investors.length})`);

          // Save one investor at a time so the UI can show real progress and never look stuck.
          const result = await saveInvestors([investor]);
          totalSaved += result.success.length;
          allErrors.push(...result.errors);

          // Yield one frame so React can paint status updates between long operations.
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      };

      // Add new investors
      const newInvestors = investorForms
        .filter(f => f.classification === 'new' || f.classification === 'suspected')
        .map(toExtracted);
      if (newInvestors.length > 0) {
        await processInvestorsWithProgress(newInvestors, 'Adding new investors');
      }

      // Update existing investors
      const existingInvestors = investorForms
        .filter(f => f.classification === 'existing')
        .map(toExtracted);
      if (existingInvestors.length > 0) {
        await processInvestorsWithProgress(existingInvestors, 'Updating existing investors');
      }

      // Emails are sent in real time during Email Generation step — no batch send here
      setSaveSuccessCount(totalSaved);
      setSaveErrors(allErrors);
      setFinalExecutionStatus('Complete');

      if (onSave && totalSaved > 0) {
        const allToSave = investorForms.map(toExtracted);
        allToSave.slice(0, totalSaved).forEach(inv => {
          onSave({
            investorName: inv.investorName,
            holdingId: inv.holdingId,
            email: inv.email,
            phone: inv.phone,
            ownershipPercent: inv.ownershipPercent,
            country: inv.country,
            coAddress: inv.coAddress,
            accountType: inv.accountType,
            holdings: inv.holdings,
            stake: inv.stake,
          });
        });
      }
      if (allErrors.length === 0) {
        triggerToast('All operations completed successfully.', 'success');
      } else if (totalSaved > 0) {
        triggerToast(`Completed with ${allErrors.length} error(s). ${totalSaved} investor(s) saved successfully.`, 'warning');
      } else {
        triggerToast(`All operations failed. Please check errors and try again.`, 'error');
      }
      
      await sleep(500);
      onClose();
    } catch (error: any) {
      console.error('Final execution error:', error);
      // Ensure all pending investors are marked as errors if the entire operation failed
      const existingInvestors = investorForms.filter(f => f.classification === 'existing').map(toExtracted);
      if (existingInvestors.length > 0 && allErrors.length === 0) {
        existingInvestors.forEach(investor => {
          allErrors.push({
            investorName: investor.investorName,
            holdingId: investor.holdingId,
            error: error.message || 'Operation failed',
          });
        });
        setSaveErrors(allErrors);
      }
      triggerToast(`Error: ${error?.message || 'Unknown error occurred. Please try again.'}`, 'error');
    } finally {
      // Always clear loading state, even if there was an error
      setIsFinalExecuting(false);
      setFinalExecutionStatus('');
    }
  };

  // Steps configuration - dynamic based on upload type
  const getSteps = (): { id: Step; label: string }[] => {
    if (uploadType === 'individual') {
      return [
        { id: 'SELECTION', label: 'Selection' },
        { id: 'REVIEW', label: 'Review & Confirm' },
        { id: 'SEND_INVITATION', label: 'Email Generation' },
        { id: 'CONFIRMATION', label: 'Summary' },
      ];
    } else {
      return [
        { id: 'SELECTION', label: 'Selection' },
        { id: 'UPLOAD', label: 'Upload' },
        { id: 'PROCESSING', label: 'Processing' },
        { id: 'VALIDATION_CLASSIFICATION', label: 'Validation & Classification' },
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

  if (!isOpen) return null;

  const sidebarWidth = sidebarCollapsed ? '80px' : '256px';
  const sidebarWidthClass = sidebarCollapsed ? 'left-20' : 'left-64';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${sidebarWidthClass} transition-all duration-300`}>
      {/* Blurred background - covers only content area, not sidebar */}
      <div 
        className={`fixed top-0 right-0 bottom-0 ${sidebarWidthClass} bg-neutral-900/40 dark:bg-black/40 backdrop-blur-sm z-40 transition-all duration-300`}
      />
      
      {/* Privacy Notice Overlay - shown before modal content if not accepted */}
      {!privacyNoticeAccepted && (
        <div 
          className={`fixed inset-0 z-[60] flex items-center justify-center ${sidebarWidthClass} transition-all duration-300`}
        >
          <div 
            className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Privacy Notice Header */}
            <div className="px-8 py-6 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
                Investor Privacy & Data Use Notice
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Privacy Notice Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {/* One-line summary */}
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-6">
                We take investor data seriously. This information is used only for verification and official investor communications.
              </p>

              {/* View details link */}
              <div className="mb-4">
                <button
                  onClick={togglePrivacyDetails}
                  className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors flex items-center gap-2"
                >
                  {showPrivacyDetails ? 'Hide details' : 'View details'}
                  <svg 
                    className={`w-4 h-4 transition-transform ${showPrivacyDetails ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Expandable details section */}
              {showPrivacyDetails && (
                <div className="mt-4 p-6 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-700 animate-in fade-in slide-in-from-top-2 duration-300">
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
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal container - only show when privacy notice is accepted */}
      {privacyNoticeAccepted && (
        <div className="relative bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] mx-4 overflow-hidden flex flex-col z-50">
          {/* Header */}
          <div className="px-8 py-6 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700">
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">Add/Update Investors</h2>
            <button
              onClick={handleExitClick}
              className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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

          {currentStep === 'VALIDATION_CLASSIFICATION' && (
            <div className="w-full min-h-[560px] flex items-center justify-center">
              <div className="flex flex-col items-center justify-center w-full py-12 max-w-2xl mx-auto">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-700 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-black text-green-700 dark:text-green-400 mb-6">Verification Complete!</p>
                {classificationResult.suspectedCount > 0 && (
                  <div className="w-full mb-4 p-4 rounded-lg bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-600 flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Attention needed before proceeding</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        You have {classificationResult.suspectedCount} potential match(es) that need verification in the Review step. Please confirm each one before continuing.
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 w-full">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mb-1">{classificationResult.newCount}</div>
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400">New Investors to be Added</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mb-1">{classificationResult.existingCount}</div>
                    <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Existing Investors to be Updated</div>
                  </div>
                  <div className={`rounded-lg p-4 border-2 ${classificationResult.suspectedCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600' : 'bg-neutral-100 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700'}`}>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-black text-amber-700 dark:text-amber-400">{classificationResult.suspectedCount}</div>
                      <InfoTooltip
                        content="These investors may already exist in the system (similar name or Registration ID). Please verify each one in the Review step to avoid duplicates."
                        className="inline-flex"
                      >
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-400 dark:bg-neutral-600 text-neutral-100 cursor-help text-[10px] font-bold hover:bg-neutral-500 dark:hover:bg-neutral-500">
                          ?
                        </span>
                      </InfoTooltip>
                    </div>
                    <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-1">Potential Matches (verify in Review)</div>
                    {classificationResult.suspectedCount > 0 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-300 mt-1">Requires attention</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'REVIEW' && (
            <div className="space-y-6 relative">
              {/* Verifying overlay - blocks entire content */}
              {isVerifyingSuspected && (
                <div className="absolute inset-0 bg-white/90 dark:bg-neutral-900/90 z-50 flex flex-col items-center justify-center rounded-xl">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Verifying...</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Please wait. Do not touch anything.</p>
                </div>
              )}

              {extractionError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900 dark:text-red-300">{extractionError}</p>
                </div>
              )}

              {/* Validation indicator — data needs attention */}
              {investorForms.length > 0 && (() => {
                const invalidRegId = investorForms.filter(f => {
                  const normalizedId = normalizeRegistrationId(f.holdingId || '');
                  return normalizedId.length > 0 && !isValidRegistrationId(normalizedId);
                });
                const invalidEmail = investorForms.filter(f => hasInvalidEmail(f.email || ''));
                if (invalidRegId.length === 0 && invalidEmail.length === 0) return null;
                return (
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Please correct the following before proceeding:</p>
                      <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 list-disc list-inside">
                        {invalidRegId.length > 0 && <li>Registration ID: exactly 6 digits required ({invalidRegId.length} need correction)</li>}
                        {invalidEmail.length > 0 && <li>Email: valid format with @ and domain required ({invalidEmail.length} need correction)</li>}
                      </ul>
                    </div>
                  </div>
                );
              })()}

              {/* Add investor button */}
              <div className="flex justify-end">
                <button
                  onClick={handleAddInvestor}
                  className="px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 border border-purple-300 dark:border-purple-700 rounded-lg flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add investor
                </button>
              </div>

              {investorForms.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                  No investors to review.
                </div>
              ) : (
                <>
                  {/* 1. New Investors - Table */}
                  {investorForms.filter(f => f.classification === 'new').length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">New Investors</h3>
                      <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300">Name</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300">Registration ID</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300">Email</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300">Phone</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300 w-24">Edit</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300 w-20">Delete</th>
                            </tr>
                          </thead>
                          <tbody>
                            {investorForms.filter(f => f.classification === 'new').map((form) => {
                              const normalizedRegId = normalizeRegistrationId(form.holdingId || '');
                              const regIdErr = normalizedRegId.length > 0 && !isValidRegistrationId(normalizedRegId);
                              const emailErr = hasInvalidEmail(form.email || '');
                              const phoneErr = hasInvalidPhone(form.phone || '');
                              return (
                              <React.Fragment key={form.id}>
                                <tr className="border-t border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                                  <td className="px-4 py-3">{form.investorName || '—'}</td>
                                  <td className="px-4 py-3">
                                    <span className="flex items-center gap-1.5">
                                      {form.holdingId || '—'}
                                      {regIdErr && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex-shrink-0" title="Needs attention">!</span>}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="flex items-center gap-1.5">
                                      {form.email || '—'}
                                      {emailErr && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex-shrink-0" title="Needs attention">!</span>}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="flex items-center gap-1.5">
                                      {formatPhoneForDisplay(form.phone || '', form.country || '')}
                                      {phoneErr && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex-shrink-0" title="Needs attention">!</span>}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => setExpandedReviewRowId(expandedReviewRowId === form.id ? null : form.id)}
                                      className="px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                                    >
                                      {expandedReviewRowId === form.id ? 'Save' : 'Edit'}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => handleRemoveInvestor(form.id)}
                                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                      title="Delete investor"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                                {expandedReviewRowId === form.id && (
                                  <tr className="border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                                    <td colSpan={6} className="px-4 py-4">
                                      <ReviewRowFields form={form} onFieldChange={handleFieldChange} onHoldingIdChange={handleHoldingIdChange} />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 2. Existing Investors - Table */}
                  {investorForms.filter(f => f.classification === 'existing').length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Existing Investors</h3>
                      <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300">Name</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300">Registration ID</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300">Email</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300">Phone</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300 w-24">Edit</th>
                              <th className="px-4 py-3 text-left font-bold text-neutral-700 dark:text-neutral-300 w-20">Delete</th>
                            </tr>
                          </thead>
                          <tbody>
                            {investorForms.filter(f => f.classification === 'existing').map((form) => {
                              const normalizedRegId = normalizeRegistrationId(form.holdingId || '');
                              const regIdErr = normalizedRegId.length > 0 && !isValidRegistrationId(normalizedRegId);
                              const emailErr = hasInvalidEmail(form.email || '');
                              const phoneErr = hasInvalidPhone(form.phone || '');
                              return (
                              <React.Fragment key={form.id}>
                                <tr className="border-t border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                                  <td className="px-4 py-3">{form.investorName || '—'}</td>
                                  <td className="px-4 py-3">
                                    <span className="flex items-center gap-1.5">
                                      {form.holdingId || '—'}
                                      {regIdErr && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex-shrink-0" title="Needs attention">!</span>}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="flex items-center gap-1.5">
                                      {form.email || '—'}
                                      {emailErr && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex-shrink-0" title="Needs attention">!</span>}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="flex items-center gap-1.5">
                                      {formatPhoneForDisplay(form.phone || '', form.country || '')}
                                      {phoneErr && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex-shrink-0" title="Needs attention">!</span>}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => setExpandedReviewRowId(expandedReviewRowId === form.id ? null : form.id)}
                                      className="px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                                    >
                                      {expandedReviewRowId === form.id ? 'Save' : 'Edit'}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => handleRemoveInvestor(form.id)}
                                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                      title="Delete investor"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                                {expandedReviewRowId === form.id && (
                                  <tr className="border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                                    <td colSpan={6} className="px-4 py-4">
                                      <ReviewRowFields form={form} onFieldChange={handleFieldChange} onHoldingIdChange={handleHoldingIdChange} />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 3. Potential Matches - possible duplicates to verify */}
                  {investorForms.filter(f => f.classification === 'suspected').length > 0 && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-600">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">Potential Matches — Needs attention</h3>
                              <InfoTooltip
                                content="These investors may already exist. Click &quot;Confirm match&quot; to use the correct name and ID from the system, or edit manually if it&apos;s a different person."
                                className="inline-flex"
                              >
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-400 dark:bg-neutral-600 text-neutral-100 cursor-help text-[10px] font-bold hover:bg-neutral-500 dark:hover:bg-neutral-500">
                                  ?
                                </span>
                              </InfoTooltip>
                            </div>
                            <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                              Similar name or Registration ID found in the system. Confirm the match or edit details before proceeding.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {investorForms.filter(f => f.classification === 'suspected').map((form) => {
                          const normalizedRegId = normalizeRegistrationId(form.holdingId || '');
                          const regIdErr = normalizedRegId.length > 0 && !isValidRegistrationId(normalizedRegId);
                          const emailErr = hasInvalidEmail(form.email || '');
                          const phoneErr = hasInvalidPhone(form.phone || '');
                          return (
                          <div
                            key={form.id}
                            className="rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800/50 shadow-sm overflow-hidden"
                          >
                            <div className="flex flex-wrap items-center gap-4 p-5">
                              <div className="flex-1 min-w-[200px] space-y-1">
                                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{form.investorName || '—'}</p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                  ID: {form.holdingId || '—'}{regIdErr && <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold align-middle ml-0.5" title="Needs attention">!</span>}
                                  {' · '}Email: {form.email || 'No email'}{emailErr && <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold align-middle ml-0.5" title="Needs attention">!</span>}
                                  {' · '}Phone: {formatPhoneForDisplay(form.phone || '', form.country || '')}{phoneErr && <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold align-middle ml-0.5" title="Needs attention">!</span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Possible match</p>
                                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">{form.suspectedSimilarTo || '—'}</p>
                                  {form.suspectedReason && (
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{form.suspectedReason}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExpandedReviewRowId(expandedReviewRowId === form.id ? null : form.id)}
                                  className="px-4 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors"
                                >
                                  {expandedReviewRowId === form.id ? 'Save' : 'View & edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleConfirmRightInvestor(form.id); }}
                                  disabled={isVerifyingSuspected}
                                  className="px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
                                >
                                  Confirm match
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInvestor(form.id)}
                                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Delete investor"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {expandedReviewRowId === form.id && (
                              <div className="px-5 pb-5 pt-0 border-t border-neutral-100 dark:border-neutral-700">
                                <div className="mt-4 pt-4">
                                  <ReviewRowFields form={form} onFieldChange={handleFieldChange} onHoldingIdChange={handleHoldingIdChange} />
                                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-4">
                                    Click &quot;Confirm match&quot; to use the correct name and Registration ID from the system. Your other data (country, address, email, etc.) will be kept for the update.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {currentStep === 'SEND_INVITATION' && (
            <div className="grid" style={{ gridTemplateColumns: '40% 60%', gap: '1.5rem' }}>
              {/* Left Panel: Recipient List with Tabs */}
              <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg flex flex-col overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-neutral-200 dark:border-neutral-700">
                  {(['with-email', 'no-email', 'existing'] as const).map((tab) => {
                    const isNewOrSuspected = (f: InvestorFormData) => f.classification === 'new' || f.classification === 'suspected';
                    const withEmailCount = investorForms.filter(f => isNewOrSuspected(f) && f.email && f.email.trim()).length;
                    const noEmailCount = investorForms.filter(f => isNewOrSuspected(f) && !(f.email && f.email.trim())).length;
                    const existingCount = investorForms.filter(f => f.classification === 'existing').length;
                    const label = tab === 'with-email' ? `With Email (${withEmailCount})` : tab === 'no-email' ? `No Email (${noEmailCount})` : `Existing Investors (${existingCount})`;
                    return (
                      <button
                        key={tab}
                        onClick={() => setEmailRecipientTab(tab)}
                        className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                          emailRecipientTab === tab
                            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-b-2 border-purple-600'
                            : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Header: Select All for With Email tab */}
                {emailRecipientTab === 'with-email' && (
                  <div className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Selected {selectedInvestorsForEmail.size} of {investorForms.filter(f => (f.classification === 'new' || f.classification === 'suspected') && f.email && f.email.trim() && !sentEmailsTo.has(f.id)).length}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-bold"
                      >
                        Select All
                      </button>
                      <button
                        onClick={handleDeselectAll}
                        className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 font-bold"
                      >
                        Deselect All
                      </button>
                      <button
                        onClick={handleSendInvitations}
                        disabled={isSendingEmails || selectedInvestorsForEmail.size === 0 || !generatedSubject.trim() || !generatedMessage.trim()}
                        className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {isSendingEmails ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Sending...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Send to Selected
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Recipient List filtered by tab — With Email & No Email = NEW investors only */}
                {/* Fixed height: 10 items * (3.5rem height + 0.5rem gap) = 40rem = 640px */}
                {/* Each item is approximately 3.5rem (56px) + 0.5rem (8px) gap = 64px per item */}
                <div className="overflow-y-auto p-4 space-y-2 flex-1" style={{ maxHeight: '40rem', minHeight: '40rem' }}>
                  {(() => {
                    const isNewOrSuspected = (f: InvestorFormData) => f.classification === 'new' || f.classification === 'suspected';
                    const withEmail = investorForms.filter(f => isNewOrSuspected(f) && f.email && f.email.trim());
                    const noEmail = investorForms.filter(f => isNewOrSuspected(f) && !(f.email && f.email.trim()));
                    const existing = investorForms.filter(f => f.classification === 'existing');
                    const tabInvestors = emailRecipientTab === 'with-email' ? withEmail : emailRecipientTab === 'no-email' ? noEmail : existing;
                    const isSelectable = emailRecipientTab === 'with-email';
                    
                    return tabInvestors.length === 0 ? (
                      <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400">
                        {emailRecipientTab === 'with-email' && 'No new investors with email addresses.'}
                        {emailRecipientTab === 'no-email' && 'No new investors without email.'}
                        {emailRecipientTab === 'existing' && 'No existing investors.'}
                      </div>
                    ) : (
                      tabInvestors.map((investor) => {
                        const hasEmail = !!(investor.email && investor.email.trim());
                        const isSelected = selectedInvestorsForEmail.has(investor.id);
                        const hasSentEmail = sentEmailsTo.has(investor.id);
                        const emailContent = hasSentEmail ? sentEmailContent.get(investor.id) : null;

                        const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                          e.stopPropagation();
                          if (!isSelectable || hasSentEmail) return; // Don't allow selection if email already sent
                          setSelectedInvestorsForEmail(prev => {
                            const newSet = new Set(prev);
                            if (isSelected) newSet.delete(investor.id);
                            else newSet.add(investor.id);
                            return newSet;
                          });
                        };

                        const handleRowClick = () => {
                          if (!isSelectable) return;
                          // If email was already sent, show preview instead of selecting
                          if (hasSentEmail && emailContent) {
                            setPreviewEmailInvestorId(investor.id);
                            return;
                          }
                          // Only allow selection if email hasn't been sent
                          if (hasSentEmail) return;
                          setSelectedInvestorsForEmail(prev => {
                            const newSet = new Set(prev);
                            if (isSelected) newSet.delete(investor.id);
                            else newSet.add(investor.id);
                            return newSet;
                          });
                        };

                        return (
                          <div
                            key={investor.id}
                            onClick={handleRowClick}
                            className={`p-3 rounded-lg border transition-all ${
                              !isSelectable
                                ? 'bg-neutral-50 dark:bg-neutral-700/50 border-neutral-200 dark:border-neutral-600 cursor-default opacity-90'
                                : hasSentEmail
                                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 cursor-pointer hover:border-green-300 dark:hover:border-green-700'
                                : isSelected
                                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 cursor-pointer hover:border-purple-400 dark:hover:border-purple-600'
                                : 'bg-neutral-50 dark:bg-neutral-700/50 border-neutral-200 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {isSelectable && !hasSentEmail && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={handleCheckboxChange}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 text-purple-600 border-neutral-300 rounded focus:ring-purple-500 cursor-pointer"
                                />
                              )}
                              {isSelectable && hasSentEmail && (
                                <div className="w-4 h-4 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                                    {investor.investorName || 'Unnamed Investor'}
                                  </p>
                                  {sentEmailsTo.has(investor.id) && (
                                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider rounded-full flex-shrink-0">
                                      Sent
                                    </span>
                                  )}
                                  {!hasEmail && emailRecipientTab === 'with-email' && (
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
                      })
                    );
                  })()}
                </div>
              </div>

              {/* Email Preview Modal */}
              {previewEmailInvestorId && sentEmailContent.has(previewEmailInvestorId) && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewEmailInvestorId(null)}>
                  <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Email Preview - Sent Email
                      </h3>
                      <button
                        onClick={() => setPreviewEmailInvestorId(null)}
                        className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {(() => {
                        const investor = investorForms.find(f => f.id === previewEmailInvestorId);
                        const content = sentEmailContent.get(previewEmailInvestorId)!;
                        const sentDate = new Date(content.sentAt);
                        
                        return (
                          <>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                                <span className="font-bold">To:</span>
                                <span>{investor?.email || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                                <span className="font-bold">Investor:</span>
                                <span>{investor?.investorName || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                                <span className="font-bold">Sent:</span>
                                <span>{sentDate.toLocaleString()}</span>
                              </div>
                            </div>

                            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 space-y-3">
                              <div>
                                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                  Subject
                                </label>
                                <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                  {content.subject}
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                                  Message
                                </label>
                                <div 
                                  className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap max-h-96 overflow-y-auto"
                                  dangerouslySetInnerHTML={{ __html: content.message }}
                                />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

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
                    disabled={isGeneratingMessage}
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
                </div>
              </div>
            </div>
          )}

          {currentStep === 'CONFIRMATION' && isFinalExecuting && (
            <div className="w-full min-h-[400px] flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-purple-600 mb-6"></div>
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {finalExecutionStatus}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                Please wait. Do not close this window.
              </p>
            </div>
          )}
          {currentStep === 'CONFIRMATION' && !isFinalExecuting && (
            <div className="flex flex-col items-center justify-center py-12 max-w-lg mx-auto">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">Summary</h3>
              <div className="w-full space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Investors to be added</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{classificationResult.newCount}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Investors to be updated</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{classificationResult.existingCount}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Invitations sent</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{sentEmailsTo.size}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">New investors without email</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{investorForms.filter(f => (f.classification === 'new' || f.classification === 'suspected') && !(f.email && f.email.trim())).length}</span>
                </div>
              </div>
              {(() => {
                const newWithEmail = investorForms.filter(f => (f.classification === 'new' || f.classification === 'suspected') && f.email && f.email.trim());
                const unsentCount = newWithEmail.filter(f => !sentEmailsTo.has(f.id)).length;
                return unsentCount > 0 ? (
                  <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg w-full">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      {unsentCount} investor{unsentCount !== 1 ? 's' : ''} with email {unsentCount !== 1 ? 'have' : 'has'} not received invitation{unsentCount !== 1 ? 's' : ''} yet.
                    </p>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {currentStep === 'CONFIRMATION' && !isFinalExecuting && (
          <div className="px-8 py-6 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-3">
            <button
              onClick={handlePrevious}
              disabled={isProcessingStep}
              className="px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <button
              onClick={handleConfirmAndProcess}
              disabled={isProcessingStep}
              className="px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 bg-purple-600 text-white hover:bg-purple-700"
            >
              Confirm & Process
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        )}
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
                  disabled={isProcessingStep}
                  className="px-6 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 bg-purple-600 text-white hover:bg-purple-700 disabled:bg-neutral-100 dark:disabled:bg-neutral-700 disabled:text-neutral-400 dark:disabled:text-neutral-500 disabled:cursor-not-allowed"
                >
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
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

        </div>
      )}

      {/* Exit Confirmation Dialog — X button does not close without confirmation */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-neutral-900/30 dark:bg-black/30" onClick={handleCancelExit} />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full mx-4 z-50">
            <div className="px-6 pt-4 pb-2 flex items-start justify-between">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Leave without saving?</h3>
              <button
                onClick={handleCancelExit}
                className="p-1.5 -m-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                If you close this modal, all changes and updates you made will be lost.
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500">
                You can save your progress as a draft and resume later, or exit and discard everything.
              </p>
            </div>
            <div className="px-6 pb-6 pt-2 flex flex-wrap items-center justify-end gap-3">
              <button
                onClick={handleSaveAsDraft}
                className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Save as draft
              </button>
              <button
                onClick={handleConfirmExit}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                Exit and discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Potential Matches — Confirm before proceeding to Review */}
      {showPotentialMatchesConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-neutral-900/30 dark:bg-black/30" onClick={() => setShowPotentialMatchesConfirm(false)} />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full mx-4 z-50">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Verify before proceeding</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                You have <span className="font-bold">{classificationResult.suspectedCount}</span> potential match(es) that need verification.
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500">
                Please make sure every piece of information is correct and true before proceeding. Review and confirm each potential match in the next step.
              </p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setShowPotentialMatchesConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                Go back
              </button>
              <button
                onClick={() => {
                  setShowPotentialMatchesConfirm(false);
                  setCurrentStep('REVIEW');
                }}
                className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Continue to Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email reminder — warn before Continue to Summary if not all invitations sent */}
      {showEmailReminderModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-neutral-900/30 dark:bg-black/30" onClick={() => setShowEmailReminderModal(false)} />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full mx-4 z-50">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400">Send all invitations first?</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                You have <span className="font-bold text-amber-700 dark:text-amber-400">
                  {investorForms.filter(f => (f.classification === 'new' || f.classification === 'suspected') && f.email && f.email.trim() && !sentEmailsTo.has(f.id)).length}
                </span> new investor{investorForms.filter(f => (f.classification === 'new' || f.classification === 'suspected') && f.email && f.email.trim() && !sentEmailsTo.has(f.id)).length !== 1 ? 's' : ''} with email who haven&apos;t received invitations yet.
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500">
                Invitations are sent in real time. Please send to all investors with email before proceeding to the Summary step.
              </p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setShowEmailReminderModal(false)}
                className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Go back &amp; send
              </button>
              <button
                onClick={() => {
                  setShowEmailReminderModal(false);
                  setCurrentStep('CONFIRMATION');
                }}
                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                Continue anyway
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

export default AddInvestorModal;

