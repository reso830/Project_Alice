// Demo seed fixture for the portfolio demo (feature 020). Mirrors the
// 23 active records in `server/seeds/applicationsData.js#DEMO_RECORDS`,
// plus two client-only archived rows used by the archive-view demo, and
// the `server/seeds/profileData.js#DEMO_PROFILE` persona. Records are
// translated from SQLite storage shape to the frontend shape consumed by
// `src/pages/*`.
//
// Parity rule: when the SQLite seed data changes, mirror the change here
// in the same PR. `tests/data/demoStore.test.js` enforces parity by
// asserting `(companyName, jobTitle, status)` triples align by index
// with `DEMO_RECORDS` for the active list and that `getProfile()`
// deep-equals `DEMO_PROFILE`.
//
// Dates: the SQLite seed uses hard-coded calendar dates that drift into
// the past over time. This fixture preserves the **relative spacing**
// between records and anchors the most recent `last_status_update` to
// "today" so the demo always reads as current. Profile biographical
// dates (`dateStarted`, `dateEnded`, `yearCompleted`, certification
// `issuanceDate` / `expiryDate`, award `date`) stay static — they're
// the demo persona's history, not metadata about the demo session.

import { computeCompatibility } from '../models/compatibility.js';
import { toISODate } from '../utils/date.js';

export const DEMO_COMPAT_AS_OF = '2026-05-21';

const SEEDED_COMPAT_SCORED_AT = '2026-06-17T09:00:00.000Z';

