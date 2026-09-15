/**
 * The open documents, and what a new one is built with, shared with the tree.
 *
 * `useSyncExternalStore` rather than React state: `DocumentList` is the source
 * of truth and is mutated from menus, file handlers and screens. Mirroring it
 * into state would give two answers to "what is open" and let them disagree.
 *
 * The services travel with the list. A document created from the File menu, an
 * import or the dashboard has to be built with the same server context, file
 * storage, toast sink and recents hook as the scratch document the app opens
 * with — otherwise it is a document that never saves, or never reports a
 * failure. So they are provided once, from the composition root.
 */
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { DocumentList } from './document-list';
import { OFFLINE_DOCUMENT_SERVICES } from './document';
import type { DocumentServices, MusicDocument } from './document';

const DocumentsContext = createContext<DocumentList | null>(null);
const ServicesContext = createContext<DocumentServices>(
  OFFLINE_DOCUMENT_SERVICES,
);

export function DocumentsProvider({
  list,
  services,
  children,
}: {
  list: DocumentList;
  /** Defaults to no server and no filesystem — what a component test wants. */
  services?: DocumentServices;
  children: ReactNode;
}) {
  return (
    <DocumentsContext.Provider value={list}>
      <ServicesContext.Provider value={services ?? OFFLINE_DOCUMENT_SERVICES}>
        {children}
      </ServicesContext.Provider>
    </DocumentsContext.Provider>
  );
}

/** What a document made below the provider is built with. */
export function useDocumentServices(): DocumentServices {
  return useContext(ServicesContext);
}

export function useDocumentList(): DocumentList {
  const list = useContext(DocumentsContext);
  if (!list) throw new Error('useDocumentList outside a DocumentsProvider');
  return list;
}

/** Re-renders on open, close, activate — not on every score edit. */
export function useDocuments(): {
  documents: readonly MusicDocument[];
  activeId: string | null;
} {
  const list = useDocumentList();
  const documents = useSyncExternalStore(
    cb => list.subscribe(cb),
    // `openDocuments`, not `state.documents`: the snapshot must be stable
    // between changes or this re-renders forever.
    () => list.openDocuments,
  );
  const activeId = useSyncExternalStore(
    cb => list.subscribe(cb),
    () => list.activeId,
  );
  return useMemo(() => ({ documents, activeId }), [documents, activeId]);
}

export function useActiveDocument(): MusicDocument | null {
  const { documents, activeId } = useDocuments();
  return documents.find(d => d.id === activeId) ?? null;
}
