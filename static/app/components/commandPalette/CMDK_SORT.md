# CMDK Slot Priority Sorting

## Problem

The command palette collection orders nodes by React mount time (insertion order into a
`Set<string>`). Page- and task-scoped actions are declared inside slot consumers that portal
their content to outlet DOM nodes inside `CommandPalette`. Because those consumers mount after
the globally-registered actions (which live in the navigation sidebar and mount at startup),
global actions always appear first — even though page and task actions should take priority.

The failing test in `commandPalette.spec.tsx` (describe "slot rendering") documents this
contract and must pass when this work is complete.

## Solution

Pre-sort the array returned by `store.tree()` by the DOM position of each node's slot outlet
element before passing it to `flattenActions`. Since the outlets are declared in priority order
inside `CommandPalette` (`task` → `page` → `global`), their DOM positions already encode the
correct ordering. `Node.compareDocumentPosition` gives that order for free.

No changes to `collection.tsx` or `makeCollection` are needed — the collection stays generic.
The sort is a single pre-processing step in `commandPalette.tsx`.

## How slot refs reach each node

Each registered action needs to store a ref to its slot's outlet DOM element. The chain:

1. **Outlet populates a shared ref.** `CommandPalette` creates one `RefObject<HTMLElement>`
   per slot name and provides them via a `SlotRefsContext`. Each outlet's ref callback
   populates the corresponding entry alongside the existing `CommandPaletteSlot.Outlet` ref.

2. **Consumer wrapper injects the ref into context.** Named wrapper components
   (`CMDKTaskSlot`, `CMDKPageSlot`, `CMDKGlobalSlot`) read their slot's ref from
   `SlotRefsContext` and provide it to children via a `CurrentSlotRefContext`.

3. **`CMDKAction` / `CMDKGroup` store the ref.** Both read `CurrentSlotRefContext` and
   include the ref in the data passed to `useRegisterNode`. Because the slot library preserves
   React context at the consumer's declaration site (see `collection.spec.tsx` lines 313–349),
   portaled children correctly see the context provided by the consumer wrapper.

4. **`commandPalette.tsx` pre-sorts before flattening.** The pre-sort reads each node's stored
   ref and calls `compareDocumentPosition`. Nodes without a ref (no slot wrapper) compare as
   equal and retain their existing relative order.

## Changes required

### 1. New file — `commandPaletteSlotRefs.tsx`

Create a shared context to avoid a circular import between `cmdk.tsx` and `commandPalette.tsx`
(cmdk imports commandPalette for `CommandPaletteSlot`; commandPalette imports cmdk for
`CMDKCollection`).

```ts
export const SlotRefsContext = createContext<{
  task: React.RefObject<HTMLElement | null>;
  page: React.RefObject<HTMLElement | null>;
  global: React.RefObject<HTMLElement | null>;
} | null>(null);

export const CurrentSlotRefContext =
  createContext<React.RefObject<HTMLElement | null> | null>(null);
```

### 2. `cmdk.tsx`

- Import `CurrentSlotRefContext` from the new file.
- Add `slotRef?: React.RefObject<HTMLElement | null>` to all three `CMDKActionData` variants.
- In `CMDKAction` and `CMDKGroup`, read `CurrentSlotRefContext` and forward it as `slotRef`
  in the data passed to `useRegisterNode`.

### 3. `commandPalette.tsx`

- Import `SlotRefsContext` and `CurrentSlotRefContext` from the new file.
- In `CommandPalette`, create the three outlet refs with `useRef` and provide them via
  `SlotRefsContext.Provider` wrapping the outlets.
- Wire each outlet's ref callback to populate the corresponding entry in `SlotRefsContext`
  alongside the existing `CommandPaletteSlot.Outlet` ref:
  ```tsx
  <CommandPaletteSlot.Outlet name="page">
    {({ref: outletRef}) => (
      <div
        ref={el => {
          slotRefs.page.current = el;
          outletRef(el);
        }}
        style={{display: 'contents'}}
      />
    )}
  </CommandPaletteSlot.Outlet>
  ```
- Export named consumer wrapper components that inject the right ref into
  `CurrentSlotRefContext`:
  ```tsx
  export function CMDKTaskSlot({children}: {children: React.ReactNode}) {
    const slotRefs = useContext(SlotRefsContext);
    return (
      <CurrentSlotRefContext.Provider value={slotRefs?.task ?? null}>
        <CommandPaletteSlot name="task">{children}</CommandPaletteSlot>
      </CurrentSlotRefContext.Provider>
    );
  }
  // Same pattern for CMDKPageSlot and CMDKGlobalSlot
  ```
- Add `presortBySlotRef` and apply it to `currentNodes` before `flattenActions`:

  ```ts
  function presortBySlotRef(
    nodes: Array<CollectionTreeNode<CMDKActionData>>
  ): Array<CollectionTreeNode<CMDKActionData>> {
    return [...nodes].sort((a, b) => {
      const aEl = a.slotRef?.current ?? null;
      const bEl = b.slotRef?.current ?? null;
      if (!aEl || !bEl || aEl === bEl) return 0;
      return aEl.compareDocumentPosition(bEl) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  // In CommandPalette:
  const currentNodes = presortBySlotRef(store.tree(currentRootKey));
  ```

### 4. `commandPaletteGlobalActions.tsx`

Replace `<CommandPaletteSlot name="global">` with `<CMDKGlobalSlot>`.

### 5. `static/app/views/issueList/actions/index.tsx`

Replace `<CommandPaletteSlot name="task">` with `<CMDKTaskSlot>`.

### 6. `commandPalette.spec.tsx`

- Update the slot rendering test to use `CMDKPageSlot` (or keep `CommandPaletteSlot` directly
  with a manual `CurrentSlotRefContext.Provider` — either works).
- The failing test should pass once the pre-sort is in place.
- Add a three-tier test asserting task < page < global ordering when all three slots are
  populated.

## Key invariants

- `presortBySlotRef` is a **stable** sort: nodes sharing the same outlet ref (same slot) keep
  their existing relative order, preserving correct sibling ordering within a slot.
- `compareDocumentPosition` is only called when the palette is open and `CommandPalette` is
  mounted — the outlet refs will always be populated at that point.
- Nodes with `slotRef = null` (no wrapper, or outlet not yet mounted) return `0` from the
  comparator and are not reordered relative to each other.
- The pre-sort applies only to the root level of each `store.tree()` call. Children within a
  drilled-in group are never reordered (they're already within a single slot by definition).
