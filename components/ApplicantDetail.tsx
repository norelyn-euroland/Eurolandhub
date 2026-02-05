
'use client';

import React, { useState, useEffect } from 'react';
import { Applicant, RegistrationStatus } from '../lib/types';
import { MOCK_SHAREHOLDERS } from '../lib/mockShareholders';
import { applicantService } from '../lib/firestore-service';
import Tooltip from './Tooltip';

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

  // Helper to get system status display label
  const getSystemStatusLabel = (status?: string): string => {
    if (!status) return 'N/A';
    const statusMap: Record<string, string> = {
      'NULL': 'NULL',
      'ACTIVE': 'Active',
      'CLAIMED': 'Claimed',
      'INACTIVE': 'Inactive'
    };
    return statusMap[status] || status;
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

  const [shareholderQuery, setShareholderQuery] = useState('');
  const effectiveShareholderQuery = shareholderQuery.trim().toLowerCase();
  const filteredShareholders = MOCK_SHAREHOLDERS.filter((s) => {
    if (!effectiveShareholderQuery) return true;
    return (
      s.name.toLowerCase().includes(effectiveShareholderQuery) ||
      s.id.toLowerCase().includes(effectiveShareholderQuery)
    );
  });

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
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.FURTHER_INFO)}
              className="px-6 py-3 text-[11px] font-black border-2 border-neutral-200 rounded-lg uppercase tracking-widest hover:bg-neutral-50 hover:border-black transition-all"
            >
              Request Info
            </button>
            <button 
              onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.REJECTED)}
              className="px-6 py-3 text-[11px] font-black border-2 border-neutral-900 text-neutral-900 rounded-lg uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
            >
              Reject
            </button>
            <button 
              onClick={() => onUpdateStatus(applicant.id, RegistrationStatus.APPROVED)}
              className="px-8 py-3 text-[11px] font-black bg-black text-white rounded-lg uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-xl shadow-black/20"
            >
              Approve Registration
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
                { label: 'Legal name', value: applicant.fullName },
                { label: 'Email', value: applicant.email },
                { label: 'Contact Number', value: applicant.phoneNumber || 'Not provided' },
                ...(getCountryLabel() ? [{ label: 'Country', value: getCountryLabel() }] : []),
                { 
                  label: 'Registration ID', 
                  value: applicant.isPreVerified && applicant.registrationId 
                    ? (applicant.registrationId.length > 6 ? applicant.registrationId.slice(-6) : applicant.registrationId)
                    : applicant.id 
                },
                { label: 'Submission date', value: applicant.submissionDate },
                { label: 'Current status', value: getAuditStatusLabel(applicant.status) },
                ...(applicant.isPreVerified ? [
                  { label: 'Workflow Stage', value: getWorkflowStageLabel(applicant.workflowStage) },
                  { label: 'System Status', value: getSystemStatusLabel(applicant.systemStatus) }
                ] : [])
              ].map((item, idx) => (
                <div key={idx}>
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">{item.label}</label>
                  <p className="text-sm font-bold text-neutral-900">{item.value}</p>
                </div>
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
              
              <div className="space-y-4">
                {applicant.emailGeneratedAt && (
                  <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-sm font-medium text-neutral-700">Email generated</span>
                    </div>
                    <span className="text-xs text-neutral-500 font-mono">
                      {new Date(applicant.emailGeneratedAt).toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        hour12: false 
                      }).replace(',', '')}
                    </span>
                  </div>
                )}
                
                {applicant.emailSentAt && (
                  <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-neutral-700">Email sent</span>
                    </div>
                    <span className="text-xs text-neutral-500 font-mono">
                      {new Date(applicant.emailSentAt).toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        hour12: false 
                      }).replace(',', '')}
                    </span>
                  </div>
                )}
                
                {applicant.emailOpenedAt && (
                  <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <span className="text-sm font-medium text-neutral-700">
                        Email opened {applicant.emailOpenedCount && applicant.emailOpenedCount > 1 ? `(${applicant.emailOpenedCount} times)` : ''}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500 font-mono">
                      {new Date(applicant.emailOpenedAt).toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        hour12: false 
                      }).replace(',', '')}
                    </span>
                  </div>
                )}
                
                {applicant.linkClickedAt && (
                  <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span className="text-sm font-medium text-neutral-700">
                        Link clicked {applicant.linkClickedCount && applicant.linkClickedCount > 1 ? `(${applicant.linkClickedCount} times)` : ''}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500 font-mono">
                      {new Date(applicant.linkClickedAt).toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        hour12: false 
                      }).replace(',', '')}
                    </span>
                  </div>
                )}
                
                {applicant.accountClaimedAt && (
                  <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-sm font-medium text-neutral-700">Account verified</span>
                    </div>
                    <span className="text-xs text-neutral-500 font-mono">
                      {new Date(applicant.accountClaimedAt).toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        hour12: false 
                      }).replace(',', '')}
                    </span>
                  </div>
                )}
                
                {!applicant.emailGeneratedAt && !applicant.emailSentAt && (
                  <p className="text-sm text-neutral-400 italic">No activity recorded yet</p>
                )}
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

          {/* Shareholder Registry Table (Snapshot) - Only show for non-pre-verified accounts */}
          {!applicant.isPreVerified && (
            <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-neutral-100 flex items-start justify-between gap-6">
              <div>
                <h2 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-black rounded-full"></span>
                  Shareholders Registry
                </h2>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">
                  Registry Snapshot • Table View
                </p>
              </div>

              <div className="relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input
                  type="text"
                  placeholder="Search name or investor ID..."
                  value={shareholderQuery}
                  onChange={(e) => setShareholderQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[11px] focus:ring-1 focus:ring-black focus:border-black outline-none w-64 transition-all placeholder:text-neutral-400 font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/50 text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em] border-b border-neutral-200">
                    <th className="px-6 py-5 text-center w-16">Rank</th>
                    <th className="px-6 py-5">Holdings</th>
                    <th className="px-6 py-5">Stake %</th>
                    <th className="px-6 py-5">Investor ID</th>
                    <th className="px-6 py-5">Name</th>
                    <th className="px-6 py-5">CO address</th>
                    <th className="px-6 py-5">Country (post)</th>
                    <th className="px-6 py-5 text-right">Type of account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredShareholders.map((sh) => (
                    <tr key={sh.id} className="group hover:bg-neutral-50/80 transition-all cursor-default">
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center">
                          <span className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-black transition-colors ${sh.rank === 1 ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                            {sh.rank}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-black text-neutral-900 tracking-tight">
                          {sh.holdings.toLocaleString()}
                        </p>
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">Ordinary Shares</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-sm font-black text-neutral-900">{sh.stake.toFixed(5)}%</span>
                          <div className="w-16 h-1 bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full bg-neutral-900" style={{ width: `${Math.min(sh.stake * 2.5, 100)}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-black text-neutral-900 font-mono tracking-tighter bg-neutral-100 px-2.5 py-1 rounded border border-neutral-200">
                          {sh.id}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <Tooltip content={sh.name}>
                          <p className="text-sm font-bold text-neutral-900 uppercase truncate max-w-[200px]">{sh.name}</p>
                        </Tooltip>
                        <p className="text-[10px] text-neutral-400 font-medium italic">{sh.firstName || 'Primary Account Holder'}</p>
                      </td>
                      <td className="px-6 py-5">
                        <Tooltip content={sh.coAddress || 'Registered Office'}>
                          <span className="text-[10px] text-neutral-400 truncate max-w-[240px] block">
                            {sh.coAddress || 'Registered Office'}
                          </span>
                        </Tooltip>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs font-bold text-neutral-700">{sh.country}</span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="inline-block px-3 py-1 bg-neutral-100 text-[10px] font-black text-neutral-600 rounded-full uppercase tracking-widest border border-neutral-200 group-hover:bg-white transition-colors">
                          {sh.accountType}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          )}
      </div>
    </div>
    </>
  );
};

export default ApplicantDetail;
