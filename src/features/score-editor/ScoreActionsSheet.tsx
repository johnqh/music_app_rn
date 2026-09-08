/**
 * Long-press on the score — the native half of the web's right-click menu.
 *
 * **This is now the only place cut, copy, paste and delete live**, on both
 * platforms. They were also toolbar controls, which meant four buttons on a bar
 * that is already the widest thing in the editor, for actions that only apply to
 * something already selected and that could say nothing about *what* they would
 * act on. A menu opened on the thing itself can: it names the object before it
 * offers to change it.
 *
 * That header is the point. "Track" / "Bars" / "Notes" in small grey type above
 * the entries, because Delete means three different edits depending on what is
 * selected, and a list of verbs with no subject is one you have to try to
 * understand.
 *
 * A sheet rather than a menu positioned at the touch, because a popover anchored
 * to a finger is under the finger: on a phone the thing you pressed is hidden
 * by the menu about it. The sheet leaves the score visible above it.
 *
 * **Entries follow the selection, and an action that would do nothing is
 * disabled rather than hidden** — so the list keeps the same shape and reading
 * order every time it opens, and nobody has to hunt for an entry that moved.
 */
import { View } from 'react-native';
import { Button, FormModal, Text } from '@sudobility/components-rn';
import { useTranslation } from 'react-i18next';
import type { SelectionKind } from '@sudobility/music_editing';

export type ScoreAction =
  | 'copy'
  | 'cut'
  | 'clear'
  | 'paste'
  | 'delete'
  | 'selectAll';

export type ScoreActionsSheetProps = {
  open: boolean;
  /**
   * What the menu is about, or null when nothing is selected.
   *
   * `music_editing`'s own vocabulary, so the sheet and the actions cannot
   * disagree about whether a selection is a track or a run of notes.
   */
  kind: SelectionKind | null;
  /** How many bars or notes, for the header's singular/plural. */
  count: number;
  /** Whether the clipboard holds something of the same kind. */
  canPaste: boolean;
  /** False while the transport plays: content is immutable then. */
  canEdit: boolean;
  onAction: (action: ScoreAction) => void;
  onClose: () => void;
};

export function ScoreActionsSheet({
  open,
  kind,
  count,
  canPaste,
  canEdit,
  onAction,
  onClose,
}: ScoreActionsSheetProps) {
  const { t } = useTranslation();
  const hasSelection = kind !== null;

  /** "Track", "Bar"/"Bars", "Note"/"Notes" — what every entry below acts on. */
  const subject =
    kind === null
      ? null
      : kind === 'track'
      ? t('editor.subjectTrack')
      : kind === 'measures'
      ? t('editor.subjectBars', { count })
      : t('editor.subjectNotes', { count });

  const items: Array<{ action: ScoreAction; label: string; enabled: boolean }> =
    [
      // Copy only reads, so it survives playback — the same exemption the
      // toolbar makes.
      { action: 'copy', label: t('editor.copy'), enabled: hasSelection },
      {
        action: 'cut',
        label: t('editor.cut'),
        enabled: canEdit && hasSelection,
      },
      /*
        Clear and Delete are different edits, so they are different entries
        rather than one entry and a question. Clear keeps the container and
        empties it — a cleared bar keeps its number and its repeats, a cleared
        track keeps its instrument. Delete removes the container and everything
        behind it moves up.
      */
      {
        action: 'clear',
        label: t('editor.clear'),
        enabled: canEdit && hasSelection,
      },
      {
        action: 'delete',
        label: t('editor.deleteSelection'),
        enabled: canEdit && hasSelection,
      },
      // Only when the clipboard holds the same kind of thing: pasting a track
      // over a run of notes has no meaning anybody could predict.
      {
        action: 'paste',
        label: t('editor.paste'),
        enabled: canEdit && canPaste,
      },
      { action: 'selectAll', label: t('editor.selectAllNotes'), enabled: true },
    ];

  return (
    <FormModal
      visible={open}
      title={t('editor.scoreActions')}
      onClose={onClose}
      /*
        No bottom bar: every row acts, so a Save would be a second way to do
        what tapping already did, and a Cancel would duplicate the × the shell
        carries.
      */
      actions={[]}
      closeAriaLabel={t('common.closeDialog')}
    >
      <View className="gap-2 p-1">
        {/*
          The subject, before the verbs — it says what the list is about, which
          is exactly what "Delete" cannot say on its own when it means three
          different edits.
        */}
        {subject === null ? null : (
          <Text className="text-muted-foreground text-sm font-medium">
            {subject}
          </Text>
        )}
        {items.map(item => (
          <Button
            key={item.action}
            variant="secondary"
            disabled={!item.enabled}
            onPress={() => {
              onClose();
              onAction(item.action);
            }}
            accessibilityLabel={item.label}
          >
            {item.label}
          </Button>
        ))}
        <Text className="text-muted-foreground text-sm">
          {t('editor.scoreActionsHint')}
        </Text>
      </View>
    </FormModal>
  );
}
