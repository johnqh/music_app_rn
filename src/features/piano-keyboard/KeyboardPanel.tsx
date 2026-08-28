/**
 * The keyboard, bound to a document.
 *
 * Pressing a key auditions it through the player and nothing else — no caret
 * move, no transport change. On release the whole group goes to `playKeyGroup`,
 * which is music_editing's: it decides whether the keys join a chord, replace a
 * selected note, or enter at the caret, and turns the held time into a note
 * value. That rule used to live inside the web app's keyboard component, which
 * is precisely why a second keyboard would have had to copy it.
 *
 * Keys pressed together are one group: a chord is keys that overlap in time, so
 * the group closes when the last finger lifts rather than the first.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useStore } from 'zustand';
import { selectActiveTrackId } from '@sudobility/music_editing';
import { playKeyGroup } from '@sudobility/music_editing';
import { getAppServices } from '@/config/initialize';
import type { MusicDocument } from '@/documents/document';
import { Text } from '@sudobility/components-rn';
import { PianoKeyboard } from './PianoKeyboard';
import { useContainerSize } from '@/features/layout/useContainerSize';
import { EMPTY_GROUP, pressKey, releaseKey } from './key-group';
import type { KeyGroup } from './key-group';

/** The keyboard's own height; the container states it so it can be measured. */
const KEYBOARD_HEIGHT = 120;

export type KeyboardPanelProps = {
  document: MusicDocument;
  /** Collapsed hides the keys and leaves the header, as the web panel does. */
  collapsed: boolean;
  onToggle: () => void;
};

export function KeyboardPanel({
  document,
  collapsed,
  onToggle,
}: KeyboardPanelProps) {
  const { t } = useTranslation();
  const { size, onLayout, measured } = useContainerSize();
  const [sounding, setSounding] = useState<ReadonlySet<number>>(new Set());
  const activeTrackId = useStore(document.store, selectActiveTrackId);

  /**
   * The group being played. A ref, not state: it changes on every touch and
   * nothing renders from it — putting it in state would re-render the whole
   * keyboard on each press.
   */
  const group = useRef<KeyGroup>(EMPTY_GROUP);

  useEffect(() => {
    const player = getAppServices().player;
    return player.onSounding(notes => {
      setSounding(new Set(notes.map(n => n.midi)));
    });
  }, []);

  const program = useStore(document.store, s => {
    const track = s.score?.tracks.find(t => t.id === activeTrackId);
    return track?.midiProgram ?? 0;
  });
  const isPercussion = useStore(document.store, s => {
    const track = s.score?.tracks.find(t => t.id === activeTrackId);
    return track?.clef === 'percussion';
  });

  const onKeyDown = useCallback(
    (midi: number) => {
      group.current = pressKey(group.current, midi, Date.now());
      // Audition only: `noteOn` touches no transport state.
      getAppServices().player.noteOn(midi, program, isPercussion);
    },
    [program, isPercussion],
  );

  const onKeyUp = useCallback(
    (midi: number) => {
      getAppServices().player.noteOff(midi);
      const { group: next, finished } = releaseKey(
        group.current,
        midi,
        Date.now(),
      );
      group.current = next;
      // Only once the last finger lifts. `playKeyGroup` decides the rest —
      // whether these join a chord, replace a selected note or enter at the
      // caret, and what note value the held time comes to.
      if (finished) playKeyGroup(document.store, finished);
    },
    [document],
  );

  if (collapsed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('editor.showKeyboard')}
        accessibilityState={{ expanded: false }}
        onPress={onToggle}
        className="border-border bg-card items-center border-t py-1"
      >
        <Text className="text-muted-foreground text-xs">
          {t('editor.showKeyboard')}
        </Text>
      </Pressable>
    );
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('editor.hideKeyboard')}
        accessibilityState={{ expanded: true }}
        onPress={onToggle}
        className="border-border bg-card items-center border-t py-0.5"
      >
        <Text className="text-muted-foreground text-xs">
          {t('editor.hideKeyboard')}
        </Text>
      </Pressable>
      <View onLayout={onLayout} style={{ height: KEYBOARD_HEIGHT }}>
        {measured ? (
          <PianoKeyboard
            width={size.width}
            height={KEYBOARD_HEIGHT}
            naming={isPercussion ? 'percussion' : 'pitch'}
            sounding={sounding}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
          />
        ) : null}
      </View>
    </View>
  );
}
