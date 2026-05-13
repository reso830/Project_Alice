import { describe, expect, it } from 'vitest';
import { parseResumeText } from '../../server/resume/parser.js';

describe('resume parser', () => {
  it('parses contact block fields from separate lines', () => {
    const result = parseResumeText(`
      Jane Smith
      jane@example.com
      +1 (555) 123-4567
      San Francisco, CA
    `);

    expect(result).toMatchObject({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '+1 (555) 123-4567',
      city: 'San Francisco, CA',
    });
  });

  it('removes middle initials and certifications from parsed names', () => {
    const result = parseResumeText(`
      Alvin C. Resoso, PSM-A, RTE, SSM
      alvin@example.com
    `);

    expect(result.firstName).toBe('Alvin');
    expect(result.lastName).toBe('Resoso');
  });

  it('parses phone and location from a combined contact line', () => {
    const result = parseResumeText(`
      Jane Smith
      jane@example.com | +63 917 555 0184 | Metro Manila
    `);

    expect(result).toMatchObject({
      email: 'jane@example.com',
      phone: '+63 917 555 0184',
      city: 'Metro Manila',
    });
  });

  it('adds LinkedIn URLs from the contact block to links', () => {
    const result = parseResumeText(`
      Jane Smith
      https://linkedin.com/in/janesmith
    `);

    expect(result.links).toContainEqual({
      url: 'https://linkedin.com/in/janesmith',
      friendlyName: 'LinkedIn',
    });
  });

  it('adds www. portfolio URLs from the contact block to links', () => {
    const result = parseResumeText(`
      Jane Smith
      www.janesmith.dev
    `);

    expect(result.links).toContainEqual({
      url: 'https://www.janesmith.dev',
      friendlyName: 'Portfolio',
    });
  });

  it('populates summary only when a summary section header is present', () => {
    expect(parseResumeText(`
      Jane Smith

      Summary
      Product-minded engineer.

      Skills
      JavaScript
    `).summary).toBe('Product-minded engineer.');

    expect(parseResumeText(`
      Jane Smith
      Product-minded engineer.

      Skills
      JavaScript
    `).summary).toBeNull();
  });

  it('joins wrapped paragraph lines without joining bullets', () => {
    const result = parseResumeText(`
      Jane Smith

      Summary
      Agile delivery leader with experience across mobile applications and globally distributed
      programs. Hands-on experience performing Scrum Master responsibilities.

      Experience
      Acme Corp
      Senior Engineer
      Jan 2022 - Feb 2024
      • Owned release planning and execution across multiple Scrum teams; introduced
      timeline visualizations that improved milestone clarity.
      • Managed cross-team dependencies.
    `);

    expect(result.summary).toBe(
      'Agile delivery leader with experience across mobile applications and globally distributed programs. Hands-on experience performing Scrum Master responsibilities.',
    );
    expect(result.experience[0].responsibilities).toBe(
      '• Owned release planning and execution across multiple Scrum teams; introduced timeline visualizations that improved milestone clarity.\n• Managed cross-team dependencies.',
    );
  });

  it('parses an experience section with one job block', () => {
    const result = parseResumeText(`
      Jane Smith

      Experience
      Acme Corp
      Senior Engineer
      Jan 2022 - Feb 2024
      Built backend services.
      Improved release automation.
    `);

    expect(result.experience).toEqual([
      {
        company: 'Acme Corp',
        role: 'Senior Engineer',
        responsibilities: 'Built backend services.\nImproved release automation.',
        dateStarted: '01/2022',
        dateEnded: '02/2024',
        currentWork: false,
      },
    ]);
  });

  it('recognizes professional experience as an experience section header', () => {
    const result = parseResumeText(`
      Jane Smith

      Professional Experience
      Acme Corp
      Senior Engineer
      Jan 2022 - Feb 2024
      Built backend services.
    `);

    expect(result.summary).toBeNull();
    expect(result.experience).toHaveLength(1);
    expect(result.experience[0]).toMatchObject({
      company: 'Acme Corp',
      role: 'Senior Engineer',
      responsibilities: 'Built backend services.',
    });
  });

  it('parses company-line date ranges and grouped responsibilities from ATS resume text', () => {
    const result = parseResumeText(`
      Alvin Resoso

      Professional Experience
      Cognizant Technology Solutions Philippines Inc. 2025 August - 2026 April
      Project Manager
      • Owned release planning and execution.
      • Managed cross-team dependencies.
      Dyson Electronics Pte. Ltd. - Philippine Branch 2021 January - 2025 July
      Scrum Master (Multi-team, Beauty Line)
      • Led up to three concurrent local embedded software teams.
      • Supported ART-level delivery.
      Nokia Technology Center Philippines, Inc. 2014 December - 2020 June
      Scrum Master / Software Developer, 2017 January - 2020 June
      • Defined structured workflows.
      Software Developer, 2016 March - 2017 January
      • Delivered features and fixes.
    `);

    expect(result.experience).toHaveLength(4);
    expect(result.experience[0]).toMatchObject({
      company: 'Cognizant Technology Solutions Philippines Inc.',
      role: 'Project Manager',
      responsibilities: '• Owned release planning and execution.\n• Managed cross-team dependencies.',
      dateStarted: '08/2025',
      dateEnded: '04/2026',
    });
    expect(result.experience[2]).toMatchObject({
      company: 'Nokia Technology Center Philippines, Inc.',
      role: 'Scrum Master / Software Developer',
      dateStarted: '01/2017',
      dateEnded: '06/2020',
    });
  });

  it('marks present experience entries as current work', () => {
    const result = parseResumeText(`
      Jane Smith

      Experience
      Acme Corp
      Staff Engineer
      January 2022 - Present
      Leading platform work.
    `);

    expect(result.experience[0]).toMatchObject({
      dateStarted: '01/2022',
      dateEnded: '',
      currentWork: true,
    });
  });

  it('parses experience ranges separated by en or em dashes', () => {
    const result = parseResumeText(`
      Jane Smith

      Experience
      Acme Corp
      Staff Engineer
      Jan 2022 – Dec 2023
      Built platform tools.

      Example Inc
      Developer
      January 2020 — Present
      Built services.
    `);

    expect(result.experience[0]).toMatchObject({
      dateStarted: '01/2022',
      dateEnded: '12/2023',
      currentWork: false,
    });
    expect(result.experience[1]).toMatchObject({
      dateStarted: '01/2020',
      dateEnded: '',
      currentWork: true,
    });
  });

  it('parses skills only from an explicit skills section', () => {
    expect(parseResumeText(`
      Jane Smith

      Skills
      JavaScript, Node.js | React
      CSS
    `).skills).toEqual(['JavaScript', 'Node.js', 'React', 'CSS']);

    expect(parseResumeText(`
      Jane Smith
      Built JavaScript services.
    `).skills).toEqual([]);
  });

  it('parses education entries', () => {
    const result = parseResumeText(`
      Jane Smith

      Education
      State University
      B.S. Computer Science
      2019
    `);

    expect(result.education).toEqual([
      {
        university: 'State University',
        degreeMajor: 'B.S. Computer Science',
        yearCompleted: '2019',
      },
    ]);
  });

  it('recognizes educational attainment as an education section header', () => {
    const result = parseResumeText(`
      Jane Smith

      Educational Attainment
      Bachelor of Science in Electronics and Communications Engineering
      University of the Philippines - Diliman
    `);

    expect(result.certifications).toEqual([]);
    expect(result.education).toEqual([
      {
        university: 'University of the Philippines - Diliman',
        degreeMajor: 'Bachelor of Science in Electronics and Communications Engineering',
        yearCompleted: '',
      },
    ]);
  });

  it('uses the end year from an education date range as yearCompleted', () => {
    const result = parseResumeText(`
      Jane Smith

      Education
      State University
      B.S. Computer Science
      2018 - 2022
    `);

    expect(result.education[0].yearCompleted).toBe('2022');
  });

  it('parses certifications and awards sections', () => {
    const result = parseResumeText(`
      Jane Smith

      Certifications
      AWS Solutions Architect
      Amazon Web Services
      Jun 2022 - Jun 2025

      Awards
      Employee of the Year
      Acme Corp
      Dec 2021
      Recognized for platform reliability work.
    `);

    expect(result.certifications).toEqual([
      {
        name: 'AWS Solutions Architect',
        issuingBody: 'Amazon Web Services',
        issuanceDate: '06/2022',
        expiryDate: '06/2025',
      },
    ]);
    expect(result.awards).toEqual([
      {
        awardName: 'Employee of the Year',
        issuingBody: 'Acme Corp',
        date: '12/2021',
        details: 'Recognized for platform reliability work.',
      },
    ]);
  });

  it('parses certification bullet lines as separate incomplete entries', () => {
    const result = parseResumeText(`
      Jane Smith

      Certifications
      - AWS Certified Cloud Practitioner
      - Google Data Analytics Certificate
    `);

    expect(result.certifications).toEqual([
      {
        name: 'AWS Certified Cloud Practitioner',
        issuingBody: '',
        issuanceDate: '',
        expiryDate: '',
      },
      {
        name: 'Google Data Analytics Certificate',
        issuingBody: '',
        issuanceDate: '',
        expiryDate: '',
      },
    ]);
  });

  it('parses certification bullet lines with issuers and dates', () => {
    const result = parseResumeText(`
      Jane Smith

      Certifications
      • SAFe® 6 Release Train Engineer, Scaled Agile, Inc 2026 April - 2027 April
      • Professional Scrum Master - Advanced, Scrum.org 2026 January
    `);

    expect(result.certifications).toEqual([
      {
        name: 'SAFe® 6 Release Train Engineer',
        issuingBody: 'Scaled Agile, Inc',
        issuanceDate: '04/2026',
        expiryDate: '04/2027',
      },
      {
        name: 'Professional Scrum Master - Advanced',
        issuingBody: 'Scrum.org',
        issuanceDate: '01/2026',
        expiryDate: '',
      },
    ]);
  });

  it('defaults language proficiency to Intermediate when absent', () => {
    const result = parseResumeText(`
      Jane Smith

      Languages
      Spanish
    `);

    expect(result.languages).toEqual([
      {
        language: 'Spanish',
        proficiency: 'Intermediate',
      },
    ]);
  });

  it('returns the complete failure shape for empty input', () => {
    expect(parseResumeText('')).toEqual({
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      city: null,
      summary: null,
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      awards: [],
      languages: [],
      links: [],
    });
  });

  it('normalizes supported date formats', () => {
    const result = parseResumeText(`
      Jane Smith

      Experience
      Acme Corp
      Engineer
      Jan 2022 - January 2023
      Built tools.

      Example Inc
      Developer
      01/2022 - 2024
      Built services.
    `);

    expect(result.experience[0]).toMatchObject({
      dateStarted: '01/2022',
      dateEnded: '01/2023',
    });
    expect(result.experience[1]).toMatchObject({
      dateStarted: '01/2022',
      dateEnded: '01/2024',
    });
  });
});
