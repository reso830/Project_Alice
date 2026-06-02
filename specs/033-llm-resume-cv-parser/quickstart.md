# Quickstart: LLM Resume / CV Parser (033)

How to exercise the feature once implemented.

## Prerequisites

- An OpenRouter account and API key (free-tier is fine): https://openrouter.ai/keys
- Alice running locally (`npm run dev` + `npm run server:dev`) or the hosted
  deployment, signed in (AI parsing is unavailable in demo mode).

## Enable AI parsing (one-time, per browser)

1. Go to the **Profile** page → **AI Resume Parsing** section (next to Account).
2. Paste your OpenRouter API key and save. Note the disclosure: *the key is
   stored only in this browser and safeguarding it is your responsibility.*

## Parse a resume

1. Go to **Edit Profile** → the **Resume Import** area at the top.
2. Either **paste** resume text or **upload** a PDF/DOCX/TXT (≤ 5 MB).
3. Click **Process Resume**. On first use, accept the one-time consent notice
   ("resume content will be sent to OpenRouter"). Decline = nothing is sent.
4. Watch loading feedback (~up to 30s). The form pre-fills; AI-populated fields
   show a subtle "AI" indicator.
5. Review/edit any field (editing clears its AI indicator), then **Save**. Nothing
   saves automatically.

## Verify fallback behavior

- **No key / declined consent** → processing uses the rule-based parser (no
  external call). Form still pre-fills.
- **AI failure** (invalid key, provider down, timeout, bad JSON) → automatically
  falls back to rule-based; a friendly message is shown, no internals leaked.
- **Both fail** → retry + "Continue Manually"; existing form data is preserved.
- **Very long resume** → truncated with a visible notice; a draft is still
  produced.

## Tests

```bash
npm run test:run        # unit/integration (vitest)
npm run lint            # eslint
```

Key suites: `tests/data/aiSettings*`, `tests/services/llmParser*`,
`tests/server/resumeExtract*`, `tests/components/ResumeImport*`,
`tests/pages/profile.aiSettings*`, plus existing resume suites.

## Adjusting model / timeout

- Default model and `LLM_TIMEOUT_MS` / `MAX_INPUT_CHARS` are single constants in
  the browser LLM service — edit and rebuild; no env vars or server changes.
