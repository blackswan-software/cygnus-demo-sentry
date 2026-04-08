# Layout.HeaderActions → TopBar.Slot Migration

## Overview

When the page frame feature flag is active, action buttons that live at the top of a page (in
`Layout.HeaderActions`, `ButtonActionsWrapper`, `StyledHeaderActions`, or similar styled
equivalents) should be rendered into the `TopBar` via slots instead of inline. This allows the
top navigation bar to own button placement when the new page frame is enabled.

Two slots are involved:

- **`actions`** — primary page actions (Create, Edit, Duplicate, etc.)
- **`feedback`** — `FeedbackButton` instances (only relevant when the button carries custom
  `feedbackOptions`; the TopBar renders a global fallback FeedbackButton when no page registers
  one)

## Migration Patterns

### Pattern A — Actions only (no FeedbackButton)

```tsx
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

// Inside the component:
const hasPageFrameFeature = useHasPageFrameFeature();

// Before
<Layout.HeaderActions>
  <ActionButton />
</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <TopBar.Slot name="actions">
      <ActionButton />
    </TopBar.Slot>
  ) : (
    <Layout.HeaderActions>
      <ActionButton />
    </Layout.HeaderActions>
  );
}
```

### Pattern B — Actions + FeedbackButton (no custom `feedbackOptions`)

When `FeedbackButton` has no custom options the TopBar's built-in fallback is sufficient; drop it
from the slot branch entirely.

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <ActionButton />
    <FeedbackButton />
  </Grid>
</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <TopBar.Slot name="actions">
      <ActionButton />
    </TopBar.Slot>
  ) : (
    <Layout.HeaderActions>
      <Grid flow="column" align="center" gap="md">
        <ActionButton />
        <FeedbackButton />
      </Grid>
    </Layout.HeaderActions>
  );
}
```

### Pattern C — Actions + FeedbackButton with custom `feedbackOptions`

When `FeedbackButton` carries custom options (tags, placeholder, form title) register it in the
`feedback` slot so those options are preserved in the TopBar context.

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <ActionButton />
    <FeedbackButton feedbackOptions={feedbackOptions} />
  </Grid>
</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <>
      <TopBar.Slot name="actions">
        <ActionButton />
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton feedbackOptions={feedbackOptions}>{null}</FeedbackButton>
      </TopBar.Slot>
    </>
  ) : (
    <Layout.HeaderActions>
      <Grid flow="column" align="center" gap="md">
        <ActionButton />
        <FeedbackButton feedbackOptions={feedbackOptions} />
      </Grid>
    </Layout.HeaderActions>
  );
}
```

## Rules

- **Always preserve all existing props** on every button.
- **Do not move or restructure** anything inside the `else` branch — the fallback path must be
  identical to the original.
- **Drop the `Grid` wrapper in the slot branch** — the `actions` slot outlet already wraps
  children in a `<Flex align="center" gap="sm">`.
- **Pass `{null}` as children** to `FeedbackButton` inside `TopBar.Slot name="feedback"` to
  suppress the default label in the TopBar context.
- **Only wrap, do not move** — leave the conditional in the same location in the JSX tree; the
  slot mechanism handles repositioning.
- For **component-level migrations** (`WorkflowEngineListLayout`, `DomainViewHeader`): migrate
  inside the shared component so all callers are covered automatically.

---

## Task List

### 1 — `static/app/views/discover/landing.tsx:204`

Pattern A. Inside `Layout.HeaderActions`.

```tsx
// Before
<Layout.HeaderActions>
  <LinkButton
    data-test-id="build-new-query"
    to={to}
    size="sm"
    priority="primary"
    onClick={() => {
      trackAnalytics('discover_v2.build_new_query', {organization});
    }}
  >
    {t('Build a new query')}
  </LinkButton>
</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <TopBar.Slot name="actions">
      <LinkButton
        data-test-id="build-new-query"
        to={to}
        size="sm"
        priority="primary"
        onClick={() => {
          trackAnalytics('discover_v2.build_new_query', {organization});
        }}
      >
        {t('Build a new query')}
      </LinkButton>
    </TopBar.Slot>
  ) : (
    <Layout.HeaderActions>
      <LinkButton
        data-test-id="build-new-query"
        to={to}
        size="sm"
        priority="primary"
        onClick={() => {
          trackAnalytics('discover_v2.build_new_query', {organization});
        }}
      >
        {t('Build a new query')}
      </LinkButton>
    </Layout.HeaderActions>
  );
}
```

