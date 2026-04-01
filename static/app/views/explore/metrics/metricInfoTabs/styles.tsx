import styled from '@emotion/styled';

import {LogDate} from 'sentry/views/explore/logs/styles';

export const StyledTimestampWrapper = styled('div')`
  white-space: nowrap;
  width: fit-content;
  ${LogDate} {
    color: ${p => p.theme.tokens.content.primary};
  }
`;
