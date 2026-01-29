# Investors - Holdings Verification Workflow

This document outlines the complete workflow for investor holdings verification, including registration, email confirmation, holdings submission, automatic verification, manual IRO review, and final verification status.

---

## Phase 1: Registration and Email Confirmation

### Step 1: Basic User Registration
The user provides their First and Last Name, Email, and Contact Number, or registers through a Google/Microsoft account.

### Step 2: Verify Email Address
The system sends a 6-digit code via email to confirm ownership of the account.

**Sample Template:** *"Hello {{first_name}}, your email verification code is: {{otp_code}}. This code will expire in 1 hour."*

**Decision Point (Verification Consent):** The user is asked if they want to verify their account for the investor community and updates.

- **No:** The user is directed to the dynamic home page as an **unverified account**.
- **Yes:** Proceed to Step 3.

---

## Phase 2: Holdings Submission and Lockout Validation

### Step 3: Holdings Registration
The user enters their Registration/shareholdings ID and the Company Name.

**Decision Point (Block?):** The system checks the **Lockout Enforcement Logic**.

**Lockout Enforcement Logic:**
To prevent duplicate registrations, if an account is locked and a user attempts to register using a different email, phone number, or name, the system will block the attempt and notify the user that the email/phone/name is locked for 7 days, including how many days remain before they can register again.

**Notification:** The user is notified that the ID is locked for 7 days, including a countdown of remaining days.

- **Yes (Blocked):** Directed to the dynamic home page (unverified).
- **No (Not Blocked):** Proceed to Step 4.

---

## Phase 3: Automated and Manual Verification

### Step 4: Automatic Verification (Fast Initial)
The system automatically cross-references the ID, Company Name, and Country (if provided) against records.

**Matching Criteria:**
- **Shareholdings ID:** Must match exactly (normalized: trimmed, extra spaces collapsed)
- **Company Name:** Must match exactly (normalized: trimmed, extra spaces collapsed, converted to UPPERCASE)
- **Country:** Only checked if provided by user (normalized: trimmed, extra spaces collapsed, converted to UPPERCASE)

**Decision Point (Match?):**

- **Pending:** If not immediately resolved, it moves to the next check.
- **Not Match:** The system notifies the user to double-check their information.
  - **Failure Rule:** After **three (3) failed attempts**, the user is locked out and may only request verification again after seven (7) days.
  - **Resubmit?** 
    - If the user chooses "Yes," they can resubmit corrected information. The system will run automatic verification again, and the failed attempts counter increments.
    - If the user chooses "No," they are sent to the dynamic home page as an unverified account.
- **Match:** Proceed to Step 5.

**Status Updates:**
- **Match Found:** Status set to `AWAITING_IRO_REVIEW` (FURTHER_INFO), failed attempts reset to 0, lockout cleared (if previously locked).
- **No Match Found:** Status set to `UNVERIFIED` (PENDING), failed attempts incremented, lockout applied after 3 failures.

### Step 5: Manual IRO Verification (Final)
An Investor Relations Officer (IRO) manually reviews the information for accuracy.

**IRO Decision Options:**
- **Approve:** Proceed to Step 6 (Verified Account)
- **Reject:** Re-enters the "Not Match" notification and failure rule cycle
  - After **three (3) IRO rejections**, the user is locked out for 7 days
- **Request Info:** User remains in `AWAITING_IRO_REVIEW` state, can resubmit additional information

**Decision Point (Match?):**

- **Not Match:** Re-enters the "Not Match" notification and failure rule cycle.
- **Match:** Proceed to Step 6.

**Status Updates:**
- **IRO Approves:** Status set to `APPROVED`, workflow status becomes `VERIFIED`, `step6.verifiedAt` timestamp recorded.
- **IRO Rejects:** Status set to `UNVERIFIED` (PENDING), failed attempts incremented, lockout applied after 3 rejections.

---

## Phase 4: Final Verification Status

### Step 6: Verified Account
The system informs the user via the dynamic home page that their account is now verified.

**Sample Template:** *"Hello {{first_name}}, Your account has been successfully verified. You can now access all features available to verified investors."*

**Status:** `VERIFIED` - User has full access to verified investor features and holdings information.

---

## Workflow Status Mapping