---

### 2 — `static/app/views/discover/results/resultsHeader.tsx:176`

Pattern A. `SavedQueryButtonGroup` is the only child of `Layout.HeaderActions`.

```tsx
// Before
<Layout.HeaderActions>
  <SavedQueryButtonGroup ... />
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <SavedQueryButtonGroup ... />
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <SavedQueryButtonGroup ... />
  </Layout.HeaderActions>
)}
```

Preserve all props on `SavedQueryButtonGroup`.

---

### 3 — `static/app/views/releases/detail/header/releaseHeader.tsx:168`

Pattern A. `ReleaseActions` is the only child.

```tsx
// Before
<Layout.HeaderActions>
  <ReleaseActions ... />
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <ReleaseActions ... />
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <ReleaseActions ... />
  </Layout.HeaderActions>
)}
```

---

### 4 — `static/app/views/projectsDashboard/index.tsx:242`

Pattern A. Two `LinkButton` children inside a `Grid`.

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <LinkButton size="sm" icon={<IconUser />} ... >
      {t('Join a Team')}
    </LinkButton>
    <LinkButton size="sm" priority="primary" ... >
      {t('Create Project')}
    </LinkButton>
  </Grid>
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <LinkButton size="sm" icon={<IconUser />} ... >
      {t('Join a Team')}
    </LinkButton>
    <LinkButton size="sm" priority="primary" ... >
      {t('Create Project')}
    </LinkButton>
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <Grid flow="column" align="center" gap="md">
      <LinkButton size="sm" icon={<IconUser />} ... >
        {t('Join a Team')}
      </LinkButton>
      <LinkButton size="sm" priority="primary" ... >
        {t('Create Project')}
      </LinkButton>
    </Grid>
  </Layout.HeaderActions>
)}
```

---

### 5 — `static/app/views/alerts/rules/metric/details/header.tsx:114`

Pattern A. `SnoozeAlert` (conditional) + two `LinkButton` children inside a `Grid`.

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    {rule && project && (
      <Access access={['alerts:write']}>
        {({hasAccess}) => (
          <SnoozeAlert ... />
        )}
      </Access>
    )}
    <LinkButton size="sm" icon={<IconCopy />} to={duplicateLink} ...>
      {t('Duplicate')}
    </LinkButton>
    <LinkButton size="sm" icon={<IconEdit />} to={settingsLink}>
      {t('Edit Rule')}
    </LinkButton>
  </Grid>
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    {rule && project && (
      <Access access={['alerts:write']}>
        {({hasAccess}) => <SnoozeAlert ... />}
      </Access>
    )}
    <LinkButton size="sm" icon={<IconCopy />} to={duplicateLink} ...>
      {t('Duplicate')}
    </LinkButton>
    <LinkButton size="sm" icon={<IconEdit />} to={settingsLink}>
      {t('Edit Rule')}
    </LinkButton>
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <Grid flow="column" align="center" gap="md">
      {rule && project && (
        <Access access={['alerts:write']}>
          {({hasAccess}) => <SnoozeAlert ... />}
        </Access>
      )}
      <LinkButton size="sm" icon={<IconCopy />} to={duplicateLink} ...>
        {t('Duplicate')}
      </LinkButton>
      <LinkButton size="sm" icon={<IconEdit />} to={settingsLink}>
        {t('Edit Rule')}
      </LinkButton>
    </Grid>
  </Layout.HeaderActions>
)}
```

---

### 6 — `static/app/views/alerts/rules/issue/details/ruleDetails.tsx:425`

Pattern A. Same structure as task 5 but for issue alert rules (`type="issue"`, edit link differs).
Apply the same pattern; preserve all existing props.

