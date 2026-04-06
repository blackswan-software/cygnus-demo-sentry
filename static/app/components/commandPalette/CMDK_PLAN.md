# CMDK Migration Plan

Migrate the command palette action registration system from the reducer-based
`useCommandPaletteActionsRegister` model to a JSX/React-context collection model.

## Background

`ui/collection.tsx` exports a `makeCollection<T>()` factory. Each call creates an
isolated, fully-typed collection instance with its own React contexts. The factory
takes a single type parameter `T` — the data shape shared by all nodes. There is no
separate group/item type: a node becomes a group by wrapping its children in
`GroupContext.Provider`, not by carrying a `type` field.

The factory returns:

```ts
{
  Provider,        // root store provider
  GroupContext,    // string context — propagates nearest parent group key
  useStore(),      // returns CollectionStore<T> with register/unregister/tree()
  useRegisterNode(data: T): string,  // registers a node, returns its stable key
}
```

`tree()` returns `CollectionTreeNode<T>[]` where each node is:

```ts
{ key: string; parent: string | null; children: CollectionTreeNode<T>[] } & T
```

Data fields are spread directly onto the node — no `.data` wrapper. A node is a
group if `node.children.length > 0`.

On top of this, `ui/cmdk.tsx` defines:

```ts
// Single data shape — groups are nodes that happen to have children
export type CMDKActionData =
  | { display: DisplayProps; to: string; keywords?: string[] }
  | { display: DisplayProps; onAction: () => void; keywords?: string[] }
  | { display: DisplayProps; resource?: (...) => CMDKQueryOptions; keywords?: string[] };

export const CMDKCollection = makeCollection<CMDKActionData>();
```

`CMDKGroup` calls `CMDKCollection.useRegisterNode(data)` and wraps children in
`CMDKCollection.GroupContext.Provider`. `CMDKAction` calls `CMDKCollection.useRegisterNode(data)`
and renders `null`.

The palette consumes `CMDKCollection.useStore().tree()` instead of `useCommandPaletteActions()`.

## Todo

### Step 1 — Extend the data model ✅ Done

The collection factory, typed data shapes, `CMDKGroup`, and `CMDKAction` are all
implemented in `ui/collection.tsx` and `ui/cmdk.tsx`. `poc.spec.tsx` covers
registration, unregistration, and data freshness.

### Step 2 — Add CMDKQueryContext

Async groups (`CMDKGroup` with `resource`) need the current search query to call
`resource(query)`. The query lives in `CommandPaletteStateContext` (`state.query`).

- [x] Add `CMDKQueryContext = createContext<string>('')` to `ui/cmdk.tsx`
- [x] Update `CMDKCollection.Provider` to also provide `CMDKQueryContext`:
  ```tsx
  function CMDKCollectionProvider({children}) {
    const {query} = useCommandPaletteState();
    return (
      <CMDKCollection.Provider>
        <CMDKQueryContext.Provider value={query}>{children}</CMDKQueryContext.Provider>
      </CMDKCollection.Provider>
    );
  }
  ```
  Export this as `CMDKProvider` — callers use this instead of `CMDKCollection.Provider` directly.
- [x] In `CMDKGroup`, read `const query = useContext(CMDKQueryContext)`
- [x] When `resource` prop is present, call `useQuery({ ...resource(query), enabled: !!resource })`
      inside `CMDKGroup`
- [x] Resolve children based on whether `children` is a render prop:
  ```ts
  const resolvedChildren =
    typeof children === 'function' ? (data ? children(data) : null) : children;
  ```
- [x] Wrap resolved children in `<CMDKCollection.GroupContext.Provider value={key}>` as before

### Step 3 — Wire CMDKProvider into the provider tree

`CMDKProvider` (from Step 2) must sit inside `CommandPaletteStateProvider` because it
reads from `useCommandPaletteState()`.

- [x] Find where `CommandPaletteProvider` and `CommandPaletteStateProvider` are mounted —
      search for `CommandPaletteProvider` in the codebase to locate the mount point
- [x] Place `<CMDKProvider>` as a child of `CommandPaletteStateProvider`, wrapping
      whatever subtree currently lives inside it
- [x] Verify no runtime errors — the collection store is live but empty

### Step 4 — Convert global actions to a JSX component

`useGlobalCommandPaletteActions` calls `useCommandPaletteActionsRegister([...actions])`
with a large static action tree. Replace it with a component that renders the equivalent
JSX tree. The old hook stays alive during this step so both systems run in parallel.

- [x] Create `GlobalCommandPaletteActions` component (can live in `useGlobalCommandPaletteActions.tsx`
      or a new file `globalActions.tsx`)
- [x] Translate each section — read `useGlobalCommandPaletteActions.tsx` carefully before translating:
  - [x] **Navigation** — one `<CMDKGroup display={{label: t('Go to...')}}>` containing a
        `<CMDKAction>` per destination (Issues, Explore, Dashboards, Insights, Settings)
  - [x] **Create** — one `<CMDKGroup>` with `<CMDKAction onAction={...}>` for Dashboard,
        Alert, Project, Invite Members
  - [x] **DSN Lookup** — `<CMDKGroup resource={dsnQueryFn}>` with render-prop children:
        `{data => data.map(item => <CMDKAction key={...} display={item.display} to={item.to} />)}`
  - [x] **Help** — static `<CMDKAction>` nodes for Docs/Discord/GitHub/Changelog plus a
        `<CMDKGroup resource={helpSearchQueryFn}>` with render-prop children for search results
  - [x] **Interface** — `<CMDKAction onAction={...}>` for navigation toggle and theme switching
