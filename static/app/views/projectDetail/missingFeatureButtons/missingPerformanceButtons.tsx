import tourAlert from 'sentry-images/spot/performance-tour-alert.svg';
import tourCorrelate from 'sentry-images/spot/performance-tour-correlate.svg';
import tourMetrics from 'sentry-images/spot/performance-tour-metrics.svg';
import tourTrace from 'sentry-images/spot/performance-tour-trace.svg';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';

import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import Feature from 'sentry/components/acl/feature';
import {FeatureShowcase, useShowcaseContext} from 'sentry/components/featureShowcase';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useProjects} from 'sentry/utils/useProjects';
import {
  getPerformanceBaseUrl,
  platformToDomainView,
} from 'sentry/views/performance/utils';

const DOCS_URL = 'https://docs.sentry.io/performance-monitoring/getting-started/';

function SetupFooter() {
  const {close} = useShowcaseContext();
  return (
    <Flex justify="end">
      <LinkButton
        external
        href={DOCS_URL}
        onClick={close}
        priority="primary"
        aria-label={t('Complete tour')}
      >
        {t('Start Setup')}
      </LinkButton>
    </Flex>
  );
}

const docsLink = (
  <LinkButton external href={DOCS_URL}>
    {t('Setup')}
  </LinkButton>
);

type Props = {
  organization: Organization;
};

interface PerformanceShowcaseProps extends Props, ModalRenderProps {}

function PerformanceShowcase(props: PerformanceShowcaseProps) {
  const {organization, ...deps} = props;

  function handleFeatureShowcaseAdvance(step: number) {
    trackAnalytics('project_detail.performance_tour.advance', {
      organization,
      step,
    });
  }

  function handleClose(step: number) {
    trackAnalytics('project_detail.performance_tour.close', {
      organization,
      step,
    });
  }

  return (
    <FeatureShowcase
      {...deps}
      onStepChange={handleFeatureShowcaseAdvance}
      onClose={handleClose}
    >
      <FeatureShowcase.Step>
        <FeatureShowcase.Image src={tourMetrics} alt={t('Track Application Metrics')} />
        <FeatureShowcase.StepTitle>
          {t('Track Application Metrics')}
        </FeatureShowcase.StepTitle>
        <FeatureShowcase.StepContent>
          {t(
            'Monitor your slowest pageloads and APIs to see which users are having the worst time.'
          )}
        </FeatureShowcase.StepContent>
        <FeatureShowcase.StepActions>{docsLink}</FeatureShowcase.StepActions>
      </FeatureShowcase.Step>
      <FeatureShowcase.Step>
        <FeatureShowcase.Image
          src={tourCorrelate}
          alt={t('Correlate Errors and Traces')}
        />
        <FeatureShowcase.StepTitle>
          {t('Correlate Errors and Traces')}
        </FeatureShowcase.StepTitle>
        <FeatureShowcase.StepContent>
          {t(
            'See what errors occurred within a transaction and the impact of those errors.'
          )}
        </FeatureShowcase.StepContent>
        <FeatureShowcase.StepActions>{docsLink}</FeatureShowcase.StepActions>
      </FeatureShowcase.Step>
      <FeatureShowcase.Step>
        <FeatureShowcase.Image src={tourAlert} alt={t('Watch and Alert')} />
        <FeatureShowcase.StepTitle>{t('Watch and Alert')}</FeatureShowcase.StepTitle>
        <FeatureShowcase.StepContent>
          {t(
            'Highlight mission-critical pages and APIs and set latency alerts to notify you before things go wrong.'
          )}
        </FeatureShowcase.StepContent>
        <FeatureShowcase.StepActions>{docsLink}</FeatureShowcase.StepActions>
      </FeatureShowcase.Step>
      <FeatureShowcase.Step>
        <FeatureShowcase.Image src={tourTrace} alt={t('Trace Across Systems')} />
        <FeatureShowcase.StepTitle>{t('Trace Across Systems')}</FeatureShowcase.StepTitle>
        <FeatureShowcase.StepContent>
          {t(
            "Follow a trace from a user's session and drill down to identify any bottlenecks that occur."
          )}
        </FeatureShowcase.StepContent>
        <SetupFooter />
      </FeatureShowcase.Step>
    </FeatureShowcase>
  );
}

export function MissingPerformanceButtons({organization}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const {projects} = useProjects();
  const {
    selection: {projects: selectedProjects},
  } = usePageFilters();

  const domainView = platformToDomainView(projects, selectedProjects);

  return (
    <Feature
      hookName="feature-disabled:project-performance-score-card"
      features="performance-view"
      organization={organization}
    >
      <Grid flow="column" align="center" gap="md">
        <Button
          size="sm"
          priority="primary"
          analyticsEventKey="project_detail.performance_setup_clicked"
          analyticsEventName="Project Detail: Performance Start Setup Clicked"
          onClick={event => {
            event.preventDefault();
            navigateTo(
              `${getPerformanceBaseUrl(organization.slug, domainView)}/?project=:project#performance-sidequest`,
              navigate,
              location
            );
          }}
        >
          {t('Start Setup')}
        </Button>

        <Button
          size="sm"
          analyticsEventKey="project_detail.performance_tour_clicked"
          analyticsEventName="Project Detail: Performance Get Tour Clicked"
          onClick={() => {
            openModal(deps => (
              <PerformanceShowcase {...deps} organization={organization} />
            ));
          }}
        >
          {t('Get Tour')}
        </Button>
      </Grid>
    </Feature>
  );
}
