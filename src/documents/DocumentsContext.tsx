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

/**
 * What to do when a document's score changes.
 *
 * The autosaver is built in the composition root, so nothing below it could
 * reach it — a document created from the File menu would register no change
 * callback and never autosave. Passed through the provider rather than
 * imported, because *who writes the bytes* is the app's business and a test
 * hands in a fake.
 */
const ChangedContext = createContext<
  ((document: MusicDocument) => void) | undefined
>(undefined);

export function DocumentsProvider({
  list,
  onDocumentChanged,
  children,
}: {
  list: DocumentList;
  onDocumentChanged?: (document: MusicDocument) => void;
  children: ReactNode;
}) {
  return (
    <DocumentsContext.Provider value={list}>
      <ChangedContext.Provider value={onDocumentChanged}>
        {children}
      </ChangedContext.Provider>
    </DocumentsContext.Provider>
  );
}

/**
 * The change callback a newly created document should register.
 *
 * Undefined outside a provider that supplies one, which is every test that does
 * not care about saving — `createDocument` takes it as optional for exactly
 * that reason.
 */
export function useDocumentChanged():
  | ((document: MusicDocument) => void)
  | undefined {
  return useContext(ChangedContext);
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
