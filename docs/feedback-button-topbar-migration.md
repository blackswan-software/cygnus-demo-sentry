# FeedbackButton → TopBar.Slot Migration

## Overview

When the page frame feature flag is active, `FeedbackButton` instances that live at the top of a
page (in `Layout.HeaderActions`, `Layout.HeaderContent`, `Layout.Header`, `SettingsPageHeader`
actions, or styled equivalents) should be rendered into the `TopBar` via a slot instead of inline.
This allows the top navigation bar to own the button's placement when the new page frame is
enabled.

## Migration Pattern

For each candidate site:

1. Import `useHasPageFrameFeatureFlag` and call it in the component body.
2. Import `TopBar` from its module.
3. Wrap the existing `<FeedbackButton>` in a ternary:

```tsx
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeatureFlag} from 'sentry/views/navigation/useHasPageFrameFeatureFlag';

// Inside the component:
const hasPageFrameFeatureFlag = useHasPageFrameFeatureFlag();

// In JSX — copy all existing props, pass null as children in the slot version
// to suppress the default button label:
{hasPageFrameFeatureFlag ? (
  <TopBar.Slot name="feedback">
    <FeedbackButton {...existingProps}>{null}</FeedbackButton>
  </TopBar.Slot>
) : (
  <FeedbackButton {...existingProps} />
)}
```

### Rules

- **Always preserve all existing props** (`size`, `feedbackOptions`, `aria-label`, etc.).
- **Pass `{null}` as children** inside the `TopBar.Slot` version — this prevents the default
  label from rendering in the top bar context.
- **Do not change the `else` branch** — the original render must stay identical.
- **Only wrap, do not move** — leave the button in its existing location in the JSX tree; the
  slot mechanism handles repositioning.

---

## Task List

### 1 — `static/app/views/alerts/list/header.tsx:82`

Inside `Layout.HeaderActions`.

```tsx
// Before
<FeedbackButton />

// After
{hasPageFrameFeatureFlag ? (
  <TopBar.Slot name="feedback"><FeedbackButton>{null}</FeedbackButton></TopBar.Slot>
) : (
  <FeedbackButton />
)}
```

---

### 2 — `static/app/views/performance/transactionSummary/header.tsx:317`

Inside `Layout.HeaderActions`.

```tsx
// Before
<FeedbackButton />
```

Same no-props pattern as task 1.

---

### 3 — `static/app/views/insights/pages/domainViewHeader.tsx:138`

Inside `Layout.HeaderActions`.

```tsx
// Before
<FeedbackButton feedbackOptions={feedbackOptions} />

// After
{hasPageFrameFeatureFlag ? (
  <TopBar.Slot name="feedback">
    <FeedbackButton feedbackOptions={feedbackOptions}>{null}</FeedbackButton>
  </TopBar.Slot>
) : (
  <FeedbackButton feedbackOptions={feedbackOptions} />
)}
```

---

### 4 — `static/app/views/insights/uptime/views/overview.tsx:85`

Inside `Layout.HeaderActions`. No-props pattern.

---

### 5 — `static/app/views/insights/crons/views/overview.tsx:99`

Inside `Layout.HeaderActions`. No-props pattern.

---

### 6 — `static/app/views/insights/crons/components/monitorHeaderActions.tsx:87`

Inside a `Flex` row; parent `monitorHeader.tsx` places this inside `Layout.HeaderActions`.
No-props pattern.

---

### 7 — `static/app/views/explore/errors/content.tsx:48`

Sole child of `Layout.HeaderActions`. No-props pattern.

---

### 8 — `static/app/views/explore/logs/content.tsx:123`

Inside `Layout.HeaderActions`.

```tsx
// Before
<FeedbackButton
  feedbackOptions={{
    messagePlaceholder: t('How can we make logs work better for you?'),
    tags: {['feedback.source']: 'logs-listing'},
  }}
/>
```

Preserve `feedbackOptions` in both branches.

---

### 9 — `static/app/views/explore/spans/content.tsx:185`

Inside `Layout.HeaderActions`. No-props pattern.

---

### 10 — `static/app/views/explore/savedQueries/index.tsx:51`

Inside `Layout.HeaderActions` (inside a `Grid`). No-props pattern.

---

### 11 — `static/app/views/explore/multiQueryMode/index.tsx:61`

Inside `Layout.HeaderActions` (inside a `Grid`). No-props pattern.

---

### 12 — `static/app/views/explore/metrics/content.tsx:100`

