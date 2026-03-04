
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Applicant, RegistrationStatus, ComplianceStatus } from '../lib/types';
import { shareholderService } from '../lib/firestore-service';
import { Shareholder } from '../lib/types';
import { applicantService } from '../lib/firestore-service';
import { getWorkflowStatusInternal, markUserResponse, markComplianceComplete } from '../lib/shareholdingsVerification';
import Tooltip from './Tooltip';

// CopyableField component with copy notification
const CopyableField: React.FC<{ label: string; value: string; copyable: boolean }> = ({ label, value, copyable }) => {
  const [showCopied, setShowCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = async () => {
    if (!copyable || !value || value === 'Not provided') return;
    
    try {
      await navigator.clipboard.writeText(value);
      setShowCopied(true);
      
      // Clear existing timeout if any
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Hide notification after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setShowCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <label className="block text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">{label}</label>
      {copyable && value && value !== 'Not provided' ? (
        <button
          onClick={handleCopy}
          className="text-sm font-bold text-neutral-900 dark:text-neutral-100 hover:text-primary transition-colors cursor-pointer relative group"
        >
          {value}
          {showCopied && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-800 dark:bg-black text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-10">
              Copied!
            </span>
          )}
        </button>
      ) : (
        <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
      )}
    </div>
  );
};

interface ApplicantDetailProps {
  applicant: Applicant;
  onBack: () => void;
  onUpdateStatus: (id: string, status: RegistrationStatus) => void;
}

const ApplicantDetail: React.FC<ApplicantDetailProps> = ({ applicant, onBack, onUpdateStatus }) => {
  // Helper to get workflow stage display label
  const getWorkflowStageLabel = (stage?: string): string => {
    if (!stage) return 'N/A';
    const stageMap: Record<string, string> = {
      'SEND_EMAIL': 'Send Email',
      'SENT_EMAIL': 'Sent Email',
      'CLAIM_IN_PROGRESS': 'Claim In Progress',
      'ACCOUNT_CLAIMED': 'Account Claimed',
      'INVITE_EXPIRED': 'Invite Expired'
    };
    return stageMap[stage] || stage;
  };

  // Helper to get system status display label - follows investor provisioning workflow mapping
  const getSystemStatusLabel = (): string => {
    if (!applicant.isPreVerified) {
      // For regular accounts, use the basic systemStatus
      if (!applicant.systemStatus) return 'N/A';
      const statusMap: Record<string, string> = {
        'NULL': 'NULL',
        'ACTIVE': 'Active',
        'CLAIMED': 'Claimed',
        'INACTIVE': 'Inactive'
      };
      return statusMap[applicant.systemStatus] || applicant.systemStatus;
    }

    // For pre-verified accounts, follow the exact workflow stage to system status mapping:
    // SEND_EMAIL -> NULL
    // SENT_EMAIL -> ACTIVE
    // CLAIM_IN_PROGRESS -> ACTIVE
    // ACCOUNT_CLAIMED -> CLAIMED
    // INVITE_EXPIRED -> INACTIVE
    const { workflowStage, systemStatus } = applicant;

    // Primary: Use workflowStage to determine system status (following documented mapping)
    if (workflowStage) {
      const workflowToSystemStatus: Record<string, string> = {
        'SEND_EMAIL': 'NULL',
        'SENT_EMAIL': 'ACTIVE',
        'CLAIM_IN_PROGRESS': 'ACTIVE',
        'ACCOUNT_CLAIMED': 'CLAIMED',
        'INVITE_EXPIRED': 'INACTIVE'
      };
      
      const mappedStatus = workflowToSystemStatus[workflowStage];
      if (mappedStatus) {
        // Map to display label
        const statusMap: Record<string, string> = {
          'NULL': 'NULL',
          'ACTIVE': 'Active',
          'CLAIMED': 'Claimed',
          'INACTIVE': 'Inactive'
        };
        return statusMap[mappedStatus] || mappedStatus;
      }
    }

    // Fallback: Use actual systemStatus if workflowStage is not available
    if (systemStatus) {
      const statusMap: Record<string, string> = {
        'NULL': 'NULL',
        'ACTIVE': 'Active',
        'CLAIMED': 'Claimed',
        'INACTIVE': 'Inactive'
      };
      return statusMap[systemStatus] || systemStatus;
    }

    return 'N/A';
  };

  // Helper to get account status display label for pre-verified accounts
  const getAccountStatusLabel = (status?: string): string => {
    if (!status) return 'N/A';
    const statusMap: Record<string, string> = {
      'PENDING': 'Pending',
      'VERIFIED': 'Verified',
      'UNVERIFIED': 'Unverified'
    };
    return statusMap[status] || status;
  };

  const getAuditStatusLabel = (s: RegistrationStatus) => {
    // For pre-verified accounts, use accountStatus instead
    if (applicant.isPreVerified && applicant.accountStatus) {
      return getAccountStatusLabel(applicant.accountStatus);
    }
    
    // For regular accounts, use the original logic
    if (s === RegistrationStatus.APPROVED) return 'Accepted';
    if (s === RegistrationStatus.FURTHER_INFO) return 'Pending';
    // Treat both PENDING and REJECTED as Unverified in the UI.
    return 'Unverified';
  };

  const getCountryLabel = () => {
    // Only show country if it was provided in shareholdings verification (Step 2)
    // If no country is provided, don't display anything
    const countryFromVerification = applicant.shareholdingsVerification?.step2?.country;
    if (countryFromVerification && countryFromVerification.trim()) {
      return countryFromVerification.trim();
    }
    
    // No country provided - return empty string (will show nothing)
    return '';
  };

  // Shareholder match finder state
  const [registrationId, setRegistrationId] = useState<string>('');
  const [statusForRegId, setStatusForRegId] = useState<string>('REGISTRATION_PENDING');

  useEffect(() => {
    const computeRegistrationId = async () => {
      const internalStatus = await getWorkflowStatusInternal(applicant);
      setStatusForRegId(internalStatus);
      
      // Don't show registration ID for invalid/wrong holdings (FURTHER_INFO_REQUIRED)
      if (internalStatus === 'FURTHER_INFO_REQUIRED') {
        setRegistrationId('');
        return;
      }
      
      // Priority: shareholdingsId from step2 > registrationId > applicant.id
      // Only show if holdings are valid (VERIFIED or UNDER_REVIEW)
      if (internalStatus === 'VERIFIED' || internalStatus === 'UNDER_REVIEW') {
        setRegistrationId(
          applicant.shareholdingsVerification?.step2?.shareholdingsId || 
          applicant.registrationId || 
          applicant.id
        );
        return;
      }
      
      // For other statuses, only show if pre-verified
      if (applicant.isPreVerified && applicant.registrationId) {
        setRegistrationId(applicant.registrationId);
        return;
      }
      
      setRegistrationId(applicant.id);
    };
    computeRegistrationId();
  }, [applicant]);

  const getRegistrationId = (): string => {
    return registrationId;
  };

  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [matchedShareholder, setMatchedShareholder] = useState<Shareholder | null>(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const loadingMessages = [
    'Searching for investor ID match...',
    'Querying shareholders registry...',
    'Verifying registration details...',
    'Cross-referencing investor data...'
  ];

  // Rotate loading messages while searching
  useEffect(() => {
    if (!isSearching) return;

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1500); // Change message every 1.5 seconds

    return () => clearInterval(interval);
  }, [isSearching, loadingMessages.length]);

  const handleInputFocus = () => {
    if (!hasAutoFilled) {
      const autoFillId = getRegistrationId();
      setRegistrationId(autoFillId);
      setHasAutoFilled(true);
    }
  };

  const handleFindMatch = () => {
    if (!registrationId.trim()) return;
    
    // Mark that a search has been performed
    setHasSearched(true);
    
    // Clear previous results
    setMatchedShareholder(null);
    setShowMatchDetails(false);
    setIsSearching(true);
    setLoadingMessageIndex(0);
    
    // Search for shareholder in Firestore
    const searchShareholder = async () => {
      try {
        const match = await shareholderService.getById(registrationId.trim());
        setMatchedShareholder(match);
      } catch (error) {
        console.error('Error searching for shareholder:', error);
        setMatchedShareholder(null);
      } finally {
        setIsSearching(false);
      }
    };
    
    // Add a small delay to show loading messages
    setTimeout(() => {
      searchShareholder();
    }, 2000);
  };


  const mainContent = (
    <>
      {/* Toast Animation Styles */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div className="max-w-screen-2xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between mb-10">
        <button 
          onClick={onBack}
          className="group flex items-center gap-3 text-xs font-black text-neutral-400 hover:text-black transition-colors uppercase tracking-widest"
        >
          <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          Return to Registry
        </button>
        {/* Action buttons - Only show for non-pre-verified accounts */}
        {!applicant.isPreVerified && (() => {
          // Determine application status for button control
          const workflow = applicant.shareholdingsVerification;
          const wantsVerification = workflow?.step1.wantsVerification !== false;
          
          // Determine application status based on current state
          type ApplicationStatus = 'VERIFIED' | 'REJECTED' | 'PENDING_RESUBMISSION' | 'UNDER_REVIEW';
          let applicationStatus: ApplicationStatus = 'UNDER_REVIEW';
          let finalizingAction: 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | null = null;
          
          // Check if user skipped verification - disable all buttons
          if (workflow?.step1.wantsVerification === false) {
            // All buttons disabled for skipped verification
          } else {
            // VERIFIED: Status is APPROVED and Step 6 exists (completed verification)
            if (applicant.status === RegistrationStatus.APPROVED && 
                (workflow?.step6?.verifiedAt || workflow?.step4?.lastResult === 'MATCH')) {
              applicationStatus = 'VERIFIED';
              finalizingAction = 'APPROVE';
            }
            // REJECTED: Status is REJECTED
            else if (applicant.status === RegistrationStatus.REJECTED) {
              applicationStatus = 'REJECTED';
              finalizingAction = 'REJECT';
            }
            // PENDING_RESUBMISSION: Request Info was clicked (FURTHER_INFO status) and awaiting resubmission
            // This means:
            // 1. Status is FURTHER_INFO (Request Info was clicked)
            // 2. step4.lastResult is undefined (no IRO decision yet - waiting for resubmission)
            // 3. step4.lastReviewedAt exists (IRO has reviewed/requested info)
            // 4. step2.submittedAt is older than or equal to step4.lastReviewedAt (no resubmission yet)
            // Note: When investor resubmits, step2.submittedAt will be newer than step4.lastReviewedAt, so buttons re-enable
            else if (applicant.status === RegistrationStatus.FURTHER_INFO && 
                     workflow?.step4?.lastResult === undefined &&
                     workflow?.step4?.lastReviewedAt) {
              // Check if investor has resubmitted (new step2 submission after Request Info)
              const lastReviewedAt = workflow.step4.lastReviewedAt;
              const step2SubmittedAt = workflow.step2?.submittedAt;
              
              // If step2 was submitted after Request Info was sent, it's a resubmission - enable buttons
              const hasResubmitted = step2SubmittedAt && lastReviewedAt && 
                                     new Date(step2SubmittedAt) > new Date(lastReviewedAt);
              
              if (!hasResubmitted) {
                applicationStatus = 'PENDING_RESUBMISSION';
                finalizingAction = 'REQUEST_INFO';
              }
              // If hasResubmitted, keep as UNDER_REVIEW (buttons enabled)
            }
            // UNDER_REVIEW: Default state - all buttons enabled
            else {
              applicationStatus = 'UNDER_REVIEW';
            }
          }
          
          // Determine button states based on application status
          const isSkippedVerification = workflow?.step1.wantsVerification === false;
          const isVerified = applicationStatus === 'VERIFIED';
          const isRejected = applicationStatus === 'REJECTED';
          const isPendingResubmission = applicationStatus === 'PENDING_RESUBMISSION';
          const isUnderReview = applicationStatus === 'UNDER_REVIEW';
          
          // All buttons disabled if verification was skipped, verified, rejected, or pending resubmission
          const approveDisabled = isSkippedVerification || isVerified || isRejected || isPendingResubmission;
          const rejectDisabled = isSkippedVerification || isVerified || isRejected || isPendingResubmission;
          const requestInfoDisabled = isSkippedVerification || isVerified || isRejected || isPendingResubmission;
          
          // Determine which button should be highlighted (the one that finalized the state)
          const approveHighlighted = finalizingAction === 'APPROVE';
          const rejectHighlighted = finalizingAction === 'REJECT';
          const requestInfoHighlighted = finalizingAction === 'REQUEST_INFO';
          
          return (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.FURTHER_INFO)}
                disabled={requestInfoDisabled}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md transition-colors ${
                  requestInfoDisabled 
                    ? requestInfoHighlighted
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 cursor-not-allowed opacity-90'
                      : 'text-neutral-400 dark:text-neutral-600 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 cursor-not-allowed opacity-50'
                    : 'text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
                }`}
                title={
                  isSkippedVerification 
                    ? 'This account skipped holdings verification' 
                    : requestInfoDisabled && requestInfoHighlighted
                    ? 'Request Info was sent - awaiting investor resubmission'
                    : requestInfoDisabled
                    ? 'Action not available in current state'
                    : 'Request additional information from the applicant'
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Request Info
              </button>
              <button 
                onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.REJECTED)}
                disabled={rejectDisabled}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md transition-colors ${
                  rejectDisabled 
                    ? rejectHighlighted
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 cursor-not-allowed opacity-90'
                      : 'text-neutral-400 dark:text-neutral-600 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 cursor-not-allowed opacity-50'
                    : 'text-red-600 dark:text-red-400 bg-neutral-100 dark:bg-neutral-700 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-400 dark:hover:border-red-700'
                }`}
                title={
                  isSkippedVerification 
                    ? 'This account skipped holdings verification' 
                    : rejectDisabled && rejectHighlighted
                    ? 'Application was rejected'
                    : rejectDisabled
                    ? 'Action not available in current state'
                    : 'Reject the applicant\'s holdings verification'
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </button>
              <button 
                onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.APPROVED)}
                disabled={approveDisabled}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md transition-colors ${
                  approveDisabled 
                    ? approveHighlighted
                      ? 'text-white bg-green-600 dark:bg-green-500 border-2 border-green-700 dark:border-green-400 cursor-not-allowed opacity-90 shadow-md'
                      : 'text-neutral-400 dark:text-neutral-600 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 cursor-not-allowed opacity-50'
                    : 'text-white bg-[#082b4a] dark:bg-[#00adf0] hover:bg-[#061d33] dark:hover:bg-[#0099d6]'
                }`}
                title={
                  isSkippedVerification 
                    ? 'This account skipped holdings verification' 
                    : approveDisabled && approveHighlighted
                    ? 'Application was approved and verified'
                    : approveDisabled
                    ? 'Action not available in current state'
                    : 'Approve the applicant\'s holdings verification'
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Approve
              </button>
            </div>
          );
        })()}
      </div>

      <div className="space-y-10">
          <section className="bg-white dark:bg-neutral-800 p-10 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#082b4a] dark:bg-[#00adf0]"></div>
            <h2 className="text-sm font-black mb-8 text-neutral-900 dark:text-neutral-100 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-neutral-800 dark:bg-black rounded-full"></span>
              Identity & Profile Summary
            </h2>
            <div className="grid grid-cols-3 gap-10">
              {[
                { label: 'Legal name', value: applicant.fullName, copyable: false },
                { label: 'Email', value: applicant.email, copyable: true },
                { label: 'Contact Number', value: applicant.phoneNumber || 'Not provided', copyable: true },
                ...(getCountryLabel() ? [{ label: 'Country', value: getCountryLabel(), copyable: false }] : []),
                { 
                  label: 'Registration ID', 
                  value: (() => {
                    const regId = getRegistrationId();
                    // Don't show registration ID for invalid holdings
                    if (!regId || regId === applicant.id) {
                      // Only show applicant.id if it's not an invalid holdings case
                      if (statusForRegId === 'FURTHER_INFO_REQUIRED') {
                        return 'N/A'; // Hide for invalid holdings
                      }
                      return applicant.id;
                    }
                    return regId.length > 6 ? regId.slice(-6) : regId;
                  })(),
                  copyable: false
                },
                { label: 'Submission date', value: applicant.submissionDate, copyable: false },
                { label: 'Current status', value: getAuditStatusLabel(applicant.status), copyable: false },
                ...(applicant.isPreVerified ? [
                  { label: 'Workflow Stage', value: getWorkflowStageLabel(applicant.workflowStage), copyable: false },
                  { label: 'System Status', value: getSystemStatusLabel(), copyable: false }
                ] : [])
              ].map((item, idx) => (
                <CopyableField key={idx} label={item.label} value={item.value} copyable={item.copyable} />
              ))}
            </div>
          </section>

          {/* Compliance Status - Only for non-pre-verified accounts with IRO decisions */}
          {!applicant.isPreVerified && applicant.shareholdingsVerification?.step4?.iroDecision && (
            <section className="bg-white dark:bg-neutral-800 p-10 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#082b4a] dark:bg-[#00adf0]"></div>
              <h2 className="text-sm font-black mb-8 text-neutral-900 dark:text-neutral-100 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#082b4a] dark:bg-[#00adf0] rounded-full"></span>
                Compliance Status
              </h2>
              
              {(() => {
                const iroDecision = applicant.shareholdingsVerification?.step4?.iroDecision;
                const complianceStatus = applicant.complianceStatus || iroDecision?.complianceStatus || 'NO_COMPLIANCE_REQUIRED';
                const decisionHistory = applicant.shareholdingsVerification?.step4?.iroDecisionHistory || [];
                
                const getComplianceStatusColor = (status: ComplianceStatus) => {
                  switch (status) {
                    case 'AWAITING_USER_RESPONSE':
                      return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
                    case 'USER_RESPONDED':
                      return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
                    case 'COMPLIANCE_COMPLETE':
                      return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700';
                    default:
                      return 'text-neutral-700 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700';
                  }
                };

                const getComplianceStatusLabel = (status: ComplianceStatus) => {
                  switch (status) {
                    case 'AWAITING_USER_RESPONSE':
                      return 'Awaiting User Response';
                    case 'USER_RESPONDED':
                      return 'User Responded';
                    case 'COMPLIANCE_COMPLETE':
                      return 'Compliance Complete';
                    default:
                      return 'No Compliance Required';
                  }
                };

                return (
                  <div className="space-y-6">
                    {/* Current Compliance Status */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
                          Current Status
                        </label>
                        <span className={`inline-block px-3 py-1.5 text-xs font-bold rounded-md border ${getComplianceStatusColor(complianceStatus)}`}>
                          {getComplianceStatusLabel(complianceStatus)}
                        </span>
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
                          IRO Decision
                        </label>
                        <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                          {iroDecision?.decision === 'APPROVED' ? 'Approved' : 
                           iroDecision?.decision === 'REJECTED' ? 'Rejected' : 
                           iroDecision?.decision === 'REQUEST_INFO' ? 'Request Info' : 'N/A'}
                        </span>
                      </div>
                      {iroDecision?.decisionAt && (
                        <div>
                          <label className="block text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
                            Decision Date
                          </label>
                          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                            {new Date(iroDecision.decisionAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {iroDecision?.userRespondedAt && (
                        <div>
                          <label className="block text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
                            User Responded
                          </label>
                          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                            {new Date(iroDecision.userRespondedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {iroDecision?.resubmissionCount !== undefined && (
                        <div>
                          <label className="block text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">
                            Resubmissions
                          </label>
                          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                            {iroDecision.resubmissionCount}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons for IRO */}
                    {(complianceStatus === 'AWAITING_USER_RESPONSE' || complianceStatus === 'USER_RESPONDED') && (
                      <div className="flex items-center gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                        {complianceStatus === 'AWAITING_USER_RESPONSE' && (
                          <button
                            onClick={async () => {
                              try {
                                const updated = markUserResponse(applicant, 'Manually marked by IRO');
                                await applicantService.update(applicant.id, updated);
                                // Force a refresh by updating the parent component
                                window.location.reload();
                              } catch (error) {
                                console.error('Failed to mark user response:', error);
                                alert('Failed to update compliance status');
                              }
                            }}
                            className="px-4 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/70 transition-colors"
                          >
                            Mark User Responded
                          </button>
                        )}
                        {complianceStatus === 'USER_RESPONDED' && (
                          <button
                            onClick={async () => {
                              try {
                                const updated = markComplianceComplete(applicant);
                                await applicantService.update(applicant.id, updated);
                                window.location.reload();
                              } catch (error) {
                                console.error('Failed to mark compliance complete:', error);
                                alert('Failed to update compliance status');
                              }
                            }}
                            className="px-4 py-2 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 border border-green-300 dark:border-green-800 rounded-md hover:bg-green-100 dark:hover:bg-green-900/70 transition-colors"
                          >
                            Mark Compliance Complete
                          </button>
                        )}
                      </div>
                    )}

                    {/* Decision History */}
                    {decisionHistory.length > 0 && (
                      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                        <label className="block text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-3">
                          Decision History
                        </label>
                        <div className="space-y-2">
                          {decisionHistory.map((decision, idx) => (
                            <div key={idx} className="text-xs text-neutral-600 dark:text-neutral-400 p-2 bg-neutral-50 dark:bg-neutral-900 rounded">
                              <span className="font-bold">{decision.decision}</span> - {new Date(decision.decisionAt).toLocaleDateString()}
                              {decision.userRespondedAt && (
                                <span className="ml-2 text-blue-600 dark:text-blue-400">• User responded</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>
          )}

          {/* Email Activity Log - Only for pre-verified accounts */}
          {applicant.isPreVerified && (
            <section className="bg-white dark:bg-neutral-800 p-10 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <h2 className="text-sm font-black mb-6 text-neutral-900 dark:text-neutral-100 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#082b4a] dark:bg-[#00adf0] rounded-full"></span>
                Email Activity Log
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200 dark:border-neutral-700">
                      <th className="px-6 py-4">Activity</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Time</th>
                      <th className="px-6 py-4 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                    {applicant.emailGeneratedAt && (
                      <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">Email Generated</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                            {new Date(applicant.emailGeneratedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                            {new Date(applicant.emailGeneratedAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: false 
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">—</span>
                        </td>
                      </tr>
                    )}
                    
                    {applicant.emailSentAt && (
                      <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">Email Sent</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                            {new Date(applicant.emailSentAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                            {new Date(applicant.emailSentAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: false 
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                            {applicant.emailSentCount && applicant.emailSentCount > 1 ? `${applicant.emailSentCount}x` : '1x'}
                          </span>
                        </td>
                      </tr>
                    )}
                    
                    {applicant.emailOpenedAt && (
                      <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">Email Opened</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                            {new Date(applicant.emailOpenedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                            {new Date(applicant.emailOpenedAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: false 
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-medium text-neutral-600">
                            {applicant.emailOpenedCount && applicant.emailOpenedCount > 1 ? `${applicant.emailOpenedCount}x` : '1x'}
                          </span>
                        </td>
                      </tr>
                    )}
                    
                    {applicant.linkClickedAt && (
                      <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">Link Clicked</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                            {new Date(applicant.linkClickedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                            {new Date(applicant.linkClickedAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: false 
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-medium text-neutral-600">
                            {applicant.linkClickedCount && applicant.linkClickedCount > 1 ? `${applicant.linkClickedCount}x` : '1x'}
                          </span>
                        </td>
                      </tr>
                    )}
                    
                    {applicant.accountClaimedAt && (
                      <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">Account Verified</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                            {new Date(applicant.accountClaimedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                            {new Date(applicant.accountClaimedAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: false 
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">—</span>
                        </td>
                      </tr>
                    )}
                    
                    {!applicant.emailGeneratedAt && !applicant.emailSentAt && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center">
                          <p className="text-sm text-neutral-400 italic">No activity recorded yet</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Documentary Evidence - Only show for non-pre-verified accounts */}
          {!applicant.isPreVerified && (
            <section className="bg-white dark:bg-neutral-800 p-10 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <h2 className="text-sm font-black mb-8 text-neutral-900 dark:text-neutral-100 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#082b4a] dark:bg-[#00adf0] rounded-full"></span>
                Documentary Evidence
              </h2>
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-widest">Government ID Scan</label>
                  <div className="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-900 rounded-lg overflow-hidden group border border-neutral-300 dark:border-neutral-700 cursor-zoom-in">
                    <img src={applicant.idDocumentUrl} className="w-full h-full object-cover transition-all duration-500 opacity-90 group-hover:opacity-100" alt="ID" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-[2px]">
                      <span className="px-6 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg border border-neutral-300 dark:border-neutral-700">Verify Original</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-widest">Financial Statements</label>
                  <div className="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-900 rounded-lg overflow-hidden group border border-neutral-300 dark:border-neutral-700 cursor-zoom-in">
                    <img src={applicant.taxDocumentUrl} className="w-full h-full object-cover transition-all duration-500 opacity-90 group-hover:opacity-100" alt="Tax" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-[2px]">
                      <span className="px-6 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg border border-neutral-300 dark:border-neutral-700">Verify Original</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Shareholder Match Finder - Only show for non-pre-verified accounts */}
          {!applicant.isPreVerified && (
            <section className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-8">
              <div className="mb-6">
                <h2 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 bg-[#082b4a] dark:bg-[#00adf0] rounded-full"></span>
                  Shareholder Match Finder
                </h2>
                <p className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-[0.2em]">
                  Verify Registration ID Against Shareholders Registry
                </p>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-widest mb-2">
                    Registration ID
                  </label>
                  <input
                    type="text"
                    value={registrationId}
                    onChange={(e) => setRegistrationId(e.target.value)}
                    onFocus={handleInputFocus}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm font-semibold text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-[#082b4a] dark:focus:border-[#00adf0] outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                    placeholder="Click to auto-fill registration ID"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleFindMatch}
                    disabled={isSearching || !registrationId.trim()}
                    className="px-6 py-2.5 text-sm font-semibold text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-neutral-700 dark:bg-[#00adf0] hover:bg-neutral-600 dark:hover:bg-[#0099d6]"
                  >
                    Find Match
                  </button>
                </div>
              </div>

              {/* Loading Indicator */}
              {isSearching && (
                <div className="mb-6 flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md">
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 border-2 border-[#082b4a] dark:border-[#00adf0] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                    {loadingMessages[loadingMessageIndex]}
                  </p>
                </div>
              )}

              {/* Match Results - Only show after search completes */}
              {!isSearching && matchedShareholder && (
                <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-800 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Match Found</h3>
                        <p className="text-xs text-green-600 dark:text-green-300">Registration ID verified in shareholders registry</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[9px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">
                        Company Name
                      </label>
                      <p className="text-sm font-bold text-green-900 dark:text-green-300">{matchedShareholder.name}</p>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">
                        Investor ID
                      </label>
                      <p className="text-sm font-bold text-green-900 dark:text-green-300 font-mono">{matchedShareholder.id.length > 6 ? matchedShareholder.id.slice(-6) : matchedShareholder.id}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowMatchDetails(!showMatchDetails)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-800 rounded-md hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={showMatchDetails ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                    </svg>
                    {showMatchDetails ? 'Hide Details' : 'More Details'}
                  </button>

                  {/* Expanded Details */}
                  {showMatchDetails && (
                    <div className="mt-4 pt-4 border-t border-green-300 dark:border-green-800">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">
                            Holdings
                          </label>
                          <p className="text-sm font-bold text-green-900 dark:text-green-300">{matchedShareholder.holdings.toLocaleString()} shares</p>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">
                            Stake Percentage
                          </label>
                          <p className="text-sm font-bold text-green-900 dark:text-green-300">{matchedShareholder.stake.toFixed(5)}%</p>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">
                            Rank
                          </label>
                          <p className="text-sm font-bold text-green-900 dark:text-green-300">#{matchedShareholder.rank}</p>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">
                            Account Type
                          </label>
                          <p className="text-sm font-bold text-green-900 dark:text-green-300">{matchedShareholder.accountType}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">
                            Corporate Address
                          </label>
                          <p className="text-sm font-bold text-green-900 dark:text-green-300">{matchedShareholder.coAddress}</p>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">
                            Country
                          </label>
                          <p className="text-sm font-bold text-green-900 dark:text-green-300">{matchedShareholder.country}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No Match Found - Only show after search has been performed */}
              {!isSearching && hasSearched && registrationId && !matchedShareholder && (
                <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-200 dark:border-red-800 rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-wide mb-1">No Match Found</h3>
                      <p className="text-xs text-red-600 dark:text-red-300">Registration ID not found in shareholders registry</p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
      </div>
    </div>

    </>
  );

  return mainContent;
};

export default ApplicantDetail;
