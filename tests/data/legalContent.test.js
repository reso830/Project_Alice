import { describe, expect, it } from 'vitest';
import { TERMS_AND_CONDITIONS, PRIVACY_POLICY } from '../../src/data/legalContent.js';

describe('legalContent', () => {
  describe('Terms & Conditions', () => {
    it('has the real title, version, and disclaimer', () => {
      expect(TERMS_AND_CONDITIONS.title).toBe('Terms & Conditions');
      expect(TERMS_AND_CONDITIONS.version).toBe('v1.0 · Effective July 6, 2026');
      expect(TERMS_AND_CONDITIONS.disclaimer).toContain('Notice:');
      expect(TERMS_AND_CONDITIONS.disclaimer).toContain('have not been reviewed by a licensed attorney');
    });

    it('has all 22 sections in order, including flattened AI Features subsections', () => {
      expect(TERMS_AND_CONDITIONS.sections).toHaveLength(22);
      expect(TERMS_AND_CONDITIONS.sections[0].title).toBe('1. Acceptance of Terms');
      expect(TERMS_AND_CONDITIONS.sections[7].title).toBe('8. AI Features');
      expect(TERMS_AND_CONDITIONS.sections[8].title).toBe('8.1 Bring Your Own Key (BYOK)');
      expect(TERMS_AND_CONDITIONS.sections[9].title).toBe('8.2 AI Output Disclaimer');
      expect(TERMS_AND_CONDITIONS.sections[21].title).toBe('20. Contact Information');
    });

    it('states the 18+ eligibility requirement', () => {
      const eligibility = TERMS_AND_CONDITIONS.sections.find((s) => s.title === '3. Eligibility and Accounts');
      expect(eligibility.content).toContain('at least 18 years old');
    });

    it('states the OFAC-sanctioned-country restriction', () => {
      const eligibility = TERMS_AND_CONDITIONS.sections.find((s) => s.title === '3. Eligibility and Accounts');
      expect(eligibility.content).toContain('Office of Foreign Assets Control');
    });

    it('caps liability at the greater of $50 or amount paid in the past 12 months', () => {
      const liability = TERMS_AND_CONDITIONS.sections.find((s) => s.title === '15. Limitation of Liability');
      expect(liability.content).toContain('the greater of fifty United States dollars');
      expect(liability.content).toContain('total amount, if any, you paid the Owner for Alice in the twelve months');
    });

    it('future-proofs the AI provider wording instead of implying OpenRouter is the only option', () => {
      const byok = TERMS_AND_CONDITIONS.sections.find((s) => s.title === '8.1 Bring Your Own Key (BYOK)');
      expect(byok.content).toContain('Alice currently supports OpenRouter');
      expect(byok.content).toContain('additional providers may be supported in future releases');
    });
  });

  describe('Privacy Policy', () => {
    it('has the real title, version, and disclaimer', () => {
      expect(PRIVACY_POLICY.title).toBe('Privacy Policy');
      expect(PRIVACY_POLICY.version).toBe('v1.2 · Effective July 9, 2026');
      expect(PRIVACY_POLICY.disclaimer).toContain('Notice:');
    });

    it('has all 25 sections in order, including flattened subsections', () => {
      expect(PRIVACY_POLICY.sections).toHaveLength(25);
      expect(PRIVACY_POLICY.sections[0].title).toBe('1. Introduction');
      expect(PRIVACY_POLICY.sections[9].title).toBe('4.6 Technical Information');
      expect(PRIVACY_POLICY.sections[24].title).toBe('15. Contact Us');
    });

    it('describes resume files as processed, not retained', () => {
      const resumeSection = PRIVACY_POLICY.sections.find((s) => s.title === '4.4 Resume Files');
      expect(resumeSection.content).toContain('not written to disk');
      expect(resumeSection.content).toContain('discarded once the extraction request completes');
    });

    it('describes export requests as fulfilled manually, not as a self-service feature', () => {
      const rightsSection = PRIVACY_POLICY.sections.find((s) => s.title === '10. Your Rights');
      expect(rightsSection.content).toContain('fulfilled manually');
      // Note: the content does mention "automated self-service export" — but only to say
      // this is NOT how requests are handled. This assertion checks for the manual-fulfillment
      // claim rather than the string's absence, since the word "self-service" legitimately
      // appears in that negation.
      expect(rightsSection.content).not.toContain('export your entire application history');
    });

    it('discloses the Sydney, Australia hosting region and SCC safeguard', () => {
      const hostedStorage = PRIVACY_POLICY.sections.find((s) => s.title === '6.3 Hosted Mode');
      expect(hostedStorage.content).toContain('Sydney, Australia');

      const transfers = PRIVACY_POLICY.sections.find((s) => s.title === '11. International Data Transfers');
      expect(transfers.content).toContain('Standard Contractual Clauses');
    });

    it('describes Supabase/Vercel as the Owner\'s own service providers, not as "sub-processors" of the Owner', () => {
      const thirdParty = PRIVACY_POLICY.sections.find((s) => s.title === '8. Third-Party Services');
      // "Sub-processor" is Supabase's own DPA term for vendors underneath Supabase itself
      // (e.g. AWS, Cloudflare) — Supabase/Vercel are the Owner's direct processors, not
      // sub-processors of the Owner. Only Supabase's own downstream vendors get that label.
      expect(thirdParty.content).not.toContain("process data on the Owner's behalf as sub-processors");
      expect(thirdParty.content).toContain('third-party service providers');
      expect(thirdParty.content).toContain('its own sub-processors, such as underlying cloud infrastructure providers');
    });

    it('does not overclaim that Speed Insights metrics are categorically "not personal data"', () => {
      const technical = PRIVACY_POLICY.sections.find((s) => s.title === '4.6 Technical Information');
      // IP/device metrics can be personal data in some jurisdictions (e.g. GDPR) depending on
      // context — describe what's not done with the data instead of asserting a legal category.
      expect(technical.content).not.toContain('this is not personal data');
      expect(technical.content).toContain('not used to identify individual users');
    });
  });
});
