import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function ProblemSection() {
  return (
    <InterimSection type={SectionKey.CONFIGURATION_PROBLEM} title={t('Problem')}>
      <Stack gap="md">
        <Text>
          {t(
            "Your source maps aren't configured correctly, so stack traces will show minified code instead of your original source. Fix this to see the exact file, line, and function causing the error."
          )}
        </Text>
        <LinkButton
          size="sm"
          icon={<IconQuestion />}
          external
          href="https://docs.sentry.io/platforms/javascript/sourcemaps/"
        >
          {t('Why configure source maps?')}
        </LinkButton>
      </Stack>
    </InterimSection>
  );
}
