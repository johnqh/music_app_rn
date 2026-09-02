/**
 * New, Save, and what to do when a save fails.
 *
 * The storage is a prop rather than an import, so this renders against a fake
 * in a test and against the filesystem in the app — the same split
 * `DocumentStorage` exists for. A failure is shown rather than swallowed: a
 * save that silently did nothing is how work is lost.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TOUCH_TARGET } from '@sudobility/components-rn';
import { newProjectScore } from '@sudobility/music_lib';
import { newDocument, saveDocument } from '@/documents/document-storage';
import { EXPORT_FORMATS, exportDocument } from '@/documents/export';
import { getAppServices } from '@/config/initialize';
import type { DocumentStorage } from '@/documents/document-storage';
import { useDocumentList } from '@/documents/DocumentsContext';
import type { MusicDocument } from '@/documents/document';

export function DocumentActions({
  document,
  storage,
}: {
  document: MusicDocument | null;
  storage: DocumentStorage;
}) {
  const { t } = useTranslation();
  const list = useDocumentList();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!document || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveDocument(document, storage);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function exportAs(format: (typeof EXPORT_FORMATS)[number]) {
    if (!document) return;
    setError(null);
    try {
      await exportDocument(document, getAppServices().io, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('document.new')}
        style={styles.button}
        onPress={() => {
          const title = t('document.untitled');
          newDocument(list, newProjectScore(title), title);
        }}
      >
        <Text style={styles.label}>{t('document.new')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('document.save')}
        disabled={!document || saving}
        style={[styles.button, (!document || saving) && styles.off]}
        onPress={save}
      >
        {saving ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={styles.label}>{t('document.save')}</Text>
        )}
      </Pressable>
      {EXPORT_FORMATS.map(format => (
        <Pressable
          key={format}
          accessibilityRole="button"
          accessibilityLabel={`Export ${format}`}
          disabled={!document}
          style={[styles.button, !document && styles.off]}
          onPress={() => void exportAs(format)}
        >
          <Text style={styles.label}>{format.toUpperCase()}</Text>
        </Pressable>
      ))}
      {error ? (
        <Text style={styles.error} numberOfLines={1}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    paddingHorizontal: 14,
    // Sized to the minimum touch target rather than to the text: 8pt of
    // padding around a 16px label is 32pt tall, which is under both
    // platforms' figure.
    paddingVertical: 8,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#e4e4e7',
  },
  off: { opacity: 0.4 },
  label: { fontSize: 14, fontWeight: '600', color: '#18181b' },
  error: { color: '#b91c1c', fontSize: 12, flexShrink: 1 },
});
