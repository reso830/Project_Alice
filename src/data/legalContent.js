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
      content: "By accessing or using Project Alice (the \"Software\"), you agree to be bound by these Terms & Conditions. If you are entering into these terms on behalf of a company or other legal entity, you represent that you have the authority to bind such entity. If you do not agree to these terms, you must immediately cease all use of the Software. The Software is licensed, not sold, under the PolyForm Noncommercial 1.0.0 license, and any commercial exploitation is strictly prohibited without a separate agreement."
    },
    {
      title: "2. Your account",
      content: "You're responsible for the accuracy of the application data you enter, for managing your local SQLite database or browser storage, and for keeping your login credentials secure. You acknowledge that developers of the Software have no access to your database, cannot recover lost data, and are not responsible for any data loss, file corruption, or database access failures. You agree to safeguard your credentials and assume full liability for all activities associated with your local or hosted deployment."
    },
    {
      title: "3. Acceptable use",
      content: "You agree not to use the Software for any unlawful activity, or to store data that violates third-party intellectual property or privacy rights. THE SOFTWARE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS, COPYRIGHT HOLDERS, OR OPERATORS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE."
    },
    {
      title: "4. Changes to the service",
      content: "We reserve the right to modify or discontinue, temporarily or permanently, the Software or any features therein at any time. Updates, releases, and changelogs will be documented in our repository. Continued use of the Software following any changes constitutes acceptance of those changes. Any use of the Software must strictly comply with the PolyForm Noncommercial 1.0.0 license restrictions."
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
      content: "Project Alice operates primarily as a local-first client-side application. The Software processes application entries, profile details, credentials, and resume texts on your local machine. No personal data, session tokens, or application logs are transmitted to the developers or any third-party analytics servers. If you are using the hosted multi-user deployment of the Software, the system collects your authentication credentials and application records solely to persist them in your dedicated account schema."
    },
    {
      title: "2. How we use it",
      content: "All data processed by the Software is used exclusively to facilitate your job search tracking, analytics dashboard, and calendar scheduling views. We do not sell, rent, share, or trade your personal information, job applications, or profile details with any third parties. If hosted mode is utilized, data persistence is maintained strictly to enable multi-device access for your authorized account."
    },
    {
      title: "3. Storage & retention",
      content: "Data stays in your account until you archive or delete it. Local and portable builds keep all database entries locally on your device; no cloud synchronization or remote data transmission occurs unless the hosted version of Project Alice is explicitly configured with a Supabase persistence backend by your administrator. For hosted deployments, your data is stored in the PostgreSQL database configured by your operator, isolated by Row Level Security (RLS) policies, and is retained only until your account is deleted or your data is manually removed."
    },
    {
      title: "4. Your choices",
      content: "You maintain absolute ownership and control over your data. The Software provides built-in utilities in the Profile settings to export your entire application history and profile records as structured JSON files at any time, or to permanently purge your local database. For hosted deployments, you may request account deletion or data removal directly through your operator's administrative controls."
    }
  ]
};
