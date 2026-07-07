# Terms & Conditions
Version: v1.0 · Effective July 6, 2026

> Notice: These Terms & Conditions were prepared with the assistance of an AI system and cross-checked against Project Alice's actual source code and data practices, but they have not been reviewed by a licensed attorney. They reflect a good-faith, functional agreement for a free, individually-operated project, not a substitute for professional legal advice.

## 1. Acceptance of Terms
By accessing or using Project Alice (Alice, the Service, or the Software), in any of its available forms, you agree to be bound by these Terms and Conditions. If you do not agree to these Terms, do not access or use Alice. These Terms are a binding agreement between you and the individual operator of Alice, identified in these Terms as the Owner.

## 2. Definitions
Alice, the Service, or the Software means the Project Alice job-application tracking application, including its source code, hosted deployment, portable distribution, and associated documentation. The Owner means the individual who develops and operates Alice, identified publicly through the GitHub account reso830. Local Mode means running Alice's backend against a local SQLite database on your own device, whether from a cloned copy of the source code or the Portable Package. The Portable Package means the pre-built, downloadable distribution of Alice for Windows that runs in Local Mode without a development environment. Hosted Mode means the multi-user deployment of Alice operated by the Owner, backed by Supabase for authentication and data persistence. Demo Mode means the in-memory, no-signup preview of Alice available from the Hosted Mode welcome page. You or User means any person who accesses or uses Alice in any mode. Content means any data, text, files, or other material you submit to, upload to, or store in Alice, including application entries, profile information, and resume files.

## 3. Eligibility and Accounts
You must be at least 18 years old to use Alice, and by using Alice you represent that you meet this requirement. Alice must not be accessed from, and is not intended for use by, individuals or entities located in a country or region subject to comprehensive sanctions administered by the United States Office of Foreign Assets Control, or by any person on an OFAC-administered list of prohibited or restricted parties; by using Alice you represent that you are not located in, and are not a national or resident of, any such sanctioned country or region, and that you are not on any such restricted-party list. The Owner does not operate technical geographic access controls to enforce this restriction; you are solely responsible for your own compliance with it, and a violation is grounds for immediate termination of your access under Section 17. Hosted Mode currently requires an invitation, meaning your email address must be added to an allowlist by the Owner, due to infrastructure limitations; this is an operational limit, not a reflection of eligibility criteria beyond what is stated in these Terms. Local Mode and the Portable Package do not require an account or invitation. For Hosted Mode, you are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account, and you should notify the Owner via GitHub Issues (Section 20) if you suspect unauthorized access to your account.

## 4. How Alice Works
Alice is available in four modes, described here so you understand what you are actually agreeing to use. In Local Mode, you run Alice's backend yourself, for example from a cloned copy of the source code, against a SQLite database file stored on your own device; no account is required, and no data is transmitted to the Owner or any hosted infrastructure. The Portable Package is a pre-built, downloadable distribution of Alice for Windows that runs in Local Mode without a development environment; it may check GitHub Releases for newer versions and prompt you to install updates, and declining an update does not disable your existing installation, though unsupported versions may not receive further fixes. Hosted Mode is a multi-user deployment operated by the Owner, using Supabase for authentication and data persistence, currently requiring an invitation as described in Section 3, with your data isolated from other users' data through database-level access controls. Demo Mode is a no-signup preview of Alice's Tracker and Profile features using seeded sample data, held only in your browser's memory for the duration of your session, and is never persisted; it is discarded when you refresh or close the page.

## 5. Fees
As of the Effective Date, all modes of Alice, including Hosted Mode, are provided free of charge. The Owner reserves the right to introduce paid tiers, usage limits, or other pricing changes in the future, with reasonable advance notice provided through Alice's release notes, an in-app notice, or the contact channel in Section 20. Any pricing change will not apply retroactively to usage that occurred before the change takes effect.

## 6. License to Use Alice
Subject to your compliance with these Terms, the Owner grants you a limited, non-exclusive, non-transferable, revocable license to access and use Alice for your own personal job search, career, or application-tracking purposes. This license to use the Service is separate from, and does not expand, any rights you may have to the underlying source code, which are governed exclusively by the PolyForm Noncommercial License 1.0.0 included in the project's LICENSE file. Nothing in these Terms grants you any right to use Alice, or the Owner's name or branding, for commercial purposes without the Owner's separate written permission.

## 7. User Responsibilities
You are responsible for the accuracy of the information you enter into Alice, including application entries, profile details, and any resume content you upload or paste; for maintaining your own backups of Local Mode or Portable Package data, since the Owner has no access to, and cannot recover, a database file stored on your own device; for keeping any Hosted Mode account credentials confidential; and for complying with these Terms and all applicable laws in your use of Alice.

## 8. AI Features
Alice includes optional AI-assisted features covering resume parsing, job-description parsing, and compatibility notes, described further in the two sections below.

