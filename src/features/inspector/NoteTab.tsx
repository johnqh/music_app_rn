/**
 * The selected note's properties — the web inspector's Note tab.
 *
 * **It says note values and key names, never ticks or fifths.** `Duration 480`
 * states the storage format; the reader is looking at a quarter note. The
 * conversions are `music_editing`'s `music-vocabulary` — music theory, not
 * panel code — and `durationNameForTicks` answers `null` for a length no single
 * notehead spells, which shows as Custom rather than being relabelled as the
 * nearest name.
 *
 * Voice is counted from 1, matching the toolbar; the stored index is 0-based.
 */
import { View } from 'react-native';
import { DraftInput } from './DraftInput';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Select, Text } from '@sudobility/components-rn';
import {
  changeArticulation,
  changeDuration,
  selectSelectedNotes,
  setChordSymbol,
  setDynamic,
  setFingering,
} from '@sudobility/music_editing';
import {
  DURATION_NAMES,
  DYNAMICS,
  durationNameForTicks,
  pitchToString,
} from '@sudobility/music_types';
import type {
  Articulation,
  Dynamic,
  DurationName,
} from '@sudobility/music_types';
import { EmptyTab, Field } from './Field';
import type { MusicDocument } from '@/documents/document';

const ARTICULATIONS: readonly (Articulation | 'none')[] = [
  'none',
  'staccato',
  'accent',
  'tenuto',
  'marcato',
];

export function NoteTab({ document }: { document: MusicDocument }) {
  const { t } = useTranslation();
  const store = document.store;
  const notes = useStore(store, selectSelectedNotes);
  const playing = useStore(store, s => s.state) === 'playing';

  if (notes.length === 0)
    return <EmptyTab message={t('inspector.selectNote')} />;

  const first = notes[0];
  if (!first) return <EmptyTab message={t('inspector.selectNote')} />;
  const durationName = durationNameForTicks(
    first.durationTicks,
    store.getState().score?.ppq ?? 480,
  );

  return (
    <View className="gap-3">
      <Field label={t('inspector.pitch')}>
        <Text className="text-foreground text-sm">
          {notes.length > 1 ? t('inspector.mixed') : pitchToString(first.pitch)}
        </Text>
      </Field>

      <Field label={t('inspector.duration')}>
        <Select
          value={durationName ?? ''}
          accessibilityLabel={t('inspector.duration')}
          disabled={playing}
          placeholder={t('inspector.custom')}
          options={DURATION_NAMES.map((name: DurationName) => ({
            value: name,
            label: t(`duration.${name}`),
          }))}
          onValueChange={(value: string) =>
            changeDuration(store, value as DurationName)
          }
        />
      </Field>

      <Field label={t('inspector.articulation')}>
        <Select
          value={first.articulation ?? 'none'}
          accessibilityLabel={t('inspector.articulation')}
          disabled={playing}
          options={ARTICULATIONS.map(value => ({
            value,
            label: t(`articulation.${value}`),
          }))}
          onValueChange={(value: string) =>
            changeArticulation(
              store,
              value === 'none' ? undefined : (value as Articulation),
            )
          }
        />
      </Field>

      <Field label={t('inspector.dynamic')} hint={t('inspector.dynamicHint')}>
        {/*
          A dynamic marks the note a level *begins* at and is in force until the
          next marking — so setting one here makes a passage loud, and there is
          nothing to apply to the notes between.
        */}
        <Select
          value={first.dynamic ?? 'none'}
          accessibilityLabel={t('inspector.dynamic')}
          disabled={playing}
          options={[
            { value: 'none', label: t('inspector.noDynamic') },
            ...DYNAMICS.map((d: Dynamic) => ({ value: d, label: d })),
          ]}
          onValueChange={(value: string) =>
            setDynamic(
              store,
              notes.map(n => n.id),
              value === 'none' ? undefined : (value as Dynamic),
            )
          }
        />
      </Field>

      <Field label={t('inspector.chordSymbol')}>
        {/*
          Stored as typed. `C-7`, `Cmin7` and `Cm7` are one chord written three
          ways, and only the root is ever parsed.
        */}
        <DraftInput
          value={first.chordSymbol ?? ''}
          placeholder={t('inspector.chordSymbolPlaceholder')}
          editable={!playing}
          onCommit={text => setChordSymbol(store, first.id, text)}
          accessibilityLabel={t('inspector.chordSymbol')}
        />
      </Field>

      <Field label={t('inspector.fingering')}>
        {/*
          A string, not a number: piano uses 1-5, guitar adds `T`, and editions
          write `1-2` for a substitution.
        */}
        <DraftInput
          value={first.fingering ?? ''}
          editable={!playing}
          onCommit={text => setFingering(store, text || undefined)}
          accessibilityLabel={t('inspector.fingering')}
        />
      </Field>

      <Field label={t('inspector.voice')}>
        {/* Counted from 1, to match the toolbar's Voice 1 / Voice 2. */}
        <Text className="text-foreground text-sm">
          {notes.length > 1 ? t('inspector.mixed') : 1}
        </Text>
      </Field>
    </View>
  );
}
