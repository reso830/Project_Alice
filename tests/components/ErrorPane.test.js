// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { ErrorPane } from '../../src/components/ErrorPane.js';

describe('ErrorPane', () => {
  it('renders the title, message, and status badge', () => {
    const pane = ErrorPane.render({
      title: "Couldn't load your applications",
      message: 'Something went wrong while loading your applications.',
      code: 'LOAD_FAILED',
    });

    expect(pane.querySelector('.error-pane__title')?.textContent)
      .toBe("Couldn't load your applications");
    expect(pane.querySelector('.error-pane__copy')?.textContent)
      .toBe('Something went wrong while loading your applications.');
    expect(pane.querySelector('.error-pane__badge')?.textContent)
      .toBe('ERROR · LOAD_FAILED');
  });

  it('calls onRetry when the retry button is clicked', () => {
    const onRetry = vi.fn();
    const pane = ErrorPane.render({
      title: 'Title',
      message: 'Message',
      onRetry,
    });
    const retryButton = pane.querySelector('.error-pane__retry');

    expect(retryButton).not.toBeNull();
    expect(retryButton.textContent).toBe('Try again');
    retryButton.click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onRetry is omitted', () => {
    const pane = ErrorPane.render({ title: 'Title', message: 'Message' });
    const retryButton = pane.querySelector('.error-pane__retry');

    expect(() => retryButton.click()).not.toThrow();
  });
});
