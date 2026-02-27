# Investors - Holdings Verification Workflow

This document outlines the complete 6-step workflow for investor holdings verification, including registration, email confirmation, holdings submission, automatic verification, manual IRO review, and final verification status.

---

## **User Registration & Verification Workflow**

### **Step 1: Basic User Registration**

The process begins with the user providing basic identification details:

* **Required Data:** First & Last Name, Email, and Contact Number.
* **OAuth Options:** Alternative registration via Google or Microsoft accounts.

### **Step 2: Email Verification (Frontend)**

To confirm identity and prevent bot registrations:

* The system sends a **6-digit code** to the user's email.
* The user must enter this code on the frontend to proceed.
* **Note:** This step is handled entirely by the frontend and is not tracked in the backend workflow state.

**Decision Point (Verification Consent):** After email verification, the user is asked if they want to verify their account for the Investor community and updates.

- **No:** The user is directed to the Dynamic Home Page as an **Unverified Account**.
- **Yes:** Proceed to Step 3.

---

### **Step 3: Holdings Registration**

The user provides specific investment data for verification:

* **Required Data:** Registration/Shareholdings ID and Company Name/Name.

**Decision Point (Block?):** The system checks the **Lockout Enforcement Logic** before processing the submission.

**Lockout Enforcement Logic:**
To prevent duplicate registrations, if an account is locked and a user attempts to register using a different email, phone number, or name, the system will block the attempt and notify the user that the email/phone/name is locked for 7 days, including how many days remain before they can register again.

**Notification:** The user is notified that the ID is locked for 7 days, including a countdown of remaining days.

- **Yes (Blocked):** Directed to the Dynamic Home Page (unverified).
- **No (Not Blocked):** Proceed to Step 4.

---

### **Step 4: Automatic Verification (Fast Initial)**

The system performs an automated cross-reference:

* The system checks the ID and Company Name against existing records.
* If a country is provided, it is also validated.

**Matching Criteria:**
- **Shareholdings ID:** Must match exactly (normalized: trimmed, extra spaces collapsed)
- **Company Name:** Must match exactly (normalized: trimmed, extra spaces collapsed, converted to UPPERCASE)
- **Country:** Only checked if provided by user (normalized: trimmed, extra spaces collapsed, converted to UPPERCASE)

**Decision Point (Match?):**

- **Match:** Proceed directly to Step 5.
- **No Match:** The user is notified that their ID does not match and is asked to double-check.
  - **User Options:**
    - **Request Manual Verification:** User can request manual IRO checking (bypasses resubmission)
      - Status changes to `AWAITING_IRO_REVIEW` (FURTHER_INFO)
      - Goes directly to Step 5 (Manual IRO Verification)
    - **Resubmit:** User can correct and resubmit information
      - Automatic verification runs again
      - Failed attempts counter increments
  - **Retry Logic:** If the user fails **3 times**, they are locked out for 7 days
  - **After 3 failed attempts:** User is locked out for 7 days but may still request manual verification (if not locked)

**Status Updates:**
- **Match Found:** Status set to `AWAITING_IRO_REVIEW` (FURTHER_INFO), failed attempts reset to 0, lockout cleared (if previously locked).
- **No Match Found:** Status set to `RESUBMISSION_REQUIRED` (PENDING), failed attempts incremented, lockout applied after 3 failures.
- **Manual Verification Requested:** Status set to `AWAITING_IRO_REVIEW` (FURTHER_INFO), submission goes directly to Step 5.

---

### **Step 5: Manual IRO Verification (Final)**

For accounts that fail auto-verification or require higher-level clearance:

* An **Investor Relations Officer (IRO)** manually reviews the submitted information.
* The IRO confirms if the data matches the internal registry.

**IRO Decision Options:**
- **Approve:** Proceed to Step 6 (Verified Account)
- **Reject:** User needs to resubmit corrected information
  - After **three (3) IRO rejections**, the user is locked out for 7 days
- **Request Info:** User remains in `AWAITING_IRO_REVIEW` state, can resubmit additional information

**Status Updates:**
- **IRO Approves:** Status set to `APPROVED`, workflow status becomes `VERIFIED`, `step6.verifiedAt` timestamp recorded.
- **IRO Rejects:** Status set to `UNVERIFIED` (PENDING), failed attempts incremented, lockout applied after 3 rejections.

---

### **Step 6: Verified Account**

Once cleared by the IRO or the automated system:

* The user is notified via the Dynamic Home Page and email.
* **Status:** The account is now "Verified."
* **Sample Email Content:** *"Hello {{ first_name }}, your account has been successfully verified. You can now access all features available to verified investors."*

---

## **Security & Guardrails**

### **Lockout Enforcement Logic**

To prevent duplicate registrations and system abuse:

* **Trigger:** If an account is locked and the user attempts to register using a different email or phone number.
* **Action:** The system blocks the attempt.
* **Penalty:** The email or phone number is **locked for 7 days**. The system notifies the user of the remaining lockout duration before they can try again.

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

