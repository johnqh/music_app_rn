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
import { Input, SheetSelector, Switch, Text } from '@sudobility/components-rn';
import { PanSlider, VolumeSlider } from '@/features/tracks/MixerSliders';
import { selectSelectedTrack } from '@sudobility/music_editing';
import { INSTRUMENT_OPTIONS } from '@sudobility/music_types';
import { Field, EmptyTab } from './Field';
import type { MusicDocument } from '@/documents/document';

export function TrackTab({ document }: { document: MusicDocument }) {
  const { t } = useTranslation();
  const store = document.store;
  const track = useStore(store, selectSelectedTrack);
  const playing = useStore(store, s => s.state) === 'playing';
  const [draftName, setDraftName] = useState(track?.name ?? '');

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

      <Field label={t('inspector.instrument')}>
        {/*
          The library's own option list: already grouped by family, and already
          carrying the catalogue *value* — kit prefix and all — that
          `setTrackInstrument` wants. Rebuilding it from `GM_CATALOGUE` would be
          a second list to keep in step, and would get the kit/melodic
          distinction wrong the first time somebody picked a drum track.
        */}
        <SheetSelector
          title={t('inspector.instrument')}
          value={String(track.midiProgram)}
          options={INSTRUMENT_OPTIONS}
          onChange={value =>
            store
              .getState()
              .setTrackInstrument(track.id, value, t('inspector.setInstrument'))
          }
          accessibilityLabel={t('inspector.instrument')}
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
        <Text className="text-foreground text-sm">{t('inspector.mute')}</Text>
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
        <Text className="text-foreground text-sm">{t('inspector.solo')}</Text>
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
    </View>
  );
}
