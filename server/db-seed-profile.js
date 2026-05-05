import { initSchema } from './db.js';
import { saveProfile } from './db/profile.js';

initSchema();

const DEMO_PROFILE = {
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

  skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'PostgreSQL', 'SQLite', 'Docker', 'AWS', 'Git'],

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

try {
  const saved = saveProfile(DEMO_PROFILE);
  console.log('Profile seeded successfully.');
  console.log(`  Name  : ${saved.firstName} ${saved.lastName}`);
  console.log(`  City  : ${saved.city}`);
  console.log(`  Email : ${saved.email}`);
  process.exit(0);
} catch (error) {
  console.error('Failed to seed profile:', error.message);
  process.exit(1);
}
