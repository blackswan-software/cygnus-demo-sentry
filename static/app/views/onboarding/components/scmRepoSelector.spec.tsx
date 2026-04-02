import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  OnboardingContextProvider,
  type OnboardingSessionState,
} from 'sentry/components/onboarding/onboardingContext';

import {ScmRepoSelector} from './scmRepoSelector';

function makeOnboardingWrapper(initialState?: OnboardingSessionState) {
  return function OnboardingWrapper({children}: {children?: React.ReactNode}) {
    return (
      <OnboardingContextProvider initialValue={initialState}>
        {children}
      </OnboardingContextProvider>
    );
  };
}

describe('ScmRepoSelector', () => {
  const organization = OrganizationFixture();

  const mockIntegration = OrganizationIntegrationsFixture({
    id: '1',
    name: 'getsentry',
    domainName: 'github.com/getsentry',
    provider: {
      key: 'github',
      slug: 'github',
      name: 'GitHub',
      canAdd: true,
      canDisable: false,
      features: ['commits'],
      aspects: {},
    },
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders search placeholder', () => {
    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper(),
    });

    expect(screen.getByText('Search repositories')).toBeInTheDocument();
  });

  it('shows empty state message when search returns no results', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/1/repos/`,
      body: {repos: []},
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper(),
    });

    await userEvent.type(screen.getByRole('textbox'), 'nonexistent');

    expect(
      await screen.findByText(
        'No repositories found. Check your installation permissions to ensure your integration has access.'
      )
    ).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/1/repos/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper(),
    });

    await userEvent.type(screen.getByRole('textbox'), 'sentry');

    expect(
      await screen.findByText('Failed to search repositories. Please try again.')
    ).toBeInTheDocument();
  });

  it('displays repos returned by search', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/1/repos/`,
      body: {
        repos: [
          {identifier: 'getsentry/sentry', name: 'sentry', isInstalled: false},
          {identifier: 'getsentry/relay', name: 'relay', isInstalled: false},
        ],
      },
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper(),
    });

    await userEvent.type(screen.getByRole('textbox'), 'get');

    expect(await screen.findByText('sentry')).toBeInTheDocument();
    expect(screen.getByText('relay')).toBeInTheDocument();
  });

  it('shows selected repo value when one is in context', () => {
    const selectedRepo = RepositoryFixture({
      name: 'getsentry/old-repo',
      externalSlug: 'getsentry/old-repo',
    });

    render(<ScmRepoSelector integration={mockIntegration} />, {
      organization,
      wrapper: makeOnboardingWrapper({selectedRepository: selectedRepo}),
    });

    expect(screen.getByText('getsentry/old-repo')).toBeInTheDocument();
  });
});
