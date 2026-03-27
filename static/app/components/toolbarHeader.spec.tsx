import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ToolbarHeader} from 'sentry/components/toolbarHeader';

describe('ToolbarHeader', () => {
  it('renders', () => {
    render(<div>Toolbar Header</div>, {additionalWrapper: ToolbarHeader});
    expect(screen.getByText('Toolbar Header')).toBeInTheDocument();
  });
});
