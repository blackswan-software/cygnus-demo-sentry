import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

type StoredNode<T> = {
  dataRef: React.MutableRefObject<T>;
  key: string;
  parent: string | null;
};

/**
 * A node as returned by tree(). Plain data fields are spread alongside the
 * structural fields (key, parent, children).
 *
 * A node is a "group" if it has children — there is no separate type
 * discriminant. The collection is purely a structural container.
 */
export type CollectionTreeNode<T> = {
  children: Array<CollectionTreeNode<T>>;
  key: string;
  parent: string | null;
} & T;

export interface CollectionStore<T> {
  register: (node: StoredNode<T>) => void;
  /**
   * Reconstruct the subtree rooted at rootKey.
   * Pass null (default) to get the full tree from the top.
   */
  tree: (rootKey?: string | null) => Array<CollectionTreeNode<T>>;
  unregister: (key: string) => void;
}

export interface CollectionInstance<T> {
  /**
   * Propagates the nearest parent group's key to children.
   * Use it in Group components to wrap children so they register under this node:
   *   <instance.Context.Provider value={key}>
   */
  Context: React.Context<string | null>;

  /**
   * Root provider. Wrap your node tree in this component.
   */
  Provider: (props: {children: React.ReactNode}) => React.ReactElement;

  /**
   * Registers a node on mount, unregisters on unmount.
   * Returns the stable key assigned to this node.
   *
   * To make this node a group (i.e. allow it to have children), wrap its
   * children in <instance.Context.Provider value={key}>.
   */
  useRegisterNode: (data: T) => string;

  /**
   * Returns the typed collection store. Call tree() to reconstruct the node
   * tree at any time.
   */
  useStore: () => CollectionStore<T>;
}

/**
 * Creates a typed collection instance. Call once at module level.
 *
 * There is a single type parameter T — the data shape shared by all nodes.
 * A node becomes a "group" by virtue of having children registered under it
 * (via Context), not by having a separate type.
 *
 * @example
 * const CMDKCollection = makeCollection<CMDKActionData>();
 *
 * function CMDKGroup({ data, children }) {
 *   const key = CMDKCollection.useRegisterNode(data);
 *   return <CMDKCollection.Context.Provider value={key}>{children}</CMDKCollection.Context.Provider>;
 * }
 *
 * function CMDKAction({ data }) {
 *   CMDKCollection.useRegisterNode(data);
 *   return null;
 * }
 */
export function makeCollection<T>(): CollectionInstance<T> {
  const StoreContext = createContext<CollectionStore<T> | null>(null);
  const Context = createContext<string | null>(null);

  // -------------------------------------------------------------------------
  // Provider
  // -------------------------------------------------------------------------

  function Provider({children}: {children: React.ReactNode}) {
    const nodes = useRef(new Map<string, StoredNode<T>>());

    // Secondary index: parent key → ordered Set of child keys.
    // Insertion order = JSX order (guaranteed by React's depth-first left-to-right
    // effect ordering: siblings register before their next sibling's subtree fires).
    const childIndex = useRef(new Map<string | null, Set<string>>());

    // Tracks whether any registrations happened since the last flush.
    // register/unregister mutate refs and increment this counter. They do NOT call
    // bump() directly — that would cause a synchronous re-render mid-registration
    // and leave consumers seeing a partial tree.
    const pendingVersion = useRef(0);
    const flushedVersion = useRef(0);

    const [, bump] = useReducer(x => x + 1, 0);

    const store = useMemo<CollectionStore<T>>(
      () => ({
        register(node) {
          nodes.current.set(node.key, node);
          const siblings = childIndex.current.get(node.parent) ?? new Set<string>();
          siblings.add(node.key);
          childIndex.current.set(node.parent, siblings);
          pendingVersion.current++;
        },

        unregister(key) {
          const node = nodes.current.get(key);
          if (!node) return;
          nodes.current.delete(key);
          childIndex.current.get(node.parent)?.delete(key);
          childIndex.current.delete(key);
          pendingVersion.current++;
        },

        tree(rootKey = null): Array<CollectionTreeNode<T>> {
          const childKeys = childIndex.current.get(rootKey) ?? new Set<string>();
          return [...childKeys].map(key => {
            const node = nodes.current.get(key)!;
            return {
              key: node.key,
              parent: node.parent,
              children: this.tree(key),
              ...node.dataRef.current,
            } as CollectionTreeNode<T>;
          });
        },
      }),
      []
    );

    // This effect runs AFTER all descendants' useLayoutEffects (parent fires last).
    // If registrations changed since the last flush, trigger one re-render so
    // consumers see the complete, stable tree.
    useLayoutEffect(() => {
      if (pendingVersion.current !== flushedVersion.current) {
        flushedVersion.current = pendingVersion.current;
        bump();
      }
    });

    return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
  }

  // -------------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------------

  function useStore(): CollectionStore<T> {
    const store = useContext(StoreContext);
    if (!store) {
      throw new Error('useStore must be called inside the matching Collection Provider');
    }
    return store;
  }

  function useRegisterNode(data: T): string {
    const store = useStore();
    const parentKey = useContext(Context);
    const key = useId();

    // Store data in a ref so tree() always reflects the latest value without
    // needing to re-register when data changes. Structural changes (parentKey)
    // still cause a full re-registration via the effect deps.
    const dataRef = useRef(data);
    dataRef.current = data;

    useLayoutEffect(() => {
      store.register({key, parent: parentKey, dataRef});
      return () => store.unregister(key);
    }, [key, parentKey, store]);

    return key;
  }

  return {Provider, Context, useStore, useRegisterNode};
}
