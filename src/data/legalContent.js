// Static legal copy content for Terms & Conditions and Privacy Policy.
// This is developer-drafted placeholder copy requiring professional attorney review.

export const LEGAL_DISCLAIMER = "Notice: This document is realistic developer-drafted placeholder copy and requires professional attorney review before production use.";

export const TERMS_AND_CONDITIONS = {
  title: "Terms & Conditions",
  version: "v0.3.0 · Effective Apr 1, 2026",
  disclaimer: LEGAL_DISCLAIMER,
  sections: [
    {
      title: "1. Acceptance of terms",
      content: "By using Project Alice you agree to these terms. If you're using the app on behalf of an organization, you're confirming you have authority to bind that organization."
    },
    {
      title: "2. Your account",
      content: "You're responsible for the accuracy of the application data you enter, for managing your local SQLite database or browser storage, and for keeping your login credentials secure. We may suspend accounts that abuse the service."
    },
    {
      title: "3. Acceptable use",
      content: "Don't use Alice to store data you don't have rights to, or to interfere with the service's availability for other users."
    },
    {
      title: "4. Changes to the service",
      content: "Features may change as Alice evolves. We'll note material changes in the release notes linked from the footer."
    }
  ]
};

export const PRIVACY_POLICY = {
  title: "Privacy Policy",
  version: "v0.2.1 · Effective Mar 15, 2026",
  disclaimer: LEGAL_DISCLAIMER,
  sections: [
    {
      title: "1. What we collect",
      content: "Application entries, profile details, and basic usage data needed to run the tracker, calendar, and profile pages."
    },
    {
      title: "2. How we use it",
      content: "Solely to operate the product for you — populating your tracker, calendar and profile views. We don't sell your data."
    },
    {
      title: "3. Storage & retention",
      content: "Data stays in your account until you archive or delete it. Local and portable builds keep all database entries locally on your device; no cloud synchronization or remote data transmission occurs unless the hosted version of Project Alice is explicitly configured with a Supabase persistence backend by your administrator."
    },
    {
      title: "4. Your choices",
      content: "You can export or remove your data at any time from Profile settings."
    }
  ]
};
