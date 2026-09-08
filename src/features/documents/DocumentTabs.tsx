/**
 * The open documents, as tabs.
 *
 * Rendered from `useDocuments`, which re-renders on open, close and activate —
 * never on an edit. The dirty mark is deliberately read from the document
 * object rather than its store: it flips on the first edit after a save and
 * then not again, so subscribing per tab to a score would cost a render per
 * keystroke to learn nothing new.
 *
 * Hidden below two documents, because a single tab is a label, not a choice.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDocumentList, useDocuments } from '@/documents/DocumentsContext';

export function DocumentTabs() {
  const { t } = useTranslation();
  const list = useDocumentList();
  const { documents, activeId } = useDocuments();
  if (documents.length < 2) return null;

  return (
    <View style={styles.bar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {documents.map(document => {
          const active = document.id === activeId;
          return (
            <Pressable
              key={document.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => list.activate(document.id)}
              style={[styles.tab, active && styles.tabOn]}
            >
              <Text numberOfLines={1} style={styles.title}>
                {document.dirty ? `• ${document.title}` : document.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('document.closeDocument', {
                  title: document.title,
                })}
                hitSlop={8}
                onPress={() => list.close(document.id)}
              >
                <Text style={styles.close}>×</Text>
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d4d4d8',
    backgroundColor: '#fafafa',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 220,
  },
  tabOn: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#3f3f46',
  },
  title: { fontSize: 13, color: '#3f3f46', flexShrink: 1 },
  close: { fontSize: 16, color: '#a1a1aa' },
});
