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
      period: 'Jan 2022 – Present',
      desc:
        'Led migration of monolithic Rails app to a service-oriented architecture. ' +
        'Reduced p99 API latency by 40% and mentored a team of 4 engineers.',
    },
    {
      role: 'Software Engineer',
      company: 'Bright Labs',
      period: 'Jun 2019 – Dec 2021',
      desc:
        'Built real-time collaboration features in React and Node.js. ' +
        'Owned the deployment pipeline and reduced release time from 2 hours to 15 minutes.',
    },
    {
      role: 'Junior Developer',
      company: 'Pixel Studio',
      period: 'Aug 2018 – May 2019',
      desc: 'Developed marketing landing pages and internal tools using Vue and Python.',
    },
  ],

  education: [
    {
      degree: 'B.S. Computer Science',
      school: 'University of Texas at Austin',
      year: '2018',
    },
  ],

  skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'PostgreSQL', 'SQLite', 'Docker', 'AWS', 'Git'],

  languages: ['English', 'Spanish'],

  certifications: [
    'AWS Certified Developer – Associate (2023)',
    'Google Cloud Professional Cloud Developer (2022)',
  ],

  awards: [
    'Acme Corp Hackathon — 1st Place (2023)',
    "Dean's List, UT Austin (2016, 2017)",
  ],

  links: [
    { platform: 'GitHub', label: 'github.com/alexrivera', url: 'https://github.com/alexrivera' },
    { platform: 'LinkedIn', label: 'linkedin.com/in/alexrivera', url: 'https://www.linkedin.com/in/alexrivera' },
    { platform: 'Portfolio', label: 'alexrivera.dev', url: 'https://alexrivera.dev' },
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
