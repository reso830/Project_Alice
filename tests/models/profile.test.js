import { describe, expect, it } from 'vitest';
import {
  computeAppCounts,
  computeStats,
  normaliseProfile,
  validateProfile,
} from '../../src/models/profile.js';

describe('profile model', () => {
  it('treats null, arrays, and primitives as empty input without throwing', () => {
    for (const bad of [null, [], 42, 'string', true]) {
      expect(() => normaliseProfile(bad)).not.toThrow();
      expect(normaliseProfile(bad)).toMatchObject({ firstName: '', lastName: '', skills: [] });
    }
  });

  it('requires first and last name', () => {
    expect(validateProfile({ lastName: 'Rivera' })).toEqual({
      valid: false,
      errors: { firstName: 'First Name is required.' },
    });
    expect(validateProfile({ firstName: 'Ana' })).toEqual({
      valid: false,
      errors: { lastName: 'Last Name is required.' },
    });
  });

  it('validates email format when provided', () => {
    expect(validateProfile({
      firstName: 'Ana',
      lastName: 'Rivera',
      email: 'not-an-email',
    })).toEqual({
      valid: false,
      errors: { email: 'Email must be a valid email address.' },
    });
  });

  it('accepts a valid full profile object', () => {
    expect(validateProfile({
      firstName: 'Ana',
      lastName: 'Rivera',
      email: 'ana@example.com',
    })).toEqual({ valid: true, errors: {} });
  });

  it('normalises profile strings and arrays', () => {
    expect(normaliseProfile({
      firstName: ' Ana ',
      lastName: ' Rivera ',
      city: ' Taipei ',
      skills: [' JavaScript ', '', ' CSS '],
      languages: undefined,
    })).toMatchObject({
      firstName: 'Ana',
      lastName: 'Rivera',
      city: 'Taipei',
      skills: ['JavaScript', 'CSS'],
      languages: [],
      experience: [],
    });
  });

  it('normalises legacy profile entry shapes into the new model', () => {
    expect(normaliseProfile({
      experience: [{
        role: ' Engineer ',
        company: ' Acme ',
        desc: ' Built things ',
      }],
      education: [{
        degree: ' BS Computer Science ',
        school: ' State University ',
        year: ' 2020 ',
      }],
      certifications: [' AWS Developer '],
      awards: [' Innovation Award '],
      languages: [' English '],
      links: [{
        platform: 'GitHub',
        label: ' Code ',
        url: ' https://github.com/ana ',
      }],
    })).toMatchObject({
      experience: [{
        role: 'Engineer',
        company: 'Acme',
        responsibilities: 'Built things',
        dateStarted: '',
        dateEnded: '',
        currentWork: false,
      }],
      education: [{
        degreeMajor: 'BS Computer Science',
        university: 'State University',
        yearCompleted: '2020',
      }],
      certifications: [{
        name: 'AWS Developer',
        issuingBody: '',
        certificateId: '',
        issuanceDate: '',
        expiryDate: '',
      }],
      awards: [{
        awardName: 'Innovation Award',
        issuingBody: '',
        details: '',
        date: '',
      }],
      languages: [{
        language: 'English',
        proficiency: '',
      }],
      links: [{
        url: 'https://github.com/ana',
        friendlyName: 'Code',
      }],
    });
  });

  it('normalises new profile entry shapes without dropping data', () => {
    expect(normaliseProfile({
      experience: [{
        role: 'Engineer',
        company: 'Acme',
        responsibilities: 'Build apps',
        dateStarted: '01/2020',
        dateEnded: '02/2024',
        currentWork: false,
      }],
      education: [{
        degreeMajor: 'MS Data Science',
        university: 'Tech University',
        yearCompleted: '2022',
      }],
      certifications: [{
        name: 'Security Plus',
        issuingBody: 'CompTIA',
        certificateId: 'ABC',
        issuanceDate: '03/2023',
        expiryDate: '03/2026',
      }],
      awards: [{
        awardName: 'Top Performer',
        issuingBody: 'Acme',
        details: 'Quarterly award',
        date: '04/2024',
      }],
      languages: [{
        language: 'Spanish',
        proficiency: 'Fluent',
      }],
      links: [{
        url: 'https://example.com',
        friendlyName: 'Portfolio',
      }],
    })).toMatchObject({
      experience: [{
        role: 'Engineer',
        company: 'Acme',
        responsibilities: 'Build apps',
        dateStarted: '01/2020',
        dateEnded: '02/2024',
        currentWork: false,
      }],
      education: [{
        degreeMajor: 'MS Data Science',
        university: 'Tech University',
        yearCompleted: '2022',
      }],
      certifications: [{
        name: 'Security Plus',
        issuingBody: 'CompTIA',
        certificateId: 'ABC',
        issuanceDate: '03/2023',
        expiryDate: '03/2026',
      }],
      awards: [{
        awardName: 'Top Performer',
        issuingBody: 'Acme',
        details: 'Quarterly award',
        date: '04/2024',
      }],
      languages: [{
        language: 'Spanish',
        proficiency: 'Fluent',
      }],
      links: [{
        url: 'https://example.com',
        friendlyName: 'Portfolio',
      }],
    });
  });

  it('validates entry-level required fields after migration', () => {
    const result = validateProfile({
      firstName: 'Ana',
      lastName: 'Rivera',
      experience: [{ company: 'Acme', responsibilities: 'Build apps' }],
      education: [{ degreeMajor: 'BS' }],
      certifications: ['AWS Developer'],
      awards: ['Innovation Award'],
      languages: ['English'],
      links: ['not a url'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({
      'experience[0].role': 'Role is required.',
      'experience[0].dateStarted': 'Date Started is required.',
      'experience[0].dateEnded': 'Date Ended is required.',
      'education[0].university': 'University is required.',
      'education[0].yearCompleted': 'Year Completed is required.',
      'certifications[0].issuingBody': 'Issuing Body is required.',
      'certifications[0].issuanceDate': 'Issuance Date is required.',
      'awards[0].issuingBody': 'Issuing Body is required.',
      'languages[0].proficiency': 'Proficiency is required.',
      'links[0].url': 'URL must be a valid http or https URL.',
    });
  });

  it('validates education year format', () => {
    expect(validateProfile({
      firstName: 'Ana',
      lastName: 'Rivera',
      education: [{
        degreeMajor: 'BS Computer Science',
        university: 'State University',
        yearCompleted: '20-20',
      }],
    })).toEqual({
      valid: false,
      errors: {
        'education[0].yearCompleted': 'Year Completed must be a valid four-digit year.',
      },
    });
  });

  it('accepts valid structured profile entries', () => {
    expect(validateProfile({
      firstName: 'Ana',
      lastName: 'Rivera',
      experience: [{
        role: 'Engineer',
        company: 'Acme',
        responsibilities: 'Build apps',
        dateStarted: '01/2020',
        currentWork: true,
      }],
      education: [{
        degreeMajor: 'BS Computer Science',
        university: 'State University',
        yearCompleted: '2020',
      }],
      certifications: [{
        name: 'AWS Developer',
        issuingBody: 'Amazon Web Services',
        issuanceDate: '02/2022',
      }],
      awards: [{
        awardName: 'Innovation Award',
        issuingBody: 'Acme',
      }],
      languages: [{
        language: 'English',
        proficiency: 'Fluent',
      }],
      links: [{
        url: 'https://example.com',
      }],
    })).toEqual({ valid: true, errors: {} });
  });

  it('counts applications by status slug', () => {
    expect(computeAppCounts([
      { status: 'applied' },
      { status: 'applied' },
      { status: 'phone_screen' },
      { status: 'offer' },
      { status: 'wishlisted' },
      { status: 'unknown' },
    ])).toEqual({
      applied: 2,
      phone_screen: 1,
      offer: 1,
      wishlisted: 1,
      unknown: 1,
    });
  });

  it('computes display stats from app counts', () => {
    expect(computeStats({
      wishlisted: 1,
      applied: 2,
      phone_screen: 3,
      interview: 4,
      assessment: 5,
      offer: 6,
      rejected: 7,
    })).toEqual({
      total: 28,
      active: 12,
      pending: 2,
      offer: 6,
    });
    expect(computeStats(computeAppCounts([]))).toEqual({
      total: 0,
      active: 0,
      pending: 0,
      offer: 0,
    });
  });
});
