import { describe, expect, it } from 'vitest';
import {
  COMPAT_BANDS,
  COMPAT_WEIGHTS,
  computeCompatibility,
  getCompatLabel,
} from '../../src/models/compatibility.js';

const AS_OF = '2026-06-11';
const SKILLS_ONLY = Object.freeze({ skills: 1 });
const SKILLS_AND_EXPERIENCE_ONLY = Object.freeze({ skills: 43, experience: 12 });

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
      skills: 43,
      roleAlignment: 25,
      experience: 12,
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
      { asOf: AS_OF, weights: SKILLS_ONLY },
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
      { asOf: AS_OF, weights: SKILLS_ONLY },
    );

    expect(levelFive.score).toBeGreaterThan(levelTwo.score);
  });

  it('uses pooled weighted coverage so required matches are worth at least preferred matches', () => {
    const candidate = profile({ skills: [{ name: 'React', level: 5 }] });
    const asRequired = computeCompatibility(
      candidate,
      application({
        jobTitle: '',
        skills: ['React', 'Missing'],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: null,
      }),
      { asOf: AS_OF, weights: SKILLS_ONLY },
    );
    const asPreferred = computeCompatibility(
      candidate,
      application({
        jobTitle: '',
        skills: ['Missing'],
        preferredSkills: ['React'],
        responsibilities: '',
        minYearsExperience: null,
      }),
      { asOf: AS_OF, weights: SKILLS_ONLY },
    );

    expect(asRequired.score).toBeGreaterThanOrEqual(asPreferred.score);
    expect(asRequired.score).toBe(50);
    expect(asPreferred.score).toBe(35);
  });

  it('keeps partial required coverage honest in the skills sub-score', () => {
    const result = computeCompatibility(
      profile({
        skills: [
          { name: 'React', level: 4 },
          { name: 'JavaScript', level: 4 },
          { name: 'TypeScript', level: 4 },
          { name: 'CSS', level: 4 },
          { name: 'Vite', level: 4 },
        ],
      }),
      application({
        jobTitle: '',
        skills: ['React', 'JavaScript', 'TypeScript', 'CSS', 'Vite', 'Accessibility'],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: null,
      }),
      { asOf: AS_OF, weights: SKILLS_ONLY },
    );

    expect(result.score).toBe(67);
  });

  it('caps skills at 35 percent when required skills exist and none are matched', () => {
    const result = computeCompatibility(
      profile({
        skills: [
          { name: 'GraphQL', level: 5 },
          { name: 'Storybook', level: 5 },
        ],
      }),
      application({
        jobTitle: '',
        skills: ['React'],
        preferredSkills: ['GraphQL', 'Storybook'],
        responsibilities: '',
        minYearsExperience: null,
      }),
      { asOf: AS_OF, weights: SKILLS_ONLY },
    );

    expect(result.score).toBe(35);
  });

  it('uses preferred-only coverage when no required skills are listed', () => {
    const result = computeCompatibility(
      profile({ skills: [{ name: 'GraphQL', level: 5 }] }),
      application({
        jobTitle: '',
        skills: [],
        preferredSkills: ['GraphQL'],
        responsibilities: '',
        minYearsExperience: null,
      }),
      { asOf: AS_OF, weights: SKILLS_AND_EXPERIENCE_ONLY },
    );

    expect(result.score).toBe(100);
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
      { asOf: AS_OF, weights: SKILLS_AND_EXPERIENCE_ONLY },
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

  it('scores stated experience as zero for a substantive profile with no experience entries', () => {
    const result = computeCompatibility(
      profile({
        summary: '',
        skills: [{ name: 'React', level: 5 }],
        experience: [],
        certifications: [],
      }),
      application({
        jobTitle: '',
        skills: ['React'],
        preferredSkills: [],
        responsibilities: '',
        minYearsExperience: 3,
      }),
      { asOf: AS_OF, weights: SKILLS_AND_EXPERIENCE_ONLY },
    );

    expect(result.score).toBe(78);
  });

  it('omits stated experience for an essentially empty profile', () => {
    const emptyProfile = profile({
      summary: '',
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      awards: [],
      languages: [],
    });
    const yearsRequired = application({
      jobTitle: '',
      skills: [],
      preferredSkills: [],
      responsibilities: '',
      minYearsExperience: 3,
    });
    const yearsBlank = application({
      jobTitle: '',
      skills: [],
      preferredSkills: [],
      responsibilities: '',
      minYearsExperience: null,
    });

    expect(computeCompatibility(emptyProfile, yearsRequired, { asOf: AS_OF })).toEqual(
      computeCompatibility(emptyProfile, yearsBlank, { asOf: AS_OF }),
    );
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