Sole child of `Layout.HeaderActions`.

```tsx
// Before
<FeedbackButton
  feedbackOptions={{
    messagePlaceholder: t('How can we make metrics work better for you?'),
    tags: {
      ['feedback.source']: 'metrics-listing',
      ['feedback.owner']: 'performance',
    },
  }}
/>
```

---

### 13 — `static/app/views/releases/list/index.tsx:428`

Inside `Layout.HeaderActions`.

```tsx
// Before
<FeedbackButton
  feedbackOptions={{
    messagePlaceholder: t('How can we improve the Releases experience?'),
    tags: {['feedback.source']: 'releases-list-header'},
  }}
/>
```

---

### 14 — `static/app/views/dashboards/manage/index.tsx:648`

Inside `Layout.HeaderActions` (inside a `Grid`). No-props pattern.

---

### 15 — `static/app/views/projectDetail/projectDetail.tsx:208`

Inside `Layout.HeaderActions` (inside a `Grid`). No-props pattern.

---

### 16 — `static/app/views/issueList/issueViews/issueViewsList/issueViewsList.tsx:368`

Inside `Layout.HeaderActions`.

```tsx
// Before
<FeedbackButton
  size="sm"
  feedbackOptions={{
    formTitle: t('Give Feedback'),
    messagePlaceholder: t('How can we make issue views better for you?'),
  }}
/>
```

---

### 17 — `static/app/views/replays/detail/header/replayDetailsHeaderActions.tsx:26 & 38`

Two instances inside `ButtonActionsWrapper = styled(Layout.HeaderActions)`, in separate render
branches (error state and loaded state). Both must be wrapped.

```tsx
// Before (both instances)
<FeedbackButton size="xs" />
```

---

### 18 — `static/app/components/profiling/continuousProfileHeader.tsx:54`

Inside `StyledHeaderActions = styled(Layout.HeaderActions)`. No-props pattern.

---

### 19 — `static/app/components/profiling/profileHeader.tsx:92`

Inside `StyledHeaderActions = styled(Layout.HeaderActions)`. No-props pattern.

---

### 20 — `static/app/views/preprod/buildDetails/header/buildDetailsHeaderContent.tsx:178`

Inside `Layout.HeaderActions`.

```tsx
// Before
<FeedbackButton
  feedbackOptions={{
    tags: {'feedback.source': 'preprod.buildDetails', ...},
  }}
/>
```

Preserve all `feedbackOptions` tags.

---

### 21 — `static/app/views/feedback/feedbackListPage.tsx:156`

Inside `Layout.HeaderActions`.

```tsx
// Before
<FeedbackButton
  size="sm"
  feedbackOptions={{
    messagePlaceholder: t('How can we improve the User Feedback experience?'),
  }}
/>
```

---

### 22 — `static/app/views/profiling/content.tsx:391`

Inside `StyledHeaderContent = styled(Layout.HeaderContent)`, sibling of `Layout.Title`.
No-props pattern.

---

### 23 — `static/app/views/issueDetails/streamline/header/header.tsx:150`

Inside a custom `<Header>` styled component, inside `Flex > Grid` at top of page. Note: this
button is nested inside an existing conditional — only the `FeedbackButton` branch changes, the
`else` branch (`<NewIssueExperienceButton />`) is untouched.

```tsx
// Before
{hasFeedbackForm && feedback ? (
  <FeedbackButton
    aria-label={t('Give feedback on the issue Sentry detected')}
    size="xs"
    feedbackOptions={{
      messagePlaceholder: t('Please provide feedback on the issue Sentry detected.'),
      tags: {['feedback.source']: feedbackSource},
    }}
  />
) : (
  <NewIssueExperienceButton />
)}

// After
{hasFeedbackForm && feedback ? (
  hasPageFrameFeatureFlag ? (
    <TopBar.Slot name="feedback">
      <FeedbackButton
        aria-label={t('Give feedback on the issue Sentry detected')}
        size="xs"
        feedbackOptions={{
          messagePlaceholder: t('Please provide feedback on the issue Sentry detected.'),
          tags: {['feedback.source']: feedbackSource},
        }}
      >
        {null}
      </FeedbackButton>
    </TopBar.Slot>
  ) : (
    <FeedbackButton
      aria-label={t('Give feedback on the issue Sentry detected')}
      size="xs"
      feedbackOptions={{
        messagePlaceholder: t('Please provide feedback on the issue Sentry detected.'),
        tags: {['feedback.source']: feedbackSource},
      }}
    />
  )
) : (
  <NewIssueExperienceButton />
)}
```

