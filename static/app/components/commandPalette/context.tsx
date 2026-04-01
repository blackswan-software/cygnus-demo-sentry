import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
} from 'react';

import {unreachable} from 'sentry/utils/unreachable';

import {CommandPaletteStateProvider} from './ui/commandPaletteStateContext';
import type {CommandPaletteActionWithKey} from './types';

type CommandPaletteProviderProps = {children: React.ReactNode};
type CommandPaletteActions = CommandPaletteActionWithKey[];

type Unregister = () => void;
type CommandPaletteRegistration = (actions: CommandPaletteActionWithKey[]) => Unregister;

type CommandPaletteActionReducerAction =
  | {
      actions: CommandPaletteActionWithKey[];
      type: 'register';
    }
  | {
      keys: string[];
      type: 'unregister';
    };

interface CommandPaletteAsyncState {
  isLoading: boolean;
}

type TrackPromise = (id: string, promise: Promise<unknown>) => void;
type UntrackPromise = (id: string) => void;

interface CommandPaletteAsyncDispatch {
  trackPromise: TrackPromise;
  untrackPromise: UntrackPromise;
}

const CommandPaletteRegistrationContext =
  createContext<CommandPaletteRegistration | null>(null);
const CommandPaletteActionsContext = createContext<CommandPaletteActions | null>(null);
const CommandPaletteAsyncStateContext = createContext<CommandPaletteAsyncState | null>(
  null
);
const CommandPaletteAsyncDispatchContext =
  createContext<CommandPaletteAsyncDispatch | null>(null);

export function useCommandPaletteRegistration(): CommandPaletteRegistration {
  const ctx = useContext(CommandPaletteRegistrationContext);
  if (ctx === null) {
    throw new Error(
      'useCommandPaletteRegistration must be wrapped in CommandPaletteProvider'
    );
  }
  return ctx;
}

export function useCommandPaletteActions(): CommandPaletteActionWithKey[] {
  const ctx = useContext(CommandPaletteActionsContext);
  if (ctx === null) {
    throw new Error('useCommandPaletteActions must be wrapped in CommandPaletteProvider');
  }
  return ctx;
}

export function useCommandPaletteAsyncState(): CommandPaletteAsyncState {
  const ctx = useContext(CommandPaletteAsyncStateContext);
  if (ctx === null) {
    throw new Error(
      'useCommandPaletteAsyncState must be wrapped in CommandPaletteProvider'
    );
  }
  return ctx;
}

export function useCommandPaletteAsyncDispatch(): CommandPaletteAsyncDispatch {
  const ctx = useContext(CommandPaletteAsyncDispatchContext);
  if (ctx === null) {
    throw new Error(
      'useCommandPaletteAsyncDispatch must be wrapped in CommandPaletteProvider'
    );
  }
  return ctx;
}

function actionsReducer(
  state: CommandPaletteActionWithKey[],
  reducerAction: CommandPaletteActionReducerAction
): CommandPaletteActionWithKey[] {
  const type = reducerAction.type;
  switch (type) {
    case 'register': {
      const result = [...state];

      for (const newAction of reducerAction.actions) {
        const existingIndex = result.findIndex(action => action.key === newAction.key);

        if (existingIndex >= 0) {
          result[existingIndex] = newAction;
        } else {
          result.push(newAction);
        }
      }

      return result;
    }
    case 'unregister':
      return state.filter(action => !reducerAction.keys.includes(action.key));
    default:
      unreachable(type);
      return state;
  }
}

export function CommandPaletteProvider({children}: CommandPaletteProviderProps) {
  const [actions, dispatch] = useReducer(actionsReducer, []);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const registerActions = useCallback(
    (newActions: CommandPaletteActionWithKey[]) => {
      dispatch({type: 'register', actions: newActions});
      return () => {
        dispatch({type: 'unregister', keys: newActions.map(a => a.key)});
      };
    },
    [dispatch]
  );

  const asyncState = useMemo<CommandPaletteAsyncState>(
    () => ({isLoading: pendingIds.size > 0}),
    [pendingIds]
  );

  const asyncDispatch = useMemo<CommandPaletteAsyncDispatch>(
    () => ({
      trackPromise: (id: string, promise: Promise<unknown>) => {
        setPendingIds(prev => new Set(prev).add(id));
        promise.finally(() => {
          setPendingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });
      },
      untrackPromise: (id: string) => {
        setPendingIds(prev => {
          if (!prev.has(id)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
    }),
    []
  );

  return (
    <CommandPaletteRegistrationContext.Provider value={registerActions}>
      <CommandPaletteActionsContext.Provider value={actions}>
        <CommandPaletteAsyncStateContext.Provider value={asyncState}>
          <CommandPaletteAsyncDispatchContext.Provider value={asyncDispatch}>
            <CommandPaletteStateProvider>{children}</CommandPaletteStateProvider>
          </CommandPaletteAsyncDispatchContext.Provider>
        </CommandPaletteAsyncStateContext.Provider>
      </CommandPaletteActionsContext.Provider>
    </CommandPaletteRegistrationContext.Provider>
  );
}
