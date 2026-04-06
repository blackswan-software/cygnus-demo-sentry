import {useCallback} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import {useCommandPaletteActionsRegister} from 'sentry/components/commandPalette/context';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import type {CMDKActionData} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

export function RegisterActions({actions}: {actions: CommandPaletteAction[]}) {
  useCommandPaletteActionsRegister(actions);
  return null;
}

export function CommandPaletteDemo() {
  const navigate = useNavigate();

  const handleAction = useCallback(
    (action: CollectionTreeNode<CMDKActionData>) => {
      if ('to' in action) {
        navigate(normalizeUrl(String(action.to)));
      } else if ('onAction' in action) {
        action.onAction();
      }
    },
    [navigate]
  );

  const demoActions: CommandPaletteAction[] = [
    {
      display: {label: 'Go to Flex story'},
      to: '/stories/layout/flex/',
    },
    {
      display: {label: 'Execute an action'},
      onAction: () => {
        addSuccessMessage('Action executed');
      },
    },
    {
      display: {label: 'Parent action'},
      actions: [
        {
          display: {label: 'Child action'},
          onAction: () => {
            addSuccessMessage('Child action executed');
          },
        },
      ],
    },
  ];

  return (
    <CommandPaletteProvider>
      <RegisterActions actions={demoActions} />
      <CommandPalette onAction={handleAction} />
    </CommandPaletteProvider>
  );
}