- [x] Mount `<GlobalCommandPaletteActions />` inside `<CMDKProvider>` in the provider tree
- [x] Verify `CMDKCollection.useStore().tree()` returns the expected structure by adding a
      temporary log or test — do not remove old system yet

### Step 5 — Update the palette UI to read from the collection store

`commandPalette.tsx` currently drives all data through `useCommandPaletteActions()` →
`scoreTree()` → `flattenActions()` → `collectResourceActions()`. Replace this pipeline
with the collection store.

- [ ] Replace `const actions = useCommandPaletteActions()` with
      `const store = CMDKCollection.useStore()` in `commandPalette.tsx`
- [ ] Rewrite `scoreTree()` to accept `CollectionTreeNode<CMDKActionData>[]`. Data fields
      are spread directly onto nodes — access `node.display.label`, `node.display.details`,
      and `node.keywords` directly (no `node.data.*` indirection)
- [ ] Rewrite `flattenActions()` to accept `CollectionTreeNode<CMDKActionData>[]` with the
      same direct field access
- [ ] A node is a group if `node.children.length > 0` — replace any `node.type === 'group'`
      checks with this
- [ ] Remove `collectResourceActions()` entirely — async fetching is now handled inside
      `CMDKGroup` before nodes appear in the tree. The `resource` field never reaches the consumer.
- [ ] Replace the linked-list action stack navigation with the collection's `tree(rootKey)` API:
  - When the user navigates into a group, store that group's `key` as the current root
  - Call `store.tree(currentRootKey)` to get the subtree to display
  - Going back means popping the key stack
  - Update `commandPaletteStateContext.tsx` `push action` / `pop action` to store node
    keys instead of full action objects
- [ ] Update `modal.tsx` `handleSelect`: `to` and `onAction` are now direct fields on the
      node (e.g. `node.to`, `node.onAction`) — no `.data` wrapper, no cast needed
- [ ] Run `CI=true pnpm test static/app/components/commandPalette` and fix failures

### Step 6 — Remove the old registration infrastructure

Only do this after Step 5 passes all tests.

- [ ] Search for all callers of `useCommandPaletteActionsRegister` outside of
      `useGlobalCommandPaletteActions.tsx` — these are page-scoped action registrations.
      For each one, create a component that renders `<CMDKGroup>` / `<CMDKAction>` and mount
      it in the relevant page's component tree instead.
- [ ] Delete the reducer (`actionsReducer`), `addKeysToActions`, `addKeysToChildActions`
      from `context.tsx`
- [ ] Remove `CommandPaletteActionsContext` and `useCommandPaletteActions` from `context.tsx`
- [ ] Remove `CommandPaletteRegistrationContext` and `useCommandPaletteActionsRegister` from `context.tsx`
- [ ] Remove or simplify `CommandPaletteProvider` — if it only wrapped the two contexts above
      it can be deleted; if it serves other purposes keep a slimmed version
- [ ] Remove the old `useGlobalCommandPaletteActions` hook (replaced by `GlobalCommandPaletteActions`)
- [ ] Clean up `types.tsx`: remove `CommandPaletteActionWithKey` and its variants
      (`CommandPaletteActionLinkWithKey`, `CommandPaletteActionCallbackWithKey`, etc.) — these
      were only needed because the old system added keys at registration time. The new system
      uses `useId()` inside each component.
- [ ] Run the full test suite and typecheck: `CI=true pnpm test` and `pnpm run typecheck`

## Key files

| File                                 | Role                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `ui/collection.tsx`                  | Generic factory — `makeCollection<T>()` returns `{Provider, GroupContext, useStore, useRegisterNode}`        |
| `ui/cmdk.tsx`                        | CMDK layer — `CMDKActionData`, `CMDKCollection`, `CMDKGroup`, `CMDKAction`, `CMDKProvider` (added in Step 2) |
| `ui/commandPalette.tsx`              | Palette UI — reads from collection store, scoring, flattening, keyboard nav                                  |
| `ui/commandPaletteStateContext.tsx`  | UI state — query string, open/close, navigation stack                                                        |
| `ui/modal.tsx`                       | Modal wrapper — executes selected actions via `to` or `onAction`                                             |
| `context.tsx`                        | Old registration system — deleted in Step 6                                                                  |
| `useGlobalCommandPaletteActions.tsx` | Global actions — replaced by JSX component in Step 4                                                         |
| `types.tsx`                          | Shared types — `WithKey` variants removed in Step 6                                                          |

## Notes

- Steps 2 and 3 are independent and can be done in parallel.
- Step 6 is only safe once Step 5 is complete and all tests pass.
- Item reordering (items that change position without unmounting) is a known limitation of
  the collection model — it is documented and intentionally deferred. Do not block the
  migration on it.
- `useId()` inside `CMDKGroup`/`CMDKAction` replaces the old `uuid4()` + slug key generation
  in `addKeysToActions`. Keys are now stable across renders but reset on remount.
- There is no `type: 'group' | 'item'` on tree nodes. A node is a group if
  `node.children.length > 0`. An empty async group (loading state) will appear as a leaf
  until its children mount — handle this at the rendering layer if needed (e.g. check
  for `resource` on the node data to show a loading indicator).