---

### 7 — `static/app/views/alerts/rules/uptime/details.tsx:152`

Pattern A. `StatusToggleButton` (conditional) + Edit `LinkButton`.

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    {canEdit && <StatusToggleButton ... />}
    {canEdit && (
      <LinkButton size="sm" icon={<IconEdit />} to={...}>
        {t('Edit Rule')}
      </LinkButton>
    )}
  </Grid>
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    {canEdit && <StatusToggleButton ... />}
    {canEdit && (
      <LinkButton size="sm" icon={<IconEdit />} to={...}>
        {t('Edit Rule')}
      </LinkButton>
    )}
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <Grid flow="column" align="center" gap="md">
      {canEdit && <StatusToggleButton ... />}
      {canEdit && (
        <LinkButton size="sm" icon={<IconEdit />} to={...}>
          {t('Edit Rule')}
        </LinkButton>
      )}
    </Grid>
  </Layout.HeaderActions>
)}
```

---

### 8 — `static/app/views/replays/list.tsx:84`

Pattern A. `ReplayIndexTimestampPrefPicker` is the sole child.

```tsx
// Before
<Layout.HeaderActions>
  <ReplayIndexTimestampPrefPicker />
</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <TopBar.Slot name="actions">
      <ReplayIndexTimestampPrefPicker />
    </TopBar.Slot>
  ) : (
    <Layout.HeaderActions>
      <ReplayIndexTimestampPrefPicker />
    </Layout.HeaderActions>
  );
}
```

---

### 9 — `static/app/views/insights/crons/components/monitorHeader.tsx:44`

Pattern A. `MonitorHeaderActions` is the sole child.

```tsx
// Before
<Layout.HeaderActions>
  <MonitorHeaderActions ... />
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <MonitorHeaderActions ... />
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <MonitorHeaderActions ... />
  </Layout.HeaderActions>
)}
```

---

### 10 — `static/app/views/preprod/snapshots/snapshots.tsx:406`

Pattern A. `SnapshotHeaderActions` is the sole child.

```tsx
// Before
<Layout.HeaderActions>
  <SnapshotHeaderActions ... />
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <SnapshotHeaderActions ... />
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <SnapshotHeaderActions ... />
  </Layout.HeaderActions>
)}
```

---

### 11 — `static/app/views/dashboards/detail.tsx:1139`

Pattern A. `Controls` component is the sole child.

```tsx
// Before
<Layout.HeaderActions>
  <Controls
    organization={organization}
    dashboards={dashboards}
    dashboard={dashboard}
    hasUnsavedFilters={hasUnsavedFilters}
    onEdit={this.onEdit}
    onCancel={this.onCancel}
    onCommit={this.onCommit}
    onAddWidget={this.onAddWidget}
    onDelete={this.onDelete(dashboard)}
    onChangeEditAccess={this.onChangeEditAccess}
    dashboardState={dashboardState}
    widgetLimitReached={widgetLimitReached}
    isSaving={isCommittingChanges}
  />
