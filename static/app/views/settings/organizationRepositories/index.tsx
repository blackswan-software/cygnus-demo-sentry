import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {AllCodeMappings} from './allCodeMappings';
import {
  ProviderDropdown,
  ScmConnectionsView,
  useScmConnectionsData,
} from './scmConnectionsView';

export default function OrganizationRepositories() {
  const organization = useOrganization();
  const scmConnectionsData = useScmConnectionsData();

  return (
    <AnalyticsArea name="source-code-management">
      <SentryDocumentTitle title={t('Source Code')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Source Code')}
        action={
          scmConnectionsData.hasConnections ? (
            <ProviderDropdown
              providers={scmConnectionsData.scmProviders}
              onAddIntegration={scmConnectionsData.refetchIntegrations}
              buttonText={t('Connect Source Code')}
              size="sm"
            />
          ) : undefined
        }
      />

      <Stack gap="3xl">
        <ScmConnectionsView data={scmConnectionsData} />
        <AllCodeMappings />
      </Stack>
    </AnalyticsArea>
  );
}
