# Privacy Policy
Version: v1.1 · Effective July 9, 2026

> Notice: This Privacy Policy was prepared with the assistance of an AI system and cross-checked against Project Alice's actual source code and data practices, but it has not been reviewed by a licensed attorney or data protection professional. It reflects a good-faith description of how Alice actually handles data as of the Effective Date above.

## 1. Introduction
This Privacy Policy describes how Project Alice, Alice, or the Service handles information depending on which mode you use it in: Local Mode, the Portable Package, Hosted Mode, or Demo Mode. Alice is operated by an individual identified in this Policy as the Owner, publicly identifiable through the GitHub account reso830.

## 2. Scope
This Policy applies to your use of Alice itself. It does not apply to the project's public source code repository as a browsing experience, since GitHub's own handling of repository traffic is governed by GitHub's privacy policy, not this one, and it does not apply to any third-party website you may reach through a link inside Alice.

## 3. Definitions
Terms used in this Policy have the meanings given to them in Alice's Terms and Conditions, including Alice, the Owner, Local Mode, Portable Package, Hosted Mode, Demo Mode, and Content. Personal Data means any information relating to an identified or identifiable individual.

## 4. Information We Collect
This section describes the categories of information Alice may collect, depending on which mode you use, set out in the subsections below.

## 4.1 Account Information
In Hosted Mode only, Alice collects the email address and password you use to create an account. Your password is handled by Supabase's authentication system and is never visible to the Owner in plain text. Local Mode, the Portable Package, and Demo Mode do not require an account and do not collect this information.

## 4.2 Profile Information
Information you choose to enter on your Profile page, including your name, contact details, work history, skills, education, and similar career-related information you provide to describe yourself.

## 4.3 Career Data
The application-tracking data you create in Alice, including job titles, company names, application status, dates, salary information, notes, and any other fields you enter about a job application.

## 4.4 Resume Files
If you upload a resume file, in PDF, DOCX, or TXT format up to 5 MB, to have Alice pre-fill your Profile, the file is transmitted to Alice's backend for the sole purpose of extracting its text and identifying structured fields such as your name, skills, and work history. The file itself is processed in memory and is not written to disk or any database; it is discarded once the extraction request completes, whether or not extraction succeeds. Only the resulting structured fields you choose to keep become part of your saved Profile data.

## 4.5 AI Configuration
If you enable Alice's optional AI features, your chosen AI provider API key and model selection are stored locally in your browser. This information is never transmitted to or stored on Alice's own servers, as described further in Section 7.

## 4.6 Technical Information
Standard web request information, such as IP address and browser type, may be processed transiently by Alice's hosting infrastructure, Vercel, and Supabase in the course of serving Hosted Mode requests, consistent with those providers' own standard operating logs. In Hosted Mode production deployments, Alice also uses Vercel Speed Insights to collect anonymized, aggregate Core Web Vitals performance metrics, and Vercel Web Analytics to collect anonymized, aggregate visitor and traffic statistics, including page views, visitor counts, referrer sources, and country-level location derived transiently from your IP address. Vercel Web Analytics does not use cookies, and does not retain your IP address itself, only the aggregate, anonymized location derived from it. This information is not used to identify individual users, track behavior across sessions, or serve advertising, and neither feature is active in Local Mode or Demo Mode.

## 5. How We Use Your Information
We use the information described in Section 4 solely to operate Alice: to authenticate your Hosted Mode account, to store and display your Career Data and Profile Information back to you, to pre-fill your Profile from a resume you choose to upload, and to compute compatibility scores and, if you enable AI features, generate optional AI-assisted notes. We do not sell, rent, or share your Personal Data with third parties for their own marketing purposes. Where the GDPR applies, as described in Section 11, our legal basis for this processing is performance of the contract you accepted by using the Service, under GDPR Article 6(1)(b), and, where applicable, your consent, for example when you choose to enable optional AI features.

## 6. How Information is Stored
This section describes where your information is stored, depending on which mode you use, set out in the subsections below.

## 6.1 Local Mode
All data is stored in a SQLite database file on your own device. No data is transmitted to the Owner or any hosted infrastructure.

## 6.2 Portable Package
Identical to Local Mode: your data is stored in a SQLite database file within your own installation folder, on your own device.