</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <TopBar.Slot name="actions">
      <Controls
        organization={organization}
        dashboards={dashboards}
        dashboard={dashboard}
        hasUnsavedFilters={hasUnsavedFilters}
        onEdit={this.onEdit}
        onCancel={this.onCancel}
        onCommit={this.onCommit}
        onAddWidget={this.onAddWidget}
        onDelete={this.onDelete(dashboard)}
        onChangeEditAccess={this.onChangeEditAccess}
        dashboardState={dashboardState}
        widgetLimitReached={widgetLimitReached}
        isSaving={isCommittingChanges}
      />
    </TopBar.Slot>
  ) : (
    <Layout.HeaderActions>
      <Controls
        organization={organization}
        dashboards={dashboards}
        dashboard={dashboard}
        hasUnsavedFilters={hasUnsavedFilters}
        onEdit={this.onEdit}
        onCancel={this.onCancel}
        onCommit={this.onCommit}
        onAddWidget={this.onAddWidget}
        onDelete={this.onDelete(dashboard)}
        onChangeEditAccess={this.onChangeEditAccess}
        dashboardState={dashboardState}
        widgetLimitReached={widgetLimitReached}
        isSaving={isCommittingChanges}
      />
    </Layout.HeaderActions>
  );
}
```

Note: `dashboards/detail.tsx` is a class component — call `useHasPageFrameFeature` in the
function component that wraps or renders this section, or thread the value in as a prop.

---

### 12 — `static/app/views/alerts/list/header.tsx:66`

Pattern B. `CreateAlertButton` + settings `LinkButton` + `FeedbackButton` (no custom options).

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <CreateAlertButton
      organization={organization}
      iconProps={{size: 'sm'}}
      size="sm"
      priority="primary"
      referrer="alert_stream"
      projectSlug={...}
    >
      {t('Create Alert')}
    </CreateAlertButton>
    <FeedbackButton />
    <LinkButton
      size="sm"
      onClick={handleNavigateToSettings}
      href="#"
      icon={<IconSettings size="sm" />}
      aria-label={t('Settings')}
    />
  </Grid>
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <CreateAlertButton
      organization={organization}
      iconProps={{size: 'sm'}}
      size="sm"
      priority="primary"
      referrer="alert_stream"
      projectSlug={...}
    >
      {t('Create Alert')}
    </CreateAlertButton>
    <LinkButton
      size="sm"
      onClick={handleNavigateToSettings}
      href="#"
      icon={<IconSettings size="sm" />}
      aria-label={t('Settings')}
    />
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <Grid flow="column" align="center" gap="md">
      <CreateAlertButton
        organization={organization}
        iconProps={{size: 'sm'}}
        size="sm"
        priority="primary"
        referrer="alert_stream"
        projectSlug={...}
      >
        {t('Create Alert')}
      </CreateAlertButton>
      <FeedbackButton />
      <LinkButton
        size="sm"
        onClick={handleNavigateToSettings}
        href="#"
        icon={<IconSettings size="sm" />}
        aria-label={t('Settings')}
      />
    </Grid>
  </Layout.HeaderActions>
)}
```

---

### 13 — `static/app/views/performance/transactionSummary/header.tsx:281`

Pattern B. Three action buttons + `FeedbackButton` (no custom options).

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <Feature organization={organization} features="incidents">
      {({hasFeature}) =>
        hasFeature && !metricsCardinality?.isLoading && !deprecateTransactionAlerts(organization) ? (
          <CreateAlertFromViewButton size="sm" ... />
        ) : null
      }
    </Feature>
    <TeamKeyTransactionButton transactionName={transactionName} eventView={eventView} organization={organization} />
    <GuideAnchor target="project_transaction_threshold_override" position="bottom">
      <TransactionThresholdButton organization={organization} transactionName={transactionName} eventView={eventView} onChangeThreshold={onChangeThreshold} />
    </GuideAnchor>
    <FeedbackButton />
  </Grid>
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <Feature organization={organization} features="incidents">
      {({hasFeature}) =>
        hasFeature && !metricsCardinality?.isLoading && !deprecateTransactionAlerts(organization) ? (
          <CreateAlertFromViewButton size="sm" ... />
        ) : null
      }
    </Feature>
    <TeamKeyTransactionButton transactionName={transactionName} eventView={eventView} organization={organization} />
    <GuideAnchor target="project_transaction_threshold_override" position="bottom">
      <TransactionThresholdButton organization={organization} transactionName={transactionName} eventView={eventView} onChangeThreshold={onChangeThreshold} />
    </GuideAnchor>
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <Grid flow="column" align="center" gap="md">
      <Feature organization={organization} features="incidents">
        {({hasFeature}) =>
          hasFeature && !metricsCardinality?.isLoading && !deprecateTransactionAlerts(organization) ? (
            <CreateAlertFromViewButton size="sm" ... />
          ) : null
        }
      </Feature>
      <TeamKeyTransactionButton transactionName={transactionName} eventView={eventView} organization={organization} />
      <GuideAnchor target="project_transaction_threshold_override" position="bottom">
        <TransactionThresholdButton organization={organization} transactionName={transactionName} eventView={eventView} onChangeThreshold={onChangeThreshold} />
      </GuideAnchor>
      <FeedbackButton />
    </Grid>
  </Layout.HeaderActions>
)}
```

---

### 14 — `static/app/views/explore/spans/content.tsx:181`

Pattern B. `StarSavedQueryButton` + conditional `SavedQueryEditMenu` + `FeedbackButton` (no custom options).

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <StarSavedQueryButton />
    {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
    <FeedbackButton />
  </Grid>
</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <TopBar.Slot name="actions">
      <StarSavedQueryButton />
      {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
    </TopBar.Slot>
  ) : (
    <Layout.HeaderActions>
      <Grid flow="column" align="center" gap="md">
        <StarSavedQueryButton />
        {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
        <FeedbackButton />
      </Grid>
    </Layout.HeaderActions>
  );
}
```