## 8.1 Bring Your Own Key (BYOK)
Alice's optional AI-assisted features require you to supply your own API key for a third-party AI provider. Alice currently supports OpenRouter; additional providers may be supported in future releases. Your key is stored locally in your browser and is never transmitted to or stored on Alice's own servers; requests made using your key go directly from your browser to the AI provider. Your use of a third-party AI provider is governed by that provider's own terms of service, and any costs charged by that provider are between you and the provider. The Owner is not a party to that relationship and has no visibility into, or responsibility for, those requests. You are responsible for ensuring that any information you submit to an AI provider through Alice is appropriate for that provider to process and does not violate applicable law, a confidentiality obligation, or any third party's rights, including trade secrets or personal information belonging to others.

## 8.2 AI Output Disclaimer
Any output generated by Alice's AI features, including parsed resume or job-posting data and compatibility notes, is generated by a third-party AI model and may be inaccurate, incomplete, or otherwise unreliable. AI-generated content is provided for your convenience only and does not constitute advice of any kind. You are solely responsible for reviewing and verifying any AI-generated content before relying on it, including before submitting a job application based on it.

## 9. User Content
You retain all ownership rights in the Content you submit to Alice. By submitting Content, you grant the Owner, and in Hosted Mode the Owner's infrastructure providers such as Supabase, a limited license to store, process, and transmit that Content solely as necessary to operate Alice and provide it to you. You represent that you have all rights necessary to submit your Content, for example that you have the right to store the text of a job posting or a resume you upload, and that doing so does not infringe any third party's rights.

## 10. Acceptable Use
You agree not to use Alice to store or process Content that you do not have the right to store or process, or that infringes any third party's intellectual property, privacy, or other rights; to attempt to gain unauthorized access to another user's account or data; to upload malicious software or otherwise attempt to compromise the Service; to interfere with or disrupt the availability, security, or integrity of Alice or its underlying infrastructure; to use Alice for any unlawful purpose; or to decompile or circumvent any access or usage restriction in Alice beyond what the PolyForm Noncommercial License 1.0.0 expressly permits.

## 11. Intellectual Property
Alice's source code is licensed under the PolyForm Noncommercial License 1.0.0, set out in the LICENSE file in the project repository, and that license, not these Terms, governs your rights to copy, modify, and distribute the source code. Aside from the rights expressly granted under that license and the limited use license in Section 6, the Owner retains all right, title, and interest in and to Alice, including its name, branding, and any content or design not authored by you.

## 12. Third-Party Services
Alice's Hosted Mode relies on third-party infrastructure providers, including Supabase for authentication and data persistence and Vercel for application hosting. Alice's optional AI features rely on a third-party AI provider you configure yourself, as described in Section 8.1. The Owner is not responsible for the availability, performance, security practices, or acts or omissions of these third-party services, and your use of them, directly or through Alice, may be subject to their own separate terms.

## 13. Availability, Updates, and Changes
Alice is provided on a best-effort basis by an individual operator; the Owner does not guarantee any particular level of uptime or availability, particularly for the free Hosted Mode deployment. The Owner may modify, suspend, or discontinue any part of Alice, including Hosted Mode, at any time. Alice is an actively developed project, and features may change between releases. The Portable Package may check for and prompt you to install updates; you may decline an update, though declining may mean you no longer receive fixes for issues addressed in later versions.

## 14. Disclaimer of Warranties
Alice is provided as is and as available, without warranties of any kind, whether express, implied, or statutory, including but not limited to implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. The Owner does not warrant that Alice will be uninterrupted, error-free, or secure, or that any data loss will not occur.

## 15. Limitation of Liability
To the maximum extent permitted by applicable law, the Owner shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or opportunity, arising out of or relating to your use of, or inability to use, Alice, regardless of the legal theory on which such damages are claimed and even if the Owner has been advised of the possibility of such damages. The Owner's total aggregate liability to you for any claim arising out of or relating to these Terms or your use of Alice shall not exceed the greater of fifty United States dollars, or the total amount, if any, you paid the Owner for Alice in the twelve months before the claim arose. Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above limitations may not apply to you.

## 16. Indemnification
You agree to indemnify, defend, and hold harmless the Owner from and against any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or in any way connected with your Content, your violation of these Terms, or your violation of any applicable law or the rights of any third party.

## 17. Suspension and Termination
The Owner may suspend or terminate your access to Hosted Mode at any time, including for violation of these Terms, extended account inactivity, or discontinuation of Hosted Mode itself. You may stop using Alice at any time. Upon termination of a Hosted Mode account, your stored Content will be handled in accordance with the Privacy Policy's retention and deletion terms. Sections of these Terms that by their nature should survive termination, including Sections 11, 14, 15, 16, and 18, will survive.

## 18. Governing Law
These Terms are governed by the laws of the Republic of the Philippines, without regard to its conflict-of-laws principles, and any dispute arising out of or relating to these Terms or your use of Alice will be subject to the exclusive jurisdiction of the courts of the Philippines. This section does not override any mandatory consumer-protection or data-protection right you have under the laws of your own country of residence, to the extent such laws require otherwise.

## 19. Changes to these Terms
The Owner may update these Terms from time to time. Material changes will be noted in the project's release notes or an in-app notice. Your continued use of Alice after a change takes effect constitutes your acceptance of the revised Terms.

## 20. Contact Information
Questions about these Terms can be directed to the Owner via GitHub Issues, at github.com/reso830/Project_Alice/issues/new.
