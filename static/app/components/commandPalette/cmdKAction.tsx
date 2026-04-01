import {Fragment, useContext, useEffect, useId} from 'react';
import type {UseQueryOptions} from '@tanstack/react-query';
import {keepPreviousData, useQueries} from '@tanstack/react-query';

import {CmdKGroupContext} from 'sentry/components/commandPalette/cmdKActionProvider';
import {
  useCommandPaletteAsyncDispatch,
  useCommandPaletteRegistration,
} from 'sentry/components/commandPalette/context';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {addKeysToActions} from 'sentry/components/commandPalette/useCommandPaletteActions';

export type CmdKQueryOption = UseQueryOptions<any, Error, CommandPaletteAction[], any>;

interface CmdKActionProps {
  /**
   * For simple actions, use this prop.
   *
   * @example
   * actions={() => [
   *   {
   *     display: {
   *       label: 'My Action',
   *       details: 'My Action Details',
   *       icon: <IconIssues />,
   *     },
   *   },
   * ]}
   */
  actions?: () => CommandPaletteAction[] | Promise<CommandPaletteAction[]>;
  /**
   * Query configuration - function returns query options.
   * Use `select` to transform API data to CommandPaletteAction[]s.
   *
   * @example
   * queryOptions={() => {
   *   const baseOptions = apiOptions.as<ResponseType[]>()(path, {
   *     path: {...},
   *     query: {...},
   *     staleTime: 30_000,
   *   });
   *   return {
   *     ...baseOptions,
   *     select: raw => baseOptions.select(raw).map((target): CommandPaletteAction => ({
   *       to: target.to,
   *       display: {
   *         label: target.label,
   *         details: target.description,
   *         icon: <IconIssues />,
   *       },
   *       groupingKey: 'search-result',
   *     })
   *   };
   * })}
   */
  queryOptions?: () => CmdKQueryOption | CmdKQueryOption[];
}

export function CmdKAction({actions, queryOptions}: CmdKActionProps) {
  const resolvedQueryOptions = queryOptions?.();
  const normalizedQueryOptions = resolvedQueryOptions
    ? Array.isArray(resolvedQueryOptions)
      ? resolvedQueryOptions
      : [resolvedQueryOptions]
    : undefined;

  return (
    <Fragment>
      {typeof actions === 'function' && <CmdKActionAsync actions={actions} />}
      {normalizedQueryOptions !== undefined && (
        <CmdKActionQuery queryOptions={normalizedQueryOptions} />
      )}
    </Fragment>
  );
}

function useRegisterActions(id: string, actions: CommandPaletteAction[]) {
  const groupingKey = useContext(CmdKGroupContext);
  const registerActions = useCommandPaletteRegistration();

  useEffect(() => {
    const withGrouping = actions.map(a => ({
      ...a,
      groupingKey: a.groupingKey ?? groupingKey,
    }));
    const keyed = addKeysToActions(id, withGrouping);
    return registerActions(keyed);
  }, [actions, groupingKey, id, registerActions]);
}

function CmdKActionQuery({queryOptions}: {queryOptions: CmdKQueryOption[]}) {
  const id = useId();
  const {trackPromise, untrackPromise} = useCommandPaletteAsyncDispatch();

  const {actions, isFetching} = useQueries({
    queries: queryOptions.map(opt => ({
      placeholderData: keepPreviousData as typeof opt.placeholderData,
      ...opt,
    })),
    combine: results => ({
      actions: results.flatMap(r => (r.data as CommandPaletteAction[]) ?? []),
      isFetching: results.some(r => r.isFetching),
    }),
  });

  useRegisterActions(id, actions);

  useEffect(() => {
    if (!isFetching) {
      untrackPromise(id);
      return undefined;
    }
    const promise = new Promise<void>(() => {});
    trackPromise(id, promise);
    return () => {
      untrackPromise(id);
    };
  }, [id, isFetching, trackPromise, untrackPromise]);

  return null;
}

function CmdKActionAsync({
  actions,
}: {
  actions: () => CommandPaletteAction[] | Promise<CommandPaletteAction[]>;
}) {
  const id = useId();
  const groupingKey = useContext(CmdKGroupContext);
  const registerActions = useCommandPaletteRegistration();
  const {trackPromise, untrackPromise} = useCommandPaletteAsyncDispatch();

  useEffect(() => {
    let cancelled = false;
    let unregister: (() => void) | undefined;

    function handleResolved(resolved: CommandPaletteAction[]) {
      if (cancelled) {
        return;
      }
      const withGrouping = resolved.map(a => ({
        ...a,
        groupingKey: a.groupingKey ?? groupingKey,
      }));
      const keyed = addKeysToActions(id, withGrouping);
      unregister = registerActions(keyed);
    }

    const result = actions();

    if (result instanceof Promise) {
      const promise = result.then(handleResolved, err => {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error('CmdKAction failed to resolve actions:', err);
        }
      });
      trackPromise(id, promise);
    } else {
      handleResolved(result);
    }

    return () => {
      cancelled = true;
      untrackPromise(id);
      unregister?.();
    };
  }, [actions, groupingKey, id, registerActions, trackPromise, untrackPromise]);

  return null;
}
