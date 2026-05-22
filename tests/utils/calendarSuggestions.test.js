import { describe, expect, it } from 'vitest';
import {
  GHOST_RULE_STATUSES,
  evaluateSuggestions,
  ruleFeedback,
  ruleFollowup,
  ruleGhost,
  ruleInterviewFollowup,
  ruleOfferExpiry,
} from '../../src/utils/calendarSuggestions.js';

const TODAY = '2026-05-21';

function app(overrides = {}) {
  return {
    id: 1,
    companyName: 'Acme',
    jobTitle: 'Frontend Engineer',
    status: 'applied',
    timeline: [],
    ...overrides,
  };
}

describe('ruleFollowup', () => {
  it('fires when the latest entry is applied and at least 7 days old', () => {
    expect(ruleFollowup(app({
      timeline: [{ id: 1, date: '2026-05-14', status: 'applied', text: '' }],
    }), TODAY)).toMatchObject({
      kind: 'followup',
      title: 'Follow up with recruiter?',
      meta: '7d since application',
      primary: 'open',
    });
  });

  it('does not fire before 7 days or when a newer entry exists', () => {
    expect(ruleFollowup(app({
      timeline: [{ id: 1, date: '2026-05-15', status: 'applied', text: '' }],
    }), TODAY)).toBeNull();
    expect(ruleFollowup(app({
      timeline: [
        { id: 1, date: '2026-05-01', status: 'applied', text: '' },
        { id: 2, date: '2026-05-16', status: 'interview', text: '' },
      ],
    }), TODAY)).toBeNull();
  });
});

describe('ruleFeedback', () => {
  it('fires after 5 business days', () => {
    expect(ruleFeedback(app({
      timeline: [{ id: 1, date: '2026-05-14', status: 'phone_screen', text: '' }],
    }), TODAY)).toMatchObject({
      kind: 'feedback',
      meta: '5 business days since phone screen',
    });
  });

  it('does not count weekend days toward the threshold', () => {
    expect(ruleFeedback(app({
      timeline: [{ id: 1, date: '2026-05-16', status: 'phone_screen', text: '' }],
    }), TODAY)).toBeNull();
  });
});

describe('ruleInterviewFollowup', () => {
  it('fires when the latest interview entry is at least 7 days old', () => {
    expect(ruleInterviewFollowup(app({
      timeline: [{ id: 1, date: '2026-05-14', status: 'interview', text: '' }],
    }), TODAY)).toMatchObject({
      kind: 'interview_followup',
      title: 'Consider sending a follow-up message',
      meta: '7d since interview',
    });
  });

  it('does not fire before 7 days or when latest entry is not interview', () => {
    expect(ruleInterviewFollowup(app({
      timeline: [{ id: 1, date: '2026-05-15', status: 'interview', text: '' }],
    }), TODAY)).toBeNull();
    expect(ruleInterviewFollowup(app({
      timeline: [
        { id: 1, date: '2026-05-01', status: 'interview', text: '' },
        { id: 2, date: '2026-05-16', status: 'applied', text: '' },
      ],
    }), TODAY)).toBeNull();
  });
});

describe('ruleOfferExpiry', () => {
  it('fires from day 3 through day 5 of the assumed offer window', () => {
    expect(ruleOfferExpiry(app({
      status: 'offer',
      timeline: [{ id: 1, date: '2026-05-18', status: 'offer', text: '' }],
    }), TODAY)).toMatchObject({
      kind: 'offer_expiry',
      meta: 'Offer extended 3d ago',
    });
    expect(ruleOfferExpiry(app({
      status: 'offer',
      timeline: [{ id: 1, date: '2026-05-16', status: 'offer', text: '' }],
    }), TODAY)).toMatchObject({ kind: 'offer_expiry' });
  });

  it('is silent outside the window and requires app.status offer', () => {
    expect(ruleOfferExpiry(app({
      status: 'offer',
      timeline: [{ id: 1, date: '2026-05-19', status: 'offer', text: '' }],
    }), TODAY)).toBeNull();
    expect(ruleOfferExpiry(app({
      status: 'offer',
      timeline: [{ id: 1, date: '2026-05-15', status: 'offer', text: '' }],
    }), TODAY)).toBeNull();
    expect(ruleOfferExpiry(app({
      status: 'interview',
      timeline: [{ id: 1, date: '2026-05-18', status: 'offer', text: '' }],
    }), TODAY)).toBeNull();
    expect(ruleOfferExpiry(app({
      status: 'offer',
      timeline: [{ id: 1, date: '2026-05-18', status: 'interview', text: '' }],
    }), TODAY)).toBeNull();
  });
});

