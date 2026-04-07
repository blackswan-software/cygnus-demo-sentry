import {Fragment, useState} from 'react';

import tourAlertImage from 'sentry-images/spot/performance-tour-alert.svg';
import tourCorrelateImage from 'sentry-images/spot/performance-tour-correlate.svg';
import tourTraceImage from 'sentry-images/spot/performance-tour-trace.svg';

import {Button} from '@sentry/scraps/button';

import {GlobalModal} from 'sentry/components/globalModal';
import {
  FeatureTourModal,
  TourImage,
  TourText,
} from 'sentry/components/modals/featureTourModal';
import * as Storybook from 'sentry/stories';

const SAMPLE_STEPS = [
  {
    title: 'Trace Errors',
    body: <TourText>Trace errors across your services to find the root cause.</TourText>,
    image: <TourImage src={tourTraceImage} />,
  },
  {
    title: 'Set Alerts',
    body: <TourText>Get notified when things break before your users do.</TourText>,
    image: <TourImage src={tourAlertImage} />,
  },
  {
    title: 'Correlate Data',
    body: (
      <TourText>Correlate errors, transactions, and releases to find patterns.</TourText>
    ),
    image: <TourImage src={tourCorrelateImage} />,
  },
];

export default Storybook.story('FeatureTourModal', story => {
  story('Basic', () => (
    <Fragment>
      <p>
        <Storybook.JSXNode name="FeatureTourModal" /> renders a multi-step modal tour
        using a render-prop pattern. It provides a <code>showModal</code> callback to its
        children, which opens the tour when called.
      </p>
      <GlobalModal />
      <FeatureTourModal steps={SAMPLE_STEPS} doneUrl="https://docs.sentry.io">
        {({showModal}) => (
          <Button priority="primary" onClick={showModal}>
            Open Tour
          </Button>
        )}
      </FeatureTourModal>
    </Fragment>
  ));

  story('Custom Done Text', () => (
    <Fragment>
      <p>
        Use <Storybook.JSXProperty name="doneText" value={String} /> to customize the
        label on the final step's button.
      </p>
      <GlobalModal />
      <FeatureTourModal
        steps={SAMPLE_STEPS}
        doneUrl="https://docs.sentry.io"
        doneText="Read the Docs"
      >
        {({showModal}) => (
          <Button priority="primary" onClick={showModal}>
            Open Tour
          </Button>
        )}
      </FeatureTourModal>
    </Fragment>
  ));

  story('With Custom Actions', () => {
    const stepsWithActions = [
      {
        ...SAMPLE_STEPS[0]!,
        actions: (
          <Button size="sm" priority="link">
            Skip this step
          </Button>
        ),
      },
      ...SAMPLE_STEPS.slice(1),
    ];

    return (
      <Fragment>
        <p>
          Each step can include custom{' '}
          <Storybook.JSXProperty name="actions" value="ReactNode" /> that render alongside
          the navigation buttons.
        </p>
        <GlobalModal />
        <FeatureTourModal steps={stepsWithActions} doneUrl="https://docs.sentry.io">
          {({showModal}) => (
            <Button priority="primary" onClick={showModal}>
              Open Tour
            </Button>
          )}
        </FeatureTourModal>
      </Fragment>
    );
  });

  story('Callbacks', () => {
    const [log, setLog] = useState<string[]>([]);

    return (
      <Fragment>
        <p>
          Use <Storybook.JSXProperty name="onAdvance" value={Function} /> and{' '}
          <Storybook.JSXProperty name="onCloseModal" value={Function} /> to track user
          progress through the tour. Both receive the current step index and the duration
          (ms) the modal has been open.
        </p>
        <GlobalModal />
        <FeatureTourModal
          steps={SAMPLE_STEPS}
          doneUrl="https://docs.sentry.io"
          onAdvance={(step, duration) =>
            setLog(prev => [...prev, `Advanced to step ${step} (${duration}ms)`])
          }
          onCloseModal={(step, duration) =>
            setLog(prev => [...prev, `Closed at step ${step} (${duration}ms)`])
          }
        >
          {({showModal}) => (
            <Button priority="primary" onClick={showModal}>
              Open Tour
            </Button>
          )}
        </FeatureTourModal>
        <p>
          <label>
            Event log:
            <br />
            <textarea rows={4} readOnly value={log.join('\n')} />
            <br />
            <button onClick={() => setLog([])}>Reset</button>
          </label>
        </p>
      </Fragment>
    );
  });
});
