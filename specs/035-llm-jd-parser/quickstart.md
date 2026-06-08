# Quickstart: LLM JD Parser

How to enable and exercise the feature locally.

---

## Enable AI JD parsing

1. Run the app locally (`npm run dev`) and sign in / use local mode.
2. Go to **Profile → Settings → Artificial Intelligence**:
   - Turn on the master **AI features** switch.
   - Paste an **OpenRouter API key** (browser-only; never sent to the server).
   - Enable the **Job-description parsing** toggle (now live; no longer "Coming soon").
3. Optionally set a model slug (defaults to the shared free model).

---

## Happy path (AI parse)

1. Click **+ New application** (or the FAB on mobile) → the Add-application gate.
2. Choose **Smart entry** (shows the *Fastest* affordance when AI is on).
3. Paste a job posting (≥ ~40 chars) → **Parse posting**.
4. Watch the processing scrim ("Reading the job posting…").
5. The Create modal opens pre-filled with **✦ AI** markers + a "Filled from the job
   posting" banner; status is **Wishlisted**, compat is a random 0–100.
6. Review/edit (markers clear on edit) → **Create** to save.

---

## Fallback & failure paths

- **AI off** (no key, master off, or `jd` toggle off): the **Smart card is locked**
  ("Enable AI in Settings →"); use **Manual entry** to add the application by hand.
- **AI failure** (simulate by using a bad key, or block network): a reason-code dialog
  appears with the mapped chip and:
  - **Use basic parser** → pre-fills with **⚙ Auto** markers (rule-based extraction).
  - **Try AI again** (wait reasons) / **Update key in Settings** (key/credit reasons).
  - **Enter manually** → empty Create modal.
- **Unreadable posting** (paste gibberish/structureless text): terminal "We couldn't
  read that posting" (NO_TEXT) with **Try again / Enter manually** — no basic-parser
  option. Your pasted text is preserved across retries.

---

## What to verify

- No application is saved until you click **Create**.
- No key or job text is persisted server-side (inspect network/storage).
- With no key, the app is still fully usable via **Manual entry** (local-first).
- Parsed enums are constrained (Work Setup / Shift), salary is an annual PHP integer,
  duplicate skills are removed, and invalid URLs are dropped.

---

## Tests

```bash
npm test            # unit + component suites
```

Targeted suites: `tests/services/llmParser*.test.js`,
`tests/components/JobPostingImport.test.js`, the `CreationPicker` gate test, the
`Modal` provenance test, and the Profile AI-settings test (`jd` toggle live).