| **AUTOMATIC/MANUAL** | **INTERNAL STATE**         | **STATUS IN FRONTEND**          | **GENERAL ACCOUNT STATUS** | **DESCRIPTION**                                                                                                                                                                                                                               |
| -------------------- | -------------------------- | ------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTOMATIC (SYSTEM)   | EMAIL_VERIFICATION_PENDING | VERIFY EMAIL                    | UNVERIFIED                 | User has completed basic registration and is required to enter a 6-digit email verification code to confirm email ownership.                                                                                                                  |
| AUTOMATIC (SYSTEM)   | EMAIL_VERIFIED             | VERIFIED EMAIL NOTIFICATION     | UNVERIFIED                 | User successfully input the correct 6-digit code that was sent to them via email                                                                                                                                                              |
| AUTOMATIC(SYSTEM)    | SHAREHOLDINGS_DECLINED     | VERIFY YOUR ACCOUNT             | UNVERIFIED                 | User declined the optional shareholdings verification process after completing email verification.                                                                                                                                            |
| AUTOMATIC(SYSTEM)    | REGISTRATION_PENDING       | CONTINUE TO VERIFY YOUR ACCOUNT | PENDING                    | User agreed to proceed with shareholdings verification but did not complete or canceled the submission of required shareholding information.                                                                                                  |
| MANUAL(IRO/IR)       | AWAITING_IRO_REVIEW        | PENDING                         | PENDING                    | Automatic verification successfully matched the submitted information, and the application is now awaiting manual review and approval by an IRO/IR                                                                                            |
| MANUAL(IRO/IR)       | RESUBMISSION_REQUIRED      | VERIFY YOUR ACCOUNT             | UNVERIFIED                 | The IRO identified discrepancies in the submitted information and has requested the user to correct and resubmit their shareholding details.                                                                                                  |
| AUTOMATIC/MANUAL     | LOCKED_FOR_7_DAYS          | VERIFY YOUR ACCOUNT             | UNVERIFIED                 | After three failed automatic verification attempts or IRO rejection, the account is temporarily locked for seven (7) days. A countdown is tracked internally. Upon expiration, the account remains unverified and may reattempt verification. |
| MANUAL(IRO/IR)       | AWAITING_IRO_REVIEW        | PENDING                         | PENDING                    | User resubmitted their application. Automatic verification is skipped, and the submission is sent directly for manual review by the IRO/IR team.                                                                                              |
| MANUAL(IRO/IR)       | VERIFIED                   | VERIFIED                        | VERIFIED                   | The IRO has approved the shareholdings verification. The user has successfully completed all verification steps and the account is fully verified.                                                                                            |

### Registration Status (Backend)
- `PENDING` - Unverified account (maps to UNVERIFIED in frontend)
- `FURTHER_INFO` - Awaiting IRO review (maps to PENDING in frontend)
- `APPROVED` - Verified account (maps to VERIFIED in frontend)
- `REJECTED` - Rejected by IRO (maps to UNVERIFIED in frontend)

---

## Lockout Enforcement Details

### When Lockout is Applied
1. **After 3 failed automatic verification attempts (Step 4)**
2. **After 3 IRO rejections (Step 5)**

### Lockout Behavior
- **Duration:** 7 days from the last failed attempt/rejection
- **Status:** User's status is set to `UNVERIFIED` (PENDING) on both frontend and backend
- **Prevention:** System blocks new registrations using the same email, phone number, or name during lockout period
- **Notification:** User is informed of remaining lockout days if attempting to register with different contact information

### Resubmission Rules
- **First-time submission:** Automatic verification runs immediately
- **Resubmission after IRO rejection:** Automatic verification is skipped, goes directly to IRO review
- **Resubmission after auto-verification failure:** Automatic verification runs again
- **Locked account:** Cannot resubmit until lockout expires

---

## Key Features

1. **Duplicate Registration Prevention:** System checks for locked accounts before allowing new registrations
2. **Automatic Verification:** Fast initial check against Shareholders Registry
3. **Manual IRO Review:** Final verification step for accuracy
4. **Lockout Protection:** Prevents abuse and ensures data integrity
5. **Status Tracking:** Comprehensive workflow status mapping for all stages
6. **User Notifications:** Clear feedback at each decision point

---

## Notes

- Email templates are stored in Brevo and referenced by template ID
- Country field is optional and only used for profile display, not verification matching (unless provided)
- Normalization ensures case-insensitive matching for company names and countries
- Failed attempts counter resets to 0 on successful match
- Lockout is cleared automatically when a match is found

