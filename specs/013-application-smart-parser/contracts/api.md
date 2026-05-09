# API Contracts: Smart Application Creation Flow

**Branch**: `013-application-smart-parser` | **Date**: 2026-05-09

## Summary

This feature introduces **no new API endpoints**. The parser runs entirely client-side. The existing application create and update endpoints are reused without modification.

---

## Reused Endpoints

### POST /api/applications — Create Application

Used by `api.create()` in `Modal.saveDraft()`. Called unchanged when the user saves a parser-pre-populated application record.

**Request body** (unchanged — same shape as manual create):
```json
{
  "jobTitle": "string (required)",
  "companyName": "string (required)",
  "responsibilities": "string (required)",
  "status": "wishlisted | applied | phone_screen | interview | assessment | offer | rejected | withdrawn | ghosted",
  "lastStatusUpdate": "YYYY-MM-DD",
  "location": "string (optional)",
  "workSetup": "Remote | Hybrid | On-site | Field | '' (optional)",
  "shift": "Day | Mid | Night | Flexible | '' (optional)",
  "salary": "positive integer | null (optional)",
  "jobPostingUrl": "string URL | '' (optional)",
  "skills": ["string array (optional)"],
  "preferredSkills": ["string array (optional)"],
  "recruiter": "string (optional)",
  "compat": "integer 0–100 (optional)",
  "compatNotes": "string (optional)",
  "generalNotes": "string (optional)",
  "fav": "boolean (optional)"
}
```

**Response** (unchanged):
```json
{
  "id": "integer",
  "jobTitle": "string",
  "companyName": "string",
  "...": "all persisted fields"
}
```

---

## No New Contracts

The following are explicitly out of scope and require no contract definition:

| Potential contract | Reason not needed |
|---|---|
| Parser API endpoint | Parser is client-side only; no server call |
| URL scraping endpoint | Out of scope per spec |
| AI/LLM integration endpoint | Out of scope per spec |