---

### 24 — `static/app/views/performance/newTraceDetails/traceHeader/index.tsx:92`

Inside a `Grid` in a custom trace header (no `Layout.*` primitives, but at top of page).

```tsx
// Before
<FeedbackButton
  size="xs"
  feedbackOptions={{messagePlaceholder: t('How can we make the trace view better for you?')}}
/>
```

---

### 25 — `static/app/views/performance/newTraceDetails/traceHeader/placeholder.tsx:43`

Same as task 24 but the skeleton/placeholder version of the trace header.

---

### 26 — `static/app/views/preprod/buildComparison/header/buildCompareHeaderContent.tsx:144`

Inside a `Flex align="center" gap="sm"` in a custom build comparison header.

```tsx
// Before
<FeedbackButton
  feedbackOptions={{
    tags: {'feedback.source': 'preprod.buildDetails', ...},
  }}
/>
```

---

### 27 — `static/app/views/settings/project/preprod/index.tsx:66`

In the `action` prop of `<SettingsPageHeader>`, inside a `Grid`.

```tsx
// Before
<FeedbackButton />
```

No-props pattern.

---

### 28 — `static/app/views/settings/project/tempest/index.tsx:113`

In the `action` prop of `<SettingsPageHeader>`, inside a `Grid`, alongside
`<RequestSdkAccessButton>`.

```tsx
// Before
<FeedbackButton />
```

No-props pattern.

---

### 29 — `static/gsApp/views/seerAutomation/onboarding/onboardingSeatBased.tsx:84`

In the `action` prop of `<SettingsPageHeader>`.

```tsx
// Before
<FeedbackButton
  size="md"
  feedbackOptions={{
    messagePlaceholder: t('How can we make Seer better for you?'),
    tags: {['feedback.source']: 'seer-settings-wizard'},
  }}
/>
```

---

### 30 — `static/gsApp/views/amCheckout/components/checkoutSuccess.tsx:610`

In a `Flex` alongside a `<LinkButton>` on the checkout success page.

```tsx
// Before
<FeedbackButton
  feedbackOptions={{
    formTitle: t('Give feedback'),
    messagePlaceholder: t('How can we make the checkout experience better for you?'),
  }}
/>
```

---

### 31 — `static/app/views/automations/components/automationFeedbackButton.tsx:6`

Thin wrapper component. All call sites are in header context:

- `automations/list.tsx` → `WorkflowEngineListLayout` → `Layout.HeaderActions`
- `automations/detail.tsx` → `DetailLayout.Actions` → `Layout.HeaderActions`
- `automations/edit.tsx` → `StyledLayoutHeader = styled(Layout.Header)`
- `automations/new.tsx` → same as edit.tsx

Migrate inside the wrapper itself to cover all call sites at once.

```tsx
// Before
export function AutomationFeedbackButton() {
  return (
    <FeedbackButton
      size="sm"
      feedbackOptions={{
        messagePlaceholder: t('How can we improve the alerts experience?'),
        tags: {['feedback.source']: 'automations'},
      }}
    />
  );
}
```

---

### 32 — `static/app/views/detectors/components/monitorFeedbackButton.tsx:6`

Thin wrapper component used in `detectorListActions.tsx` → `WorkflowEngineListLayout` →
`Layout.HeaderActions`. Migrate inside the wrapper itself.

```tsx
// Before
export function MonitorFeedbackButton() {
  return (
    <FeedbackButton
      size="sm"
      feedbackOptions={{
        messagePlaceholder: t('How can we improve the monitor experience?'),
        tags: {['feedback.source']: 'monitors'},
      }}
    />
  );
}
```

---

### 33 — `static/app/views/performance/newTraceDetails/traceSummary.tsx:90 & 164`

Two instances:

- **Line 90**: inside `<Flex align="center" padding="xl" gap="md">` in the error state branch.
- **Line 164**: inside `<Flex justify="end" marginTop="xl">` at the bottom of content,
  conditionally rendered when `feedback` is truthy.

Both instances:

```tsx
// Before
<FeedbackButton
  size="xs"
  feedbackOptions={{
    messagePlaceholder: t('How can we make the trace summary better for you?'),
    tags: {['feedback.source']: 'trace-summary'},
  }}
/>
```

Both must be wrapped independently.
