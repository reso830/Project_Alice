# Research: Smart Application Creation Flow

**Branch**: `013-application-smart-parser` | **Date**: 2026-05-09

## Decision Log

---

### 1. Parser Location — Client-Side vs Server Endpoint

**Decision**: Client-side only. The parser runs synchronously in the browser as a pure JS utility module with no network calls.

**Rationale**: The brief explicitly rules out external APIs and background jobs. Heuristic regex parsing of a short text string completes in well under 10ms — no async overhead is warranted. Running it client-side also satisfies the constitution's privacy constraint (no data leaves the device during extraction).

**Alternatives considered**:
- Server endpoint: Would enable heavier NLP in future, but adds a round-trip, a new route, and a server deployment concern for what is currently a local-first app. Rejected for MVP.
- Web Worker: Only useful if parsing blocks the main thread. For ≤10k character input with regex heuristics, blocking time is negligible. Rejected as premature.

---

### 2. Parser API Shape

**Decision**: Single exported function `parseJobPost(text)` returning a partial normalized application object. Each field is extracted by a dedicated private function.

**Rationale**: One public entry point keeps the module easy to mock in tests and easy to swap for an LLM-backed version later (same interface). Private extraction functions are independently unit-testable by feeding them directly in tests.

**Alternatives considered**:
- Class with `Parser.parse(text)`: More verbose, no practical benefit for a stateless operation.
- Multiple exports (one per field): More granular but forces callers to assemble the result themselves. Rejected in favor of a single composed result.

---

### 3. Prefill Mechanism in Modal

**Decision**: Add an optional `prefill` parameter to `Modal.open()` options. When present in create mode, prefill is spread over the normalized blank draft after `normalizeApplication({})` and before the modal renders.

**Rationale**: Zero impact on all existing call sites (they pass no `prefill`). The spread approach is consistent with how `copyApplication()` already merges normalized fields. No refactor of modal internals required.

**Alternatives considered**:
- New `Modal.openWithPrefill(data, callbacks)` function: Duplicate entry point with identical internals. Avoided in favor of a single optional param.
- CreationPicker calls `Modal`'s internal `_draft` directly: Breaks encapsulation. Rejected.

---

### 4. CreationPicker State Model

**Decision**: Two-view internal state machine (`'selection' | 'paste'`). State is local module-level variables, mirroring the pattern used by `Modal.js`. No external state library.

**Rationale**: The picker has exactly two views and no shared state with other components. Module-level variables (same pattern as Modal) are the simplest approach that works correctly.

**Alternatives considered**:
- Re-render entire overlay on each state change: Simpler logic but causes visible flicker between selection and paste views. Rejected for UX.
- Embed paste step inside Modal: Tightly couples the parser UX to the form component. The brief specifies the selection screen precedes the form. Rejected.

---

### 5. Extraction Heuristics — Field-by-Field Decisions

#### Company Name
- **Primary**: Label pattern — `Company:`, `Employer:`, `Organization:`
- **Secondary**: "About [Name]" section header
- **Tertiary**: "At [Name]," or "Join [Name]" sentence opener
- **Fallback**: Empty string (required-field validation surfaces the gap)

#### Job Title
- **Primary**: First non-empty line with substantial length (4–80 characters), not all-caps (which often indicates a section header), not starting with a bullet or number
- **Secondary**: Line immediately following a known heading like "Position:", "Role:", "Job Title:"
- **Fallback**: Empty string

#### Responsibilities
- **Primary**: Content of a section headed by: "Responsibilities", "What You'll Do", "Role Overview", "Job Description", "Your Role", "Duties", "About the Role", "What you will do"
- **Secondary**: Longest contiguous block of text not identified as a section header or bullet list
- **Fallback**: Empty string (required field — user must complete before saving)

#### Location
- **Primary**: "Location:" label followed by text on same line
- **Secondary**: "Based in:", "Office:", "City:"
- **Tertiary**: Known city/country name in first 500 characters
- **Fallback**: Empty string

