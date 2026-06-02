import { describe, expect, it } from 'vitest';
import { mergeResumeData } from '../../src/models/profile.js';

function baseProfile(overrides = {}) {
  return {
    firstName: '',
    lastName: '',
    city: '',
    phone: '',
    email: '',
    summary: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    awards: [],
    languages: [],
    links: [],
    ...overrides,
  };
}

describe('resume merge rules', () => {
  it('does not overwrite non-empty singular fields', () => {
    const result = mergeResumeData(baseProfile({ firstName: 'Alice' }), {
      firstName: 'Bob',
    });

    expect(result.firstName).toBe('Alice');
  });

  it('fills empty singular fields from parsed values', () => {
    const result = mergeResumeData(baseProfile({ email: '' }), {
      email: 'a@b.com',
    });

    expect(result.email).toBe('a@b.com');
  });

  it('does not corrupt empty singular fields with null parsed values', () => {
    const result = mergeResumeData(baseProfile({ phone: '' }), {
      phone: null,
    });

    expect(result.phone).toBe('');
  });

  it('appends collection entries without replacing existing entries', () => {
    const result = mergeResumeData(baseProfile({ skills: [{ name: 'JS', level: 4 }] }), {
      skills: ['Python'],
    });

    expect(result.skills).toEqual([
      { name: 'JS', level: 4 },
      { name: 'Python', level: null },
    ]);
  });

  it('imports parsed skills as unrated (level null), never auto-rated', () => {
    const result = mergeResumeData(baseProfile({ skills: [] }), {
      skills: ['Go', 'Rust'],
    });

    expect(result.skills).toEqual([
      { name: 'Go', level: null },
      { name: 'Rust', level: null },
    ]);
  });

  it('blocks duplicate experience entries by company, role, and dateStarted', () => {
    const existing = { company: 'Acme', role: 'Dev', dateStarted: '01/2020' };
    const result = mergeResumeData(baseProfile({ experience: [existing] }), {
      experience: [{ company: ' Acme ', role: 'dev', dateStarted: '01/2020' }],
    });

    expect(result.experience).toHaveLength(1);
    expect(result.experience[0]).toEqual(existing);
  });

  it('appends non-duplicate experience entries', () => {
    const result = mergeResumeData(baseProfile({
      experience: [{ company: 'Acme', role: 'Dev', dateStarted: '01/2020' }],
    }), {
      experience: [{ company: 'Acme', role: 'Dev', dateStarted: '02/2020' }],
    });

    expect(result.experience).toHaveLength(2);
  });

  it('deduplicates skills case-insensitively and keeps the existing level', () => {
    const result = mergeResumeData(baseProfile({ skills: [{ name: 'JavaScript', level: 5 }] }), {
      skills: ['javascript'],
    });

    expect(result.skills).toEqual([{ name: 'JavaScript', level: 5 }]);
  });

  it('deduplicates education entries', () => {
    const existing = { university: 'State', degreeMajor: 'BS CS', yearCompleted: '2020' };
    const result = mergeResumeData(baseProfile({ education: [existing] }), {
      education: [{ university: 'state', degreeMajor: 'BS  CS', yearCompleted: '2020' }],
    });

    expect(result.education).toEqual([existing]);
  });

  it('deduplicates certification entries', () => {
    const existing = { name: 'AWS', issuingBody: 'Amazon' };
    const result = mergeResumeData(baseProfile({ certifications: [existing] }), {
      certifications: [{ name: 'aws', issuingBody: ' Amazon ' }],
    });

    expect(result.certifications).toEqual([existing]);
  });

  it('deduplicates language entries case-insensitively', () => {
    const existing = { language: 'Spanish', proficiency: 'Fluent' };
    const result = mergeResumeData(baseProfile({ languages: [existing] }), {
      languages: [{ language: 'spanish', proficiency: 'Intermediate' }],
    });

    expect(result.languages).toEqual([existing]);
  });

  it('deduplicates links by normalized URL', () => {
    const existing = { url: 'https://example.com/path/', friendlyName: 'Portfolio' };
    const result = mergeResumeData(baseProfile({ links: [existing] }), {
      links: [{ url: 'https://example.com/path', friendlyName: 'Site' }],
    });

    expect(result.links).toEqual([existing]);
  });

  it('deduplicates award entries', () => {
    const existing = { awardName: 'Top Performer', issuingBody: 'Acme' };
    const result = mergeResumeData(baseProfile({ awards: [existing] }), {
      awards: [{ awardName: 'top performer', issuingBody: ' acme ' }],
    });

    expect(result.awards).toEqual([existing]);
  });

  it('does not mutate current profile or parsed data', () => {
    const currentProfile = baseProfile({ skills: [{ name: 'JS', level: 2 }] });
    const parsedData = { skills: ['Python'] };
    const currentSnapshot = globalThis.structuredClone(currentProfile);
    const parsedSnapshot = globalThis.structuredClone(parsedData);

    const result = mergeResumeData(currentProfile, parsedData);

    expect(result).not.toBe(currentProfile);
    expect(currentProfile).toEqual(currentSnapshot);
    expect(parsedData).toEqual(parsedSnapshot);
  });

  it('handles null or undefined parsed data without throwing', () => {
    const currentProfile = baseProfile({ firstName: 'Alice', skills: [{ name: 'JS', level: 2 }] });

    expect(mergeResumeData(currentProfile, null)).toEqual(currentProfile);
    expect(mergeResumeData(currentProfile, undefined)).toEqual(currentProfile);
    expect(mergeResumeData(currentProfile, null)).not.toBe(currentProfile);
  });
});