---

### 15 — `static/app/views/explore/multiQueryMode/index.tsx:57`

Pattern B. Same structure as task 14 (`StarSavedQueryButton` + `SavedQueryEditMenu` + `FeedbackButton`).
Apply the same pattern.

---

### 16 — `static/app/views/insights/crons/views/overview.tsx:97`

Pattern B. Manage Monitors `Button` + `NewMonitorButton` + `FeedbackButton` (no custom options).

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <FeedbackButton />
    <Button icon={<IconList />} size="sm" onClick={...} ...>
      {t('Manage Monitors')}
    </Button>
    {!guideVisible && (
      <NewMonitorButton size="sm" icon={<IconAdd />}>
        {t('Add Cron Monitor')}
      </NewMonitorButton>
    )}
  </Grid>
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <Button icon={<IconList />} size="sm" onClick={...} ...>
      {t('Manage Monitors')}
    </Button>
    {!guideVisible && (
      <NewMonitorButton size="sm" icon={<IconAdd />}>
        {t('Add Cron Monitor')}
      </NewMonitorButton>
    )}
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <Grid flow="column" align="center" gap="md">
      <FeedbackButton />
      <Button icon={<IconList />} size="sm" onClick={...} ...>
        {t('Manage Monitors')}
      </Button>
      {!guideVisible && (
        <NewMonitorButton size="sm" icon={<IconAdd />}>
          {t('Add Cron Monitor')}
        </NewMonitorButton>
      )}
    </Grid>
  </Layout.HeaderActions>
)}
```

---

### 17 — `static/app/views/insights/uptime/views/overview.tsx:83`

Pattern B. Add Uptime Monitor `LinkButton` + `FeedbackButton` (no custom options).

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <FeedbackButton />
    <LinkButton size="sm" priority="primary" to={...} icon={<IconAdd />} ...>
      {t('Add Uptime Monitor')}
    </LinkButton>
  </Grid>
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <LinkButton size="sm" priority="primary" to={...} icon={<IconAdd />} ...>
      {t('Add Uptime Monitor')}
    </LinkButton>
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <Grid flow="column" align="center" gap="md">
      <FeedbackButton />
      <LinkButton size="sm" priority="primary" to={...} icon={<IconAdd />} ...>
        {t('Add Uptime Monitor')}
      </LinkButton>
    </Grid>
  </Layout.HeaderActions>
)}
```

---

### 18 — `static/app/views/dashboards/manage/index.tsx:635`

