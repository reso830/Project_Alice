import { describe, expect, it } from 'vitest';
import {
  COMPAT_BANDS,
  COMPAT_WEIGHTS,
  computeCompatibility,
  getCompatLabel,
} from '../../src/models/compatibility.js';

const AS_OF = '2026-06-11';

function profile(overrides = {}) {
  return {
    summary: 'Frontend engineer building React applications and design systems.',
    skills: [
      { name: 'React', level: 5 },
      { name: 'JavaScript', level: 4 },
      { name: 'GraphQL', level: 2 },
    ],
    experience: [
      {
        role: 'Frontend Engineer',
        responsibilities: 'Built React interfaces and component libraries.',
        dateStarted: '01/2020',
        dateEnded: '01/2026',
        currentWork: false,
      },
    ],
    certifications: [{ name: 'AWS Certified Cloud Practitioner' }],
    ...overrides,
  };
}

function application(overrides = {}) {
  return {
    jobTitle: 'Frontend Engineer',
    skills: ['React', 'JavaScript'],
    preferredSkills: ['GraphQL'],
    responsibilities: 'Build React applications and maintain AWS integrations.',
    minYearsExperience: 3,
    ...overrides,
  };
}

describe('getCompatLabel', () => {
  it('maps band boundaries to the fixed compatibility labels', () => {
    expect(COMPAT_BANDS).toEqual([
      { min: 0, max: 39, label: 'Low' },
      { min: 40, max: 64, label: 'Medium' },
      { min: 65, max: 84, label: 'High' },
      { min: 85, max: 100, label: 'Great' },
    ]);

    expect(getCompatLabel(39)).toBe('Low');
    expect(getCompatLabel(40)).toBe('Medium');
    expect(getCompatLabel(64)).toBe('Medium');
    expect(getCompatLabel(65)).toBe('High');
    expect(getCompatLabel(84)).toBe('High');
    expect(getCompatLabel(85)).toBe('Great');
  });
});

describe('computeCompatibility', () => {
  it('exports the documented default weights', () => {
    expect(COMPAT_WEIGHTS).toEqual({
      skills: 35,
      roleAlignment: 25,
      experience: 20,
      keywords: 10,
      certifications: 10,
    });
  });

  it('returns the same integer score and label for identical inputs', () => {
    const first = computeCompatibility(profile(), application(), { asOf: AS_OF });
    const second = computeCompatibility(profile(), application(), { asOf: AS_OF });

    expect(first).toEqual(second);
    expect(Number.isInteger(first.score)).toBe(true);
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(first.score).toBeLessThanOrEqual(100);
    expect(first.label).toBe(getCompatLabel(first.score));
  });

  it('raises and lowers the score when matched required skills change', () => {
    const missingRequired = computeCompatibility(
      profile({ skills: [{ name: 'Python', level: 5 }] }),
      application({ skills: ['React'] }),
      { asOf: AS_OF },
    );
    const matchedRequired = computeCompatibility(profile(), application({ skills: ['React'] }), {
      asOf: AS_OF,
    });

    expect(matchedRequired.score).toBeGreaterThan(missingRequired.score);
  });

  it('weights matched required skills by profile proficiency', () => {
    const levelTwo = computeCompatibility(
      profile({ skills: [{ name: 'React', level: 2 }] }),
      application({
        jobTitle: '',
        skills: ['React'],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: null,
      }),
      { asOf: AS_OF },
    );
    const levelFive = computeCompatibility(
      profile({ skills: [{ name: 'React', level: 5 }] }),
      application({
        jobTitle: '',
        skills: ['React'],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: null,
      }),
      { asOf: AS_OF },
    );

    expect(levelFive.score).toBeGreaterThan(levelTwo.score);
  });

  it('gives preferred skills capped partial credit below required coverage', () => {
    const preferredOnly = computeCompatibility(
      profile({ skills: [{ name: 'GraphQL', level: 5 }] }),
      application({
        jobTitle: '',
        skills: ['React'],
        preferredSkills: ['GraphQL'],
        responsibilities: '',
        minYearsExperience: null,
      }),
      { asOf: AS_OF },
    );
    const requiredCovered = computeCompatibility(
      profile({ skills: [{ name: 'React', level: 5 }] }),
      application({
        jobTitle: '',
        skills: ['React'],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: null,
      }),
      { asOf: AS_OF },
    );

    expect(preferredOnly.score).toBeGreaterThan(0);
    expect(preferredOnly.score).toBeLessThan(requiredCovered.score);
  });

  it('grades experience by closeness and gives no overshoot bonus', () => {
    const sixYears = profile();
    const nearMiss = computeCompatibility(
      sixYears,
      application({
        jobTitle: '',
        skills: [],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: 7,
      }),
      { asOf: AS_OF },
    );
    const largeShortfall = computeCompatibility(
      sixYears,
      application({
        jobTitle: '',
        skills: [],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: 18,
      }),
      { asOf: AS_OF },
    );
    const meetsRequirement = computeCompatibility(
      sixYears,
      application({
        jobTitle: '',
        skills: [],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: 3,
      }),
      { asOf: AS_OF },
    );
    const overshootsRequirement = computeCompatibility(
      profile({
        experience: [
          {
            role: 'Frontend Engineer',
            responsibilities: '',
            dateStarted: '01/2014',
            dateEnded: '01/2026',
            currentWork: false,
          },
        ],
      }),
      application({
        jobTitle: '',
        skills: [],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: 3,
      }),
      { asOf: AS_OF },
    );

    expect(nearMiss.score).toBeGreaterThan(largeShortfall.score);
    expect(overshootsRequirement.score).toBe(meetsRequirement.score);
  });

  it('renormalizes weights when a category is absent', () => {
    const appWithoutExperience = application({
      jobTitle: '',
      skills: ['React'],
      preferredSkills: [],
      responsibilities: '',
      minYearsExperience: null,
    });
    const result = computeCompatibility(
      profile({ summary: '', experience: [], certifications: [] }),
      appWithoutExperience,
      { asOf: AS_OF },
    );

    expect(result.score).toBe(100);
  });

  it('returns zero for sparse inputs and never mutates the supplied data', () => {
    const inputProfile = profile({ summary: '', skills: [], experience: [], certifications: [] });
    const inputApplication = application({
      jobTitle: '',
      skills: [],
      preferredSkills: [],
      responsibilities: '',
      minYearsExperience: null,
    });

    expect(() => computeCompatibility(inputProfile, inputApplication, { asOf: AS_OF })).not.toThrow();
    expect(computeCompatibility(inputProfile, inputApplication, { asOf: AS_OF })).toEqual({
      score: 0,
      label: 'Low',
    });
    expect(inputProfile).toEqual({ summary: '', skills: [], experience: [], certifications: [] });
    expect(inputApplication).toEqual({
      jobTitle: '',
      skills: [],
      preferredSkills: [],
      responsibilities: '',
      minYearsExperience: null,
    });
  });

  it('does not silently use the current date when asOf is omitted', () => {
    const ongoingProfile = profile({
      skills: [],
      summary: '',
      certifications: [],
      experience: [
        {
          role: '',
          responsibilities: '',
          dateStarted: '01/2020',
          dateEnded: '',
          currentWork: true,
        },
      ],
    });
    const yearsRequired = application({
      jobTitle: '',
      skills: [],
      preferredSkills: [],
      responsibilities: '',
      minYearsExperience: 3,
    });

    expect(computeCompatibility(ongoingProfile, yearsRequired).score).toBe(0);
    expect(computeCompatibility(ongoingProfile, yearsRequired, { asOf: AS_OF }).score).toBe(100);
  });
});
