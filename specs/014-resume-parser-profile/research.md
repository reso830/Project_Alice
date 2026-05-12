# Research: Library Choices for Resume Parsing

**Feature**: `014-resume-parser-profile`

---

## PDF Text Extraction

### Options Evaluated

| Library | Approach | Notes |
|---|---|---|
| `pdf-parse` | Pure JS, uses PDF.js core | Simple Buffer API; no native bindings; actively maintained; ~50k weekly downloads |
| `pdfjs-dist` | Full PDF.js for Node | Designed for browser; larger bundle; more complex API for server-side use |
| `pdf2json` | Wraps Poppler | Native dependency; more complex install |
| `pdfreader` | Row/cell based output | Better for tables; not ideal for unstructured resume text |

**Selected**: `pdf-parse`

**Rationale**: Simple `pdf-parse(buffer)` API returns `{ text }`. No native bindings
means no platform-specific install issues. Handles standard text-based PDFs. Image-based
PDFs return empty text — this is expected and handled by the graceful failure path
(OCR is explicitly out of scope for V1).

**Known issue**: `pdf-parse` emits a deprecation warning in some Node 20+ environments
related to `fs.readFileSync` usage in test mode. This only affects test runs that
import the module; the warning does not appear in production usage. Workaround: mock
the module in server tests or suppress with `--no-warnings` in the test script.

---

## DOCX Text Extraction

### Options Evaluated

| Library | Approach | Notes |
|---|---|---|
| `mammoth` | Converts DOCX → HTML or raw text | Excellent formatting stripping; widely used; ~200k weekly downloads |
| `docx` | Primarily a DOCX *creator* | Parsing support is secondary and limited |
| `docxtemplater` | Template-based DOCX manipulation | Not suited for extraction |
| `officegen` | Office document generation | Not suited for extraction |

**Selected**: `mammoth`

**Rationale**: `mammoth.extractRawText({ buffer })` returns clean plain text with
minimal boilerplate. Handles embedded lists and basic formatting gracefully.
Well-maintained, no native dependencies.

---

## Multipart Form-Data (Server)

### Options Evaluated

| Library | Approach | Notes |
|---|---|---|
| `multer` | High-level middleware for Express | Memory and disk storage modes; simple API; ~4M weekly downloads |
| `busboy` | Low-level streaming parser | More flexible but requires more code; no built-in storage abstraction |
| `formidable` | Standalone parser | Heavier; disk-write by default; requires extra config for memory-only |
| `express-fileupload` | Wrapper around busboy | Simpler API than busboy; less flexible than multer |

**Selected**: `multer` with `multer.memoryStorage()`

**Rationale**: `memoryStorage()` holds the file in a `Buffer` in RAM — nothing is
written to disk. For files up to 5 MB this is appropriate. The `limits.fileSize`
option enforces the size constraint at the middleware level. Error type
`MulterError.LIMIT_FILE_SIZE` maps cleanly to a 400 response.

**Memory consideration**: A 5 MB file buffer held per concurrent request. For a
local-first app with a single user, this is negligible.

---

## No Frontend Dependencies

The frontend requires no new packages:
- File validation: native `File` API (type, size)
- Upload: native `fetch` with `FormData`
- Drag-and-drop: native browser drag events
- UI: follows existing component patterns in `src/components/`
