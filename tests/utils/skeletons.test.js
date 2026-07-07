// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  buildApplicationListSkeleton,
  buildCalendarSkeleton,
  buildProfileAppsSkeleton,
  buildProfileEditSkeleton,
  buildProfileSkeleton,
  buildTrackerBootSkeleton,
  buildTrackerPaneSkeleton,
} from '../../src/utils/skeletons.js';

const APPLICATION_LIST_SKELETON_HTML = '<div class="loading-skeleton loading-skeleton--applications" aria-busy="true" aria-live="polite" aria-label="Loading applications"><div class="skeleton-card" aria-hidden="true"><span class="skeleton-line skeleton-line--short"></span><span class="skeleton-line skeleton-line--title"></span><span class="skeleton-line"></span></div><div class="skeleton-card" aria-hidden="true"><span class="skeleton-line skeleton-line--short"></span><span class="skeleton-line skeleton-line--title"></span><span class="skeleton-line"></span></div><div class="skeleton-card" aria-hidden="true"><span class="skeleton-line skeleton-line--short"></span><span class="skeleton-line skeleton-line--title"></span><span class="skeleton-line"></span></div></div>';
const PROFILE_SKELETON_HTML = '<div class="loading-skeleton loading-skeleton--profile" aria-busy="true" aria-live="polite" aria-label="Loading profile"><section class="section-card skeleton-section"><span class="skeleton-line skeleton-line--title" aria-hidden="true"></span><span class="skeleton-line skeleton-line--medium" aria-hidden="true"></span></section><section class="section-card skeleton-section"><span class="skeleton-line skeleton-line--short" aria-hidden="true"></span><span class="skeleton-line" aria-hidden="true"></span><span class="skeleton-line skeleton-line--medium" aria-hidden="true"></span></section><section class="section-card skeleton-section"><span class="skeleton-line skeleton-line--short" aria-hidden="true"></span><span class="skeleton-line skeleton-line--title" aria-hidden="true"></span><span class="skeleton-line" aria-hidden="true"></span><span class="skeleton-line skeleton-line--medium" aria-hidden="true"></span></section></div>';

describe('loading skeleton builders', () => {
  it('preserves the current application-list skeleton DOM', () => {
    expect(buildApplicationListSkeleton().outerHTML).toBe(APPLICATION_LIST_SKELETON_HTML);
  });

  it('preserves the current profile skeleton DOM', () => {
    expect(buildProfileSkeleton().outerHTML).toBe(PROFILE_SKELETON_HTML);
  });

  it('builds calendar grid and panel skeletons', () => {
    const { grid, panel } = buildCalendarSkeleton();

    expect(grid.className).toBe('calendar-skeleton calendar-skeleton__grid');
    expect(grid.getAttribute('aria-busy')).toBe('true');
    expect(grid.getAttribute('aria-live')).toBe('polite');
    expect(grid.getAttribute('aria-label')).toBe('Loading calendar');
    expect(grid.querySelectorAll('.calendar-skeleton__cell')).toHaveLength(42);
    expect(grid.querySelector('.skeleton-line')).not.toBeNull();
    expect(panel.className).toBe('calendar-skeleton calendar-skeleton__panel');
    expect(panel.getAttribute('aria-busy')).toBe('true');
    expect(panel.getAttribute('aria-live')).toBe('polite');
    expect(panel.getAttribute('aria-label')).toBe('Loading calendar action panel');
    expect(panel.querySelectorAll('.calendar-skeleton__row')).toHaveLength(3);
    expect(panel.querySelectorAll('.skeleton-line')).toHaveLength(9);
  });

  it('builds a ProfileEdit section-card skeleton', () => {
    const skeleton = buildProfileEditSkeleton();

    expect(skeleton.className).toBe('loading-skeleton profile-edit-skeleton');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(skeleton.getAttribute('aria-live')).toBe('polite');
    expect(skeleton.getAttribute('aria-label')).toBe('Loading profile editor');
    expect(skeleton.querySelectorAll('.skeleton-section').length).toBeGreaterThanOrEqual(1);
    expect(skeleton.querySelector('.skeleton-line')).not.toBeNull();
  });

  it('builds a Profile applications row skeleton', () => {
    const skeleton = buildProfileAppsSkeleton();

    expect(skeleton.className).toBe('loading-skeleton profile-apps-skeleton');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(skeleton.getAttribute('aria-live')).toBe('polite');
    expect(skeleton.getAttribute('aria-label')).toBe('Loading applications');
    expect(skeleton.querySelectorAll('.skeleton-line').length).toBeGreaterThanOrEqual(4);
  });

  it('builds a Tracker-boot skeleton reusing the application-list card shape with a distinct label (WS3)', () => {
    const skeleton = buildTrackerBootSkeleton();

    expect(skeleton.className).toBe('loading-skeleton loading-skeleton--applications loading-skeleton--tracker-boot');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(skeleton.getAttribute('aria-live')).toBe('polite');
    expect(skeleton.getAttribute('aria-label')).toBe('Loading your applications');
    expect(skeleton.querySelectorAll('.skeleton-card')).toHaveLength(3);
    expect(skeleton.querySelectorAll('.skeleton-line').length).toBeGreaterThanOrEqual(9);
    // No application data — purely presentational, matching data-model.md §3.
    expect(skeleton.textContent.trim()).toBe('');
  });

  it('builds a Tracker detail-pane skeleton shown while a card selection is pending (#109)', () => {
    const skeleton = buildTrackerPaneSkeleton();

    expect(skeleton.className).toBe('loading-skeleton loading-skeleton--tracker-pane');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(skeleton.getAttribute('aria-live')).toBe('polite');
    expect(skeleton.getAttribute('aria-label')).toBe('Loading application details');
    expect(skeleton.querySelectorAll('.skeleton-section')).toHaveLength(3);
    expect(skeleton.querySelectorAll('.skeleton-line').length).toBeGreaterThanOrEqual(10);
    expect(skeleton.textContent.trim()).toBe('');
  });
});
