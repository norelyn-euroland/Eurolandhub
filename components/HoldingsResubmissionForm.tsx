'use client';

import React, { useState, useEffect } from 'react';
import { applicantService } from '../lib/firestore-service';
import { submitShareholdingInfo } from '../lib/shareholdingsVerification';
import { MOCK_SHAREHOLDERS } from '../lib/mockShareholders';
import { Applicant, RegistrationStatus } from '../lib/types';
import { getWorkflowStatusInternal } from '../lib/shareholdingsVerification';

interface HoldingsResubmissionFormProps {
  applicant: Applicant;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const HoldingsResubmissionForm: React.FC<HoldingsResubmissionFormProps> = ({ 
  applicant, 
  onSuccess,
  onError 
}) => {
  const [formData, setFormData] = useState({
    registrationId: applicant.shareholdingsVerification?.step2?.shareholdingsId || '',
    holdings: applicant.holdingsRecord?.sharesHeld?.toString() || '',
    stake: applicant.holdingsRecord?.ownershipPercentage?.toString() || '',
    ownership: applicant.holdingsRecord?.ownershipPercentage?.toString() || '',
    accountType: applicant.holdingsRecord?.sharesClass || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if user has a pending IRO request
  const workflowStatus = getWorkflowStatusInternal(applicant);
  const hasPendingRequest = 
    applicant.status === RegistrationStatus.FURTHER_INFO || 
    applicant.status === RegistrationStatus.REJECTED ||
    workflowStatus === 'AWAITING_USER_RESPONSE';

  const iroDecision = applicant.shareholdingsVerification?.step4?.iroDecision;
  const needsResubmission = iroDecision && 
    (iroDecision.decision === 'REJECTED' || iroDecision.decision === 'REQUEST_INFO') &&
    iroDecision.complianceStatus === 'AWAITING_USER_RESPONSE';

  // If no pending request, don't show the form
  if (!hasPendingRequest && !needsResubmission) {
    return null;
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Registration ID validation (6 digits)
    if (!formData.registrationId.trim()) {
      newErrors.registrationId = 'Registration ID is required';
    } else if (!/^\d{6}$/.test(formData.registrationId.trim())) {
      newErrors.registrationId = 'Registration ID must be exactly 6 digits';
    }

    // Holdings validation (must be a number)
    if (!formData.holdings.trim()) {
      newErrors.holdings = 'Holdings is required';
    } else if (isNaN(Number(formData.holdings)) || Number(formData.holdings) < 0) {
      newErrors.holdings = 'Holdings must be a valid positive number';
    }

    // Stake % validation
    if (!formData.stake.trim()) {
      newErrors.stake = 'Stake % is required';
    } else if (isNaN(Number(formData.stake)) || Number(formData.stake) < 0 || Number(formData.stake) > 100) {
      newErrors.stake = 'Stake % must be a number between 0 and 100';
    }

    // Ownership % validation
    if (!formData.ownership.trim()) {
      newErrors.ownership = 'Ownership % is required';
    } else if (isNaN(Number(formData.ownership)) || Number(formData.ownership) < 0 || Number(formData.ownership) > 100) {
      newErrors.ownership = 'Ownership % must be a number between 0 and 100';
    }

    // Account Type validation
    if (!formData.accountType) {
      newErrors.accountType = 'Account Type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Get company name from existing data (required by submitShareholdingInfo)
      const companyName = applicant.shareholdingsVerification?.step2?.companyName || applicant.fullName;

      // Update holdings information using submitShareholdingInfo
      // This will automatically handle compliance tracking
      const updatedApplicant = submitShareholdingInfo(
        applicant,
        {
          shareholdingsId: formData.registrationId.trim(),
          companyName: companyName,
          country: applicant.shareholdingsVerification?.step2?.country,
        },
        MOCK_SHAREHOLDERS // Pass shareholders for auto-verification if needed
      );

      // Update holdings record with new values
      const updatedWithHoldings = {
        ...updatedApplicant,
        holdingsRecord: {
          ...updatedApplicant.holdingsRecord,
          companyId: formData.registrationId.trim(),
          sharesHeld: Number(formData.holdings),
          ownershipPercentage: Number(formData.ownership),
          sharesClass: formData.accountType,
          companyName: companyName,
          registrationDate: new Date().toISOString(),
        },
      };

      // Save to Firestore
      await applicantService.update(applicant.id, updatedWithHoldings);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to submit holdings resubmission:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit holdings information';
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-8">
      <div className="mb-6">
        <h2 className="text-lg font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-widest mb-2">
          Update Holdings Information
        </h2>
        {iroDecision?.decision === 'REQUEST_INFO' && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Our Investor Relations team has requested additional information. Please update your holdings details below.
          </p>
        )}
        {iroDecision?.decision === 'REJECTED' && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Your previous submission was not approved. Please review and update your holdings information below.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Registration ID */}
          <div>
            <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
              Registration ID <span className="text-red-500">*</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">(6 digits only)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={formData.registrationId}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                handleChange('registrationId', value);
              }}
              placeholder="e.g. 130965"
              className={`w-full px-4 py-2.5 border rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-[#082b4a] dark:focus:border-[#00adf0] outline-none transition-all ${
                errors.registrationId ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {errors.registrationId && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.registrationId}</p>
            )}
          </div>

          {/* Holdings */}
          <div>
            <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
              Holdings <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.holdings}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d.]/g, '');
                handleChange('holdings', value);
              }}
              placeholder="Number of shares"
              className={`w-full px-4 py-2.5 border rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-[#082b4a] dark:focus:border-[#00adf0] outline-none transition-all ${
                errors.holdings ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {errors.holdings && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.holdings}</p>
            )}
          </div>

          {/* Stake %} */}
          <div>
            <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
              Stake % <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.stake}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d.]/g, '');
                handleChange('stake', value);
              }}
              placeholder="0.00"
              className={`w-full px-4 py-2.5 border rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-[#082b4a] dark:focus:border-[#00adf0] outline-none transition-all ${
                errors.stake ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {errors.stake && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.stake}</p>
            )}
          </div>

          {/* Ownership %} */}
          <div>
            <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
              Ownership % <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.ownership}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d.]/g, '');
                handleChange('ownership', value);
              }}
              placeholder="0.00"
              className={`w-full px-4 py-2.5 border rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-[#082b4a] dark:focus:border-[#00adf0] outline-none transition-all ${
                errors.ownership ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            {errors.ownership && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.ownership}</p>
            )}
          </div>

          {/* Account Type */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
              Account Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.accountType}
              onChange={(e) => handleChange('accountType', e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-[#082b4a] dark:focus:border-[#00adf0] outline-none transition-all ${
                errors.accountType ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              <option value="">Select Account Type</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="JOINT">Joint</option>
              <option value="TRUST">Trust</option>
              <option value="CORPORATE">Corporate</option>
              <option value="ORDINARY">Ordinary</option>
              <option value="NOMINEE">Nominee</option>
            </select>
            {errors.accountType && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.accountType}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-[#082b4a] dark:bg-[#00adf0] text-white font-semibold rounded-md hover:bg-[#0a3a5a] dark:hover:bg-[#0099d6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Holdings Information'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HoldingsResubmissionForm;

