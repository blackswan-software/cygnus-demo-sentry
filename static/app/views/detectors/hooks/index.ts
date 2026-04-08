import {queryOptions} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import {AlertStore} from 'sentry/stores/alertStore';
import type {Organization} from 'sentry/types/organization';
import {
  type BaseDetectorUpdatePayload,
  type Detector,
} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

interface UseDetectorsApiOptionsParams {
  cursor?: string;
  ids?: string[];
  /**
   * By default, issue stream detectors are excluded from the query,
   * because they are opaque to the user in the UI and only used to
   * make connections to alerts.
   */
  includeIssueStreamDetectors?: boolean;
  limit?: number;
  projects?: number[];
  query?: string;
  sortBy?: string;
}

const createDetectorQuery = (
  query: string | undefined,
  options: {includeIssueStreamDetectors: boolean}
) => {
  if (options.includeIssueStreamDetectors) {
    return query;
  }
  console.log(`!type:issue_stream ${query ?? ''}`.trim());
  return `!type:issue_stream ${query ?? ''}`.trim();
};

export function detectorListApiOptions(
  organization: Organization,
  {
    query,
    sortBy,
    projects,
    limit,
    cursor,
    ids,
    includeIssueStreamDetectors = false,
  }: UseDetectorsApiOptionsParams = {}
) {
  return queryOptions({
    ...apiOptions.as<Detector[]>()('/organizations/$organizationIdOrSlug/detectors/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        query: createDetectorQuery(query, {includeIssueStreamDetectors}),
        sortBy,
        project: projects,
        per_page: limit,
        cursor,
        id: ids,
      },
      staleTime: 0,
    }),
    retry: false,
  });
}

export function useCreateDetector<T extends Detector = Detector>() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<T, void, BaseDetectorUpdatePayload>({
    mutationFn: data =>
      api.requestPromise(
        getApiUrl(
          '/organizations/$organizationIdOrSlug/projects/$projectIdOrSlug/detectors/',
          {
            path: {organizationIdOrSlug: org.slug, projectIdOrSlug: data.projectId},
          }
        ),
        {
          method: 'POST',
          data,
        }
      ),
    onSuccess: _ => {
      queryClient.invalidateQueries({
        queryKey: detectorListApiOptions(org).queryKey,
      });
    },
    onError: _ => {
      AlertStore.addAlert({variant: 'danger', message: t('Unable to create monitor')});
    },
  });
}

export function useUpdateDetector<T extends Detector = Detector>() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<T, void, {detectorId: string} & Partial<BaseDetectorUpdatePayload>>({
    mutationFn: data =>
      api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/detectors/$detectorId/', {
          path: {organizationIdOrSlug: org.slug, detectorId: data.detectorId},
        }),
        {
          method: 'PUT',
          data,
        }
      ),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({
        queryKey: detectorListApiOptions(org).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/detectors/$detectorId/', {
            path: {organizationIdOrSlug: org.slug, detectorId: data.detectorId},
          }),
        ],
      });
    },
    onError: _ => {
      AlertStore.addAlert({variant: 'danger', message: t('Unable to update monitor')});
    },
  });
}

export const makeDetectorDetailsQueryKey = ({
  orgSlug,
  detectorId,
}: {
  detectorId: string;
  orgSlug: string;
}): ApiQueryKey => [
  getApiUrl('/organizations/$organizationIdOrSlug/detectors/$detectorId/', {
    path: {organizationIdOrSlug: orgSlug, detectorId},
  }),
];

export function useDetectorQuery<T extends Detector = Detector>(
  detectorId: string,
  options: Partial<UseApiQueryOptions<T>> = {}
) {
  const org = useOrganization();

  return useApiQuery<T>(makeDetectorDetailsQueryKey({orgSlug: org.slug, detectorId}), {
    staleTime: 0,
    retry: false,
    ...options,
  });
}
