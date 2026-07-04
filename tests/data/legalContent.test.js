import { describe, expect, it } from 'vitest';
import {
  LEGAL_DISCLAIMER,
  TERMS_AND_CONDITIONS,
  PRIVACY_POLICY,
} from '../../src/data/legalContent.js';

describe('legalContent data structure validation', () => {
  it('exports a valid, descriptive legal disclaimer', () => {
    expect(LEGAL_DISCLAIMER).toBeTypeOf('string');
    expect(LEGAL_DISCLAIMER).toContain('Notice:');
    expect(LEGAL_DISCLAIMER).toContain('requires professional attorney review');
  });

  describe('Terms & Conditions structure', () => {
    it('has correct top-level metadata', () => {
      expect(TERMS_AND_CONDITIONS.title).toBe('Terms & Conditions');
      expect(TERMS_AND_CONDITIONS.version).toBe('v0.3.0 · Effective Apr 1, 2026');
      expect(TERMS_AND_CONDITIONS.disclaimer).toBe(LEGAL_DISCLAIMER);
    });

    it('has exactly 4 required sections', () => {
      expect(Array.isArray(TERMS_AND_CONDITIONS.sections)).toBe(true);
      expect(TERMS_AND_CONDITIONS.sections).toHaveLength(4);

      for (const section of TERMS_AND_CONDITIONS.sections) {
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('content');
        expect(section.title).toBeTypeOf('string');
        expect(section.content).toBeTypeOf('string');
      }
    });

    it('enforces SQLite/local data responsibility in Section 2', () => {
      const section2 = TERMS_AND_CONDITIONS.sections[1];
      expect(section2.title).toContain('2. Your account');
      expect(section2.content).toContain('SQLite database or browser storage');
      expect(section2.content).toContain('keeping your login credentials secure');
    });
  });

  describe('Privacy Policy structure', () => {
    it('has correct top-level metadata', () => {
      expect(PRIVACY_POLICY.title).toBe('Privacy Policy');
      expect(PRIVACY_POLICY.version).toBe('v0.2.1 · Effective Mar 15, 2026');
      expect(PRIVACY_POLICY.disclaimer).toBe(LEGAL_DISCLAIMER);
    });

    it('has exactly 4 required sections', () => {
      expect(Array.isArray(PRIVACY_POLICY.sections)).toBe(true);
      expect(PRIVACY_POLICY.sections).toHaveLength(4);

      for (const section of PRIVACY_POLICY.sections) {
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('content');
        expect(section.title).toBeTypeOf('string');
        expect(section.content).toBeTypeOf('string');
      }
    });

    it('enforces Supabase persistence warning in Section 3', () => {
      const section3 = PRIVACY_POLICY.sections[2];
      expect(section3.title).toContain('3. Storage & retention');
      expect(section3.content).toContain('Supabase persistence backend');
      expect(section3.content).toContain('no cloud synchronization or remote data transmission');
    });
  });
});
