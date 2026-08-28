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
 * The one difference from the web bar, and it is deliberate: that one reads
 * `keydown` and calls `preventDefault`, which a software keyboard has no
 * equivalent for — a typed space on a phone is a character in the field, not a
 * key event anything can cancel. So this watches the *text* instead. A trailing
 * space or hyphen means "that syllable is finished", which is true of a
 * hardware keyboard as well, so one rule covers a Mac, an iPad with a keyboard
 * case, and a phone with none. Explicit Back and Done controls sit beside it
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
import { lyricTextAt, writeLyric } from '@sudobility/music_editing';

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
  /** Whether the syllable *before* this one ended in a hyphen. */
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

  const commit = (text: string, hyphenated: boolean): void => {
    continuing.current = writeLyric(store, {
      noteId: note.id,
      text,
      continuing: continuing.current,
      hyphenated,
    });
  };

  const advance = (text: string, hyphenated: boolean): void => {
    commit(text, hyphenated);
    if (index + 1 >= notes.length) {
      onClose();
      return;
    }
    setIndex(index + 1);
  };

  const handleChange = (next: string): void => {
    /*
      A separator is only a separator at the end. Typing one in the middle of a
      syllable — fixing "beau" to "beaut" by way of the arrow keys — must not
      throw the entry two notes forward.
    */
    if (next.endsWith(' ')) {
      advance(next.slice(0, -1).trim(), false);
      return;
    }
    if (next.endsWith('-')) {
      advance(next.slice(0, -1).trim(), true);
      return;
    }
    setDraft(next);
  };

  const stepBack = (): void => {
    commit(draft, continuing.current);
    setIndex(Math.max(0, index - 1));
  };

  return (
    <View
      className="border-border flex-row items-center gap-2 border-t px-2 py-1.5"
      accessibilityRole="toolbar"
      accessibilityLabel={t('editor.lyricEntry')}
    >
      <Text className="text-muted-foreground shrink-0 text-xs">
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
        onSubmitEditing={() => {
          commit(draft, false);
          onClose();
        }}
        className="h-8 flex-1 px-2 text-sm"
      />
      <Button
        variant="ghost"
        onPress={stepBack}
        disabled={index === 0}
        accessibilityLabel={t('editor.previousSyllable')}
      >
        {'‹'}
      </Button>
      <Button
        variant="ghost"
        onPress={() => advance(draft, true)}
        accessibilityLabel={t('editor.hyphenate')}
      >
        {'-'}
      </Button>
      <Button variant="ghost" onPress={() => advance(draft, false)}>
        {'␣'}
      </Button>
      <Button variant="ghost" onPress={onClose}>
        {t('editor.done')}
      </Button>
    </View>
  );
}
