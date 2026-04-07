import {Fragment, useCallback} from 'react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import {
  useMetricVisualize,
  useSetMetricVisualize,
  useSetTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricToolbar/aggregateDropdown';
import {DeleteMetricButton} from 'sentry/views/explore/metrics/metricToolbar/deleteMetricButton';
import {Filter} from 'sentry/views/explore/metrics/metricToolbar/filter';
import {GroupBySelector} from 'sentry/views/explore/metrics/metricToolbar/groupBySelector';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {VisualizeLabel} from 'sentry/views/explore/metrics/metricToolbar/visualizeLabel';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

interface MetricToolbarProps {
  queryIndex: number;
  references: Set<string>;
  traceMetric: TraceMetric;
}

export function MetricToolbar({traceMetric, queryIndex, references}: MetricToolbarProps) {
  const organization = useOrganization();
  const metricQueries = useMultiMetricsQueryParams();
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const toggleVisibility = useCallback(() => {
    setVisualize(visualize.replace({visible: !visualize.visible}));
  }, [setVisualize, visualize]);
  const setTraceMetric = useSetTraceMetric();
  const canRemoveMetric = metricQueries.length > 1;

  const handleExpressionChange = useCallback(
    (newExpression: Expression) => {
      const isValid = newExpression.isValid;
      if (!isValid) {
        return;
      }
      setVisualize(visualize.replace({yAxis: `${EQUATION_PREFIX}${newExpression.text}`}));
    },
    [setVisualize, visualize]
  );

  if (canUseMetricsUIRefresh(organization)) {
    return (
      <Flex width="100%" align="start" gap="md" data-test-id="metric-toolbar">
        <VisualizeLabel
          index={queryIndex}
          visualize={visualize}
          onClick={toggleVisibility}
        />
        {isVisualizeFunction(visualize) ? (
          <Fragment>
            <Stack flex="1" minWidth={0} gap="sm" width="100%">
              <Flex minWidth={0} gap="xs" align="center">
                <Container width="100%" maxWidth={canRemoveMetric ? '225px' : undefined}>
                  <MetricSelector traceMetric={traceMetric} onChange={setTraceMetric} />
                </Container>
                {canRemoveMetric && <DeleteMetricButton />}
              </Flex>
              <Flex flex="2 1 0" minWidth={0}>
                <AggregateDropdown traceMetric={traceMetric} />
              </Flex>
              <Flex flex="3 1 0" minWidth={0}>
                <GroupBySelector traceMetric={traceMetric} />
              </Flex>
              <Flex minWidth={0} width="100%">
                <Filter traceMetric={traceMetric} />
              </Flex>
            </Stack>
          </Fragment>
        ) : isVisualizeEquation(visualize) ? (
          <Flex direction="row" gap="sm" align="center" minWidth={0} width="100%">
            <ArithmeticBuilder
              aggregations={[]}
              expression={visualize.expression.text}
              functionArguments={[]}
              getFieldDefinition={() => null}
              references={references}
              setExpression={handleExpressionChange}
            />
            {canRemoveMetric && <DeleteMetricButton />}
          </Flex>
        ) : null}
      </Flex>
    );
  }

  return (
    <Grid
      width="100%"
      align="center"
      gap="md"
      columns={`34px 2fr 3fr 6fr ${canRemoveMetric ? '40px' : '0'}`}
      data-test-id="metric-toolbar"
    >
      <VisualizeLabel
        index={queryIndex}
        visualize={visualize}
        onClick={toggleVisibility}
      />
      {isVisualizeFunction(visualize) ? (
        <Fragment>
          <Flex minWidth={0}>
            <MetricSelector traceMetric={traceMetric} onChange={setTraceMetric} />
          </Flex>
          <Flex gap="md" minWidth={0}>
            <Flex flex="2 1 0" minWidth={0}>
              <AggregateDropdown traceMetric={traceMetric} />
            </Flex>
            <Flex flex="3 1 0" minWidth={0}>
              <GroupBySelector traceMetric={traceMetric} />
            </Flex>
          </Flex>
          <Flex minWidth={0}>
            <Filter traceMetric={traceMetric} />
          </Flex>
        </Fragment>
      ) : isVisualizeEquation(visualize) ? (
        <ArithmeticBuilder
          aggregations={[]}
          expression={visualize.expression.text}
          functionArguments={[]}
          getFieldDefinition={() => null}
          references={references}
          setExpression={handleExpressionChange}
        />
      ) : null}
      {canRemoveMetric && <DeleteMetricButton />}
    </Grid>
  );
}
