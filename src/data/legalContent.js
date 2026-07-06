// Terms & Conditions and Privacy Policy content, loaded from the
// git-tracked markdown files in ./legal/ (repo root) and parsed into the
// shape src/components/LegalModal.js consumes. See ./legal/terms.md and
// ./legal/privacy.md for the actual document text.

import termsRaw from '../../legal/terms.md?raw';
import privacyRaw from '../../legal/privacy.md?raw';
import { parseLegalDocument } from './legalMarkdown.js';

export const TERMS_AND_CONDITIONS = parseLegalDocument(termsRaw);
export const PRIVACY_POLICY = parseLegalDocument(privacyRaw);