Pattern B. Template toggle + Create Dashboard (dropdown or plain button) + Import Dashboard + `FeedbackButton` (no custom options). The create button has two variants controlled by a `Feature` check; both variants go into the slot.

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="lg">
    {!hasPrebuiltDashboards && <TemplateSwitch>...</TemplateSwitch>}
    <FeedbackButton />
    <Feature features={['dashboards-ai-generate']}>
      {({hasFeature: hasAiGenerate}) =>
        hasAiGenerate && areAiFeaturesAllowed ? (
          <DashboardCreateLimitWrapper>
            {(...) => <DropdownMenu ... trigger={...Create Dashboard...} />}
          </DashboardCreateLimitWrapper>
        ) : (
          <DashboardCreateLimitWrapper>
            {(...) => <Button ...>Create Dashboard</Button>}
          </DashboardCreateLimitWrapper>
        )
      }
    </Feature>
    <Feature features="dashboards-import">
      <Button onClick={...} size="sm" priority="primary" icon={<IconAdd />}>
        {t('Import Dashboard from JSON')}
      </Button>
    </Feature>
  </Grid>
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    {!hasPrebuiltDashboards && <TemplateSwitch>...</TemplateSwitch>}
    <Feature features={['dashboards-ai-generate']}>
      {({hasFeature: hasAiGenerate}) =>
        hasAiGenerate && areAiFeaturesAllowed ? (
          <DashboardCreateLimitWrapper>
            {(...) => <DropdownMenu ... trigger={...Create Dashboard...} />}
          </DashboardCreateLimitWrapper>
        ) : (
          <DashboardCreateLimitWrapper>
            {(...) => <Button ...>Create Dashboard</Button>}
          </DashboardCreateLimitWrapper>
        )
      }
    </Feature>
    <Feature features="dashboards-import">
      <Button onClick={...} size="sm" priority="primary" icon={<IconAdd />}>
        {t('Import Dashboard from JSON')}
      </Button>
    </Feature>
  </TopBar.Slot>
) : (
  <Layout.HeaderActions>
    <Grid flow="column" align="center" gap="lg">
      {!hasPrebuiltDashboards && <TemplateSwitch>...</TemplateSwitch>}
      <FeedbackButton />
      <Feature features={['dashboards-ai-generate']}>
        {({hasFeature: hasAiGenerate}) => ...}
      </Feature>
      <Feature features="dashboards-import">
        <Button ...>{t('Import Dashboard from JSON')}</Button>
      </Feature>
    </Grid>
  </Layout.HeaderActions>
)}
```

---

### 19 — `static/app/components/profiling/profileHeader.tsx:91`

Pattern B. `FeedbackButton` (no custom options) + Go to Trace `LinkButton`. The
`StyledHeaderActions` is a `styled(Layout.HeaderActions)` — replace it conditionally with the
slot.

```tsx
// Before
<StyledHeaderActions>
  <FeedbackButton />
  <LinkButton ... to={traceTarget}>
    {t('Go to Trace')}
  </LinkButton>
</StyledHeaderActions>

// After
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <LinkButton ... to={traceTarget}>
      {t('Go to Trace')}
    </LinkButton>
  </TopBar.Slot>
) : (
  <StyledHeaderActions>
    <FeedbackButton />
    <LinkButton ... to={traceTarget}>
      {t('Go to Trace')}
    </LinkButton>
  </StyledHeaderActions>
)}
```

---

### 20 — `static/app/components/profiling/continuousProfileHeader.tsx:53`

Pattern B. Same structure as task 19 (`FeedbackButton` + Go to Trace `LinkButton` in
`StyledHeaderActions`). Apply the same pattern.

---

### 21 — `static/app/views/replays/detail/header/replayDetailsHeaderActions.tsx`

Pattern B. Two render branches (`renderProcessingError` and the success child function), each
containing `FeedbackButton size="xs"` + `ConfigureReplayCard` + `ReplayItemDropdown` inside
`ButtonActionsWrapper = styled(Layout.HeaderActions)`.

Both branches must be wrapped independently:

```tsx
// Before (both branches have the same structure)
<ButtonActionsWrapper>
  <FeedbackButton size="xs" />
  <ConfigureReplayCard ... />
  <ReplayItemDropdown ... />
</ButtonActionsWrapper>

