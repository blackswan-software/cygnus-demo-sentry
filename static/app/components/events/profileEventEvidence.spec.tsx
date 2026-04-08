import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {ProfileEventEvidence} from 'sentry/components/events/profileEventEvidence';
import {IssueType} from 'sentry/types/group';

describe('ProfileEventEvidence', () => {
  const defaultProps = {
    event: EventFixture({
      id: 'event-id',
      occurrence: {
        evidenceDisplay: [{name: 'Evidence name', value: 'Evidence value'}],
        evidenceData: {
          profileId: 'profile-id',
          frameName: 'some_func',
          framePackage: 'something.dll',
          transactionId: 'transaction-id',
          transactionName: 'SomeTransaction',
          templateName: 'profile',
        },
      },
      contexts: {
        trace: {
          trace_id: 'trace-id',
        },
      },
    }),
    group: GroupFixture({
      issueType: IssueType.PROFILE_FILE_IO_MAIN_THREAD,
    }),
    projectSlug: 'project-slug',
  };

  afterEach(() => {
    resetMockDate();
  });

  it('displays profile ID and data in evidence display', () => {
    render(<ProfileEventEvidence {...defaultProps} />);

    expect(screen.getByRole('cell', {name: 'Transaction Name'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: /SomeTransaction/})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Profile ID'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: /profile-id/})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Evidence name'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Evidence value'})).toBeInTheDocument();
  });

  it('correctly links to the profile frame', () => {
    render(<ProfileEventEvidence {...defaultProps} />);

    expect(screen.getByRole('button', {name: 'View Profile'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/profiling/profile/project-slug/profile-id/flamegraph/?frameName=some_func&framePackage=something.dll&referrer=issue'
    );
  });

  it('correctly links to the transaction', () => {
    render(<ProfileEventEvidence {...defaultProps} />);

    const button = screen.getByRole('button', {name: 'View Transaction'});
    expect(button).toHaveAttribute(
      'href',
      expect.stringContaining('/organizations/org-slug/explore/traces/trace/trace-id/?')
    );
    expect(button).toHaveAttribute(
      'href',
      expect.stringContaining('eventId=transaction-id')
    );
    expect(button).toHaveAttribute('href', expect.stringContaining('timestamp='));
  });

  it('disables the transaction link when the event is older than 30 days', async () => {
    setMockDate(new Date('2025-10-06T00:00:00').getTime());

    render(
      <ProfileEventEvidence
        {...defaultProps}
        event={EventFixture({
          ...defaultProps.event,
          dateCreated: '2025-08-01T00:00:00Z',
          occurrence: {
            ...defaultProps.event.occurrence,
            evidenceData: {
              ...defaultProps.event.occurrence?.evidenceData,
              timestamp: undefined,
            },
          },
        })}
      />
    );

    const button = screen.getByRole('button', {name: 'View Transaction'});
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await userEvent.hover(button);
    expect(
      await screen.findByText('Trace data is only available for the last 30 days')
    ).toBeInTheDocument();
  });
});
