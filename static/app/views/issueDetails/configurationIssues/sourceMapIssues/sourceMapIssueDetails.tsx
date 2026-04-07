import {Stack} from '@sentry/scraps/layout';

import {useSourceMapDebugQuery} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

import {DiagnosisSection} from './diagnosisSection';
import {ProblemSection} from './problemSection';
import {TroubleshootingSection} from './troubleshootingSection';

interface SourceMapIssueDetailsProps {
  event: Event;
  group: Group;
  project: Project;
}

export function SourceMapIssueDetails({event, project}: SourceMapIssueDetailsProps) {
  const sourceMapQuery = useSourceMapDebugQuery(
    project.slug,
    event.occurrence?.evidenceData?.sampleEventId
  );

  return (
    <Stack gap="lg">
      <ProblemSection />
      <DiagnosisSection sourceMapQuery={sourceMapQuery} />
      <TroubleshootingSection project={project} />
    </Stack>
  );
}
