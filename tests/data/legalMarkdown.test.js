import { describe, expect, it } from 'vitest';
import { parseLegalDocument } from '../../src/data/legalMarkdown.js';

const SAMPLE = `# Sample Title
Version: v1.0 · Effective July 6, 2026

> Notice: This is a disclaimer.

## 1. First Section
First section content, all on one line.

## 2. Second Section
Second section content
wrapped across
multiple lines.

## 2.1 Nested-looking Heading
Treated as its own flat section, not nested under Section 2.
`;

describe('parseLegalDocument', () => {
  it('parses the title from the first # line', () => {
    const result = parseLegalDocument(SAMPLE);
    expect(result.title).toBe('Sample Title');
  });

  it('parses the version line', () => {
    const result = parseLegalDocument(SAMPLE);
    expect(result.version).toBe('v1.0 · Effective July 6, 2026');
  });

  it('parses the disclaimer, keeping the "Notice:" prefix', () => {
    const result = parseLegalDocument(SAMPLE);
    expect(result.disclaimer).toBe('Notice: This is a disclaimer.');
  });

  it('parses each ## heading into its own flat section, in order', () => {
    const result = parseLegalDocument(SAMPLE);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].title).toBe('1. First Section');
    expect(result.sections[1].title).toBe('2. Second Section');
    expect(result.sections[2].title).toBe('2.1 Nested-looking Heading');
  });

  it('joins multi-line section content into a single space-joined string', () => {
    const result = parseLegalDocument(SAMPLE);
    expect(result.sections[1].content).toBe(
      'Second section content wrapped across multiple lines.',
    );
  });

  it('trims single-line section content', () => {
    const result = parseLegalDocument(SAMPLE);
    expect(result.sections[0].content).toBe('First section content, all on one line.');
  });

  it('preserves section content lines that look like metadata (> or Version:) once past the first ## heading', () => {
    const sampleWithMetadataLookingContent = `# Sample Title
Version: v1.0 · Effective July 6, 2026

> Notice: This is a disclaimer.

## 1. First Section
> This line looks like a blockquote but is real content.
Version: this line looks like a version tag but is real content.
`;
    const result = parseLegalDocument(sampleWithMetadataLookingContent);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].content).toBe(
      '> This line looks like a blockquote but is real content. Version: this line looks like a version tag but is real content.',
    );
  });

  it('throws when there is no # title line', () => {
    const noTitle = `Version: v1.0 · Effective July 6, 2026

## 1. First Section
Some content.
`;
    expect(() => parseLegalDocument(noTitle)).toThrow(
      'Malformed legal document: missing title or no sections found',
    );
  });
});
