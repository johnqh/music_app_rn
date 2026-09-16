/**
 * Typing words under a melody.
 *
 * A property field per syllable would technically work and nobody would use it:
 * a line of lyrics is one syllable per note, in order, and the only usable way
 * to enter them is to type through the line the way you sing it. So this is a
 * bar rather than a field — it takes over one note at a time, and it advances
 * on the characters that already punctuate a sung line.
 *
 * **Space** ends a word and moves on. **Hyphen** ends a syllable *within* a
 * word and moves on, which is what tells the renderer to draw the hyphen and
 * what MusicXML calls `syllabic`. **Return** commits and stops.
 *
 * **The rules are music_editing's** (`lyricEntryStep`, `applyLyricStep`,
 * `splitLyricSeparator`), shared with the web bar. What differs is only how a
 * keystroke arrives. The web reads `keydown` and cancels it; a software
 * keyboard has no key event to cancel — a typed space on a phone is already a
 * character in the field — so this watches the *text* and asks
 * `splitLyricSeparator` after each change. A separator counts **anywhere** in
 * the text, as the key does on the web: this bar used to honour one only at
 * the end, so a hyphen typed with the cursor inside a word broke the syllable
 * on the web and was a plain character here — one keystroke, two meanings,
 * depending on the app. Explicit Back and Done controls sit beside the field
 * because Shift+Space and Escape are not reachable on a phone at all.
 *
 * The syllable's own join — begin/middle/end — is derived here rather than
 * asked for: a writer knows they are in the middle of "beau-ti-ful", and should
 * not also have to say so.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Input, Text } from '@sudobility/components-rn';
import type { NoteEvent } from '@sudobility/music_types';
import type { EditingStoreApi } from '@sudobility/music_editing';
import {
  applyLyricStep,
  lyricEntryStep,
  lyricTextAt,
  splitLyricSeparator,
} from '@sudobility/music_editing';
import type { LyricEntryState, LyricInput } from '@sudobility/music_types';

export type LyricEntryBarProps = {
  store: EditingStoreApi;
  /** The notes to walk, in tick order. */
  notes: NoteEvent[];
  /** Where to start — the note the caret was on when entry began. */
  startIndex: number;
  onClose: () => void;
};

export function LyricEntryBar({
  store,
  notes,
  startIndex,
  onClose,
}: LyricEntryBarProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(startIndex);
  const [draft, setDraft] = useState('');
  /**
   * Whether the syllable *before* this one ended in a hyphen. A ref: it is read
   * inside the handlers and changing it must not re-render.
   */
  const continuing = useRef(false);

  const note = notes[index];

  /*
    Show what is already written on the note being edited, so walking back over
    a line shows the words rather than blanks.

    Read from the *store*, not from the `notes` prop: that array is a snapshot
    taken when entry began, and every syllable typed since has gone into the
    score without changing it. Stepping back over a word just written showed an
    empty field until this looked at the live score.
  */
  useEffect(() => {
    const id = notes[index]?.id;
    if (!id) return;
    setDraft(lyricTextAt(store, id));
  }, [index, notes, store]);

  if (!note) return null;

  /** Run one entry input over `text` — the shared step, then the one store write. */
  const perform = (input: LyricInput, text: string): void => {
    const state: LyricEntryState = {
      index,
      count: notes.length,
      continuing: continuing.current,
    };
    const step = lyricEntryStep(state, input, text);
    applyLyricStep(store, notes, step);
    continuing.current = step.state.continuing;
    if (step.close) {
      onClose();
      return;
    }
    if (step.state.index === index) setDraft(text.trim());
    else setIndex(step.state.index);
  };

  const handleChange = (next: string): void => {
    const { syllable, separator } = splitLyricSeparator(next);
    if (separator === null) {
      setDraft(next);
      return;
    }
    perform(separator, syllable);
  };

  return (
    <View
      className="border-border flex-row items-center gap-2 border-t px-2 py-1.5"
      accessibilityRole="toolbar"
      accessibilityLabel={t('editor.lyricEntry')}
    >
      <Text className="text-muted-foreground shrink-0 text-sm">
        {t('editor.lyricNoteOf', {
          current: index + 1,
          total: notes.length,
        })}
      </Text>
      <Input
        value={draft}
        autoFocus
        // A lyric is prose, so the keyboard should behave like prose — except
        // for autocorrect, which rewrites the syllables of a hyphenated word.
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="done"
        accessibilityLabel={t('editor.syllable')}
        onChangeText={handleChange}
        onSubmitEditing={() => perform('enter', draft)}
        className="h-8 flex-1 px-2 text-base"
      />
      <Button
        variant="ghost"
        onPress={() => perform('back', draft)}
        disabled={index === 0}
        accessibilityLabel={t('editor.previousSyllable')}
      >
        {'‹'}
      </Button>
      <Button
        variant="ghost"
        onPress={() => perform('hyphen', draft)}
        accessibilityLabel={t('editor.hyphenate')}
      >
        {'-'}
      </Button>
      <Button variant="ghost" onPress={() => perform('space', draft)}>
        {'␣'}
      </Button>
      <Button variant="ghost" onPress={onClose}>
        {t('editor.done')}
      </Button>
    </View>
  );
}