// Original calendar dates from the SQLite seed are inlined here so the
// date-shift can preserve relative spacing without re-importing from
// `server/seeds/` (which would cross the client/server boundary).
// 23 entries, one per record in DEMO_RECORDS order. `null` for
// `applicationDate` rows that have no applicationDate in the SQLite seed.
const SOURCE_TIMELINES = [
  [
    { id: 1, date: '2026-04-10', status: 'applied', text: 'Submitted application through LinkedIn.' },
    { id: 2, date: '2026-04-18', status: 'applied', text: 'Jane confirmed the profile is moving to hiring review.' },
  ],
  [
    { id: 1, date: '2026-03-28', status: 'applied', text: 'Applied after Indeed recruiter outreach.' },
    { id: 2, date: '2026-04-04', status: 'phone_screen', text: 'Recruiter screen covered backend scope and on-site expectations.' },
    { id: 3, date: '2026-04-18', status: 'interview', text: 'Panel interview scheduled for next week.' },
    { id: 4, date: '2026-04-18', status: 'interview', text: 'Panel completed; send a concise thank-you note.' },
  ],
  [
    { id: 1, date: '2026-03-15', status: 'applied', text: 'Referral submitted by Maria.' },
    { id: 2, date: '2026-03-22', status: 'phone_screen', text: 'Recruiter screen went well; startup pace confirmed.' },
    { id: 3, date: '2026-04-02', status: 'interview', text: 'Technical interview focused on product launch tradeoffs.' },
    { id: 4, date: '2026-04-22', status: 'offer', text: 'Verbal offer received with five-day decision window.' },
    { id: 5, date: '2026-04-22', status: 'accepted', text: 'Acceptance call tentatively booked after compensation review.' },
  ],
  [
    { id: 1, date: '2026-04-14', status: 'applied', text: 'Applied through company website.' },
    { id: 2, date: '2026-04-18', status: 'phone_screen', text: 'HR call complete; waiting for technical screen invite.' },
  ],
  [
    { id: 1, date: '2026-04-05', status: 'applied', text: 'Applied for ML role via LinkedIn.' },
    { id: 2, date: '2026-04-12', status: 'phone_screen', text: 'Priya described recommendation-engine roadmap.' },
    { id: 3, date: '2026-04-18', status: 'assessment', text: 'Take-home assessment assigned; due 2026-04-30.' },
  ],
  [],
  [
    { id: 1, date: '2026-03-10', status: 'applied', text: 'Applied as a platform backup option.' },
    { id: 2, date: '2026-03-17', status: 'phone_screen', text: 'Recruiter asked about Java depth.' },
    { id: 3, date: '2026-04-01', status: 'rejected', text: 'Rejected; role required more Java experience.' },
  ],
  [
    { id: 1, date: '2026-03-05', status: 'applied', text: 'Submitted through the company careers site.' },
    { id: 2, date: '2026-03-12', status: 'phone_screen', text: 'Alex confirmed fintech reliability scope.' },
    { id: 3, date: '2026-03-22', status: 'interview', text: 'Onsite interview completed.' },
    { id: 4, date: '2026-03-29', status: 'interview', text: 'Followed up after one week with no response.' },
    { id: 5, date: '2026-04-05', status: 'ghosted', text: 'Marked ghosted after second follow-up and no response.' },
  ],
  [
    { id: 1, date: '2026-03-20', status: 'applied', text: 'Referral submitted for React role.' },
    { id: 2, date: '2026-04-23', status: 'withdrawn', text: 'Withdrew after Gamma Digital offer became stronger.' },
  ],
  [
    { id: 1, date: '2026-04-08', status: 'applied', text: 'Exploratory management application submitted.' },
  ],
  [
    { id: 1, date: '2026-04-02', status: 'applied', text: 'Submitted SRE application.' },
    { id: 2, date: '2026-04-09', status: 'phone_screen', text: 'Recruiter outreach from Dana; incident-response fit discussed.' },
    { id: 3, date: '2026-04-21', status: 'interview', text: 'Onsite scheduled for reliability and system design.' },
    { id: 4, date: '2026-04-29', status: 'interview', text: 'Future onsite reminder: review incident postmortems.' },
  ],
  [
    { id: 1, date: '2026-04-16', status: 'applied', text: 'Applied via AngelList.' },
    { id: 2, date: '2026-04-24', status: 'phone_screen', text: 'Recruiter screen done; Swift depth is the stretch area.' },
  ],
  [
    { id: 1, date: '2026-04-09', status: 'applied', text: 'Applied for data engineering role.' },
    { id: 2, date: '2026-04-16', status: 'phone_screen', text: 'Omar explained SQL and Python assessment format.' },
    { id: 3, date: '2026-04-22', status: 'assessment', text: 'Technical assessment opened; three-hour window.' },
    { id: 4, date: '2026-04-28', status: 'assessment', text: 'Follow-up reminder: submit take-home before deadline.' },
  ],
  [
    { id: 1, date: '2026-04-25', status: 'wishlisted', text: 'Wishlisted dream staff role for later review.' },
  ],
  [
    { id: 1, date: '2026-04-10', status: 'applied', text: 'Applied as a backup enterprise Java option.' },
  ],
  [
    { id: 1, date: '2026-03-18', status: 'applied', text: 'Applied despite embedded experience gap.' },
    { id: 2, date: '2026-04-03', status: 'rejected', text: 'Rejected; C/C++ embedded depth was below requirement.' },
  ],
  [
    { id: 1, date: '2026-03-25', status: 'applied', text: 'Referral application submitted.' },
    { id: 2, date: '2026-04-10', status: 'withdrawn', text: 'Withdrew after salary and on-site details landed.' },
  ],
  [
    { id: 1, date: '2026-03-12', status: 'applied', text: 'Applied for cloud architecture track.' },
    { id: 2, date: '2026-03-21', status: 'phone_screen', text: 'Rachel reviewed AWS migration background.' },
    { id: 3, date: '2026-04-04', status: 'interview', text: 'Architecture interview covered network segmentation.' },
    { id: 4, date: '2026-04-20', status: 'offer', text: 'Offer received; useful for negotiation.' },
  ],
  [
    { id: 1, date: '2026-03-22', status: 'applied', text: 'Applied through security careers page.' },
    { id: 2, date: '2026-03-30', status: 'interview', text: 'Technical screen completed.' },
    { id: 3, date: '2026-04-06', status: 'interview', text: 'Followed up once after no response.' },
    { id: 4, date: '2026-04-10', status: 'ghosted', text: 'Marked ghosted after silence from Victor.' },
  ],
  [
    { id: 1, date: '2026-04-18', status: 'applied', text: 'Applied through AngelList.' },
    { id: 2, date: '2026-04-24', status: 'phone_screen', text: 'Nadia recruiter screen covered Series B pace.' },
  ],
  [
    { id: 1, date: '2026-04-01', status: 'applied', text: 'Applied for client-facing solutions role.' },
    { id: 2, date: '2026-04-11', status: 'phone_screen', text: 'Recruiter outreach clarified travel expectations.' },
    { id: 3, date: '2026-04-19', status: 'interview', text: 'Technical discovery interview scheduled.' },
  ],
  [
    { id: 1, date: '2026-04-21', status: 'applied', text: 'Applied to broaden the network engineering pipeline.' },
  ],
  [
    { id: 1, date: '2026-04-26', status: 'wishlisted', text: 'Wishlisted recently posted frontend architecture role.' },
  ],
  [
    { id: 1, date: '2026-02-20', status: 'applied', text: 'Applied to archived favorite demo role.' },
    { id: 2, date: '2026-03-01', status: 'assessment', text: 'Archived favorite row: assessment stayed open before archiving.' },
  ],
  [
    { id: 1, date: '2026-02-28', status: 'applied', text: 'Applied to archived terminal demo role.' },
    { id: 2, date: '2026-03-10', status: 'rejected', text: 'Archived terminal row: rejected before the record was archived.' },
  ],
];

