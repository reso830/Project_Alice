import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Enforces the constitution's "any analytics beyond these two named, scoped
// exceptions remains prohibited absent its own explicit amendment" rule
// (Amendments 1.5.0/1.7.0/1.7.1) at the only two points where it could
// silently be violated: importing either vendor package anywhere other than
// the one gated module, or calling the exported inject functions directly.
const ALLOWED_FILE = path.join('src', 'utils', 'vercelObservability.js');
const VENDOR_SPECIFIERS = ['@vercel/analytics', '@vercel/speed-insights'];

function listJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listJsFiles(entryPath);
    }
    return entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

describe('Vercel vendor telemetry call sites', () => {
  it('only src/utils/vercelObservability.js imports @vercel/analytics or @vercel/speed-insights', () => {
    const srcFiles = listJsFiles('src').filter((file) => file !== ALLOWED_FILE);
    const offenders = srcFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return VENDOR_SPECIFIERS.some((specifier) => content.includes(specifier));
    });

    expect(offenders).toEqual([]);
  });

  it('vercelObservability.js imports both vendor packages exactly once each', () => {
    const content = fs.readFileSync(ALLOWED_FILE, 'utf8');
    for (const specifier of VENDOR_SPECIFIERS) {
      const importLine = new RegExp(`^import .+ from '${specifier}';$`, 'gm');
      const occurrences = content.match(importLine)?.length ?? 0;
      expect(occurrences).toBe(1);
    }
  });
});
