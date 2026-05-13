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
