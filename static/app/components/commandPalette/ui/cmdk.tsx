import type {ReactNode} from 'react';

import type {
  CMDKQueryOptions,
  CommandPaletteAsyncResult,
} from 'sentry/components/commandPalette/types';

import {makeCollection} from './collection';

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
 * Does not render any UI — rendering is handled by a separate consumer of the
 * collection store.
 */
export function CMDKGroup({display, keywords, resource, children}: CMDKGroupProps) {
  const key = CMDKCollection.useRegisterNode({display, keywords, resource});
  const resolvedChildren = typeof children === 'function' ? null : children;

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
