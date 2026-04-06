import {useQuery} from '@tanstack/react-query';

import type {
  CMDKQueryOptions,
  CommandPaletteAsyncResult,
} from 'sentry/components/commandPalette/types';

import {makeCollection} from './collection';
import {useCommandPaletteState} from './commandPaletteStateContext';

interface DisplayProps {
  label: string;
  details?: string;
  icon?: React.ReactNode;
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

export const CMDKCollection = makeCollection<CMDKActionData>();
/**
 * Root provider for the CMDK collection. Must be mounted inside
 * CommandPaletteStateProvider because it reads the current query from it.
 */
export function CMDKProvider({children}: {children: React.ReactNode}) {
  return <CMDKCollection.Provider>{children}</CMDKCollection.Provider>;
}

interface CMDKGroupProps {
  display: DisplayProps;
  children?: React.ReactNode | ((data: CommandPaletteAsyncResult[]) => React.ReactNode);
  keywords?: string[];
  resource?: (query: string) => CMDKQueryOptions;
}

type CMDKActionProps =
  | {display: DisplayProps; to: string; keywords?: string[]}
  | {display: DisplayProps; onAction: () => void; keywords?: string[]};

/**
 * Registers a node in the collection and propagates its key to children via
 * GroupContext. When a `resource` prop is provided, fetches data using the
 * current query and passes results to a render-prop children function.
 */
export function CMDKGroup({display, keywords, resource, children}: CMDKGroupProps) {
  const key = CMDKCollection.useRegisterNode({display, keywords, resource});

  const {query} = useCommandPaletteState();

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
 */
export function CMDKAction(props: CMDKActionProps) {
  CMDKCollection.useRegisterNode(props);
  return null;
}
