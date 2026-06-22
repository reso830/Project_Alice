// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { OPanel } from '../../src/components/OPanel.js';

function node(className, text) {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  return element;
}

describe('OPanel', () => {
  it('renders children when open and marks the header expanded', () => {
    const panel = OPanel({
      icon: '◎',
      title: 'Overview',
      open: true,
      preview: node('preview', 'Collapsed summary'),
      children: node('children', 'Expanded content'),
    });

    expect(panel.classList.contains('panel')).toBe(true);
    expect(panel.classList.contains('panel--elevated')).toBe(true);
    expect(panel.querySelector('.panel-head').getAttribute('role')).toBe('button');
    expect(panel.querySelector('.panel-head').tabIndex).toBe(0);
    expect(panel.querySelector('.panel-head').getAttribute('aria-expanded')).toBe('true');
    expect(panel.querySelector('.sec-toggle').tabIndex).toBe(-1);
    expect(panel.querySelector('.sec-toggle').getAttribute('aria-hidden')).toBe('true');
    expect(panel.querySelector('.sec-toggle').textContent).toContain('Collapse');
    expect(panel.querySelector('.sec-chev').classList.contains('open')).toBe(true);
    expect(panel.querySelector('.children')?.textContent).toBe('Expanded content');
    expect(panel.querySelector('.preview')).toBeNull();
  });

  it('renders preview when closed and marks the header collapsed', () => {
    const panel = OPanel({
      icon: '◎',
      title: 'Skills',
      open: false,
      preview: node('preview', 'Collapsed summary'),
      children: node('children', 'Expanded content'),
    });

    expect(panel.querySelector('.panel-title').textContent).toBe('Skills');
    expect(panel.querySelector('.panel-head').getAttribute('aria-expanded')).toBe('false');
    expect(panel.querySelector('.sec-toggle').tabIndex).toBe(-1);
    expect(panel.querySelector('.sec-toggle').getAttribute('aria-hidden')).toBe('true');
    expect(panel.querySelector('.sec-toggle').textContent).toContain('Expand');
    expect(panel.querySelector('.sec-chev').classList.contains('open')).toBe(false);
    expect(panel.querySelector('.preview')?.textContent).toBe('Collapsed summary');
    expect(panel.querySelector('.children')).toBeNull();
  });

  it('fires onToggle from click, Enter, Space, and the inner toggle without double firing', () => {
    const onToggle = vi.fn();
    const panel = OPanel({
      icon: '◎',
      title: 'Timeline',
      onToggle,
      preview: node('preview', 'Collapsed summary'),
      children: node('children', 'Expanded content'),
    });

    panel.querySelector('.panel-head').click();
    panel.querySelector('.panel-head')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    panel.querySelector('.panel-head')
      .dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    panel.querySelector('.sec-toggle').click();

    expect(onToggle).toHaveBeenCalledTimes(4);
  });

  it('does not double fire keyboard events that originate on the inner toggle chrome', () => {
    const onToggle = vi.fn();
    const panel = OPanel({
      icon: '◎',
      title: 'Notes',
      onToggle,
      preview: node('preview', 'Collapsed summary'),
      children: node('children', 'Expanded content'),
    });

    panel.querySelector('.sec-toggle')
      .dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    panel.querySelector('.sec-toggle')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('adds the AI tone class when requested', () => {
    const panel = OPanel({
      icon: '◎',
      title: 'Compatibility',
      tone: 'ai',
      preview: node('preview', 'Collapsed summary'),
      children: node('children', 'Expanded content'),
    });

    expect(panel.classList.contains('panel-ai')).toBe(true);
  });
});
