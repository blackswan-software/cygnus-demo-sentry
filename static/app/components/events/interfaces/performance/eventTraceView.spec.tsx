import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {EntryType} from 'sentry/types/event';
import type {TraceEventResponse} from 'sentry/views/issueDetails/traceTimeline/useTraceTimelineEvents';
import {
  makeTraceError,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {EventTraceView} from './eventTraceView';

describe('EventTraceView', () => {
  const traceId = 'this-is-a-good-trace-id';
  const {organization} = initializeData({
    features: ['profiling'],
  });
  const group = GroupFixture();
  const event = EventFixture({
    contexts: {
      trace: {
        trace_id: traceId,
      },
    },
    eventID: 'issue-5',
  });
  const issuePlatformBody: TraceEventResponse = {
    data: [],
    meta: {fields: {}, units: {}},
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
    });
  });

  afterEach(() => {
    resetMockDate();
  });

  it('renders a trace', async () => {
    const size = 20;
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/events-trace-meta/${traceId}/`,
      body: {
        errors: 1,
        performance_issues: 1,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: new Array(size)
          .fill(0)
          .map((_, i) => [{'transaction.id': i.toString(), count: 1}]),
        span_count: 0,
        span_count_map: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-trace/${traceId}/`,
      body: {
        transactions: Array.from({length: size}, (_, i) =>
          makeTransaction({
            'transaction.op': `transaction-op-${i + 1}`,
            project_slug: `project-slug-${i + 1}`,
            event_id: `event-id-${i + 1}`,
            errors: i === 0 ? [makeTraceError({event_id: 'issue-5'})] : [],
          })
        ),
        orphan_errors: [makeTraceError()],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/project-slug-1:event-id-1/`,
      method: 'GET',
      body: {
        entries: [{type: EntryType.SPANS, data: []}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/project-slug-1:event-id-1/?averageColumn=span.self_time&averageColumn=span.duration`,
      method: 'GET',
      body: {
        entries: [{type: EntryType.SPANS, data: []}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-facets/`,
      method: 'GET',
      asyncDelay: 1,
      body: {},
    });

    render(<EventTraceView group={group} event={event} organization={organization} />);

    expect(await screen.findByText('Trace')).toBeInTheDocument();

    // Renders the transactions
    expect(await screen.findByText('transaction-op-1')).toBeInTheDocument();
    expect(await screen.findByText('transaction-op-2')).toBeInTheDocument();
    expect(await screen.findByText('transaction-op-3')).toBeInTheDocument();
    expect(await screen.findByText('transaction-op-4')).toBeInTheDocument();

    // Renders the error
    expect(
      await screen.findByText('MaybeEncodingError: Error sending result')
    ).toBeInTheDocument();

    // Only renders part of the trace. "x hidden spans" for some reason is cut off in jsdom
    expect(document.querySelectorAll('.TraceRow')).toHaveLength(8);
  });

  it('does not render the trace preview if it has no transactions', async () => {
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/events-trace-meta/${traceId}/`,
      body: {
        errors: 0,
        performance_issues: 0,
        projects: 0,
        transactions: 0,
        transaction_child_count_map: [{'transaction.id': '1', count: 1}],
        span_count: 0,
        span_count_map: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-trace/${traceId}/`,
      body: {
        transactions: [],
        orphan_errors: [],
      },
    });

    render(<EventTraceView group={group} event={event} organization={organization} />);

    expect(await screen.findByText('Trace Preview')).toBeInTheDocument();
  });

  it('disables the trace preview button when the trace is older than 30 days', async () => {
    setMockDate(new Date('2025-10-06T00:00:00').getTime());

    render(
      <EventTraceView
        group={group}
        event={EventFixture({
          ...event,
          dateCreated: '2025-08-01T00:00:00Z',
        })}
        organization={OrganizationFixture({features: []})}
      />
    );

    const button = screen.getByRole('button', {name: 'View Full Trace'});
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await userEvent.hover(button);
    expect(
      await screen.findByText('Trace data is only available for the last 30 days')
    ).toBeInTheDocument();
  });
});
