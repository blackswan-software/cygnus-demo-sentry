import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Grid} from '@sentry/scraps/layout';
import {TextArea} from '@sentry/scraps/textarea';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {IssueOwnership} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

type Props = {
  dateUpdated: string | null;
  initialText: string;
  onCancel: () => void;
  organization: Organization;
  /**
   * Used for analytics
   */
  page: 'issue_details' | 'project_settings';
  project: Project;
  disabled?: boolean;
  onSave?: (ownership: IssueOwnership) => void;
};

type InputError = {raw: string[]};

function parseError(error: InputError | null) {
  const text = error?.raw?.[0];
  if (!text) {
    return null;
  }

  if (text.startsWith('Invalid rule owners:')) {
    return <InvalidOwners>{text}</InvalidOwners>;
  }
  return <SyntaxOverlay line={parseInt(text.match(/line (\d*),/)?.[1] ?? '', 10) - 1} />;
}

export function OwnerInput({
  dateUpdated,
  disabled = false,
  initialText,
  onCancel,
  onSave,
  organization,
  page,
  project,
}: Props) {
  const mutation = useMutation<IssueOwnership, RequestError, {raw: string}>({
    mutationFn: data =>
      fetchMutation({
        method: 'PUT',
        url: `/projects/${organization.slug}/${project.slug}/ownership/`,
        data,
      }),
    onSuccess: (ownership, variables) => {
      addSuccessMessage(t('Updated issue ownership rules'));
      form.reset({raw: ownership.raw ?? ''});
      onSave?.(ownership);
      trackIntegrationAnalytics('project_ownership.saved', {
        page,
        organization,
        net_change:
          variables.raw.split('\n').filter(x => x).length -
          initialText.split('\n').filter(x => x).length,
      });
    },
    onError: (caught: RequestError) => {
      if (caught.status === 403) {
        addErrorMessage(
          t("You don't have permission to modify issue ownership rules for this project")
        );
      } else if (
        caught.status === 400 &&
        (caught.responseJSON as InputError)?.raw?.[0]?.startsWith('Invalid rule owners:')
      ) {
        addErrorMessage(
          t(
            'Unable to save issue ownership rule changes: %s',
            (caught.responseJSON as InputError).raw[0]
          )
        );
      } else {
        addErrorMessage(t('Unable to save issue ownership rule changes'));
      }
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {raw: initialText},
    onSubmit: ({value}) => {
      addLoadingMessage();
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <div
        style={{position: 'relative'}}
        onKeyDown={e => {
          if (e.metaKey && e.key === 'Enter') {
            form.handleSubmit();
          }
        }}
      >
        <Panel>
          <PanelHeader>
            {t('Ownership Rules')}

            {dateUpdated && (
              <SyncDate>
                {t('Last Edited')} <TimeSince date={dateUpdated} />
              </SyncDate>
            )}
          </PanelHeader>
          <PanelBody>
            <form.AppField name="raw">
              {field => (
                <StyledTextArea
                  aria-label={t('Ownership Rules')}
                  placeholder={
                    '#example usage\n' +
                    'path:src/example/pipeline/* person@sentry.io #infra\n' +
                    'module:com.module.name.example #sdks\n' +
                    'url:http://example.com/settings/* #product\n' +
                    'tags.sku_class:enterprise #enterprise'
                  }
                  monospace
                  onChange={e => field.handleChange(e.target.value)}
                  disabled={disabled}
                  value={field.state.value}
                  spellCheck="false"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              )}
            </form.AppField>
          </PanelBody>
        </Panel>
        <ActionBar>
          <div>
            {parseError((mutation.error?.responseJSON as InputError | undefined) ?? null)}
          </div>
          <Grid flow="column" align="center" gap="md">
            <Button type="button" size="sm" onClick={onCancel}>
              {t('Cancel')}
            </Button>
            <form.SubmitButton size="sm" disabled={disabled}>
              {t('Save')}
            </form.SubmitButton>
          </Grid>
        </ActionBar>
      </div>
    </form.AppForm>
  );
}

const TEXTAREA_PADDING = 4;
const TEXTAREA_LINE_HEIGHT = 24;

const ActionBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
`;

const SyntaxOverlay = styled('div')<{line: number}>`
  position: absolute;
  top: ${({line}) => TEXTAREA_PADDING + line * TEXTAREA_LINE_HEIGHT + 1}px;
  width: 100%;
  height: ${TEXTAREA_LINE_HEIGHT}px;
  background-color: ${p => p.theme.tokens.background.danger.vibrant};
  opacity: 0.1;
  pointer-events: none;
`;

const StyledTextArea = styled(TextArea)`
  min-height: 140px;
  overflow: auto;
  outline: 0;
  width: 100%;
  resize: none;
  margin: 1px 0 0 0;
  word-break: break-all;
  white-space: pre-wrap;
  padding-top: ${TEXTAREA_PADDING}px;
  line-height: ${TEXTAREA_LINE_HEIGHT}px;
  height: 450px;
  border-width: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
`;

const InvalidOwners = styled('div')`
  color: ${p => p.theme.tokens.content.danger};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-top: 12px;
`;

const SyncDate = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  text-transform: none;
`;