// After (both branches)
{hasPageFrameFeature ? (
  <TopBar.Slot name="actions">
    <ConfigureReplayCard ... />
    <ReplayItemDropdown ... />
  </TopBar.Slot>
) : (
  <ButtonActionsWrapper>
    <FeedbackButton size="xs" />
    <ConfigureReplayCard ... />
    <ReplayItemDropdown ... />
  </ButtonActionsWrapper>
)}
```

Add `const hasPageFrameFeature = useHasPageFrameFeature();` inside
`ReplayDetailsHeaderActions`.

---

### 22 — `static/app/views/explore/logs/content.tsx:121`

Pattern C. `FeedbackButton` with custom `feedbackOptions` + conditional `SetupLogsButton`.

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <FeedbackButton
      feedbackOptions={{
        messagePlaceholder: t('How can we make logs work better for you?'),
        tags: {
          ['feedback.source']: 'logs-listing',
          ['feedback.owner']: 'performance',
        },
      }}
    />
    {defined(onboardingProject) && <SetupLogsButton />}
  </Grid>
</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <>
      {defined(onboardingProject) && (
        <TopBar.Slot name="actions">
          <SetupLogsButton />
        </TopBar.Slot>
      )}
      <TopBar.Slot name="feedback">
        <FeedbackButton
          feedbackOptions={{
            messagePlaceholder: t('How can we make logs work better for you?'),
            tags: {
              ['feedback.source']: 'logs-listing',
              ['feedback.owner']: 'performance',
            },
          }}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
    </>
  ) : (
    <Layout.HeaderActions>
      <Grid flow="column" align="center" gap="md">
        <FeedbackButton
          feedbackOptions={{
            messagePlaceholder: t('How can we make logs work better for you?'),
            tags: {
              ['feedback.source']: 'logs-listing',
              ['feedback.owner']: 'performance',
            },
          }}
        />
        {defined(onboardingProject) && <SetupLogsButton />}
      </Grid>
    </Layout.HeaderActions>
  );
}
```

---

### 23 — `static/app/views/explore/savedQueries/index.tsx:49`

Pattern C. `FeedbackButton` with custom `feedbackOptions` + Create Query actions.
Preserve all existing `feedbackOptions` tags; wrap the create actions in the `actions` slot and
`FeedbackButton` in the `feedback` slot.

---

### 24 — `static/app/views/issueList/issueViews/issueViewsList/issueViewsList.tsx:366`

Pattern C. `FeedbackButton` with custom `feedbackOptions` + Create View `Button` (inside `Feature`
guard).

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <FeedbackButton
      size="sm"
      feedbackOptions={{
        formTitle: t('Give Feedback'),
        messagePlaceholder: t('How can we make issue views better for you?'),
        tags: {
          ['feedback.source']: 'custom_views',
          ['feedback.owner']: 'issues',
        },
      }}
    />
    <Feature features="organizations:issue-views" hookName="feature-disabled:issue-views" renderDisabled={...}>
      {({hasFeature}) => (
        <Button priority="primary" icon={<IconAdd />} size="sm" disabled={...} onClick={...}>
          {t('Create View')}
        </Button>
      )}
    </Feature>
  </Grid>
</Layout.HeaderActions>