const SOURCE_MIN_YEARS_EXPERIENCE = [
  4,
  4,
  5,
  3,
  3,
  2,
  5,
  6,
  3,
  6,
  4,
  2,
  3,
  6,
  4,
  3,
  2,
  4,
  4,
  3,
  5,
  5,
  5,
  4,
  2,
];

const SOURCE_RECORDS = [
  {
    companyName: 'Acme Corp',
    jobTitle: 'Senior Software Engineer',
    status: 'applied',
    compat: 86,
    fav: true,
    salary: 120000,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: 'https://jobs.example.com/acme-fe',
    recruiter: 'Jane Smith',
    notes: 'Strong culture fit. Hybrid role, 2 days in office.',
    responsibilities: 'Build scalable React and TypeScript corporate web applications with Node.js and PostgreSQL, developer tooling, clean architecture, Jest tests, GraphQL APIs, and accessible design-system workflows. AWS Certified Developer and Google Cloud Professional Cloud Developer experience are useful.',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Jest'],
    applicationDate: '2026-04-10',
    lastStatusUpdate: '2026-04-18',
    location: 'Makati',
    shift: 'Day',
    workSetup: 'Hybrid',
    compatNotes: 'Strong React match; culture fit confirmed.',
    compatAnalysis: {
      summary: 'Great full-stack fit',
      body: 'React, TypeScript, Node.js, PostgreSQL, Jest, and GraphQL line up with Alex\'s strongest production history, and the certification language gives the cloud expectations a helpful boost.',
      generatedAt: '2026-06-17T09:10:00.000Z',
    },
    generalNotes: null,
    preferredSkills: ['GraphQL', 'Docker', 'AWS'],
  },
  {
    companyName: 'Beta Systems',
    jobTitle: 'Backend Engineer',
    status: 'interview',
    compat: 56,
    fav: false,
    salary: 130000,
    sourcePlatform: 'Indeed',
    jobPostingUrl: 'https://jobs.example.com/beta-backend',
    recruiter: 'Tom Lee',
    notes: 'Second round scheduled for next week. Panel format.',
    responsibilities: 'Steward order-management APIs for a regional logistics group, using PostgreSQL migration playbooks and calm on-call runbooks.',
    skills: ['Node.js', 'PostgreSQL', 'Docker', 'AWS'],
    applicationDate: '2026-03-28',
    lastStatusUpdate: '2026-04-18',
    location: 'BGC',
    shift: 'Day',
    workSetup: 'On-site',
    compatNotes: null,
    generalNotes: 'Second round prep needed.',
    preferredSkills: [],
  },
  {
    companyName: 'Gamma Digital',
    jobTitle: 'Full Stack Developer',
    status: 'offer',
    compat: 67,
    fav: true,
    salary: 145000,
    sourcePlatform: 'Referral',
    jobPostingUrl: null,
    recruiter: 'Maria Chen',
    notes: 'Verbal offer received. Five-day response window in progress.',
    responsibilities: 'Guide two startup product pods from discovery to launch, splitting time between React workflows, Node services, and release decisions.',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Redis'],
    applicationDate: '2026-03-15',
    lastStatusUpdate: '2026-04-22',
    location: null,
    shift: 'Flexible',
    workSetup: 'Remote',
    compatNotes: 'Best overall fit of current round.',
    compatAnalysis: {
      summary: 'Full-stack match',
      body: 'The role combines React, Node.js, TypeScript, PostgreSQL, and Redis, matching Alex\'s strongest production history.',
      generatedAt: '2026-06-17T08:30:00.000Z',
    },
    generalNotes: null,
    preferredSkills: ['GraphQL', 'Redis'],
  },
  {
    companyName: 'Delta Cloud',
    jobTitle: 'DevOps Engineer',
    status: 'phone_screen',
    compat: 52,
    fav: false,
    salary: 110000,
    sourcePlatform: 'Company website',
    jobPostingUrl: 'https://jobs.example.com/delta-devops',
    recruiter: null,
    notes: 'Initial call with HR went well. Waiting for technical screen invite.',
    responsibilities: 'Harden deployment paths for a cloud infrastructure team, tuning AWS services, Docker images, Kubernetes clusters, Python automation, and incident drills.',
    skills: ['Kubernetes', 'Docker', 'AWS', 'Python'],
    applicationDate: '2026-04-14',
    lastStatusUpdate: '2026-04-18',
    location: null,
    shift: 'Mid',
    workSetup: 'Hybrid',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: ['PostgreSQL'],
  },
  {
    companyName: 'Epsilon AI',
    jobTitle: 'Software Engineer, AI Platform',
    status: 'assessment',
    compat: 52,
    fav: false,
    salary: 150000,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: 'https://jobs.example.com/epsilon-ml',
    recruiter: 'Priya Nair',
    notes: 'Take-home project due 2026-04-30. Build a small recommendation engine.',
    responsibilities: 'Build Python services for AI product workflows, using PostgreSQL, Docker, SQL, and clean architecture to support model experiments.',
    skills: ['Python', 'PostgreSQL', 'Docker', 'SQL'],
    applicationDate: '2026-04-05',
    lastStatusUpdate: '2026-04-19',
    location: 'Ortigas',
    shift: 'Day',
    workSetup: 'Remote',
    compatNotes: 'Good ML stack overlap.',
    generalNotes: 'Take-home due soon.',
    preferredSkills: ['AWS', 'Node.js'],
  },
  {
    companyName: 'Zeta Health',
    jobTitle: 'Software Engineer',
    status: 'wishlisted',
    compat: 60,
    fav: false,
    salary: null,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: 'https://jobs.example.com/zeta-swe',
    recruiter: null,
    notes: 'Interesting mission. Not ready to apply — revisit after current round.',
    responsibilities: 'Map patient-facing workflow risks before applying, comparing Django service boundaries with the health-tech team mission.',
    skills: ['Python', 'Django', 'React'],
    applicationDate: null,
    lastStatusUpdate: '2026-04-23',
    location: null,
    shift: null,
    workSetup: null,
    compatNotes: null,
    generalNotes: null,
    preferredSkills: ['Node.js', 'Jest'],
  },
  {
    companyName: 'Eta Retail',
    jobTitle: 'Platform Engineer',
    status: 'rejected',
    compat: 27,
    fav: false,
    salary: 115000,
    sourcePlatform: 'Indeed',
    jobPostingUrl: null,
    recruiter: 'Chris Park',
    notes: 'Generic rejection email. Role required more Java experience.',
    responsibilities: 'Modernize developer tooling for a retail engineering department, replacing manual Java release steps with Kafka-aware platform services.',
    skills: ['Java', 'Spring Boot', 'Kafka'],
    applicationDate: '2026-03-10',
    lastStatusUpdate: '2026-04-01',
    location: 'Manila',
    shift: 'Night',
    workSetup: 'On-site',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: [],
  },
  {
    companyName: 'Theta Finance',
    jobTitle: 'Senior Engineer',
    status: 'ghosted',
    compat: 51,
    fav: false,
    salary: 140000,
    sourcePlatform: 'Company website',
    jobPostingUrl: 'https://jobs.example.com/theta-sre',
    recruiter: 'Alex Wong',
    notes: 'No response after onsite interview on 2026-03-22. Followed up twice.',
    responsibilities: 'Drive reliability reviews across fintech payment services, mentoring senior peers on Go tracing, SLO budgets, and database failover.',
    skills: ['Go', 'Kubernetes', 'Prometheus', 'PostgreSQL'],
    applicationDate: '2026-03-05',
    lastStatusUpdate: '2026-03-22',
    location: null,
    shift: null,
    workSetup: 'Remote',
    compatNotes: null,
    generalNotes: 'Followed up twice; no response.',
    preferredSkills: [],
  },
  {
    companyName: 'Iota Media',
    jobTitle: 'Senior Software Engineer',
    status: 'withdrawn',
    compat: 79,
    fav: false,
    salary: 105000,
    sourcePlatform: 'Referral',
    jobPostingUrl: null,
    recruiter: 'Sam Rivera',
    notes: 'Withdrew after receiving the Gamma Digital offer.',
    responsibilities: 'Build React, GraphQL, and TypeScript collaboration features with clean architecture and user-facing performance improvements.',
    skills: ['React', 'TypeScript', 'GraphQL', 'JavaScript'],
    applicationDate: '2026-03-20',
    lastStatusUpdate: '2026-04-23',
    location: null,
    shift: 'Night',
    workSetup: 'Remote',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: [],
  },
  {
    companyName: 'Kappa Labs',
    jobTitle: 'Engineering Manager',
    status: 'applied',
    compat: 52,
    fav: false,
    salary: 160000,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: 'https://jobs.example.com/kappa-em',
    recruiter: null,
    notes: 'Exploratory — not actively pursuing management yet.',
    responsibilities: 'Coach a six-person web application team through roadmap planning, hiring calibration, Node.js service ownership, React delivery, and clean architecture practices.',
    skills: ['Node.js', 'React', 'Python', 'JavaScript'],
    applicationDate: '2026-04-08',
    lastStatusUpdate: '2026-04-08',
    location: null,
    shift: null,
    workSetup: 'Hybrid',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: ['TypeScript', 'PostgreSQL'],
  },
  {
    companyName: 'Lambda Ops',
    jobTitle: 'Software Reliability Engineer',
    status: 'interview',
    compat: 60,
    fav: false,
    salary: 135000,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: 'https://jobs.example.com/lambda-sre',
    recruiter: 'Dana Hill',
    notes: 'Onsite scheduled for 2026-04-29. Will cover incident response and system design.',
    responsibilities: 'Support scalable web applications by improving Node.js services, PostgreSQL reliability, Docker deployments, AWS monitoring, and incident reviews.',
    skills: ['Node.js', 'PostgreSQL', 'Docker', 'AWS'],
    applicationDate: '2026-04-02',
    lastStatusUpdate: '2026-04-21',
    location: null,
    shift: 'Day',
    workSetup: 'Remote',
    compatNotes: 'Strong reliability background.',
    compatAnalysis: {
      summary: 'Reliability bridge',
      body: 'Node.js, PostgreSQL, Docker, AWS, and incident-review work make this a credible operations-adjacent match, while Kubernetes depth is still more developing than senior.',
      generatedAt: '2026-06-17T09:05:00.000Z',
    },
    generalNotes: null,
    preferredSkills: ['Kubernetes', 'Python'],
  },
  {
    companyName: 'Mu Technologies',
    jobTitle: 'iOS Developer',
    status: 'phone_screen',
    compat: 27,
    fav: false,
    salary: 115000,
    sourcePlatform: 'AngelList',
    jobPostingUrl: 'https://jobs.example.com/mu-ios',
    recruiter: 'Lena Park',
    notes: 'Recruiter screen done. Stretch role — Swift experience is limited.',
    responsibilities: 'Deliver SwiftUI features for a mobile startup, negotiating API contracts with backend engineers before each App Store release.',
    skills: ['Swift', 'SwiftUI', 'Xcode', 'REST APIs'],
    applicationDate: '2026-04-16',
    lastStatusUpdate: '2026-04-24',
    location: null,
    shift: 'Mid',
    workSetup: 'On-site',
    compatNotes: null,
    generalNotes: 'Stretch role.',
    preferredSkills: [],
  },
  {
    companyName: 'Nu Analytics',
    jobTitle: 'Software Engineer',
    status: 'assessment',
    compat: 64,
    fav: false,
    salary: 125000,
    sourcePlatform: 'Indeed',
    jobPostingUrl: 'https://jobs.example.com/nu-de',
    recruiter: 'Omar Hassan',
    notes: 'SQL + Python take-home. 3-hour window, due 2026-04-28.',
    responsibilities: 'Build Python and PostgreSQL data workflows for product analytics while supporting web application teams and clean architecture practices.',
    skills: ['Python', 'PostgreSQL', 'SQL', 'Docker'],
    applicationDate: '2026-04-09',
    lastStatusUpdate: '2026-04-22',
    location: 'BGC',
    shift: 'Day',
    workSetup: 'Hybrid',
    compatNotes: 'Solid data engineering match.',
    generalNotes: null,
    preferredSkills: ['AWS', 'Node.js'],
  },
  {
    companyName: 'Xi Studio',
    jobTitle: 'Staff Software Engineer',
    status: 'wishlisted',
    compat: 69,
    fav: true,
    salary: 170000,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: 'https://jobs.example.com/xi-staff',
    recruiter: null,
    notes: 'Dream role — wait until current round settles before applying.',
    responsibilities: 'Guide TypeScript and Node.js architecture for scalable web applications, developer tooling, clean service boundaries, and mentoring engineers.',
    skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'React'],
    applicationDate: null,
    lastStatusUpdate: '2026-04-25',
    location: null,
    shift: null,
    workSetup: 'Remote',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: ['GraphQL', 'AWS'],
  },
  {
    companyName: 'Omicron Bank',
    jobTitle: 'Java Developer',
    status: 'applied',
    compat: 25,
    fav: false,
    salary: 118000,
    sourcePlatform: 'Company website',
    jobPostingUrl: 'https://jobs.example.com/omicron-java',
    recruiter: null,
    notes: 'Applied as a backup option. Heavy enterprise Java stack.',
    responsibilities: 'Refactor compliance-heavy banking services in Spring Boot, keeping Oracle-backed payment flows auditable and predictable.',
    skills: ['Java', 'Spring Boot', 'Oracle DB', 'Maven'],
    applicationDate: '2026-04-17',
    lastStatusUpdate: '2026-04-10',
    location: 'Makati',
    shift: 'Day',
    workSetup: 'On-site',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: [],
  },
  {
    companyName: 'Pi Robotics',
    jobTitle: 'Embedded Software Engineer',
    status: 'rejected',
    compat: 29,
    fav: false,
    salary: 110000,
    sourcePlatform: 'Indeed',
    jobPostingUrl: null,
    recruiter: 'Ingrid Sato',
    notes: 'Required 3+ years of C/C++ embedded experience. Not a match.',
    responsibilities: 'Implement embedded control loops for robotics hardware, validating RTOS timing assumptions on ARM prototypes.',
    skills: ['C', 'C++', 'RTOS', 'ARM'],
    applicationDate: '2026-03-18',
    lastStatusUpdate: '2026-04-03',
    location: null,
    shift: null,
    workSetup: 'Field',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: [],
  },
  {
    companyName: 'Rho Games',
    jobTitle: 'Game Developer',
    status: 'withdrawn',
    compat: 37,
    fav: false,
    salary: 95000,
    sourcePlatform: 'Referral',
    jobPostingUrl: null,
    recruiter: 'Jake Moon',
    notes: 'Withdrew — salary range too low and fully on-site.',
    responsibilities: 'Prototype Unity gameplay loops for a mobile game studio, coordinating C# systems work with design telemetry.',
    skills: ['C#', 'Unity', 'Git', 'Agile'],
    applicationDate: '2026-03-25',
    lastStatusUpdate: '2026-04-10',
    location: null,
    shift: null,
    workSetup: 'On-site',
    compatNotes: null,
    generalNotes: 'Salary too low; fully on-site.',
    preferredSkills: [],
  },
  {
    companyName: 'Sigma Cloud',
    jobTitle: 'Software Engineer',
    status: 'offer',
    compat: 77,
    fav: true,
    salary: 165000,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: 'https://jobs.example.com/sigma-arch',
    recruiter: 'Rachel Kim',
    notes: 'Competing offer — using to negotiate with Gamma Digital.',
    responsibilities: 'Build AWS-backed developer tooling and scalable web services with Python, PostgreSQL, Docker, and clean architecture. AWS Certified Developer background is valuable.',
    skills: ['Python', 'PostgreSQL', 'Docker', 'AWS'],
    applicationDate: '2026-03-12',
    lastStatusUpdate: '2026-04-20',
    location: null,
    shift: 'Flexible',
    workSetup: 'Remote',
    compatNotes: 'Strong cloud match.',
    generalNotes: 'Competing offer; using for negotiation.',
    preferredSkills: ['Node.js', 'TypeScript'],
  },
  {
    companyName: 'Tau Security',
    jobTitle: 'Application Security Engineer',
    status: 'ghosted',
    compat: 55,
    fav: false,
    salary: 140000,
    sourcePlatform: 'Company website',
    jobPostingUrl: 'https://jobs.example.com/tau-sec',
    recruiter: 'Victor Olsen',
    notes: 'Completed technical screen on 2026-03-30. No word since.',
    responsibilities: 'Lead security reviews for SaaS web application teams, combining Python automation, AWS controls, OWASP threat models, and developer tooling.',
    skills: ['Python', 'AWS', 'JavaScript', 'Docker'],
    applicationDate: '2026-03-22',
    lastStatusUpdate: '2026-03-30',
    location: null,
    shift: 'Mid',
    workSetup: 'Remote',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: ['Node.js', 'PostgreSQL'],
  },
  {
    companyName: 'Upsilon Dev',
    jobTitle: 'Software Engineer II',
    status: 'phone_screen',
    compat: 69,
    fav: false,
    salary: 125000,
    sourcePlatform: 'AngelList',
    jobPostingUrl: 'https://jobs.example.com/upsilon-swe2',
    recruiter: 'Nadia Flores',
    notes: 'Fast-growing Series B. Engineering team of 15.',
    responsibilities: 'Build first-version collaboration features for a Series B startup, moving quickly across React, Node.js, and PostgreSQL.',
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    applicationDate: '2026-04-18',
    lastStatusUpdate: '2026-04-24',
    location: null,
    shift: 'Day',
    workSetup: 'Remote',
    compatNotes: null,
    generalNotes: 'Fast-growing Series B.',
    preferredSkills: [],
  },
  {
    companyName: 'Phi Systems',
    jobTitle: 'Solutions Architect',
    status: 'interview',
    compat: 17,
    fav: false,
    salary: 155000,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: null,
    recruiter: 'Marcus Bell',
    notes: 'Client-facing role — heavier travel than expected. Worth exploring.',
    responsibilities: 'Translate enterprise integration needs into Salesforce and AWS solution diagrams during client-facing technical discovery.',
    skills: ['AWS', 'Salesforce', 'REST APIs', 'Solution design'],
    applicationDate: '2026-04-01',
    lastStatusUpdate: '2026-04-19',
    location: 'Makati',
    shift: 'Flexible',
    workSetup: 'Hybrid',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: [],
  },
  {
    companyName: 'Chi Networks',
    jobTitle: 'Senior Network Engineer',
    status: 'applied',
    compat: 29,
    fav: false,
    salary: 120000,
    sourcePlatform: 'Indeed',
    jobPostingUrl: 'https://jobs.example.com/chi-net',
    recruiter: null,
    notes: 'Long shot — applied to broaden the pipeline.',
    responsibilities: 'Plan resilient enterprise network upgrades, documenting BGP routing choices and security handoffs for operations teams.',
    skills: ['Cisco', 'BGP', 'OSPF', 'Network security'],
    applicationDate: '2026-04-21',
    lastStatusUpdate: '2026-04-21',
    location: null,
    shift: null,
    workSetup: null,
    compatNotes: null,
    generalNotes: null,
    preferredSkills: [],
  },
  {
    companyName: 'Psi Corp',
    jobTitle: 'Senior Software Engineer',
    status: 'wishlisted',
    compat: 77,
    fav: false,
    salary: null,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: 'https://jobs.example.com/psi-fe-arch',
    recruiter: null,
    notes: 'Posted recently. Revisit after the current interview round wraps.',
    responsibilities: 'Lead React and TypeScript frontend architecture for scalable web applications, design systems, developer tooling, clean architecture, and mentoring.',
    skills: ['React', 'TypeScript', 'JavaScript', 'Node.js'],
    applicationDate: null,
    lastStatusUpdate: '2026-04-26',
    location: null,
    shift: 'Night',
    workSetup: 'Remote',
    compatNotes: 'Interesting frontend architecture scope.',
    generalNotes: null,
    preferredSkills: ['GraphQL', 'Jest', 'Figma'],
  },
  // Archived demo coverage: favorite non-terminal row for restore/fav preservation.
  {
    companyName: 'Archive Labs',
    jobTitle: 'Design Systems Engineer',
    status: 'assessment',
    compat: 30,
    fav: true,
    salary: 132000,
    sourcePlatform: 'LinkedIn',
    jobPostingUrl: 'https://jobs.example.com/archive-labs-ds',
    recruiter: 'Mina Brooks',
    notes: 'Archived after the assessment window moved behind a stronger pipeline.',
    responsibilities: 'Maintain a production component library while coordinating accessibility fixes, token migrations, and release notes across product teams.',
    skills: ['React', 'Design systems', 'Accessibility', 'CSS'],
    applicationDate: '2026-02-20',
    lastStatusUpdate: '2026-03-01',
    location: null,
    shift: 'Day',
    workSetup: 'Remote',
    compatNotes: 'Strong design-system overlap.',
    generalNotes: null,
    preferredSkills: ['Figma', 'Storybook'],
    archived: true,
    archivedDate: '2026-04-15',
  },
  // Archived demo coverage: terminal non-favorite row for restore edge cases.
  {
    companyName: 'Beacon Robotics',
    jobTitle: 'Robotics QA Engineer',
    status: 'rejected',
    compat: 29,
    fav: false,
    salary: 98000,
    sourcePlatform: 'Company website',
    jobPostingUrl: 'https://jobs.example.com/beacon-robotics-qa',
    recruiter: 'Owen Malik',
    notes: 'Archived after a polite rejection clarified the role needed heavier hardware QA depth.',
    responsibilities: 'Validate robotic picking workflows by writing browser dashboards, test plans, and incident summaries for hardware and software partners.',
    skills: ['JavaScript', 'QA', 'Robotics', 'Test planning'],
    applicationDate: '2026-02-28',
    lastStatusUpdate: '2026-03-10',
    location: 'Austin, TX',
    shift: 'Mid',
    workSetup: 'Hybrid',
    compatNotes: null,
    generalNotes: null,
    preferredSkills: ['Playwright', 'Hardware QA'],
    archived: true,
    archivedDate: '2026-04-20',
  },
];

