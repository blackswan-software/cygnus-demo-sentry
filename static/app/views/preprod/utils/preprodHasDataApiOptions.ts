import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

type PreprodHasDataResponse = {
  size?: boolean;
  snapshots?: boolean;
};

export function preprodHasDataApiOptions({
  organization,
  queryParams,
}: {
  organization: Organization;
  queryParams?: Record<string, unknown>;
}) {
  return apiOptions.as<PreprodHasDataResponse>()(
    '/organizations/$organizationIdOrSlug/preprod/has-data/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: queryParams,
      staleTime: 30_000,
    }
  );
}
