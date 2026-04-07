import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';

export function ProblemSection() {
  return (
    <Stack gap="md" padding="lg">
      <Text size="lg" bold>
        {t('Problem')}
      </Text>
      <Text>
        {t(
          "Your source maps aren't configured correctly, so stack traces will show minified code instead of your original source. Fix this to see the exact file, line, and function causing the error."
        )}
      </Text>
      <div>
        <LinkButton
          size="sm"
          icon={<IconInfo />}
          external
          href="https://docs.sentry.io/platforms/javascript/sourcemaps/"
        >
          {t('Why configure source maps?')}
        </LinkButton>
      </div>
    </Stack>
  );
}
