import {DisplayType} from 'sentry/views/dashboards/types';

import {getSearchFiltersForLLM, getWidgetQueryLLMHint} from './widgetLLMContext';

describe('getWidgetQueryLLMHint', () => {
  it.each([
    [DisplayType.LINE, 'timeseries'],
    [DisplayType.AREA, 'timeseries'],
    [DisplayType.BAR, 'timeseries'],
  ])('returns timeseries hint for %s', (displayType, expected) => {
    expect(getWidgetQueryLLMHint(displayType)).toContain(expected);
  });

  it('returns table hint for TABLE', () => {
    expect(getWidgetQueryLLMHint(DisplayType.TABLE)).toContain('table query');
  });

  it('returns single aggregate hint for BIG_NUMBER', () => {
    expect(getWidgetQueryLLMHint(DisplayType.BIG_NUMBER)).toContain('single aggregate');
    expect(getWidgetQueryLLMHint(DisplayType.BIG_NUMBER)).toContain(
      'value is included below'
    );
  });

  it('returns table hint as default for unknown types', () => {
    expect(getWidgetQueryLLMHint(DisplayType.WHEEL)).toContain('table query');
  });
});

describe('getSearchFiltersForLLM', () => {
  it('parses a simple key:value filter', () => {
    expect(getSearchFiltersForLLM('browser.name:Firefox')).toEqual([
      {field: 'browser.name', op: 'is', value: 'Firefox'},
    ]);
  });

  it('parses a Contains wildcard filter with readable operator', () => {
    // Raw syntax: span.name:\uf00dContains\uf00dqueue.task
    // The search bar produces this internally for "span.name contains queue.task"
    expect(
      getSearchFiltersForLLM('span.name:\uf00dContains\uf00dqueue.task.taskworker')
    ).toEqual([{field: 'span.name', op: 'contains', value: 'queue.task.taskworker'}]);
  });

  it('parses a negated filter with ! prefix', () => {
    expect(getSearchFiltersForLLM('!browser.name:Firefox')).toEqual([
      {field: 'browser.name', op: 'NOT is', value: 'Firefox'},
    ]);
  });

  it('parses a negated Contains wildcard filter', () => {
    expect(
      getSearchFiltersForLLM('!trigger_path:\uf00dContains\uf00dold_seer_automation')
    ).toEqual([
      {field: 'trigger_path', op: 'NOT contains', value: 'old_seer_automation'},
    ]);
  });

  it('parses multiple filters separated by spaces', () => {
    const result = getSearchFiltersForLLM(
      'browser.name:Firefox os.name:Windows level:error'
    );
    expect(result).toEqual([
      {field: 'browser.name', op: 'is', value: 'Firefox'},
      {field: 'os.name', op: 'is', value: 'Windows'},
      {field: 'level', op: 'is', value: 'error'},
    ]);
  });

  it('parses an IN list filter (bracket syntax)', () => {
    const result = getSearchFiltersForLLM('browser.name:[Firefox,Chrome,Safari]');
    expect(result).toEqual([
      {field: 'browser.name', op: 'is', value: '[Firefox,Chrome,Safari]'},
    ]);
  });

  it('parses comparison operators', () => {
    expect(getSearchFiltersForLLM('count():>100')).toEqual([
      {field: 'count()', op: '>', value: '100'},
    ]);
  });

  it('parses negation-in-value syntax (key:!value)', () => {
    // browser.name:!Firefox uses NOT_EQUAL operator, not ! prefix negation
    expect(getSearchFiltersForLLM('browser.name:!Firefox')).toEqual([
      {field: 'browser.name', op: 'is', value: '!Firefox'},
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(getSearchFiltersForLLM('')).toEqual([]);
    expect(getSearchFiltersForLLM('   ')).toEqual([]);
  });

  it('falls back to raw string for unparseable input', () => {
    // Malformed query that parseSearch can't handle
    expect(getSearchFiltersForLLM('(((')).toBe('(((');
  });

  it('falls back to raw string when only free text (no key:value filters)', () => {
    expect(getSearchFiltersForLLM('just some free text')).toBe('just some free text');
  });
});