// Demo persona — mirrors `server/seeds/profileData.js#DEMO_PROFILE`
// verbatim. The SQLite seed already stores this in frontend shape
// (camelCase, arrays) so no transformation is needed.
const SOURCE_PROFILE = {
  firstName: 'Alex',
  lastName: 'Rivera',
  city: 'Austin, TX',
  email: 'alex.rivera@example.com',
  phone: '(512) 555-0142',
  summary:
    'Full-stack engineer with 6 years of experience building scalable web applications. ' +
    'Passionate about developer tooling, clean architecture, and shipping products that users love.',

  experience: [
    {
      role: 'Senior Software Engineer',
      company: 'Acme Corp',
      responsibilities:
        'Led migration of monolithic Rails app to a service-oriented architecture. ' +
        'Reduced p99 API latency by 40% and mentored a team of 4 engineers.',
      dateStarted: '01/2022',
      dateEnded: '',
      currentWork: true,
    },
    {
      role: 'Software Engineer',
      company: 'Bright Labs',
      responsibilities:
        'Built real-time collaboration features in React and Node.js. ' +
        'Owned the deployment pipeline and reduced release time from 2 hours to 15 minutes.',
      dateStarted: '06/2019',
      dateEnded: '12/2021',
      currentWork: false,
    },
    {
      role: 'Junior Developer',
      company: 'Pixel Studio',
      responsibilities: 'Developed marketing landing pages and internal tools using Vue and Python.',
      dateStarted: '08/2018',
      dateEnded: '05/2019',
      currentWork: false,
    },
  ],

  education: [
    {
      degreeMajor: 'B.S. Computer Science',
      university: 'University of Texas at Austin',
      yearCompleted: '2018',
    },
  ],

  skills: [
    { name: 'JavaScript', level: 5 },
    { name: 'TypeScript', level: 5 },
    { name: 'React', level: 4 },
    { name: 'Node.js', level: 4 },
    { name: 'Python', level: 3 },
    { name: 'PostgreSQL', level: 4 },
    { name: 'SQLite', level: 3 },
    { name: 'Docker', level: 3 },
    { name: 'AWS', level: 2 },
    { name: 'Git', level: 5 },
    { name: 'GraphQL', level: 3 },
    { name: 'Kubernetes', level: 2 },
    { name: 'Figma', level: 1 },
    { name: 'Jest', level: 4 },
  ],

  languages: [
    { language: 'English', proficiency: 'Fluent' },
    { language: 'Spanish', proficiency: 'Professional' },
  ],

  certifications: [
    {
      name: 'AWS Certified Developer - Associate',
      issuingBody: 'Amazon Web Services',
      certificateId: 'AWS-DEV-2023',
      issuanceDate: '03/2023',
      expiryDate: '03/2026',
    },
    {
      name: 'Google Cloud Professional Cloud Developer',
      issuingBody: 'Google Cloud',
      certificateId: 'GCP-CD-2022',
      issuanceDate: '08/2022',
      expiryDate: '08/2024',
    },
  ],

  awards: [
    {
      awardName: 'Acme Corp Hackathon - 1st Place',
      issuingBody: 'Acme Corp',
      details: 'Won internal hackathon for an application tracking prototype.',
      date: '11/2023',
    },
    {
      awardName: "Dean's List",
      issuingBody: 'University of Texas at Austin',
      details: 'Academic recognition for 2016 and 2017.',
      date: '05/2017',
    },
  ],

  links: [
    { friendlyName: 'GitHub', url: 'https://github.com/alexrivera' },
    { friendlyName: 'LinkedIn', url: 'https://www.linkedin.com/in/alexrivera' },
    { friendlyName: 'Portfolio', url: 'https://alexrivera.dev' },
  ],
};

