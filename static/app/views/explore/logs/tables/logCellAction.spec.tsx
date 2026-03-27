import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LogCellAction} from 'sentry/views/explore/logs/tables/logCellAction';
import {ourlogToJson} from 'sentry/views/explore/logs/utils';

jest.mock('sentry/utils/analytics');

const mockAddSearchFilter = jest.fn();

const mockCopyToClipboard = jest.fn().mockResolvedValue(undefined);
const mockCopyTextToClipboard = jest.fn();

jest.mock('sentry/utils/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({copy: mockCopyToClipboard}),
  get copyToClipboard() {
    return mockCopyTextToClipboard;
  },
}));

function makeFullLogData(
  overrides: Partial<TraceItemDetailsResponse> = {}
): TraceItemDetailsResponse {
  return {
    itemId: 'log-123',
    timestamp: '2025-04-10T19:21:10.049Z',
    meta: {},
    attributes: [
      {name: 'message', value: 'test log body', type: 'str'},
      {name: 'severity', value: 'info', type: 'str'},
      {name: 'trace', value: 'abc123', type: 'str'},
    ],
    ...overrides,
  };
}

describe('LogCellAction', () => {
  const organization = OrganizationFixture();

  it('copies message to clipboard when the message copy button is clicked', async () => {
    const message = 'Hello, world!';
    render(
      <LogCellAction
        field="message"
        value={message}
        fullLogData={undefined}
        logId="log-1"
        addSearchFilter={mockAddSearchFilter}
      >
        <span>cell</span>
      </LogCellAction>,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Copy message'}));

    expect(mockCopyTextToClipboard).toHaveBeenCalledWith(message, expect.any(Object));
  });

  it('copies JSON immediately when the JSON copy button is clicked and fullLogData is already available', async () => {
    const fullLogData = makeFullLogData();

    render(
      <LogCellAction
        field="message"
        value="hello"
        fullLogData={fullLogData}
        logId="log-123"
        addSearchFilter={mockAddSearchFilter}
      >
        <span>cell</span>
      </LogCellAction>,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Copy as JSON'}));

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      ourlogToJson(fullLogData),
      expect.any(Object)
    );
  });

  it('defers copying JSON when the JSON copy button is clicked and fullLogData is not yet available', async () => {
    const {rerender} = render(
      <LogCellAction
        field="message"
        value="hello"
        fullLogData={undefined}
        logId="log-123"
        addSearchFilter={mockAddSearchFilter}
      >
        <span>cell</span>
      </LogCellAction>,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Copy as JSON'}));

    expect(mockCopyToClipboard).not.toHaveBeenCalled();

    const fullLogData = makeFullLogData();

    rerender(
      <LogCellAction
        field="message"
        value="hello"
        fullLogData={fullLogData}
        logId="log-123"
        addSearchFilter={mockAddSearchFilter}
      >
        <span>cell</span>
      </LogCellAction>
    );

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      ourlogToJson(fullLogData),
      expect.any(Object)
    );
  });

  it('calls addSearchFilter without negation when the add button is clicked', async () => {
    render(
      <LogCellAction
        field="severity"
        value="error"
        fullLogData={undefined}
        logId="log-1"
        addSearchFilter={mockAddSearchFilter}
      >
        <span>cell</span>
      </LogCellAction>,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Add to filter'}));

    expect(mockAddSearchFilter).toHaveBeenCalledWith({
      key: 'severity',
      value: 'error',
    });
  });

  it('calls addSearchFilter with negation when the exclude button is clicked', async () => {
    render(
      <LogCellAction
        field="severity"
        value="error"
        fullLogData={undefined}
        logId="log-1"
        addSearchFilter={mockAddSearchFilter}
      >
        <span>cell</span>
      </LogCellAction>,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Exclude from filter'})
    );

    expect(mockAddSearchFilter).toHaveBeenCalledWith({
      key: 'severity',
      value: 'error',
      negated: true,
    });
  });
});
