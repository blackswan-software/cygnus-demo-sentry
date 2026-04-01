import {Fragment, useCallback, useState} from 'react';
import {SentryGlobalSearch} from '@sentry-internal/global-search';
import {skipToken} from '@tanstack/react-query';
import DOMPurify from 'dompurify';

import {
  CmdKAction,
  type CmdKQueryOption,
} from 'sentry/components/commandPalette/cmdKAction';
import {CmdKActionProvider} from 'sentry/components/commandPalette/cmdKActionProvider';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {useCommandPaletteState} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {
  DSN_PATTERN,
  getDsnNavTargets,
  type DsnLookupResponse,
} from 'sentry/components/search/sources/dsnLookupUtils';
import {IconDocs, IconIssues} from 'sentry/icons';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 5;

export function GlobalActions() {
  const {query} = useCommandPaletteState();
  const [search] = useState(() => new SentryGlobalSearch(['docs', 'develop']));

  const organization = useOrganization({allowNull: true});
  const hasDsnLookup = organization?.features?.includes('cmd-k-dsn-lookup') ?? false;
  const isDsn = DSN_PATTERN.test(query);

  const dsnQueryOptions = useCallback(() => {
    const base = apiOptions.as<DsnLookupResponse>()(
      '/organizations/$organizationIdOrSlug/dsn-lookup/',
      {
        path: organization ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {dsn: query},
        staleTime: 30_000,
      }
    );
    return {
      ...base,
      select: (raw: ApiResponse<DsnLookupResponse>) =>
        getDsnNavTargets(raw.json).map(
          (target): CommandPaletteAction => ({
            to: target.to,
            display: {
              label: target.label,
              details: target.description,
              icon: <IconIssues />,
            },
            groupingKey: 'search-result',
          })
        ),
    };
  }, [organization, query]);

  const docsQueryOptions = useCallback(
    (): CmdKQueryOption => ({
      queryKey: ['command-palette-docs-search', query],
      queryFn: () =>
        search.query(
          query,
          {searchAllIndexes: true},
          {analyticsTags: ['source:command-palette']}
        ),
      select: results =>
        results
          .flatMap((section: any) => section.hits)
          .slice(0, MAX_RESULTS)
          .map(
            (hit: any): CommandPaletteAction => ({
              display: {
                label: DOMPurify.sanitize(hit.title ?? ''),
                details: hit.context?.context1,
                icon: <IconDocs />,
              },
              groupingKey: 'help',
              keywords: [hit.context?.context1, hit.context?.context2].filter(
                Boolean
              ) as string[],
              onAction: () => window.open(hit.url, '_blank', 'noreferrer'),
            })
          ),
      enabled: query.length >= MIN_QUERY_LENGTH,
      staleTime: 0,
    }),
    [query, search]
  );

  return (
    <Fragment>
      <CmdKActionProvider groupingKey="search-result">
        {isDsn && hasDsnLookup && <CmdKAction queryOptions={dsnQueryOptions} />}
        <CmdKAction queryOptions={docsQueryOptions} />
      </CmdKActionProvider>
    </Fragment>
  );
}
