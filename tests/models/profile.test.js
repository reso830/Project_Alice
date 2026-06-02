import { describe, expect, it } from 'vitest';
import {
  computeAppCounts,
  computeStats,
  dedupeSkillsForStorage,
  joinProfileWithSkills,
  normaliseProfile,
  SKILL_LEVELS,
  SKILL_MAX,
  skillNameKey,
  splitProfileForStorage,
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
      skills: [
        { name: 'JavaScript', level: 2 },
        { name: 'CSS', level: 2 },
      ],
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

describe('skill proficiency', () => {
  const namedProfile = (skills) => ({ firstName: 'Ana', lastName: 'Rivera', skills });

  it('exposes a 1-5 proficiency scale and a max-count constant', () => {
    expect(SKILL_LEVELS.map((entry) => entry.level)).toEqual([1, 2, 3, 4, 5]);
    expect(SKILL_LEVELS.map((entry) => entry.label)).toEqual([
      'Beginner', 'Basic', 'Intermediate', 'Strong', 'Expert',
    ]);
    expect(SKILL_MAX).toBe(50);
  });

  it('migrates legacy string skills to Basic (level 2) and drops empty strings', () => {
    expect(normaliseProfile({ skills: [' JavaScript ', '', '   ', ' CSS '] }).skills)
      .toEqual([
        { name: 'JavaScript', level: 2 },
        { name: 'CSS', level: 2 },
      ]);
  });

  it('keeps valid object levels and preserves null/missing as unrated', () => {
    expect(normaliseProfile({
      skills: [
        { name: 'Jira', level: 4 },
        { name: 'Scrum', level: null },
        { name: 'Figma' },
      ],
    }).skills).toEqual([
      { name: 'Jira', level: 4 },
      { name: 'Scrum', level: null },
      { name: 'Figma', level: null },
    ]);
  });

  it('coerces out-of-range or non-integer levels to the nearest valid 1-5 (not 2)', () => {
    expect(normaliseProfile({
      skills: [
        { name: 'A', level: 6 },
        { name: 'B', level: 0 },
        { name: 'C', level: 3.7 },
        { name: 'D', level: '4' },
      ],
    }).skills).toEqual([
      { name: 'A', level: 5 },
      { name: 'B', level: 1 },
      { name: 'C', level: 4 },
      { name: 'D', level: 4 },
    ]);
  });

  it('treats empty, whitespace, boolean, or non-numeric object levels as unrated (null), not Beginner', () => {
    expect(normaliseProfile({
      skills: [
        { name: 'A', level: '' },
        { name: 'B', level: '   ' },
        { name: 'C', level: false },
        { name: 'D', level: [] },
        { name: 'E', level: 'abc' },
      ],
    }).skills).toEqual([
      { name: 'A', level: null },
      { name: 'B', level: null },
      { name: 'C', level: null },
      { name: 'D', level: null },
      { name: 'E', level: null },
    ]);
  });

  it('rejects a skill whose level is an empty string (must not silently save as Beginner)', () => {
    const result = validateProfile(namedProfile([{ name: 'Jira', level: '' }]));
    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({ 'skills[0].level': 'Set a level for this skill.' });
  });

  it('still coerces genuinely numeric levels, including numeric strings', () => {
    expect(normaliseProfile({
      skills: [
        { name: 'A', level: '4' },
        { name: 'B', level: ' 5 ' },
      ],
    }).skills).toEqual([
      { name: 'A', level: 4 },
      { name: 'B', level: 5 },
    ]);
  });

  it('preserves blank-name skill objects so validation can reject them', () => {
    expect(normaliseProfile({ skills: [{ name: '  ', level: 3 }] }).skills)
      .toEqual([{ name: '', level: 3 }]);
  });

  it('rejects an unrated skill (null level)', () => {
    const result = validateProfile(namedProfile([{ name: 'Jira', level: null }]));
    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({ 'skills[0].level': 'Set a level for this skill.' });
  });

  it('rejects a blank skill name', () => {
    const result = validateProfile(namedProfile([{ name: '', level: 3 }]));
    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({ 'skills[0].name': 'Skill name is required.' });
  });

  it('flags two blank-name rows individually, not as duplicates', () => {
    const result = validateProfile(namedProfile([
      { name: '', level: 3 },
      { name: '', level: 3 },
    ]));
    expect(result.errors['skills[0].name']).toBe('Skill name is required.');
    expect(result.errors['skills[1].name']).toBe('Skill name is required.');
    expect(result.errors['skills.duplicate']).toBeUndefined();
  });

  it('rejects duplicate skill names case- and whitespace-insensitively', () => {
    const result = validateProfile(namedProfile([
      { name: 'JavaScript', level: 3 },
      { name: '  javascript ', level: 5 },
    ]));
    expect(result.valid).toBe(false);
    expect(result.errors['skills.duplicate']).toBeTruthy();
  });

  it('rejects more than the maximum number of skills', () => {
    const skills = Array.from({ length: SKILL_MAX + 1 }, (_, i) => ({ name: `S${i}`, level: 3 }));
    const result = validateProfile(namedProfile(skills));
    expect(result.valid).toBe(false);
    expect(result.errors['skills.max']).toBeTruthy();
  });

  it('accepts a fully-rated, unique skill list at the maximum count', () => {
    const skills = Array.from({ length: SKILL_MAX }, (_, i) => ({ name: `S${i}`, level: 3 }));
    expect(validateProfile(namedProfile(skills))).toEqual({ valid: true, errors: {} });
  });
});

describe('profile storage split/join', () => {
  const roundTrip = (profile) => {
    const { document, skills } = splitProfileForStorage(profile);

    return joinProfileWithSkills(document, skills);
  };

  it('splits a profile into a skill-free document and normalised skills', () => {
    const profile = {
      firstName: ' Ana ',
      lastName: ' Rivera ',
      city: ' Taipei ',
      summary: ' Product builder ',
      skills: [
        { name: ' Jira ', level: '4' },
        ' CSS ',
      ],
      languages: [' English '],
    };
    const normalised = normaliseProfile(profile);
    const expectedDocument = { ...normalised };
    delete expectedDocument.skills;
    const { document, skills } = splitProfileForStorage(profile);

    expect(document).not.toHaveProperty('skills');
    expect(skills).toEqual(normalised.skills);
    expect(document).toEqual(expectedDocument);
  });

  it('round-trips a profile with skills back to the normalised embedded shape', () => {
    const profile = {
      firstName: 'Ana',
      lastName: 'Rivera',
      skills: [
        { name: 'JavaScript', level: 5 },
        { name: 'Product Strategy', level: 4 },
      ],
    };

    expect(roundTrip(profile)).toEqual(normaliseProfile(profile));
  });

  it('round-trips a profile with no skills back to the normalised embedded shape', () => {
    const profile = {
      firstName: 'Ana',
      lastName: 'Rivera',
      summary: 'No skills yet',
    };

    expect(roundTrip(profile)).toEqual(normaliseProfile(profile));
  });

  it('round-trips legacy string skills through the Basic migration level', () => {
    const profile = {
      firstName: 'Ana',
      lastName: 'Rivera',
      skills: [' JavaScript ', '', ' CSS '],
    };

    expect(roundTrip(profile)).toEqual(normaliseProfile(profile));
    expect(roundTrip(profile).skills).toEqual([
      { name: 'JavaScript', level: 2 },
      { name: 'CSS', level: 2 },
    ]);
  });

  it('joins undefined or null skills as an empty skills array', () => {
    expect(joinProfileWithSkills({ firstName: 'Ana' }, undefined)).toEqual({
      firstName: 'Ana',
      skills: [],
    });
    expect(joinProfileWithSkills({ firstName: 'Ana' }, null)).toEqual({
      firstName: 'Ana',
      skills: [],
    });
  });

  it('does not mutate the input profile while splitting', () => {
    const profile = {
      firstName: ' Ana ',
      lastName: ' Rivera ',
      skills: [{ name: ' Jira ', level: 4 }],
    };
    const before = globalThis.structuredClone(profile);

    splitProfileForStorage(profile);

    expect(profile).toEqual(before);
  });

  it('dedupes storage skills with the shared skill-name key', () => {
    expect(skillNameKey(' Node   JS ')).toBe('node js');

    const skills = [
      { name: 'React', level: 5 },
      { name: ' react ', level: 2 },
      { name: '  ', level: 3 },
      { name: 'Node  JS', level: 4 },
      { name: 'node js', level: 1 },
    ];

    expect(dedupeSkillsForStorage(skills)).toEqual([
      { name: 'React', level: 5 },
      { name: 'Node  JS', level: 4 },
    ]);
  });
});