describe('ruleGhost', () => {
  it('fires for the five ghost-rule statuses after 14 days without future entries', () => {
    for (const status of GHOST_RULE_STATUSES) {
      expect(ruleGhost(app({
        status,
        timeline: [{ id: 1, date: '2026-05-07', status, text: '' }],
      }), TODAY)).toMatchObject({
        kind: 'ghost',
        title: 'No updates for 14 days. Mark as Ghosted?',
        meta: '14d \u00b7 last touched May 7',
        primary: 'mark_ghosted',
      });
    }
  });

  it('excludes wishlisted, terminal states, short gaps, empty timelines, and future entries', () => {
    expect(ruleGhost(app({
      status: 'wishlisted',
      timeline: [{ id: 1, date: '2026-05-01', status: 'wishlisted', text: '' }],
    }), TODAY)).toBeNull();
    expect(ruleGhost(app({
      status: 'ghosted',
      timeline: [{ id: 1, date: '2026-05-01', status: 'ghosted', text: '' }],
    }), TODAY)).toBeNull();
    expect(ruleGhost(app({
      status: 'applied',
      timeline: [{ id: 1, date: '2026-05-08', status: 'applied', text: '' }],
    }), TODAY)).toBeNull();
    expect(ruleGhost(app({
      status: 'applied',
      timeline: [],
    }), TODAY)).toBeNull();
    expect(ruleGhost(app({
      status: 'applied',
      timeline: [
        { id: 1, date: '2026-05-01', status: 'applied', text: '' },
        { id: 2, date: '2026-05-22', status: 'applied', text: '' },
      ],
    }), TODAY)).toBeNull();
  });
});

describe('evaluateSuggestions', () => {
  it('suppresses terminal apps and apps with future entries', () => {
    expect(evaluateSuggestions([
      app({
        id: 1,
        status: 'accepted',
        timeline: [{ id: 1, date: '2026-05-01', status: 'applied', text: '' }],
      }),
      app({
        id: 2,
        status: 'applied',
        timeline: [
          { id: 1, date: '2026-05-01', status: 'applied', text: '' },
          { id: 2, date: '2026-05-22', status: 'interview', text: '' },
        ],
      }),
    ], TODAY, [])).toEqual([]);
  });

  it('filters dismissals without mutating the dismissal list', () => {
    const dismissals = [{ appId: 1, kind: 'followup', dismissedAt: '2026-05-21' }];
    const suggestions = evaluateSuggestions([
      app({
        id: 1,
        status: 'applied',
        timeline: [{ id: 1, date: '2026-05-14', status: 'applied', text: '' }],
      }),
    ], TODAY, dismissals);

    expect(suggestions).toEqual([]);
    expect(dismissals).toEqual([{ appId: 1, kind: 'followup', dismissedAt: '2026-05-21' }]);
  });

  it('sorts by app id and then suggestion kind priority', () => {
    const suggestions = evaluateSuggestions([
      app({
        id: 2,
        status: 'offer',
        timeline: [{ id: 1, date: '2026-05-17', status: 'offer', text: '' }],
      }),
      app({
        id: 1,
        status: 'applied',
        timeline: [{ id: 1, date: '2026-05-01', status: 'applied', text: '' }],
      }),
    ], TODAY, []);

    expect(suggestions.map((suggestion) => [suggestion.id, suggestion.kind])).toEqual([
      [1, 'ghost'],
      [1, 'followup'],
      [2, 'offer_expiry'],
    ]);
  });
});
