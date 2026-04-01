import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Block, RepoPRState} from 'sentry/views/seerExplorer/types';

import {usePRWidgetData} from './prWidget';

describe('usePRWidgetData', () => {
  const mockBlocks: Block[] = [
    {
      id: 'block-1',
      message: {role: 'assistant', content: 'Made changes'},
      timestamp: '2024-01-01T00:00:00Z',
      merged_file_patches: [
        {
          repo_name: 'getsentry/sentry',
          diff: '+added line',
          patch: {path: 'src/file.py', added: 3, removed: 1, type: 'M'},
        },
      ],
    },
  ];

  const mockRepoPRStates: Record<string, RepoPRState> = {
    'getsentry/sentry': {
      repo_name: 'getsentry/sentry',
      branch_name: 'fix/test',
      commit_sha: 'abc123',
      pr_creation_error: null,
      pr_creation_status: 'completed',
      pr_id: 1,
      pr_number: 100,
      pr_url: 'https://github.com/getsentry/sentry/pull/100',
      title: 'Test PR',
    },
  };

  const mockOnCreatePR = jest.fn();

  it('returns stable memoized values across rerenders with unchanged inputs', () => {
    const {result, rerender} = renderHook(() =>
      usePRWidgetData({
        blocks: mockBlocks,
        repoPRStates: mockRepoPRStates,
        onCreatePR: mockOnCreatePR,
      })
    );

    const firstRender = result.current;

    rerender();

    // All returned values should be referentially identical after a rerender
    // with the same inputs — this verifies useMemo dependencies are stable
    expect(result.current.menuItems).toBe(firstRender.menuItems);
    expect(result.current.menuFooter).toBe(firstRender.menuFooter);
    expect(result.current.allInSync).toBe(firstRender.allInSync);
    expect(result.current.anyCreating).toBe(firstRender.anyCreating);
    expect(result.current.hasPRs).toBe(firstRender.hasPRs);
  });
});
