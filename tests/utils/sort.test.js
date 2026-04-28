import { describe, expect, it } from 'vitest';
import { sortEducation, sortExperience } from '../../src/utils/sort.js';

describe('sort utilities', () => {
  it('sorts education by completed year descending with non-numeric years at the end', () => {
    const entries = [
      { degreeMajor: 'Certificate', yearCompleted: 'Not listed' },
      { degreeMajor: 'BS', yearCompleted: '2018' },
      { degreeMajor: 'MS', yearCompleted: '2022' },
    ];

    expect(sortEducation(entries).map((entry) => entry.degreeMajor)).toEqual([
      'MS',
      'BS',
      'Certificate',
    ]);
    expect(entries.map((entry) => entry.degreeMajor)).toEqual(['Certificate', 'BS', 'MS']);
  });

  it('sorts experience with current roles first, then ended roles by date and fallback start date', () => {
    const entries = [
      { role: 'Older ended', currentWork: false, dateEnded: '04/2021', dateStarted: '01/2019' },
      { role: 'Current', currentWork: true, dateEnded: '', dateStarted: '03/2024' },
      { role: 'Latest ended', currentWork: false, dateEnded: '05/2023', dateStarted: '01/2022' },
      { role: 'Fallback newer', currentWork: false, dateEnded: '', dateStarted: '08/2022' },
      { role: 'Fallback older', currentWork: false, dateEnded: '', dateStarted: '07/2020' },
    ];

    expect(sortExperience(entries).map((entry) => entry.role)).toEqual([
      'Current',
      'Latest ended',
      'Older ended',
      'Fallback newer',
      'Fallback older',
    ]);
    expect(entries.map((entry) => entry.role)[0]).toBe('Older ended');
  });
});
