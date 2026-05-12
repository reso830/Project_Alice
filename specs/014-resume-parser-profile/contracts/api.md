# API Contract: Resume Parse Endpoint

**Feature**: `014-resume-parser-profile`

---

## POST /api/resume/parse

Accepts a resume file upload, extracts text, and returns structured profile data.
The file is processed in memory and discarded within the request cycle.

### Request

```
POST /api/resume/parse
Content-Type: multipart/form-data

Field: resume  (file)
```

| Constraint | Value |
|---|---|
| Field name | `resume` |
| Max file size | 5 MB (5,242,880 bytes) |
| Accepted MIME types | `application/pdf` |
| | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| | `text/plain` |

### Success Response

```
HTTP 200 OK
Content-Type: application/json

{
  "data": {
    "firstName": "Jane" | null,
    "lastName": "Smith" | null,
    "email": "jane@example.com" | null,
    "phone": "+1 555 123 4567" | null,
    "city": "San Francisco, CA" | null,
    "summary": "Experienced engineer..." | null,
    "experience": [
      {
        "role": "Senior Engineer",
        "company": "Acme Corp",
        "responsibilities": "Led backend services...",
        "dateStarted": "03/2020",
        "dateEnded": "01/2023",
        "currentWork": false
      }
    ],
    "education": [
      {
        "degreeMajor": "B.S. Computer Science",
        "university": "State University",
        "yearCompleted": "2019"
      }
    ],
    "skills": ["JavaScript", "Node.js", "React"],
    "certifications": [
      {
        "name": "AWS Solutions Architect",
        "issuingBody": "Amazon Web Services",
        "issuanceDate": "06/2022",
        "expiryDate": "06/2025"
      }
    ],
    "awards": [
      {
        "awardName": "Employee of the Year",
        "issuingBody": "Acme Corp",
        "details": "Recognized for...",
        "date": "12/2021"
      }
    ],
    "languages": [
      { "language": "Spanish", "proficiency": "Intermediate" }
    ],
    "links": [
      { "url": "https://linkedin.com/in/janesmith", "friendlyName": "LinkedIn" }
    ]
  }
}
```

A response where all scalar fields are null and all arrays are empty indicates
a complete parse failure. The server still returns HTTP 200 in this case.
The client is responsible for detecting this condition and showing the error state.

### Error Responses

```
HTTP 400 Bad Request — No file uploaded
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "No resume file provided."
  }
}

HTTP 400 Bad Request — Unsupported file type
{
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "Unsupported file type. Please upload a PDF, DOCX, or TXT file."
  }
}

HTTP 400 Bad Request — File too large (multer LIMIT_FILE_SIZE)
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File exceeds the 5 MB size limit."
  }
}

HTTP 500 Internal Server Error — Extraction failure
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to process the resume file."
  }
}
```

---

## Notes

- The server does not store the file or any extracted text after the response is sent.
- The endpoint has no authentication in V1 (consistent with the rest of the API).
- The `data` object shape matches `ParsedProfileData` in `data-model.md`.
- Null fields in the response indicate the parser did not find a value; they do not
  indicate an error.
