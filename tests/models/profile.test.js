import { describe, expect, it } from 'vitest';
import {
  computeAppCounts,
  computeStats,
  normaliseProfile,
  validateProfile,
} from '../../src/models/profile.js';

describe('profile model', () => {
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
