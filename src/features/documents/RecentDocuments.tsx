/**
 * The documents opened lately, offered when nothing is open.
 *
 * Shown only in the empty state: once a score is on screen, a list of other
 * scores is a distraction from the one you came for. Reopening goes through
 * `openDocument`, so a file already open raises its tab rather than opening a
 * second, divergent copy.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH_TARGET } from '@sudobility/components-rn';
import { openDocument } from '@/documents/document-storage';
import type { DocumentStorage } from '@/documents/document-storage';
import { forgetRecent, loadRecent } from '@/documents/recent-documents';
import type {
  KeyValueStore,
  RecentDocument,
} from '@/documents/recent-documents';
import { useDocumentList } from '@/documents/DocumentsContext';

export function RecentDocuments({
  storage,
  keyValue,
}: {
  storage: DocumentStorage;
  keyValue: KeyValueStore;
}) {
  const list = useDocumentList();
  const [recent, setRecent] = useState<RecentDocument[]>([]);

  useEffect(() => {
    void loadRecent(keyValue).then(setRecent);
  }, [keyValue]);

  async function open(entry: RecentDocument) {
    try {
      await openDocument(list, storage, entry.handle);
    } catch {
      // A file that has gone away should leave the list rather than sit there
      // failing every time it is tapped.
      setRecent(await forgetRecent(keyValue, entry.uri));
    }
  }

  if (recent.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {recent.map(entry => (
        <Pressable
          key={entry.uri}
          accessibilityRole="button"
          accessibilityLabel={entry.title}
          onPress={() => void open(entry)}
          style={[
            styles.row,
            { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
          ]}
        >
          <Text style={styles.title}>{entry.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20, gap: 4, alignItems: 'center' },
  row: { paddingVertical: 8, paddingHorizontal: 16 },
  title: { fontSize: 14, color: '#3f3f46' },
});
