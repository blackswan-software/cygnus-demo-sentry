import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SupergroupSection} from 'sentry/views/issueDetails/streamline/sidebar/supergroupSection';

const organization = OrganizationFixture({features: ['top-issues-ui']});

describe('SupergroupSection', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders supergroup card when issue belongs to a supergroup', async () => {
    const group = GroupFixture({id: '1'});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/supergroups/by-group/`,
      body: {
        data: [
          {
            id: 10,
            title: 'Null pointer in auth flow',
            error_type: 'TypeError',
            code_area: 'auth/login',
            summary: 'Root cause summary',
            group_ids: [1, 2, 3],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });

    render(<SupergroupSection group={group} />, {organization});

    expect(await screen.findByText('Supergroup')).toBeInTheDocument();
    expect(screen.getByText('TypeError')).toBeInTheDocument();
    expect(screen.getByText('Null pointer in auth flow')).toBeInTheDocument();
    expect(screen.getByText('auth/login')).toBeInTheDocument();
    expect(screen.getByText('3 issues')).toBeInTheDocument();
  });

  it('does not render when issue is not in a supergroup', async () => {
    const group = GroupFixture({id: '1'});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/supergroups/by-group/`,
      body: {data: []},
    });

    const {container} = render(<SupergroupSection group={group} />, {organization});

    // Wait for the request to resolve, then check it's still empty
    await screen.findByText(() => false).catch(() => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render without the feature flag', () => {
    const group = GroupFixture({id: '1'});
    const orgWithoutFlag = OrganizationFixture({features: []});

    const {container} = render(<SupergroupSection group={group} />, {
      organization: orgWithoutFlag,
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('opens the supergroup drawer on click', async () => {
    const group = GroupFixture({id: '1'});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/supergroups/by-group/`,
      body: {
        data: [
          {
            id: 10,
            title: 'Null pointer in auth flow',
            error_type: 'TypeError',
            code_area: 'auth/login',
            summary: '',
            group_ids: [1, 2],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });
    // The drawer's issue list fetches group details
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });

    render(<SupergroupSection group={group} />, {organization});

    const card = await screen.findByRole('button', {name: 'Supergroup details'});
    await userEvent.click(card);

    expect(await screen.findByText('Supergroups')).toBeInTheDocument();
  });
});
