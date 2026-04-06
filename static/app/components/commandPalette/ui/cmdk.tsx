import {createContext, useContext, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {
  CMDKQueryOptions,
  CommandPaletteAsyncResult,
} from 'sentry/components/commandPalette/types';

import {makeCollection} from './collection';
import {useCommandPaletteState} from './commandPaletteStateContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DisplayProps {
  label: string;
  details?: string;
  icon?: ReactNode;
}

/**
 * Single data shape for all CMDK nodes. A node becomes a group by virtue of
 * having children registered under it — there is no separate group type.
 */
export type CMDKActionData =
  | {display: DisplayProps; to: string; keywords?: string[]}
  | {display: DisplayProps; onAction: () => void; keywords?: string[]}
  | {
      display: DisplayProps;
      keywords?: string[];
      resource?: (query: string) => CMDKQueryOptions;
    };

// ---------------------------------------------------------------------------
// Typed collection instance for CMDK
// ---------------------------------------------------------------------------

export const CMDKCollection = makeCollection<CMDKActionData>();

// ---------------------------------------------------------------------------
// Query context
// ---------------------------------------------------------------------------

/**
 * Propagates the current command palette search query to async CMDKGroup nodes
 * so they can call resource(query) to fetch results.
 */
export const CMDKQueryContext = createContext<string>('');

// ---------------------------------------------------------------------------
// CMDKProvider
// ---------------------------------------------------------------------------

interface CMDKProviderProps {
  children: ReactNode;
}

/**
 * Root provider for the CMDK collection. Must be mounted inside
 * CommandPaletteStateProvider because it reads the current query from it.
 *
 * Use this instead of CMDKCollection.Provider directly.
 */
export function CMDKProvider({children}: CMDKProviderProps) {
  const {query} = useCommandPaletteState();
  return (
    <CMDKCollection.Provider>
      <CMDKQueryContext.Provider value={query}>{children}</CMDKQueryContext.Provider>
    </CMDKCollection.Provider>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

interface CMDKGroupProps {
  display: DisplayProps;
  children?: ReactNode | ((data: CommandPaletteAsyncResult[]) => ReactNode);
  keywords?: string[];
  resource?: (query: string) => CMDKQueryOptions;
}

type CMDKActionProps =
  | {display: DisplayProps; to: string; keywords?: string[]}
  | {display: DisplayProps; onAction: () => void; keywords?: string[]};

/**
 * Registers a node in the collection and propagates its key to children via
 * GroupContext so they register as its children.
 *
 * When a `resource` prop is provided, fetches data using the current query and
 * passes results to a render-prop children function.
 *
 * Does not render any UI — rendering is handled by a separate consumer of the
 * collection store.
 */
export function CMDKGroup({display, keywords, resource, children}: CMDKGroupProps) {
  const key = CMDKCollection.useRegisterNode({display, keywords, resource});
  const query = useContext(CMDKQueryContext);

  const {data} = useQuery({
    ...(resource ? resource(query) : {queryKey: [], queryFn: () => null}),
    enabled: !!resource,
  });

  const resolvedChildren =
    typeof children === 'function' ? (data ? children(data) : null) : children;

  return (
    <CMDKCollection.GroupContext.Provider value={key}>
      {resolvedChildren}
    </CMDKCollection.GroupContext.Provider>
  );
}

/**
 * Registers a leaf action node in the collection.
 *
 * Does not render any UI — rendering is handled by a separate consumer of the
 * collection store.
 */
export function CMDKAction(props: CMDKActionProps) {
  CMDKCollection.useRegisterNode(props);
  return null;
}
