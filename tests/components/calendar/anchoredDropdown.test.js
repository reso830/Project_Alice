// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountAnchoredDropdown } from '../../../src/components/calendar/anchoredDropdown.js';

function setViewport(width, height) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function createAnchor(rect) {
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () => rect;
  document.body.append(anchor);
  return anchor;
}

function createContent(width = 180, height = 120) {
  const content = document.createElement('div');
  content.textContent = 'Dropdown content';
  content.getBoundingClientRect = () => ({
    left: 0,
    right: width,
    top: 0,
    bottom: height,
    width,
    height,
  });
  return content;
}

function stubWrapperRect(width, height) {
  vi.spyOn(window.HTMLDivElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    if (this.classList.contains('cal-dropdown') || this.classList.contains('cal-bottom-sheet')) {
      return {
        left: 0,
        right: width,
        top: 0,
        bottom: height,
        width,
        height,
      };
    }

    return {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      width: 0,
      height: 0,
    };
  });
}

describe('mountAnchoredDropdown', () => {
  beforeEach(() => {
    setViewport(800, 600);
    stubWrapperRect(180, 120);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('mounts below the anchor and unmount removes wrapper and backdrop', () => {
    const anchor = createAnchor({
      left: 100,
      right: 150,
      top: 40,
      bottom: 70,
      width: 50,
      height: 30,
    });
    const mounted = mountAnchoredDropdown({
      anchorEl: anchor,
      contentEl: createContent(),
      onClose: vi.fn(),
    });

    const wrapper = document.querySelector('.cal-dropdown');
    expect(wrapper).not.toBeNull();
    expect(wrapper.getAttribute('role')).toBe('dialog');
    expect(wrapper.getAttribute('aria-modal')).toBe('true');
    expect(wrapper.getAttribute('aria-label')).toBe('Calendar dialog');
    expect(wrapper.style.top).toBe('76px');
    expect(wrapper.style.left).toBe('100px');
    expect(wrapper.style.zIndex).toBe('var(--z-dropdown)');
    expect(document.querySelector('.cal-dropdown-backdrop')).not.toBeNull();
    expect(document.querySelector('.cal-dropdown-backdrop').style.zIndex)
      .toBe('calc(var(--z-dropdown) - 1)');

    mounted.unmount();

    expect(document.querySelector('.cal-dropdown')).toBeNull();
    expect(document.querySelector('.cal-dropdown-backdrop')).toBeNull();
  });

  it('calls onClose on Escape once and removes listeners for that close request', () => {
    const onClose = vi.fn();
    mountAnchoredDropdown({
      anchorEl: createAnchor({ left: 20, right: 60, top: 20, bottom: 50, width: 40, height: 30 }),
      contentEl: createContent(),
      onClose,
    });

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    mountAnchoredDropdown({
      anchorEl: createAnchor({ left: 20, right: 60, top: 20, bottom: 50, width: 40, height: 30 }),
      contentEl: createContent(),
      onClose,
    });

    document.querySelector('.cal-dropdown-backdrop')
      .dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders as a bottom sheet with a generated handle on mobile', () => {
    setViewport(320, 600);
    mountAnchoredDropdown({
      anchorEl: createAnchor({ left: 20, right: 60, top: 20, bottom: 50, width: 40, height: 30 }),
      contentEl: createContent(),
      asBottomSheet: true,
      scrim: true,
      onClose: vi.fn(),
    });

    const sheet = document.querySelector('.cal-bottom-sheet');
    expect(sheet).not.toBeNull();
    expect(sheet.classList).toContain('cal-bottom-sheet');
    expect(sheet.querySelector('.bs-handle')).not.toBeNull();
    expect(sheet.style.position).toBe('fixed');
    expect(sheet.style.bottom).toBe('0px');
    expect(document.querySelector('.cal-dropdown-backdrop').style.background)
      .toBe('rgba(8, 8, 24, 0.42)');
  });

  it('aligns the dropdown right edge to the anchor right edge with align end', () => {
    mountAnchoredDropdown({
      anchorEl: createAnchor({
        left: 320,
        right: 420,
        top: 40,
        bottom: 70,
        width: 100,
        height: 30,
      }),
      contentEl: createContent(),
      align: 'end',
      onClose: vi.fn(),
    });

    expect(document.querySelector('.cal-dropdown').style.left).toBe('240px');
  });

  it('flips above when the dropdown would overflow the viewport bottom', () => {
    mountAnchoredDropdown({
      anchorEl: createAnchor({
        left: 100,
        right: 150,
        top: 540,
        bottom: 570,
        width: 50,
        height: 30,
      }),
      contentEl: createContent(),
      onClose: vi.fn(),
    });

    expect(document.querySelector('.cal-dropdown').style.top).toBe('414px');
  });

  it('clamps horizontally to the viewport margin', () => {
    mountAnchoredDropdown({
      anchorEl: createAnchor({
        left: 760,
        right: 790,
        top: 40,
        bottom: 70,
        width: 30,
        height: 30,
      }),
      contentEl: createContent(),
      onClose: vi.fn(),
    });

    expect(document.querySelector('.cal-dropdown').style.left).toBe('612px');
  });

  it('repositions on desktop resize', () => {
    const anchor = createAnchor({
      left: 760,
      right: 790,
      top: 40,
      bottom: 70,
      width: 30,
      height: 30,
    });
    mountAnchoredDropdown({
      anchorEl: anchor,
      contentEl: createContent(),
      onClose: vi.fn(),
    });

    setViewport(1000, 600);
    window.dispatchEvent(new Event('resize'));

    expect(document.querySelector('.cal-dropdown').style.left).toBe('760px');
  });
});
