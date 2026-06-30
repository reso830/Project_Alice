// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BottomTabBar } from '../../src/components/BottomTabBar.js';

afterEach(() => {
  BottomTabBar.destroy();
});

describe('BottomTabBar', () => {
  it('renders three tabs with the expected ids', () => {
    const nav = BottomTabBar.render({ onSelect: () => {} });
    const buttons = nav.querySelectorAll('.bottom-tab');
    expect(Array.from(buttons, (b) => b.dataset.page)).toEqual(['tracker', 'calendar', 'profile']);
  });

  it('renders an inline SVG icon and a text label for each tab', () => {
    const nav = BottomTabBar.render({ onSelect: () => {} });
    for (const button of nav.querySelectorAll('.bottom-tab')) {
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button.querySelector('.bottom-tab__label')?.textContent).toMatch(/Tracker|Calendar|Profile/);
    }
  });

  it('uses the role-appropriate aria-label on the nav element', () => {
    const nav = BottomTabBar.render({ onSelect: () => {} });
    expect(nav.tagName).toBe('NAV');
    expect(nav.getAttribute('aria-label')).toBe('Primary navigation');
  });

  it('calls onSelect with the tapped tab id', () => {
    const onSelect = vi.fn();
    const nav = BottomTabBar.render({ onSelect });

    nav.querySelector('[data-page="calendar"]').click();
    nav.querySelector('[data-page="profile"]').click();

    expect(onSelect).toHaveBeenNthCalledWith(1, 'calendar');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'profile');
  });

  it('setActive applies and clears the active class', () => {
    const nav = BottomTabBar.render({ onSelect: () => {} });
    BottomTabBar.setActive('profile');

    const active = nav.querySelectorAll('.bottom-tab--active');
    expect(active.length).toBe(1);
    expect(active[0].dataset.page).toBe('profile');

    BottomTabBar.setActive('tracker');
    expect(nav.querySelector('.bottom-tab--active')?.dataset.page).toBe('tracker');
  });

  it('destroy() detaches internal references so further setActive is a no-op', () => {
    const nav = BottomTabBar.render({ onSelect: () => {} });
    BottomTabBar.setActive('tracker');
    BottomTabBar.destroy();

    expect(() => BottomTabBar.setActive('profile')).not.toThrow();
    // The detached element still reflects the last applied state — but no
    // further mutations from setActive happen after destroy().
    expect(nav.querySelector('.bottom-tab--active')?.dataset.page).toBe('tracker');
  });

  it('renders and clears the update badge on the profile tab', () => {
    const nav = BottomTabBar.render({ onSelect: () => {} });

    BottomTabBar.setUpdateStatus('downloading');
    expect(nav.querySelector('.bottom-tab[data-page="profile"] .bottom-tab__update-badge--active')).not.toBeNull();

    BottomTabBar.setUpdateStatus('ready-to-restart');
    expect(nav.querySelector('.bottom-tab[data-page="profile"] .bottom-tab__update-badge--ready')).not.toBeNull();

    BottomTabBar.setUpdateStatus('idle');
    expect(nav.querySelector('.bottom-tab__update-badge')).toBeNull();
  });
});
