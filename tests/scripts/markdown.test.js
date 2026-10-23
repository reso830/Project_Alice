import { describe, expect, it } from 'vitest';
import { escapeMarkdownCell } from '../../scripts/lib/markdown.js';

describe('escapeMarkdownCell', () => {
  it('preserves a single Markdown table cell for hostile review text', () => {
    expect(escapeMarkdownCell('before\\|after\rnext\nlast\r\nend')).toBe(
      'before\\\\\\|after<br>next<br>last<br>end',
    );
  });
});
