import React, {useEffect, useMemo, useState} from 'react';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  copyToClipboard as copyTextToClipboard,
  useCopyToClipboard,
} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  CellActionContainer,
  EllipsisActionMenu,
} from 'sentry/views/discover/table/cellAction';
import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {ourlogToJson} from 'sentry/views/explore/logs/utils';
import type {AddSearchFilter} from 'sentry/views/explore/queryParams/context';

type LogCellActionProps = {
  addSearchFilter: AddSearchFilter;
  children: React.ReactNode;
  field: string;
  fullLogData: TraceItemDetailsResponse | undefined;
  logId: string;
  value: string | number | boolean;
};

export function LogCellAction({
  children,
  field,
  value,
  fullLogData,
  logId,
  addSearchFilter,
}: LogCellActionProps) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const [pendingCopyJson, setPendingCopyJson] = useState(false);

  const json = useMemo(() => ourlogToJson(fullLogData), [fullLogData]);

  useEffect(() => {
    if (json && pendingCopyJson) {
      setPendingCopyJson(false);
      copy(json, {
        successMessage: t('Copied as JSON'),
        errorMessage: t('Failed to copy'),
      }).then(() => {
        trackAnalytics('logs.table.row_copied_as_json', {
          log_id: logId,
          organization,
        });
      });
    }
  }, [copy, json, logId, organization, pendingCopyJson]);

  const items = useMemo(() => {
    return [
      {
        key: 'copy-message',
        label: t('Copy message'),
        onAction: () => {
          const text = typeof value === 'object' ? JSON.stringify(value) : `${value}`;
          copyTextToClipboard(text, {
            successMessage: t('Copied message'),
            errorMessage: t('Failed to copy'),
          });
        },
      },
      {
        key: 'copy-json',
        label: t('Copy as JSON'),
        onAction: () => {
          setPendingCopyJson(true);
        },
      },
      {
        key: 'add-to-filter',
        label: t('Add to filter'),
        onAction: () => addSearchFilter({key: field, value}),
      },
      {
        key: 'exclude-from-filter',
        label: t('Exclude from filter'),
        onAction: () => addSearchFilter({key: field, value, negated: true}),
      },
    ];
  }, [addSearchFilter, field, value]);

  return (
    <CellActionContainer>
      {children}
      <EllipsisActionMenu items={items} />
    </CellActionContainer>
  );
}
