import {render} from 'sentry-test/reactTestingLibrary';

import {DocumentTitleManager} from './documentTitleManager';
import {SentryDocumentTitle} from '.';

describe('SentryDocumentTitle', () => {
  it('sets the document title', () => {
    render(<SentryDocumentTitle title="This is a test" />, {
      additionalWrapper: DocumentTitleManager,
    });
    expect(document.title).toBe('This is a test — Sentry');
  });

  it('adds a organization slug', () => {
    render(<SentryDocumentTitle orgSlug="org" title="This is a test" />, {
      additionalWrapper: DocumentTitleManager,
    });
    expect(document.title).toBe('This is a test — org — Sentry');
  });

  it('adds a project slug', () => {
    render(<SentryDocumentTitle projectSlug="project" title="This is a test" />, {
      additionalWrapper: DocumentTitleManager,
    });
    expect(document.title).toBe('This is a test — project — Sentry');
  });

  it('adds a organization and project slug', () => {
    render(
      <SentryDocumentTitle orgSlug="org" projectSlug="project" title="This is a test" />,
      {additionalWrapper: DocumentTitleManager}
    );
    expect(document.title).toBe('This is a test — org — project — Sentry');
  });

  it('sets the title without suffix', () => {
    render(<SentryDocumentTitle title="This is a test" noSuffix />, {
      additionalWrapper: DocumentTitleManager,
    });
    expect(document.title).toBe('This is a test');
  });

  it('reverts to the parent title', () => {
    const {rerender} = render(
      <SentryDocumentTitle title="This is a test">
        <SentryDocumentTitle title="child title">Content</SentryDocumentTitle>
      </SentryDocumentTitle>,
      {additionalWrapper: DocumentTitleManager}
    );

    expect(document.title).toBe('child title — Sentry');

    rerender(
      <DocumentTitleManager>
        <SentryDocumentTitle title="This is a test">new Content</SentryDocumentTitle>
      </DocumentTitleManager>
    );

    expect(document.title).toBe('This is a test — Sentry');
  });
});
