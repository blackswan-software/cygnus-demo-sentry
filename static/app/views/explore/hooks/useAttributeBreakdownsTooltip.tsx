import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {TooltipComponentFormatterCallbackParams} from 'echarts';

import type {TooltipOption} from 'sentry/components/charts/baseChart';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {
  useAddSearchFilter,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';

const TOOLTIP_POSITION_X_OFFSET = 20;
const TOOLTIP_POSITION_Y_OFFSET = -10;

type Params = {
  /**
   * The ref to the chart component.
   */
  chartRef: React.RefObject<ReactEchartsRef | null>;
  /**
   * The width of the chart. Used to dynamically position the tooltip to mitigate content fron being cut off.
   */
  chartWidth: number;
  /**
   * The formatter function to format the tooltip content.
   */
  formatter: (params: TooltipComponentFormatterCallbackParams) => string;
  /**
   * Action handlers and renderer for the tooltip. When provided, the tooltip will show
   * clickable actions on click. When null, no actions are shown.
   */
  actions?: TooltipActions | null;
};

export type TooltipActions = {
  htmlRenderer: (value: string) => string;
  onAction: (params: {action: string; key: string; value: string}) => void;
};

export enum Actions {
  GROUP_BY = 'group_by_attribute',
  ADD_TO_FILTER = 'add_value_to_filter',
  EXCLUDE_FROM_FILTER = 'exclude_value_from_filter',
  COPY_TO_CLIPBOARD = 'copy_value_to_clipboard',
}

export function useAttributeBreakdownsTooltipAction(): TooltipActions['onAction'] {
  const addSearchFilter = useAddSearchFilter();
  const setGroupBys = useSetQueryParamsGroupBys();
  const copyToClipboard = useCopyToClipboard();

  return useCallback(
    ({action, key, value}: {action: string; key: string; value: string}) => {
      switch (action) {
        case Actions.GROUP_BY:
          setGroupBys([key], Mode.AGGREGATE);
          break;
        case Actions.ADD_TO_FILTER:
          addSearchFilter({key, value});
          break;
        case Actions.EXCLUDE_FROM_FILTER:
          addSearchFilter({key, value, negated: true});
          break;
        case Actions.COPY_TO_CLIPBOARD:
          copyToClipboard.copy(value);
          break;
        default:
          break;
      }
    },
    [addSearchFilter, setGroupBys, copyToClipboard]
  );
}

// This hook creates a tooltip configuration for attribute breakdowns charts.
// Since echarts tooltips do not support actions out of the box, we need to handle them manually.
// It is used to freeze the tooltip position and show the tooltip actions on click, anywhere on the chart.
// So that users can intuitively enter the tooltip and click on the actions.
export function useAttributeBreakdownsTooltip({
  chartRef,
  formatter,
  chartWidth,
  actions,
}: Params): TooltipOption {
  // Using a ref instead of state so that freezing/unfreezing never triggers a React re-render.
  // A state change would cause BaseChart to receive a new tooltip prop, which calls
  // setOption({ notMerge: true }) — resetting the entire chart, hiding the tooltip, and making
  // the chart layout stale. dispatchAction({ type: 'showTip' }) then fails to re-show content
  // reliably because axis-to-pixel conversions are unreliable mid-reset.
  // With a ref, the tooltip config is stable; dispatchAction is called synchronously in the
  // click handler while the chart layout is still valid.
  const frozenPositionRef = useRef<[number, number] | null>(null);

  // Sets up all event listeners for freeze/unfreeze, mouseleave, and tooltip action clicks.
  // Depends only on chartRef and actions — does NOT re-run on every freeze/unfreeze.
  useEffect(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (!chartInstance) return;

    const dom = chartInstance.getDom();

    const handleClickAnywhere = (event: MouseEvent) => {
      event.preventDefault();
      const pixelPoint: [number, number] = [event.offsetX, event.offsetY];

      // Toggle frozen state. The ref is updated synchronously before dispatchAction
      // so the formatter closure reads the correct value when echarts calls it.
      frozenPositionRef.current = frozenPositionRef.current ? null : pixelPoint;

      // Dispatch showTip synchronously while the chart layout is intact (no setOption
      // has been called), so echarts can reliably map x/y to axis data and re-invoke
      // the formatter with correct params.
      chartInstance.dispatchAction({
        type: 'showTip',
        x: pixelPoint[0],
        y: pixelPoint[1],
      });
    };

    const handleMouseLeave = (event: MouseEvent) => {
      let el = event.relatedTarget as HTMLElement | null;

      // Don't clear if the mouse is moving into the tooltip content.
      while (el) {
        if (el.dataset?.attributeBreakdownsChartRegion !== undefined) {
          return;
        }
        el = el.parentElement;
      }

      frozenPositionRef.current = null;
    };

    // Handle tooltip action button clicks via event delegation.
    // The guard on frozenPositionRef ensures clicks only fire when frozen.
    const handleClickActions = (event: MouseEvent) => {
      if (!frozenPositionRef.current) return;
      event.preventDefault();

      const target = event.target as HTMLElement;
      const action = target.getAttribute('data-tooltip-action');
      const key = target.getAttribute('data-tooltip-action-key');
      const value = target.getAttribute('data-tooltip-action-value');

      if (action && value && key) {
        actions?.onAction({action, key, value});
      }
    };

    // Handle hover effects via event delegation (CSP-compliant alternative to inline onmouseover/onmouseout)
    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('attribute-breakdowns-tooltip-action-button')) {
        const hoverBg = target.getAttribute('data-hover-background');
        if (hoverBg) {
          target.style.background = hoverBg;
        }
      }
    };

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('attribute-breakdowns-tooltip-action-button')) {
        target.style.background = '';
      }
    };

    dom.addEventListener('click', handleClickAnywhere);
    dom.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('click', handleClickActions);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    // eslint-disable-next-line consistent-return
    return () => {
      dom.removeEventListener('click', handleClickAnywhere);
      dom.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('click', handleClickActions);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, [chartRef, actions]);

  // tooltipConfig is stable — frozenPositionRef is not in the deps array, so BaseChart
  // never receives a new tooltip prop on freeze/unfreeze and setOption is never called.
  const tooltipConfig: TooltipOption = useMemo(
    () => ({
      trigger: 'axis',
      appendToBody: true,
      renderMode: 'html',
      // Always enterable so the mouse can move into the tooltip to click actions without
      // triggering a mouseleave on the chart canvas.
      enterable: true,
      formatter: (params: TooltipComponentFormatterCallbackParams) => {
        // Wrap the content in a div with the data-attribute-breakdowns-chart-region attribute
        // to prevent the tooltip from being closed when the mouse is moved to the tooltip content
        // and clicking actions shouldn't clear the chart selection.
        const wrapContent = (content: string) =>
          `<div data-attribute-breakdowns-chart-region>${content}</div>`;

        if (!frozenPositionRef.current) {
          const actionsPlaceholder = actions?.htmlRenderer
            ? `
          <div
            class="tooltip-footer"
            style="
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 10px;
            "
          >
            Click for actions
          </div>
        `.trim()
            : '';

          return wrapContent(formatter(params) + actionsPlaceholder);
        }

        // Frozen: the ref was set synchronously before dispatchAction fired, so echarts
        // calls this formatter with fresh params for the frozen position.
        const value = (Array.isArray(params) ? params[0]?.name : params.name) ?? '';
        return wrapContent(formatter(params) + (actions?.htmlRenderer(value) ?? ''));
      },
      position(
        point: [number, number],
        _params: TooltipComponentFormatterCallbackParams,
        el: any
      ) {
        const dom = el as HTMLDivElement;
        const tooltipWidth = dom?.offsetWidth ?? 0;
        const [rawX = 0, rawY = 0] = frozenPositionRef.current ?? point;

        let x = rawX + TOOLTIP_POSITION_X_OFFSET;
        const y = rawY + TOOLTIP_POSITION_Y_OFFSET;

        // Flip left if it overflows chart width. Mitigates the content from being cut off.
        if (x + tooltipWidth > chartWidth) {
          x = rawX - tooltipWidth - TOOLTIP_POSITION_X_OFFSET;
        }

        return [x, y];
      },
    }),
    [chartWidth, formatter, actions]
  );

  return tooltipConfig;
}
