# Feature Brief — 021-hosted-resume-import-security

## Summary
Secure the hosted resume import functionality for authenticated hosted users.

This feature focuses on protecting resume upload endpoints, enforcing authentication requirements, and ensuring uploaded files are processed safely without persistence.

---

## Goals
- Restrict hosted resume import to authenticated users only.
- Prevent uploaded resume persistence.
- Enforce upload validation and file limits.
- Provide clear error handling for invalid upload scenarios.

---

## Scope

### Authenticated Resume Import
Restrict resume parsing/upload functionality to authenticated hosted users.

Requirements:
- Unauthenticated users must not access parsing endpoints.
- Demo users must not access parsing endpoints.
- Authentication enforcement should occur server-side.

---

## File Validation
Supported file types:
- PDF
- DOCX
- TXT

Maximum file size:
- 5 MB

Requirements:
- Unsupported file types should fail clearly.
- Oversized uploads should fail clearly.
- Validation should happen before processing.

---

## In-Memory Processing
Uploaded resumes should:
- be processed in memory only
- not persist to storage
- not be stored in Supabase
- not remain on the server after processing

Requirements:
- Resume contents are temporary processing inputs only.
- Parsed structured data may still populate profile fields after confirmation.
- Raw uploaded files should never become persistent assets.

---

## Error Handling
Provide clear user-facing errors for:
- unauthenticated access
- unsupported file types
- oversized uploads
- parsing failures
- malformed files

Requirements:
- Errors should be actionable.
- Errors should not expose internal infrastructure details.

---

## Resume Import UX
Authenticated users should:
- continue using existing import workflow
- receive parsed profile autofill behavior

Demo/public users should:
- not see import functionality
or
- see disabled UI with explanation

---

## Security Expectations
Requirements:
- Service credentials remain server-side only.
- Parsing endpoints should never trust client-provided ownership.
- Upload validation should occur server-side.
- Temporary file handling should minimize exposure risk.

---

## Non-Goals
Out of scope:
- Resume storage/history
- OCR/image scanning
- Malware scanning systems
- Cloud file storage integration
- Resume export/download features

---

## Validation And Testing
Include:
- Authentication restriction tests
- File type validation tests
- File size validation tests
- In-memory processing verification
- Unauthorized upload attempt tests
- Demo-mode restriction tests
- Parsing failure handling tests

---

## Acceptance Criteria
- Resume import only works for authenticated users.
- Demo/public users cannot access parsing endpoints.
- Supported file limits are enforced.
- Uploaded resumes are never persisted.
- Clear validation and upload errors are displayed.
- Existing profile autofill workflow still functions.