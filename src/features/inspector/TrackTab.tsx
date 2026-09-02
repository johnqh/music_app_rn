/**
 * The active track's properties — the web inspector's Track tab.
 *
 * Reflects and invokes only. The rules the actions enforce (carrying notes into
 * a new instrument's compass, refusing to delete the last track, resolving a
 * drum kit from a catalogue value) are rules about a score, which is why they
 * live in `music_editing`.
 *
 * The name is a **draft committed on blur** — dispatching per keystroke makes
 * every letter its own undo entry — and it is re-seeded when the track changes,
 * so switching tracks does not carry a half-typed name across.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  Select,
  SheetSelector,
  Switch,
  Text,
} from '@sudobility/components-rn';
import { PanSlider, VolumeSlider } from '@/features/tracks/MixerSliders';
import { selectSelectedTrack } from '@sudobility/music_editing';
import {
  CLEFS,
  INSTRUMENT_OPTIONS,
  KIT_OPTIONS,
  isPercussionTrack,
  kitOptionValue,
} from '@sudobility/music_types';
import type { Clef } from '@sudobility/music_types';
import { ConfirmSheet } from '@/components/controls/ConfirmSheet';
import { InstrumentIcon } from '@/components/icons/InstrumentIcon';
import { useNotationInk } from '@/components/icons/notation-ink';
import { Field, EmptyTab } from './Field';
import { ReplaceButton } from './ReplaceButton';
import type { ReplaceScope } from '@sudobility/music_types';
import type { MusicDocument } from '@/documents/document';

export function TrackTab({
  document,
  onReplace,
}: {
  document: MusicDocument;
  onReplace?: (scope: ReplaceScope) => void;
}) {
  const { t } = useTranslation();
  const ink = useNotationInk();
  const store = document.store;
  const track = useStore(store, selectSelectedTrack);
  const playing = useStore(store, s => s.state) === 'playing';
  const [draftName, setDraftName] = useState(track?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setDraftName(track?.name ?? ''), [track?.id, track?.name]);

  /*
    Volume and pan are drawn from a local draft and committed on release.

    A mix change per frame is a store write per frame, and the fill would
    otherwise wait for the value to come back through the store — so it lagged
    the finger. The web inspector's `CommitSlider` draws from a draft for
    exactly this reason.
  */
  const [volumeDraft, setVolumeDraft] = useState(track?.volume ?? 1);
  const [panDraft, setPanDraft] = useState(track?.pan ?? 0);
  useEffect(
    () => setVolumeDraft(track?.volume ?? 1),
    [track?.id, track?.volume],
  );
  useEffect(() => setPanDraft(track?.pan ?? 0), [track?.id, track?.pan]);

  const mix = useCallback(
    (patch: { volume?: number; pan?: number }) => {
      if (!track) return;
      store.getState().setTrackMix(track.id, patch, t('inspector.mixChange'));
    },
    [store, track, t],
  );

  const commitName = useCallback(() => {
    if (!track || draftName === track.name) return;
    store
      .getState()
      .renameTrack(track.id, draftName, t('inspector.renameTrack'));
  }, [store, draftName, track, t]);

  if (!track) return <EmptyTab message={t('inspector.selectTrack')} />;

  return (
    <View className="gap-3">
      <Field label={t('inspector.name')}>
        <Input
          value={draftName}
          onChangeText={setDraftName}
          onBlur={commitName}
          editable={!playing}
          accessibilityLabel={t('inspector.name')}
        />
      </Field>

      <Field
        label={
          isPercussionTrack(track)
            ? t('inspector.drumKit')
            : t('inspector.instrument')
        }
      >
        {/*
          The library's own option lists: already grouped by family, and already
          carrying the catalogue *value* — kit prefix and all — that
          `setTrackInstrument` wants. Rebuilding either from `GM_CATALOGUE`
          would be a second list to keep in step.

          **Two lists, not one.** On a percussion track `midiProgram` addresses
          a *kit*, so the melodic catalogue names the wrong thing outright —
          Brush is kit 40 and program 40 is Violin. This panel offered the
          melodic list on every track, so a drum part reported itself as
          whatever instrument shared its number. Which list is showing is the
          only difference here; `setTrackInstrument` takes the value either one
          produces and resolves it.
        */}
        {/*
          The icon beside the picker, as the web has it: a row of instrument
          names is a wall of text, and the shape is what a reader finds a part
          by. The art is music_types', the same drawing the canvas gutter
          strokes into the score.
        */}
        <View className="flex-row items-center gap-2">
          <InstrumentIcon track={track} color={ink.foreground} />
          <View className="flex-1">
            {isPercussionTrack(track) ? (
              <SheetSelector
                title={t('inspector.drumKit')}
                value={kitOptionValue(track.midiProgram)}
                options={KIT_OPTIONS}
                disabled={playing}
                onChange={value =>
                  store
                    .getState()
                    .setTrackInstrument(
                      track.id,
                      value,
                      t('inspector.setInstrument'),
                    )
                }
                accessibilityLabel={t('inspector.kitOf', { name: track.name })}
              />
            ) : (
              <SheetSelector
                title={t('inspector.instrument')}
                value={String(track.midiProgram)}
                options={INSTRUMENT_OPTIONS}
                disabled={playing}
                onChange={value =>
                  store
                    .getState()
                    .setTrackInstrument(
                      track.id,
                      value,
                      t('inspector.setInstrument'),
                    )
                }
                accessibilityLabel={t('inspector.instrument')}
              />
            )}
          </View>
        </View>
      </Field>

      {/*
        The clef the part *opens* in. Mid-score changes live on the measure, in
        the Measure tab — this is `Track.clef`, and crossing into or out of
        percussion re-resolves the program, since a kit and an instrument are
        different things at the same number.
      */}
      <Field label={t('inspector.clef')}>
        <Select
          value={track.clef}
          accessibilityLabel={t('inspector.clef')}
          disabled={playing}
          options={CLEFS.map((c: Clef) => ({ value: c, label: c }))}
          onValueChange={(value: string) =>
            store
              .getState()
              .setTrackClef(track.id, value as Clef, t('inspector.changeClef'))
          }
        />
      </Field>

      {/*
        Each owns its whole row — label, control, readout — so the two line up
        by construction. `Field` is for a label above a control; these carry
        their own label column, and wrapping them in one would put the word
        twice on screen and twice in the accessible name.
      */}
      <VolumeSlider
        label={t('inspector.trackVolume')}
        rowLabel={t('inspector.volume')}
        value={volumeDraft}
        onChange={setVolumeDraft}
        onCommit={value => mix({ volume: value })}
      />
      {/* -1 hard left, 0 centre, 1 hard right — the model's own range. */}
      <PanSlider
        label={t('inspector.trackPan')}
        rowLabel={t('inspector.pan')}
        value={panDraft}
        onChange={setPanDraft}
        onCommit={value => mix({ pan: value })}
        resetLabel={t('inspector.centerPan')}
        onReset={() => {
          // Straight to the store rather than through the drag's commit: the
          // button is not the slider, and centring is a decision rather than
          // the end of a gesture.
          setPanDraft(0);
          mix({ pan: 0 });
        }}
      />

      {/*
        Mixing stays live while the transport plays; the content controls above
        do not. That is the same split the edit lock makes — muting a part while
        listening is how an arrangement gets listened to.
      */}
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground text-base">{t('inspector.mute')}</Text>
        <Switch
          checked={track.muted === true}
          onCheckedChange={(checked: boolean) =>
            store
              .getState()
              .setTrackMix(
                track.id,
                { muted: checked },
                t('inspector.mixChange'),
              )
          }
          accessibilityLabel={t('inspector.mute')}
        />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground text-base">{t('inspector.solo')}</Text>
        <Switch
          checked={track.solo === true}
          onCheckedChange={(checked: boolean) =>
            store
              .getState()
              .setTrackMix(
                track.id,
                { solo: checked },
                t('inspector.mixChange'),
              )
          }
          accessibilityLabel={t('inspector.solo')}
        />
      </View>

      {/*
        Deleting the part. `canDeleteTrack` is the store's own rule, asked
        rather than restated here — a score with no tracks is not a score, and
        the panel should not be the second place that knows it.
      */}
      <Button
        variant="destructive"
        disabled={!store.getState().canDeleteTrack() || playing}
        onPress={() => setConfirmDelete(true)}
        accessibilityLabel={t('inspector.deleteTrack')}
      >
        {t('inspector.deleteTrack')}
      </Button>
      <ConfirmSheet
        open={confirmDelete}
        title={t('inspector.deleteTrack')}
        message={t('inspector.deleteTrackConfirm', { name: track.name })}
        confirmLabel={t('inspector.deleteTrack')}
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          store.getState().removeTrack(track.id, t('inspector.deleteTrack'));
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      {onReplace ? (
        <ReplaceButton
          scope="track"
          label={t('inspector.replaceTrack')}
          disabled={playing}
          onReplace={onReplace}
        />
      ) : null}
    </View>
  );
}
