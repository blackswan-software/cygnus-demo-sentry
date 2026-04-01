import {createContext} from 'react';

import type {CommandPaletteGroupKey} from 'sentry/components/commandPalette/types';

export const CmdKGroupContext = createContext<CommandPaletteGroupKey | undefined>(
  undefined
);

interface CmdKActionProviderProps {
  children: React.ReactNode;
  groupingKey?: CommandPaletteGroupKey;
}

/**
 * Use to group actions in a "sub-group". This is useful for contextual actions
 * that are related to the current context being rendered.
 *
 * @example
 * <CmdKActionProvider groupingKey="issues">
 *   <CmdKAction actions={() => [
 *     {display: {label: 'Specific Issue Action'}, to: '/issue/'},
 *   ]} />
 *   <CmdKAction actions={() => [
 *     {display: {label: 'All Issues Action'}, to: '/issues/'},
 *   ]} />
 *   ...
 *   <IssuesPage />
 * </CmdKActionProvider>
 */
export function CmdKActionProvider({children, groupingKey}: CmdKActionProviderProps) {
  return (
    <CmdKGroupContext.Provider value={groupingKey}>{children}</CmdKGroupContext.Provider>
  );
}
