/**
 * The documents opened lately, offered when nothing is open.
 *
 * Shown only in the empty state: once a score is on screen, a list of other
 * scores is a distraction from the one you came for. Reopening goes through
 * `openFileInto`, so a file already open raises its tab rather than opening a
 * second, divergent copy. Saving adds to the list through the store's
 * `onSaved`, wired at the composition root; reopening refreshes the entry here.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH_TARGET } from '@sudobility/components-rn';
import { openFileInto } from '@/documents/document';
import { forgetRecent, loadRecent } from '@/documents/recent-documents';
import { recordRecent } from '@/documents/useRecentTracking';
import type {
  KeyValueStore,
  RecentDocument,
} from '@/documents/recent-documents';
import {
  useDocumentList,
  useDocumentServices,
} from '@/documents/DocumentsContext';

export function RecentDocuments({ keyValue }: { keyValue: KeyValueStore }) {
  const list = useDocumentList();
  const services = useDocumentServices();
  const [recent, setRecent] = useState<RecentDocument[]>([]);

  useEffect(() => {
    void loadRecent(keyValue).then(setRecent);
  }, [keyValue]);

  async function open(entry: RecentDocument) {
    try {
      const opened = await openFileInto(list, services, entry.handle);
      recordRecent(keyValue, opened.store.getState());
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
