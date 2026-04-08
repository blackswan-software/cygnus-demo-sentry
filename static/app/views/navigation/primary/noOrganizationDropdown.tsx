import {useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';

import {AvatarButton} from '@sentry/scraps/avatarButton';
import {useSizeContext} from '@sentry/scraps/sizeContext';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {localizeDomain} from 'sentry/utils/resolveRoute';

export function NoOrganizationDropdown() {
  const theme = useTheme();
  const portalContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

  const size = useSizeContext();
  const configFeatures = ConfigStore.get('features');

  const createOrgUrl = configFeatures.has('system:multi-region')
    ? localizeDomain(ConfigStore.get('links').sentryUrl) + '/organizations/new/'
    : '/organizations/new/';

  const items = configFeatures.has('organizations:create')
    ? [
        {
          key: 'create-organization',
          leadingItems: <IconAdd />,
          label: t('Create a new organization'),
          ...(configFeatures.has('system:multi-region')
            ? {externalHref: createOrgUrl}
            : {to: createOrgUrl}),
        },
      ]
    : [];

  return (
    <DropdownMenu
      usePortal
      portalContainerRef={portalContainerRef}
      zIndex={theme.zIndex.modal}
      trigger={triggerProps => (
        <AvatarButton
          avatar={{
            type: 'letter_avatar',
            identifier: 'sentry',
            name: 'Sentry',
          }}
          size={size}
          aria-label={t('Organization menu')}
          {...triggerProps}
        />
      )}
      position="right-start"
      minMenuWidth={200}
      items={items}
    />
  );
}
