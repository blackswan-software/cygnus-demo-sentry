import {useOrganization} from 'sentry/utils/useOrganization';

export function useHasMetricEquations() {
  const organization = useOrganization();
  return organization.features.includes('tracemetrics-equations-in-explore');
}