#### Work Setup
- **Approach**: Case-insensitive keyword scan across full text
- **Keywords**: `remote` → "Remote"; `hybrid` → "Hybrid"; `on-site`, `onsite`, `in-office` → "On-site"; `field` (as standalone word) → "Field"
- **Priority**: First match wins; if multiple found, most prominent (earlier in text)
- **Fallback**: Empty string (not defaulted)

#### Shift
- **Approach**: Case-insensitive keyword scan
- **Keywords**: `day shift` → "Day"; `mid shift`, `mid-shift` → "Mid"; `night shift` → "Night"; `flexible` hours/schedule → "Flexible"
- **Fallback**: Empty string (rare in most job postings)

#### Salary
- **Primary regex**: `/(?:₱|PHP|USD|\$)\s*[\d,]+(?:\s*[-–—to]+\s*[\d,]+)?(?:\s*(?:per\s+month|\/mo|monthly|per\s+year|\/yr|annually|annual|yearly))?/i`
- **Range handling**: Extract both bounds, use the **lower bound** — consistent with the existing `parseSalaryInput` in `src/utils/currency.js` (line 34), which splits on `-` and takes the first part
- **Monthly detection**: Presence of "per month", "/mo", "monthly" → multiply lower bound × 12
- **Annual detection**: "per year", "/yr", "annually", "annual" → use as-is
- **Ambiguous (no period indicator)**: Use the value as-is; if > 20,000 treat as annual, otherwise assume monthly × 12 (heuristic for PH salary ranges)
- **Fallback**: `null`

#### Job Posting URL
- **Approach**: Regex for `https?://` URLs in the text
- **Validation**: Run result through `validateUrl()` from `src/utils/validate.js`
- **If invalid**: Discard; fallback to empty string
- **If multiple**: Use first match

#### Skills
- **Sections to parse**: "Required Skills", "Skills", "Qualifications", "Requirements", "Tech Stack", "Technologies", "Tools"
- **Extraction**: Comma-separated or bullet-delimited items in those sections
- **Output**: Array of trimmed strings, deduped

#### Preferred Skills
- **Sections to parse**: "Preferred Skills", "Nice to Have", "Bonus", "Preferred Qualifications"
- **Output**: Array of trimmed strings; these items are also added to `skills` (union)

#### Recruiter
- **Primary**: "Contact:", "Recruiter:", "Reach out to:", "Hiring Manager:" followed by a name on the same line
- **Fallback**: Empty string

#### Compat Score
- **Decision**: `Math.floor(Math.random() * 101)` — random integer 0–100
- **Rationale**: Brief explicitly specifies randomized placeholder. This differs from the manual create flow (which defaults to `compat: 0`). The random value signals "this was parser-created" and sets expectation that AI analysis is a future feature.

#### General Notes
- **Decision**: Not extracted by default. The responsibilities section covers the primary job description. If an "Additional Information", "About the Company", or "Benefits" section is found, its content may be placed here.
- **Rationale**: Avoid stuffing unclassified text into generalNotes — it would often just be noisy. Users can add notes manually.

---

### 6. Minimum Input Threshold

**Decision**: 20 characters. Process button is disabled when textarea length < 20.

**Rationale**: Any meaningful job posting fragment exceeds 20 characters. This threshold blocks accidental empty submissions and single-word pastes while being low enough not to frustrate users with partial content. No user-facing explanation of the threshold is needed — the button simply becomes enabled as they type.

---

### 7. "Zero fields extracted" Definition

**Decision**: A parse is considered failed (zero useful output) if all of the following are empty/null after extraction: `companyName`, `jobTitle`, `location`, `salary`, `workSetup`, `skills`.

**Rationale**: Responsibilities alone being extracted is not a useful parse result (just a block of text). At least one of the identifying fields must be found before presenting the pre-filled form. If only responsibilities or generalNotes are extracted, the error state is shown.
