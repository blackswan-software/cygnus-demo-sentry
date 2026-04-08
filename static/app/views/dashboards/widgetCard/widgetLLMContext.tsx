import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {
  parseSearch,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {DisplayType} from 'sentry/views/dashboards/types';

/**
 * Wraps parseSearch to return LLM-friendly structured filters with readable
 * operators and negation. Falls back to the raw string if parsing fails.
 */
export function getSearchFiltersForLLM(
  query: string
): Array<{field: string; op: string; value: string}> | string {
  if (!query.trim()) {
    return [];
  }
  try {
    const tokens = parseSearch(query);
    if (!tokens) {
      return query;
    }
    const filters = tokens.filter(
      (t): t is TokenResult<Token.FILTER> => t.type === Token.FILTER
    );
    if (filters.length === 0) {
      return query;
    }
    return filters.map(f => ({
      field: f.key.text,
      op: `${f.negated ? 'NOT ' : ''}${OP_LABELS[f.operator] ?? f.operator}`,
      value: f.value.text,
    }));
  } catch {
    return query;
  }
}

/**
 * Returns a hint for the Seer Explorer agent describing how to re-query this
 * widget's data using a tool call, if the user wants to dig deeper.
 */
export function getWidgetQueryLLMHint(displayType: DisplayType): string {
  switch (displayType) {
    case DisplayType.LINE:
    case DisplayType.AREA:
    case DisplayType.BAR:
      return 'To dig deeper into this widget, run a timeseries query using y_axes (aggregates) + group_by (columns) + query (conditions)';
    case DisplayType.TABLE:
      return 'To dig deeper into this widget, run a table query using fields (aggregates + columns) + query (conditions) + sort (orderby)';
    case DisplayType.BIG_NUMBER:
      return 'To dig deeper into this widget, run a single aggregate query using fields (aggregates) + query (conditions); current value is included below';
    default:
      return 'To dig deeper into this widget, run a table query using fields (aggregates + columns) + query (conditions)';
  }
}
