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
  Cog6ToothIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  MusicalNoteIcon,
  PrinterIcon,
  RectangleStackIcon,
} from 'react-native-heroicons/outline';
import type { SaveState as DocumentSaveState } from '@sudobility/music_lib';
import { IconButton } from './IconButton';
import type { MusicDocument } from '@/documents/document';

/** Matches the web app's `ICON_GLYPH_CLASS` sizing. */
const ICON_SIZE = 18;

export type TitleBarProps = {
  document: MusicDocument;
  onSave: () => void;
  onExport: () => void;
  /**
   * Opens Settings — required, not optional, because it is the only way there.
   *
   * Theme, language, sign-in and the links to Docs, Shortcuts, Resources,
   * About and Credits all live on that screen, and nothing in the app
   * navigated to it: it was in the stack and unreachable. On the Mac the
   * AppKit "Settings…" item (⌘,) is the template item the project was
   * generated with, whose menu entry names no action at all, so it is disabled
   * and cannot carry this without a native change.
   */
  onSettings: () => void;
  /**
   * Opens the projects list.
   *
   * Required, like `onSettings`, and for the same reason: nothing else in the
   * app navigated to that screen. It was in the stack and unreachable — and
   * with it every way *in* to a document that is not the scratch one the app
   * opens at launch: New Project, Import (MIDI, MusicXML, module, audio) and
   * the list of server projects. The Mac reaches those through the File menu,
   * which iOS and Android do not have.
   */
  onDocuments: () => void;
  /** Absent for a document with no project: a file has no versions on a server. */
  onSnapshots?: () => void;
  /** Prints. Absent on a build with no print service to talk to. */
  onPrint?: () => void;
  printing?: boolean;
};

export function TitleBar({
  document,
  onSave,
  onExport,
  onSettings,
  onDocuments,
  onSnapshots,
  onPrint,
  printing = false,
}: TitleBarProps) {
  const { t } = useTranslation();
  /*
    The name and the save state are the store's. They used to be fields on a
    record beside it — read once per render, so the bar showed "Saved" until
    something else happened to re-render it — plus a `saving` flag the editor
    screen kept for the manual save alone, blind to the autosave.
  */
  const title = useStore(document.store, s => s.title);
  const saveState = useStore(document.store, s => s.saveState);
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
        {title}
      </Text>
      <SaveState state={saveState} />

      <IconButton
        label={t('editor.saveNow')}
        onPress={onSave}
        disabled={saveState === 'saving'}
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
        There is no Generate here. A whole new score is where a project starts
        (New Project); what an open project offers is Generate Again, on the
        property sheet's Score tab — the web app's arrangement.
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

      {/* Pushes what follows to the right, exactly as the web's `flex-1` div does. */}
      <View className="flex-1" />

      {/*
        The app's own actions, on the right, where the web header puts them.
        Both of them are the *only* route to their screen: each was in the
        navigator with nothing in the app pointing at it.

        Projects first, then Settings, matching what each is — one opens a
        document, the other configures the app. Behind Projects sit New Project
        and every import, which the Mac reaches from the File menu and a phone
        has no equivalent of.
      */}
      <IconButton label={t('nav.projects')} onPress={onDocuments}>
        <RectangleStackIcon size={ICON_SIZE} color="white" />
      </IconButton>
      <IconButton label={t('nav.settings')} onPress={onSettings}>
        <Cog6ToothIcon size={ICON_SIZE} color="white" />
      </IconButton>
    </View>
  );
}

/**
 * The save state, as a pill — the web app's `SAVE_STATE_CLASS` badge.
 *
 * Three states rather than two: "saving" has to be distinguishable from
 * "saved", or a slow write looks like nothing happened.
 */
const SAVE_STATE_LABEL: Record<DocumentSaveState, string> = {
  saving: 'editor.saving',
  unsaved: 'editor.unsaved',
  saved: 'editor.saved',
};

const SAVE_STATE_CLASS: Record<DocumentSaveState, string> = {
  saving: 'bg-warning/20 text-warning rounded-full px-2 py-0.5',
  unsaved: 'bg-destructive/20 text-destructive rounded-full px-2 py-0.5',
  saved: 'bg-success/20 text-success rounded-full px-2 py-0.5',
};

function SaveState({ state }: { state: DocumentSaveState }) {
  const { t } = useTranslation();
  const label = t(SAVE_STATE_LABEL[state]);
  return (
    <View className={SAVE_STATE_CLASS[state]}>
      <Text className="text-sm font-medium">{label}</Text>
    </View>
  );
}
