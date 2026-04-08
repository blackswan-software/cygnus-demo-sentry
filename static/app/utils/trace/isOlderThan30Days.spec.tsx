import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {isPartialSpanOrTraceData} from 'sentry/utils/trace/isOlderThan30Days';

describe('isPartialSpanOrTraceData', () => {
  beforeEach(() => {
    setMockDate(new Date('2025-10-06T00:00:00').getTime());
  });

  afterEach(() => {
    resetMockDate();
  });

  it('handles unix timestamps in seconds as strings', () => {
    expect(isPartialSpanOrTraceData('1751328000')).toBe(true);
  });

  it('handles unix timestamps in milliseconds as strings', () => {
    expect(isPartialSpanOrTraceData('1751328000000')).toBe(true);
  });

  it('does not mark invalid timestamps as partial trace data', () => {
    expect(isPartialSpanOrTraceData('not-a-timestamp')).toBe(false);
  });
});