function deepClone(value) {
  return typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function parseISODate(isoString) {
  // Construct dates via the `YYYY-MM-DD` → epoch path so the shift math
  // operates in UTC and avoids timezone-induced day rollovers.
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function attachSourceTimelines(records) {
  if (records.length !== SOURCE_TIMELINES.length) {
    throw new Error('Demo seed records and timelines must stay aligned.');
  }

  return records.map((record, index) => ({
    ...record,
    timeline: deepClone(SOURCE_TIMELINES[index]),
  }));
}

function attachMinYearsExperience(records) {
  if (records.length !== SOURCE_MIN_YEARS_EXPERIENCE.length) {
    throw new Error('Demo seed records and min-years fixtures must stay aligned.');
  }

  return records.map((record, index) => ({
    ...record,
    minYearsExperience: SOURCE_MIN_YEARS_EXPERIENCE[index],
  }));
}

function attachCompatibility(records, profile) {
  return records.map((record) => ({
    ...record,
    compat: computeCompatibility(profile, record, { asOf: DEMO_COMPAT_AS_OF }).score,
    compatScoredAt: record.compatScoredAt ?? SEEDED_COMPAT_SCORED_AT,
    compatAnalysis: record.compatAnalysis ?? null,
  }));
}

function shiftDates(records) {
  // The shift anchors the most recent `lastStatusUpdate` in the SQLite
  // seed to today, preserving the relative spacing between all rows.
  const maxOriginalMs = records.reduce((acc, record) => {
    const t = parseISODate(record.lastStatusUpdate).getTime();
    return t > acc ? t : acc;
  }, 0);
  const todayMs = parseISODate(toISODate(new Date())).getTime();
  const offsetMs = todayMs - maxOriginalMs;

  return records.map((record, index) => {
    const shifted = {
      ...record,
      id: index + 1,
      timeline: record.timeline.map((entry) => ({
        ...entry,
        date: toISODate(new Date(parseISODate(entry.date).getTime() + offsetMs)),
      })),
    };
    shifted.lastStatusUpdate = toISODate(
      new Date(parseISODate(record.lastStatusUpdate).getTime() + offsetMs),
    );
    if (record.applicationDate) {
      shifted.applicationDate = toISODate(
        new Date(parseISODate(record.applicationDate).getTime() + offsetMs),
      );
    }
    return shifted;
  });
}

export function buildDemoSeed() {
  const profile = deepClone(SOURCE_PROFILE);
  const applications = shiftDates(
    attachSourceTimelines(attachMinYearsExperience(deepClone(SOURCE_RECORDS))),
  );

  return {
    applications: attachCompatibility(applications, profile),
    profile,
  };
}
