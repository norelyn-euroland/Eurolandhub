
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import { MOCK_SHAREHOLDERS } from '../lib/mockShareholders';
import { applicantService } from '../lib/firestore-service';
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
      <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">{label}</label>
      {copyable && value && value !== 'Not provided' ? (
        <button
          onClick={handleCopy}
          className="text-sm font-bold text-neutral-900 hover:text-primary transition-colors cursor-pointer relative group"
        >
          {value}
          {showCopied && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap z-10">
              Copied!
            </span>
          )}
        </button>
      ) : (
        <p className="text-sm font-bold text-neutral-900">{value}</p>
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
  const getRegistrationId = (): string => {
    // Priority: shareholdingsId from step2 > registrationId > applicant.id
    return applicant.shareholdingsVerification?.step2?.shareholdingsId || 
           applicant.registrationId || 
           applicant.id;
  };

  const [registrationId, setRegistrationId] = useState('');
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [matchedShareholder, setMatchedShareholder] = useState<typeof MOCK_SHAREHOLDERS[0] | null>(null);
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
    
    // Simulate search delay with rotating messages
    setTimeout(() => {
      const match = MOCK_SHAREHOLDERS.find(sh => sh.id === registrationId.trim());
      setMatchedShareholder(match || null);
      setIsSearching(false);
    }, 2000); // 2 seconds to show loading messages
  };

  // Invitation email state
  const [messageStyle, setMessageStyle] = useState<string>('default');
  const [generatedSubject, setGeneratedSubject] = useState<string>('');
  const [generatedMessage, setGeneratedMessage] = useState<string>('');
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
  const [invitationStatus, setInvitationStatus] = useState<{ type: 'success' | 'error' | 'warning' | 'critical'; message: string } | null>(null);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleGenerateMessage = async () => {
    if (!applicant.email) {
      setInvitationStatus({
        type: 'error',
        message: 'No email address available for this account.'
      });
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 5000);
      return;
    }

    setIsGeneratingMessage(true);
    setInvitationStatus(null);

    try {
      // Extract first and last name from fullName
      const nameParts = applicant.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || applicant.fullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const response = await fetch('/api/send-invitation-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail: applicant.email,
          firstName,
          lastName,
          registrationId: applicant.registrationId || applicant.id,
          messageStyle,
          preview: true, // Preview mode - generate but don't send
        }),
      });

      const rawText = await response.text();
      const data = rawText ? (() => { try { return JSON.parse(rawText); } catch { return null; } })() : null;

      if (response.ok && data?.subject && data?.body) {
        setGeneratedSubject(data.subject);
        setGeneratedMessage(data.body);
        setHasGeneratedOnce(true); // Mark that we've generated at least once
        
        // Update Firebase with generation timestamp
        if (applicant.id) {
          try {
            await applicantService.update(applicant.id, {
              emailGeneratedAt: new Date().toISOString(),
            });
          } catch (error) {
            console.error('Failed to update email generated timestamp:', error);
          }
        }
        
        // Check for rate limit warnings/errors
        if (data?.rateLimitError === 'both') {
          // Both models rate limited - critical error
          setInvitationStatus({
            type: 'critical',
            message: 'Both LLM models unavailable. Using default template. Please wait before trying again.'
          });
        } else if (data?.rateLimitWarning === 'primary') {
          // Primary rate limited, using fallback - warning
          setInvitationStatus({
            type: 'warning',
            message: 'Primary model unavailable. Using fallback model.'
          });
        } else {
          // Normal success
          setInvitationStatus({
            type: 'success',
            message: 'Message generated successfully! You can edit it below before sending.'
          });
        }
        
        setShowToast(true);
        // Auto-dismiss after 2.5 seconds
        setTimeout(() => {
          setShowToast(false);
        }, 5000);
      } else {
        setInvitationStatus({
          type: 'error',
          message: `Failed to generate message: ${data?.error || response.status || 'Unknown error'}`
        });
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 5000);
      }
    } catch (error: any) {
      setInvitationStatus({
        type: 'error',
        message: `Error: ${error.message || 'Failed to generate message'}`
      });
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 5000);
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  // Reset hasGeneratedOnce when message style changes
  useEffect(() => {
    setHasGeneratedOnce(false);
  }, [messageStyle]);

  const handleSendInvitation = async () => {
    if (!applicant.email) {
      setInvitationStatus({
        type: 'error',
        message: 'No email address available for this account.'
      });
      return;
    }

    if (!generatedSubject.trim() || !generatedMessage.trim()) {
      setInvitationStatus({
        type: 'error',
        message: 'Please generate a message first before sending.'
      });
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 5000);
      return;
    }

    setIsSendingInvitation(true);
    setInvitationStatus(null);

    try {
      // Extract first and last name from fullName
      const nameParts = applicant.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || applicant.fullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const response = await fetch('/api/send-invitation-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail: applicant.email,
          firstName,
          lastName,
          registrationId: applicant.registrationId || applicant.id,
          messageStyle,
          customSubject: generatedSubject, // Send the edited subject
          customBody: generatedMessage, // Send the edited body
        }),
      });

      const rawText = await response.text();
      const data = rawText ? (() => { try { return JSON.parse(rawText); } catch { return null; } })() : null;

      if (response.ok && data?.ok) {
        setInvitationStatus({
          type: 'success',
          message: `Invitation email sent successfully! Link expires in 30 days.`
        });
        setShowToast(true);
        // Auto-dismiss after 2.5 seconds
        setTimeout(() => {
          setShowToast(false);
        }, 5000);
      } else {
        setInvitationStatus({
          type: 'error',
          message: `Failed to send invitation: ${data?.error || response.status || 'Unknown error'}`
        });
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 5000);
      }
    } catch (error: any) {
      setInvitationStatus({
        type: 'error',
        message: `Error: ${error.message || 'Failed to send invitation'}`
      });
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 5000);
    } finally {
      setIsSendingInvitation(false);
    }
  };

  return (
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
      `}</style>
      <div className="max-w-7xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between mb-10">
        <button 
          onClick={onBack}
          className="group flex items-center gap-3 text-xs font-black text-neutral-400 hover:text-black transition-colors uppercase tracking-widest"
        >
          <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          Return to Registry
        </button>
        {/* Action buttons - Only show for non-pre-verified accounts */}
        {!applicant.isPreVerified && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.FURTHER_INFO)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 hover:border-neutral-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Request Info
            </button>
            <button 
              onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.REJECTED)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 hover:border-red-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject
            </button>
            <button 
              onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.APPROVED)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-md transition-colors"
              style={{ backgroundColor: '#082b4a' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#061d33'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#082b4a'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Approve
            </button>
          </div>
        )}
      </div>

      <div className="space-y-10">
          <section className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-black"></div>
            <h2 className="text-sm font-black mb-8 text-neutral-900 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
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
                  value: applicant.isPreVerified && applicant.registrationId 
                    ? (applicant.registrationId.length > 6 ? applicant.registrationId.slice(-6) : applicant.registrationId)
                    : applicant.id,
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

          {/* Invitation Email Section - Only for pre-verified accounts */}
          {applicant.isPreVerified && (
            <section className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm">
              <h2 className="text-sm font-black mb-6 text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
                Send Account Invitation
              </h2>
              
              <div className="space-y-6">
                {/* Message Style Selector */}
                <div>
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-3">
                    Message Style
                  </label>
                  <select
                    value={messageStyle}
                    onChange={(e) => setMessageStyle(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-black focus:border-black outline-none"
                  >
                    <option value="default">Default</option>
                    <option value="formal">Formal</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>

                {/* Subject Line Editor */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      Subject Line
                    </label>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {generatedSubject.length} characters
                    </span>
                  </div>
                  <input
                    type="text"
                    value={generatedSubject}
                    onChange={(e) => setGeneratedSubject(e.target.value)}
                    placeholder="Generate a subject or type your custom subject line here..."
                    className="w-full px-4 py-3 bg-white border-2 border-neutral-300 rounded-lg text-sm font-medium shadow-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
                  />
                </div>

                {/* Message Body Editor */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      Message Body
                    </label>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {generatedMessage.length} characters
                    </span>
                  </div>
                  <textarea
                    value={generatedMessage}
                    onChange={(e) => setGeneratedMessage(e.target.value)}
                    placeholder="Generate a message or type your custom invitation message here..."
                    className="w-full px-4 py-3 bg-white border-2 border-neutral-300 rounded-lg text-sm font-medium shadow-sm focus:ring-2 focus:ring-black focus:border-black outline-none resize-y min-h-[200px] font-mono text-xs transition-all"
                    rows={10}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4">
                  {/* Generate Message Button (Left) */}
                  <button
                    onClick={handleGenerateMessage}
                    disabled={
                      isGeneratingMessage || 
                      !applicant.email || 
                      (messageStyle === 'default' && hasGeneratedOnce) // Lock for default style after first generation
                    }
                    className="flex-1 px-6 py-4 bg-neutral-900 text-white text-sm font-black uppercase tracking-widest rounded-lg hover:bg-black transition-all disabled:bg-neutral-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {isGeneratingMessage ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {hasGeneratedOnce ? 'Regenerating...' : 'Generating...'}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {hasGeneratedOnce ? 'Regenerate Message' : 'Generate Message'}
                      </>
                    )}
                  </button>

                  {/* Send Invitation Button (Right) */}
                  <button
                    onClick={handleSendInvitation}
                    disabled={isSendingInvitation || !applicant.email || !generatedSubject.trim() || !generatedMessage.trim()}
                    className="flex-1 px-6 py-4 bg-black text-white text-sm font-black uppercase tracking-widest rounded-lg hover:bg-neutral-800 transition-all disabled:bg-neutral-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {isSendingInvitation ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send Invitation
                      </>
                    )}
                  </button>
                </div>

                {/* Toast Notification */}
                {showToast && invitationStatus && (
                  <div 
                    className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl min-w-[320px] max-w-[500px] transform transition-all duration-300 ${
                      invitationStatus.type === 'success' 
                        ? 'bg-green-500 text-white' 
                        : invitationStatus.type === 'warning'
                        ? 'bg-yellow-500 text-white'
                        : invitationStatus.type === 'critical'
                        ? 'bg-orange-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                    style={{ 
                      animation: 'slideInRight 0.3s ease-out',
                      boxShadow: invitationStatus.type === 'critical' 
                        ? '0 10px 25px -5px rgba(255, 140, 0, 0.5), 0 0 20px rgba(255, 140, 0, 0.3)'
                        : '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <p className="text-sm font-medium flex-1">{invitationStatus.message}</p>
                    <button
                      onClick={() => setShowToast(false)}
                      className="ml-2 text-white hover:text-white/80 transition-colors flex-shrink-0"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {!applicant.email && (
                  <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
                    <p className="text-sm font-medium">
                      No email address available. Cannot send invitation.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Email Activity Log - Only for pre-verified accounts */}
          {applicant.isPreVerified && (
            <section className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm">
              <h2 className="text-sm font-black mb-6 text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
                Email Activity Log
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/50 text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200">
                      <th className="px-6 py-4">Activity</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Time</th>
                      <th className="px-6 py-4 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {applicant.emailGeneratedAt && (
                      <tr className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-sm font-medium text-neutral-700">Email Generated</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 font-medium">
                            {new Date(applicant.emailGeneratedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-500 font-mono">
                            {new Date(applicant.emailGeneratedAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: false 
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs text-neutral-400">—</span>
                        </td>
                      </tr>
                    )}
                    
                    {applicant.emailSentAt && (
                      <tr className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-sm font-medium text-neutral-700">Email Sent</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 font-medium">
                            {new Date(applicant.emailSentAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-500 font-mono">
                            {new Date(applicant.emailSentAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: false 
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs text-neutral-400">—</span>
                        </td>
                      </tr>
                    )}
                    
                    {applicant.emailOpenedAt && (
                      <tr className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                            <span className="text-sm font-medium text-neutral-700">Email Opened</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 font-medium">
                            {new Date(applicant.emailOpenedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-500 font-mono">
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
                      <tr className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-sm font-medium text-neutral-700">Link Clicked</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 font-medium">
                            {new Date(applicant.linkClickedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-500 font-mono">
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
                      <tr className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-sm font-medium text-neutral-700">Account Verified</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-600 font-medium">
                            {new Date(applicant.accountClaimedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-500 font-mono">
                            {new Date(applicant.accountClaimedAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: false 
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs text-neutral-400">—</span>
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
            <section className="bg-white p-10 rounded-xl border border-neutral-200 shadow-sm">
              <h2 className="text-sm font-black mb-8 text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
                Documentary Evidence
              </h2>
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Government ID Scan</label>
                  <div className="relative aspect-[4/3] bg-neutral-100 rounded-lg overflow-hidden group border border-neutral-200 cursor-zoom-in">
                    <img src={applicant.idDocumentUrl} className="w-full h-full object-cover transition-all duration-500 opacity-90 group-hover:opacity-100" alt="ID" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-[2px]">
                      <span className="px-6 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">Verify Original</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Financial Statements</label>
                  <div className="relative aspect-[4/3] bg-neutral-100 rounded-lg overflow-hidden group border border-neutral-200 cursor-zoom-in">
                    <img src={applicant.taxDocumentUrl} className="w-full h-full object-cover transition-all duration-500 opacity-90 group-hover:opacity-100" alt="Tax" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-[2px]">
                      <span className="px-6 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">Verify Original</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Shareholder Match Finder - Only show for non-pre-verified accounts */}
          {!applicant.isPreVerified && (
            <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-8">
              <div className="mb-6">
                <h2 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
                  Shareholder Match Finder
                </h2>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">
                  Verify Registration ID Against Shareholders Registry
                </p>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">
                    Registration ID
                  </label>
                  <input
                    type="text"
                    value={registrationId}
                    onChange={(e) => setRegistrationId(e.target.value)}
                    onFocus={handleInputFocus}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-md text-sm font-semibold text-neutral-900 focus:ring-2 focus:ring-[#082b4a] focus:border-[#082b4a] outline-none transition-all"
                    placeholder="Click to auto-fill registration ID"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleFindMatch}
                    disabled={isSearching || !registrationId.trim()}
                    className="px-6 py-2.5 text-sm font-semibold text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#082b4a' }}
                    onMouseEnter={(e) => !isSearching && !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#061d33')}
                    onMouseLeave={(e) => !isSearching && (e.currentTarget.style.backgroundColor = '#082b4a')}
                  >
                    Find Match
                  </button>
                </div>
              </div>

              {/* Loading Indicator */}
              {isSearching && (
                <div className="mb-6 flex items-center gap-3 p-4 bg-neutral-50 border border-neutral-200 rounded-md">
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 border-2 border-[#082b4a] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-sm font-semibold text-neutral-700">
                    {loadingMessages[loadingMessageIndex]}
                  </p>
                </div>
              )}

              {/* Match Results - Only show after search completes */}
              {!isSearching && matchedShareholder && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-green-900 uppercase tracking-wide mb-1">Match Found</h3>
                        <p className="text-xs text-green-700">Registration ID verified in shareholders registry</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[9px] font-black text-green-700 uppercase tracking-widest mb-1">
                        Company Name
                      </label>
                      <p className="text-sm font-bold text-green-900">{matchedShareholder.name}</p>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-green-700 uppercase tracking-widest mb-1">
                        Investor ID
                      </label>
                      <p className="text-sm font-bold text-green-900 font-mono">{matchedShareholder.id}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowMatchDetails(!showMatchDetails)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={showMatchDetails ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                    </svg>
                    {showMatchDetails ? 'Hide Details' : 'More Details'}
                  </button>

                  {/* Expanded Details */}
                  {showMatchDetails && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-black text-green-700 uppercase tracking-widest mb-1">
                            Holdings
                          </label>
                          <p className="text-sm font-bold text-green-900">{matchedShareholder.holdings.toLocaleString()} shares</p>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-green-700 uppercase tracking-widest mb-1">
                            Stake Percentage
                          </label>
                          <p className="text-sm font-bold text-green-900">{matchedShareholder.stake.toFixed(5)}%</p>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-green-700 uppercase tracking-widest mb-1">
                            Rank
                          </label>
                          <p className="text-sm font-bold text-green-900">#{matchedShareholder.rank}</p>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-green-700 uppercase tracking-widest mb-1">
                            Account Type
                          </label>
                          <p className="text-sm font-bold text-green-900">{matchedShareholder.accountType}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] font-black text-green-700 uppercase tracking-widest mb-1">
                            Corporate Address
                          </label>
                          <p className="text-sm font-bold text-green-900">{matchedShareholder.coAddress}</p>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-green-700 uppercase tracking-widest mb-1">
                            Country
                          </label>
                          <p className="text-sm font-bold text-green-900">{matchedShareholder.country}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No Match Found - Only show after search has been performed */}
              {!isSearching && hasSearched && registrationId && !matchedShareholder && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-red-900 uppercase tracking-wide mb-1">No Match Found</h3>
                      <p className="text-xs text-red-700">Registration ID not found in shareholders registry</p>
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
};

export default ApplicantDetail;
