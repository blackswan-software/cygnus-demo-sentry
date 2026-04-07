import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface TroubleshootingItem {
  description: string;
  docUrl: string;
  title: string;
}

const TROUBLESHOOTING_ITEMS: TroubleshootingItem[] = [
  {
    title: t('Verify Artifacts Are Uploaded'),
    description: t(
      'For Sentry to de-minify your stack traces you must provide both the minified files (for example, app.min.js) and the corresponding source maps.'
    ),
    docUrl:
      'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-artifacts-are-uploaded',
  },
  {
    title: t("Verify That You're Building Source Maps"),
    description: t(
      'Ensure your bundler (Webpack, Rollup, Vite, etc.) is configured to emit source maps. For production builds, check that the sourceMaps option is enabled.'
    ),
    docUrl:
      'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-that-youre-building-source-maps',
  },
  {
    title: t("Verify That You're Running a Production Build"),
    description: t(
      'Source maps are typically only generated for production builds. Ensure you are testing against a production or production-like environment, not a dev server output.'
    ),
    docUrl:
      'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-that-youre-running-a-production-build',
  },
  {
    title: t('Verify Your Source Files Contain Debug ID Injection Snippets'),
    description: t(
      'If you are using the Sentry bundler plugin, each source file should contain a debug ID snippet injected at build time. Verify the plugin is running and the snippet appears in your built output.'
    ),
    docUrl:
      'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-your-source-files-contain-debug-id-injection-snippets',
  },
];

interface TroubleshootingSectionProps {
  project: Project;
}

export function TroubleshootingSection({project}: TroubleshootingSectionProps) {
  const organization = useOrganization();
  const settingsUrl = `/settings/${organization.slug}/projects/${project.slug}/source-maps/`;

  return (
    <InterimSection
      type={SectionKey.CONFIGURATION_TROUBLESHOOTING}
      title={t('Troubleshooting suggestions')}
    >
      <Stack gap="sm">
        {TROUBLESHOOTING_ITEMS.map((item, index) => (
          <Disclosure key={item.title} size="md" defaultExpanded={index === 0}>
            <Disclosure.Title>{item.title}</Disclosure.Title>
            <Disclosure.Content>
              <Stack gap="sm">
                <Text>{item.description}</Text>
                {index === 0 ? (
                  <div>
                    <LinkButton
                      size="sm"
                      priority="primary"
                      icon={<IconSettings />}
                      to={settingsUrl}
                    >
                      {t('Settings')}
                    </LinkButton>
                  </div>
                ) : (
                  <ExternalLink href={item.docUrl}>{t('Read the docs')}</ExternalLink>
                )}
              </Stack>
            </Disclosure.Content>
          </Disclosure>
        ))}
        <FooterRow>
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/">
            {t('Read all documentation')}
          </ExternalLink>
        </FooterRow>
      </Stack>
    </InterimSection>
  );
}

const FooterRow = styled(Flex)`
  padding-top: ${p => p.theme.space.sm};
`;
