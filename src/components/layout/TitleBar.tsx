/**
 * The title bar, mirroring the web app's.
 *
 * Same shape and same order as `music_app`'s header: the document's name, the
 * save state, then the actions that operate on the *document* — save, undo,
 * redo, export — and, pushed to the right, the ones that operate on the *app*.
 * A reader who knows one should not have to relearn the other.
 *
 * Built from `@sudobility/components-rn` and heroicons rather than hand-rolled
 * `Pressable`s, so the two apps inherit the same design tokens: a change to
 * the palette in `@sudobility/design` moves both.
 */
import { useCallback } from 'react';
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import {
  ArrowDownTrayIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  MusicalNoteIcon,
  PrinterIcon,
  SparklesIcon,
} from 'react-native-heroicons/outline';
import { IconButton } from './IconButton';
import type { MusicDocument } from '@/documents/document';

/** Matches the web app's `ICON_GLYPH_CLASS` sizing. */
const ICON_SIZE = 18;

export type TitleBarProps = {
  document: MusicDocument;
  onSave: () => void;
  onExport: () => void;
  /** Absent for a document with no project behind it. */
  onGenerate?: () => void;
  /** The same, for the snapshot history: a file has no versions on a server. */
  onSnapshots?: () => void;
  /** Prints. Absent on a build with no print service to talk to. */
  onPrint?: () => void;
  printing?: boolean;
  saving?: boolean;
};

export function TitleBar({
  document,
  onSave,
  onExport,
  onGenerate,
  onSnapshots,
  onPrint,
  printing = false,
  saving = false,
}: TitleBarProps) {
  const { t } = useTranslation();
  const canUndo = useStore(document.store, s => s.canUndo);
  const canRedo = useStore(document.store, s => s.canRedo);
  const playing = useStore(document.store, s => s.state) === 'playing';

  const undo = useCallback(() => document.store.getState().undo(), [document]);
  const redo = useCallback(() => document.store.getState().redo(), [document]);

  return (
    <View className="bg-primary flex-row items-center gap-1 px-2 py-1.5">
      <MusicalNoteIcon size={ICON_SIZE} color="white" />
      <Text
        className="text-primary-foreground px-1 text-lg font-medium"
        numberOfLines={1}
      >
        {document.title}
      </Text>
      <SaveState dirty={document.dirty} saving={saving} />

      <IconButton
        label={t('editor.saveNow')}
        onPress={onSave}
        disabled={saving}
      >
        <ArrowDownTrayIcon size={ICON_SIZE} color="white" />
      </IconButton>
      <IconButton
        label={t('editor.undo')}
        onPress={undo}
        disabled={!canUndo || playing}
      >
        <ArrowUturnLeftIcon size={ICON_SIZE} color="white" />
      </IconButton>
      <IconButton
        label={t('editor.redo')}
        onPress={redo}
        disabled={!canRedo || playing}
      >
        <ArrowUturnRightIcon size={ICON_SIZE} color="white" />
      </IconButton>
      <IconButton label={t('editor.export')} onPress={onExport}>
        <DocumentArrowDownIcon size={ICON_SIZE} color="white" />
      </IconButton>
      {/*
        Offered only for a project. A local document has no row on the server
        for a job to write back to, so a Generate button there would be a
        button that cannot work — better absent than dead.
      */}
      {onPrint ? (
        <IconButton
          label={t('editor.print')}
          onPress={onPrint}
          disabled={printing}
        >
          <PrinterIcon size={ICON_SIZE} color="white" />
        </IconButton>
      ) : null}
      {onSnapshots ? (
        <IconButton label={t('snapshot.openTitle')} onPress={onSnapshots}>
          <ClockIcon size={ICON_SIZE} color="white" />
        </IconButton>
      ) : null}
      {onGenerate ? (
        <IconButton
          label={t('generate.action')}
          onPress={onGenerate}
          disabled={playing}
        >
          <SparklesIcon size={ICON_SIZE} color="white" />
        </IconButton>
      ) : null}

      {/* Pushes what follows to the right, exactly as the web's `flex-1` div does. */}
      <View className="flex-1" />
    </View>
  );
}

/**
 * The save state, as a pill — the web app's `SAVE_STATE_CLASS` badge.
 *
 * Three states rather than two: "saving" has to be distinguishable from
 * "saved", or a slow write looks like nothing happened.
 */
function SaveState({ dirty, saving }: { dirty: boolean; saving: boolean }) {
  const { t } = useTranslation();
  const label = saving
    ? t('editor.saving')
    : dirty
    ? t('editor.unsaved')
    : t('editor.saved');
  const tone = saving
    ? 'bg-warning/20 text-warning'
    : dirty
    ? 'bg-destructive/20 text-destructive'
    : 'bg-success/20 text-success';
  return (
    <View className={`rounded-full px-2 py-0.5 ${tone}`}>
      <Text className="text-sm font-medium">{label}</Text>
    </View>
  );
}
