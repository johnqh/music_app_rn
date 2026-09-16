/**
 * New, Save, and what to do when a save fails.
 *
 * New builds a store with the app's document services and Save writes through
 * the document's own store (`saveNow`), so both behave exactly as the File
 * menu's do. A failure is shown rather than swallowed: a save that silently did
 * nothing is how work is lost.
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
import { exportDocument } from '@/documents/export';
import type { ExportFormat } from '@/documents/export';
import { getAppServices } from '@/config/initialize';
import {
  useDocumentList,
  useDocumentServices,
} from '@/documents/DocumentsContext';
import { newDocument } from '@/documents/document';
import type { MusicDocument } from '@/documents/document';
import { WRITABLE_EXPORT_FORMATS } from '@sudobility/music_types';

export function DocumentActions({
  document,
}: {
  document: MusicDocument | null;
}) {
  const { t } = useTranslation();
  const list = useDocumentList();
  const services = useDocumentServices();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!document || saving) return;
    setSaving(true);
    setError(null);
    try {
      await document.store.getState().saveNow();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function exportAs(format: ExportFormat) {
    if (!document) return;
    setError(null);
    try {
      await exportDocument(document, getAppServices().io, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function create() {
    const title = t('document.untitled');
    list.open(newDocument(services, { score: newProjectScore(title), title }));
  }

  const saveDisabled = !document || saving;

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('document.new')}
        style={styles.button}
        onPress={create}
        // macOS has no synthesized-touch fallback for an assistive press, so a
        // VoiceOver activation reaches a Pressable only through
        // `onAccessibilityTap` — `onPress` is a touch/mouse responder. Withheld
        // while disabled, the way `IconButton` does it: a disabled Pressable
        // still receives an accessibility tap.
        onAccessibilityTap={create}
      >
        <Text style={styles.label}>{t('document.new')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('editor.save')}
        disabled={saveDisabled}
        style={[styles.button, saveDisabled && styles.off]}
        onPress={save}
        {...(saveDisabled ? {} : { onAccessibilityTap: save })}
      >
        {saving ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={styles.label}>{t('editor.save')}</Text>
        )}
      </Pressable>
      {/* music_types' format list, the one the export sheet and the web's
          menu read, so this row cannot offer a different set. */}
      {WRITABLE_EXPORT_FORMATS.map(({ id: format, labelKey }) => {
        const activate = () => void exportAs(format);
        return (
          <Pressable
            key={format}
            accessibilityRole="button"
            accessibilityLabel={t('document.exportAs', { format: t(labelKey) })}
            disabled={!document}
            style={[styles.button, !document && styles.off]}
            onPress={activate}
            {...(document ? { onAccessibilityTap: activate } : {})}
          >
            <Text style={styles.label}>{t(labelKey)}</Text>
          </Pressable>
        );
      })}
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