## 6.3 Hosted Mode
Your data is stored in a Supabase-managed PostgreSQL database, isolated from other users' data by database-level Row Level Security policies. As of the Effective Date, this database is hosted in the Sydney, Australia region; see Section 11 for international transfer information.

## 6.4 Demo Mode
Data exists only in your browser's memory for the duration of your session and is never transmitted to or stored by any server. Refreshing or closing the page discards it permanently.

## 7. AI Features
Alice's optional AI-assisted features, covering resume parsing, job-description parsing, and compatibility notes, require you to configure your own API key for a third-party AI provider. Alice currently supports OpenRouter; additional providers may be supported in future releases. This key, and requests made using it, go directly from your browser to that provider; they never pass through, or are stored on, Alice's own servers. The content of those requests, for example resume or job-posting text you choose to have parsed, is subject to that provider's own privacy practices, not this Policy. You should review your chosen AI provider's own privacy policy before enabling this feature.

## 8. Third-Party Services
Hosted Mode relies on third-party service providers who process data on the Owner's behalf. Supabase provides authentication and database hosting; the further vendors Supabase itself relies on, its own sub-processors, such as underlying cloud infrastructure providers, are disclosed in Supabase's Data Processing Addendum. Vercel provides application hosting, and, in Hosted Mode production only, anonymized Core Web Vitals performance metrics through Vercel Speed Insights and anonymized visitor/traffic statistics through Vercel Web Analytics. These providers are contractually restricted to processing your data only as necessary to provide their services to Alice, and not for their own independent purposes.

## 9. Data Retention
Your Career Data and Profile Information are retained for as long as your account exists, in Hosted Mode, or for as long as you keep them on your device, in Local Mode or the Portable Package, unless you delete them earlier as described below. Archiving an application does not delete it. Deleting an application, clearing your local data, or deleting your Hosted Mode account, as described in Section 10, permanently removes the corresponding data.

## 10. Your Rights
You may access, correct, or delete your data at any time through Alice itself. In Local Mode or the Portable Package, use the in-app option to clear all stored data, which requires typing a confirmation phrase. In Hosted Mode, use the in-app Account settings to delete your account, which removes your profile and application records after password confirmation. If you need a copy of your data in a portable format, or need help with a request you cannot complete yourself in-app, contact the Owner via GitHub Issues, at github.com/reso830/Project_Alice/issues/new; this will be fulfilled manually rather than through an automated self-service export. Because GitHub Issues are public, please do not include sensitive account details, such as your password, in your request; a request simply asking the Owner to follow up about your data is enough.

## 11. International Data Transfers
If you are located in the European Economic Area, the United Kingdom, or Switzerland and use Hosted Mode, your Personal Data is transferred to and stored in Australia, as described in Section 6.3, a country that has not received a data protection adequacy decision from the European Commission. This transfer is safeguarded by Standard Contractual Clauses incorporated into the Data Processing Addendum between the Owner and Supabase, consistent with Article 46 of the GDPR.

## 12. Children's Privacy
Alice is not directed at, and must not be used by, anyone under 18 years old, consistent with the Terms and Conditions. We do not knowingly collect Personal Data from anyone under 18. If you believe a minor has provided us Personal Data, contact us as described in Section 15, and we will take steps to delete it.

## 13. Security
Hosted Mode data is protected by Supabase's Row Level Security policies and standard transport encryption; your password specifically is handled entirely by Supabase's authentication system and is never stored by Alice itself, as described in Section 4.1. No method of transmission or storage is completely secure, and the Owner cannot guarantee absolute security. Local Mode and Portable Package data security is your own responsibility, since it depends on the security of your own device.

## 14. Changes to this Privacy Policy
The Owner may update this Policy from time to time. Material changes will be noted in the project's release notes or an in-app notice. Continued use of Alice after a change takes effect constitutes your acceptance of the revised Policy.

## 15. Contact Us
Questions about this Policy, or requests to exercise your data rights, can be directed to the Owner via GitHub Issues, at github.com/reso830/Project_Alice/issues/new. If you are located in the European Economic Area, the United Kingdom, or Switzerland, you also have the right to lodge a complaint with your local data protection supervisory authority.
