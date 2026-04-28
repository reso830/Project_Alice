// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { calculateSegments, DonutChart } from '../../src/components/DonutChart.js';

const colors = {
  applied: '#3b82f6',
  offer: '#16a34a',
  rejected: '#dc2626',
};
const labels = {
  applied: 'Applied',
  offer: 'Offer',
  rejected: 'Rejected',
};

describe('DonutChart', () => {
  it('renders a single 100% segment as two SVG paths', () => {
    const { el } = DonutChart.render({
      counts: { offer: 3 },
      colors,
      labels,
    });

    const paths = el.querySelectorAll('path[data-status="offer"]');
    expect(paths).toHaveLength(2);
    expect([...paths].every((path) => path.getAttribute('d')?.includes('A'))).toBe(true);
  });

  it('calculates two equal segments at 50% each', () => {
    const segments = calculateSegments({ applied: 1, offer: 1 });

    expect(segments).toMatchObject([
      { status: 'applied', pct: 50 },
      { status: 'offer', pct: 50 },
    ]);
  });

  it('rounds segment percentages to exactly 100%', () => {
    const segments = calculateSegments({ applied: 1, offer: 1, rejected: 1 });
    const totalPct = segments.reduce((sum, segment) => sum + segment.pct, 0);

    expect(totalPct).toBe(100);
  });

  it('skips zero-count statuses', () => {
    const { el } = DonutChart.render({
      counts: { applied: 2, offer: 0 },
      colors,
      labels,
    });

    expect(el.querySelectorAll('path[data-status="applied"]')).toHaveLength(2);
    expect(el.querySelector('path[data-status="offer"]')).toBeNull();
  });
});
