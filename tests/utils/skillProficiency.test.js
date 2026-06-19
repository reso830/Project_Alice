import { describe, expect, it } from 'vitest';
import {
  resolveSkillLevel,
  resolveSkillMatches,
} from '../../src/utils/skillProficiency.js';

const profileSkills = [
  { name: 'React', level: 5 },
  { name: 'TypeScript', level: 4 },
  { name: 'Node.js', level: 3 },
  { name: 'GraphQL', level: 2 },
  { name: 'Figma', level: 1 },
];

describe('skillProficiency', () => {
  it.each([
    ['React', 'proficient'],
    ['TypeScript', 'proficient'],
    ['Node.js', 'proficient'],
  ])('resolves level 3 and above as proficient: %s', (skillName, expected) => {
    expect(resolveSkillLevel(skillName, profileSkills)).toBe(expected);
  });

  it.each([
    ['GraphQL', 'learning'],
    ['Figma', 'learning'],
  ])('resolves levels 1 and 2 as learning: %s', (skillName, expected) => {
    expect(resolveSkillLevel(skillName, profileSkills)).toBe(expected);
  });

  it('resolves missing skills as missing', () => {
    expect(resolveSkillLevel('PostgreSQL', profileSkills)).toBe('missing');
  });

  it('matches skills by normalized exact name', () => {
    const skills = [
      { name: '  React   Native  ', level: 5 },
      { name: 'Vue', level: 4 },
    ];

    expect(resolveSkillLevel('react native', skills)).toBe('proficient');
    expect(resolveSkillLevel('REACT   NATIVE', skills)).toBe('proficient');
    expect(resolveSkillLevel('React', skills)).toBe('missing');
  });

  it('treats an empty profile skill list as all missing', () => {
    expect(resolveSkillLevel('React', [])).toBe('missing');
    expect(resolveSkillMatches(['React', 'TypeScript'], [])).toEqual([
      { name: 'React', level: 'missing' },
      { name: 'TypeScript', level: 'missing' },
    ]);
  });

  it('returns an empty match list for empty or non-array skill inputs', () => {
    expect(resolveSkillMatches([], profileSkills)).toEqual([]);
    expect(resolveSkillMatches(null, profileSkills)).toEqual([]);
  });

  it('resolves skill arrays to name and level pairs', () => {
    expect(resolveSkillMatches(['React', 'GraphQL', 'PostgreSQL'], profileSkills)).toEqual([
      { name: 'React', level: 'proficient' },
      { name: 'GraphQL', level: 'learning' },
      { name: 'PostgreSQL', level: 'missing' },
    ]);
  });
});