// After
{hasPageFrameFeature ? (
  <>
    <TopBar.Slot name="actions">
      <Feature features="organizations:issue-views" hookName="feature-disabled:issue-views" renderDisabled={...}>
        {({hasFeature}) => (
          <Button priority="primary" icon={<IconAdd />} size="sm" disabled={...} onClick={...}>
            {t('Create View')}
          </Button>
        )}
      </Feature>
    </TopBar.Slot>
    <TopBar.Slot name="feedback">
      <FeedbackButton
        size="sm"
        feedbackOptions={{
          formTitle: t('Give Feedback'),
          messagePlaceholder: t('How can we make issue views better for you?'),
          tags: {
            ['feedback.source']: 'custom_views',
            ['feedback.owner']: 'issues',
          },
        }}
      >
        {null}
      </FeedbackButton>
    </TopBar.Slot>
  </>
) : (
  <Layout.HeaderActions>
    <Grid flow="column" align="center" gap="md">
      <FeedbackButton
        size="sm"
        feedbackOptions={{
          formTitle: t('Give Feedback'),
          messagePlaceholder: t('How can we make issue views better for you?'),
          tags: {
            ['feedback.source']: 'custom_views',
            ['feedback.owner']: 'issues',
          },
        }}
      />
      <Feature features="organizations:issue-views" hookName="feature-disabled:issue-views" renderDisabled={...}>
        {({hasFeature}) => (
          <Button priority="primary" icon={<IconAdd />} size="sm" disabled={...} onClick={...}>
            {t('Create View')}
          </Button>
        )}
      </Feature>
    </Grid>
  </Layout.HeaderActions>
)}
```

---

### 25 — `static/app/views/feedback/feedbackListPage.tsx:154`

Pattern C. `FeedbackButton` with custom `feedbackOptions` + Create Alert `LinkButton`.
Preserve all existing `feedbackOptions`; wrap each in its respective slot.

---

### 26 — `static/app/views/preprod/buildDetails/header/buildDetailsHeaderContent.tsx:176`

Pattern C. `FeedbackButton` with custom `feedbackOptions` tags + Compare Build `Button` + Settings
`LinkButton` + Delete `DropdownMenu`. Preserve all existing props. Wrap all non-feedback actions
in the `actions` slot and `FeedbackButton` in the `feedback` slot.

---

### 27 — `static/app/components/workflowEngine/layout/list.tsx:40`

Component-level migration. This component renders `<Layout.HeaderActions>{actions}</Layout.HeaderActions>`
where `{actions}` is passed as a prop. The prop already contains the callers' action buttons.
Migrate inside the component so all 8+ callers are covered automatically.

```tsx
// Before
<Layout.HeaderActions>{actions}</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <TopBar.Slot name="actions">{actions}</TopBar.Slot>
  ) : (
    <Layout.HeaderActions>{actions}</Layout.HeaderActions>
  );
}
```

Add `const hasPageFrameFeature = useHasPageFrameFeature();` inside `WorkflowEngineListLayout`.

Callers covered (no changes needed in these files):

- `views/automations/list.tsx`
- `views/detectors/list/allMonitors.tsx`
- `views/detectors/list/myMonitors.tsx`
- `views/detectors/list/cron.tsx`
- `views/detectors/list/error.tsx`
- `views/detectors/list/uptime.tsx`
- `views/detectors/list/metric.tsx`
- `views/detectors/list/mobileBuild.tsx`

---

### 28 — `static/app/views/insights/pages/domainViewHeader.tsx:136`

Component-level migration. Pattern C. `FeedbackButton feedbackOptions={feedbackOptions}` +
`{additonalHeaderActions}` prop (note the typo — preserve it).

```tsx
// Before
<Layout.HeaderActions>
  <Grid flow="column" align="center" gap="md">
    <FeedbackButton feedbackOptions={feedbackOptions} />
    {additonalHeaderActions}
  </Grid>
</Layout.HeaderActions>;

// After
{
  hasPageFrameFeature ? (
    <>
      {additonalHeaderActions && (
        <TopBar.Slot name="actions">{additonalHeaderActions}</TopBar.Slot>
      )}
      <TopBar.Slot name="feedback">
        <FeedbackButton feedbackOptions={feedbackOptions}>{null}</FeedbackButton>
      </TopBar.Slot>
    </>
  ) : (
    <Layout.HeaderActions>
      <Grid flow="column" align="center" gap="md">
        <FeedbackButton feedbackOptions={feedbackOptions} />
        {additonalHeaderActions}
      </Grid>
    </Layout.HeaderActions>
  );
}
```

Add `const hasPageFrameFeature = useHasPageFrameFeature();` inside `DomainViewHeader`.

Callers covered (no changes needed unless they pass `headerActions`):

- `views/insights/pages/frontend/frontendPageHeader.tsx`
- `views/insights/pages/backend/backendPageHeader.tsx`
- `views/insights/pages/mobile/mobilePageHeader.tsx`
- `views/insights/pages/agents/agentsPageHeader.tsx`
- `views/insights/pages/mcp/mcpPageHeader.tsx`
- `views/insights/pages/conversations/conversationsPageHeader.tsx`
- `views/insights/mobile/screens/views/screenDetailsPage.tsx` (passes `PlatformSelector` as `headerActions`)
