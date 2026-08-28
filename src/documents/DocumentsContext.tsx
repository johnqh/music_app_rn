/**
 * The open documents, shared with the tree.
 *
 * `useSyncExternalStore` rather than React state: `DocumentList` is the source
 * of truth and is mutated from menus, file handlers and the document's own
 * change callback. Mirroring it into state would give two answers to "what is
 * open" and let them disagree.
 */
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { DocumentList } from './document-list';
import type { MusicDocument } from './document';

const DocumentsContext = createContext<DocumentList | null>(null);

export function DocumentsProvider({
  list,
  children,
}: {
  list: DocumentList;
  children: ReactNode;
}) {
  return (
    <DocumentsContext.Provider value={list}>
      {children}
    </DocumentsContext.Provider>
  );
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
