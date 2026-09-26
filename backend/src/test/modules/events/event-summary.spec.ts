import { describe, expect, it } from 'vitest';
import { type SummaryColumns, toEventSummary } from '../../../modules/events/event-summary.js';

const cols = (overrides: Partial<SummaryColumns> = {}): SummaryColumns => ({
  summaryTitle: 'bug: crash',
  summaryNumber: '7',
  summaryUrl: 'https://github.com/octo/repo/issues/7',
  summaryAuthor: 'alice',
  summaryRef: null,
  ...overrides,
});

describe('toEventSummary', () => {
  it('maps an issue', () => {
    expect(toEventSummary(cols())).toEqual({
      title: 'bug: crash',
      number: 7,
      url: 'https://github.com/octo/repo/issues/7',
      author: 'alice',
      ref: null,
    });
  });

  it('keeps the first line of a commit message and strips refs/heads/', () => {
    const s = toEventSummary(
      cols({ summaryTitle: 'fix: typo\n\nlong body', summaryNumber: null, summaryRef: 'refs/heads/feature/x' }),
    );
    expect(s).toMatchObject({ title: 'fix: typo', number: null, ref: 'feature/x' });
  });

  it('truncates long titles and treats blank ones as missing', () => {
    expect(toEventSummary(cols({ summaryTitle: 'x'.repeat(500) })).title).toHaveLength(200);
    expect(toEventSummary(cols({ summaryTitle: '   ' })).title).toBeNull();
  });

  it('drops links that are not GitHub pages', () => {
    expect(toEventSummary(cols({ summaryUrl: 'javascript:alert(1)' })).url).toBeNull();
    expect(toEventSummary(cols({ summaryUrl: 'https://evil.example/x' })).url).toBeNull();
  });

  it('ignores a non-numeric number', () => {
    expect(toEventSummary(cols({ summaryNumber: 'abc' })).number).toBeNull();
  });
});
