/**
 * The playback bar, mirroring the web app's — control for control.
 *
 * Same controls in the same order, drawn with the same glyphs: go to start,
 * previous bar, play/pause, stop, next bar, loop, metronome, the bar:beat
 * readout, the tempo, the speed, the master volume, the position scrubber and
 * the timecode, with the load indicator last so it never shifts the rest.
 *
 * **The glyphs are shared, as data.** `GoToStartIcon`, `PreviousMeasureIcon`,
 * `NextMeasureIcon` and `MetronomeIcon` live in `NOTATION_ICONS` and are drawn
 * by both apps, so a metronome here is the web's metronome rather than a
 * lookalike. This bar used to draw the same `BackwardIcon` for both go-to-start
 * and previous-bar — two different actions with one picture — and a `♩` glyph
 * for the metronome.
 *
 * **Every position-driven readout is its own subscriber.** Position arrives
 * about thirty times a second; reading it here would re-render the whole bar —
 * and, through it, the notation — at that rate. The web app learned this by
 * profiling (124 renders in 4s) and split `MeasureBeatReadout`,
 * `PositionScrubber` and `Timecode` out for exactly this reason. Same split
 * here, same reason.
 *
 * **Tempo is the one control that edits the score.** Loop, metronome, speed,
 * volume and seeking are real-time device control and go to the player; the BPM
 * field is persisted with the score and goes through `setOpeningTempo`, which
 * is why this bar takes the document's store as well as its score.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { useTranslation } from 'react-i18next';
import { Input, Text } from '@sudobility/components-rn';
import {
  ArrowPathRoundedSquareIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
} from 'react-native-heroicons/solid';
import { barBeatForTick, TempoMap } from '@sudobility/music_types';
import { setOpeningTempo } from '@sudobility/music_editing';
import type { EditingStoreApi } from '@sudobility/music_editing';
import type { Score } from '@sudobility/music_types';
import { getAppServices } from '@/config/initialize';
import { NotationIcon } from '@/components/icons/NotationIcon';
import { useNotationInk } from '@/components/icons/notation-ink';
import { LevelSlider } from '@/components/controls/LevelSlider';
import { ToolbarSelect } from '@/components/controls/ToolbarSelect';
import { SynthLoadIndicator, useSynthLoad } from './SynthLoadIndicator';
import { IconButton } from '@/components/layout/IconButton';
import type { TransportApi } from './useTransport';

const ICON_SIZE = 18;

/** Spec §22: "Speeds: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x." */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type TransportBarProps = {
  score: Score;
  transport: TransportApi;
  /** The document's store. Only the tempo field writes to it. */
  store: EditingStoreApi;
};

/** `M:SS.d` — tenths make the actual playback rate visible against a wall clock. */
function formatTimecode(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const rest = clamped - minutes * 60;
  const whole = Math.floor(rest);
  const tenths = Math.floor((rest - whole) * 10);
  return `${minutes}:${String(whole).padStart(2, '0')}.${tenths}`;
}

export function TransportBar({ score, transport, store }: TransportBarProps) {
  const { t } = useTranslation();
  const ink = useNotationInk();
  const [loop, setLoop] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [tempoDraft, setTempoDraft] = useState('');
  const [editingTempo, setEditingTempo] = useState(false);
  const playing = transport.state === 'playing';

  const lastMeasure = score.tracks[0]?.measures.at(-1);
  const endTick = lastMeasure
    ? lastMeasure.startTick + lastMeasure.durationTicks
    : 0;
  const measureCount = score.tracks[0]?.measures.length ?? 0;

  /*
    Rounded for display as well as on commit: a score can arrive carrying a
    fractional tempo from a MIDI file or a detected one from audio import, and
    "119.87421 BPM" in the transport is noise, not precision.
  */
  const currentBpm = Math.round(score.tempoMap[0]?.bpm ?? 120);

  // Score-time seconds via the same TempoMap the playback engine schedules
  // with, so this readout advances exactly 1 second per wall-clock second at
  // 1x speed — a live check that playback runs at the score's real tempo.
  const tempoMap = useMemo(
    () => new TempoMap([...score.tempoMap], score.ppq),
    [score],
  );
  const totalSeconds = tempoMap.ticksToSeconds(endTick);

  /*
    The playhead's tick, held in a ref rather than state: prev/next-bar need to
    read it, and nothing renders from it — putting it in state would re-render
    the whole bar thirty times a second, which is the thing this file is
    organised to avoid.
  */
  const positionTick = useRef(0);
  useEffect(
    () => transport.onPosition(tick => (positionTick.current = tick)),
    [transport],
  );

  const stepMeasure = useCallback(
    (delta: number) => {
      const measures = score.tracks[0]?.measures ?? [];
      if (measures.length === 0) return;
      // The bar the playhead is in: the last one that has started.
      let index = 0;
      for (let i = 0; i < measures.length; i += 1) {
        const measure = measures[i];
        if (measure && measure.startTick <= positionTick.current) index = i;
      }
      const target =
        measures[Math.max(0, Math.min(measures.length - 1, index + delta))];
      if (target) transport.seek(target.startTick);
    },
    [score, transport],
  );

  const commitTempo = useCallback((): void => {
    setEditingTempo(false);
    // Whole numbers only. A paste or a stepper can put "104.5" in the field,
    // and a tempo the transport rounds for display but stores unrounded reads
    // back differently the next time it is opened.
    const next = Math.round(Number(tempoDraft));
    if (Number.isFinite(next) && next > 0) setOpeningTempo(store, next);
  }, [store, tempoDraft]);

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel={t('transport.transport')}
      className="border-border bg-card flex-row items-center gap-1 border-t px-2 py-1"
    >
      <IconButton
        label={t('transport.goToStart')}
        onPress={() => transport.seek(0)}
      >
        <NotationIcon name="GoToStartIcon" color={ink.foreground} />
      </IconButton>
      <IconButton
        label={t('transport.previousMeasure')}
        onPress={() => stepMeasure(-1)}
      >
        <NotationIcon name="PreviousMeasureIcon" color={ink.foreground} />
      </IconButton>
      <PlayPauseButton
        playing={playing}
        onPress={() => (playing ? transport.pause() : void transport.play())}
      />
      <IconButton label={t('transport.stop')} onPress={transport.stop}>
        <StopIcon size={ICON_SIZE} className="text-foreground" />
      </IconButton>
      <IconButton
        label={t('transport.nextMeasure')}
        onPress={() => stepMeasure(1)}
      >
        <NotationIcon name="NextMeasureIcon" color={ink.foreground} />
      </IconButton>

      {/*
        Loop and metronome are toggles, and they say so the way every other
        toggle in this app does — a filled chip and `selected` reported to the
        accessibility layer. Tinting the glyph alone said it only to somebody
        looking at it.
      */}
      <IconButton
        label={t('transport.toggleLoop')}
        selected={loop}
        onPress={() => {
          const next = !loop;
          setLoop(next);
          // Every track: a loop over one part and not the others would play
          // a different piece each time round.
          getAppServices().player.setLoop(
            next
              ? { startTick: 0, endTick, trackIds: score.tracks.map(t => t.id) }
              : null,
          );
        }}
      >
        <ArrowPathRoundedSquareIcon
          size={ICON_SIZE}
          className={loop ? 'text-primary' : 'text-foreground'}
        />
      </IconButton>
      <IconButton
        label={t('transport.toggleMetronome')}
        selected={metronome}
        onPress={() => {
          const next = !metronome;
          setMetronome(next);
          getAppServices().player.setMetronome(next);
        }}
      >
        <NotationIcon
          name="MetronomeIcon"
          color={metronome ? ink.onPrimary : ink.foreground}
        />
      </IconButton>

      <MeasureBeatReadout score={score} transport={transport} />

      {/*
        The BPM, edited in place. A button that becomes a field, like the web's:
        the number is read far more often than it is changed, and a permanent
        text input in a bar of icon buttons reads as somewhere to type rather
        than as a readout.
      */}
      {editingTempo ? (
        <Input
          keyboardType="number-pad"
          accessibilityLabel={t('transport.tempoBpm')}
          value={tempoDraft}
          autoFocus
          onChangeText={setTempoDraft}
          onBlur={commitTempo}
          onSubmitEditing={commitTempo}
          className="w-20"
        />
      ) : (
        <IconButton
          label={t('transport.tempoBpm')}
          hint={t('transport.editTempo')}
          onPress={() => {
            setTempoDraft(String(currentBpm));
            setEditingTempo(true);
          }}
        >
          <Text className="text-foreground text-xs tabular-nums">
            {`${currentBpm} BPM`}
          </Text>
        </IconButton>
      )}

      <ToolbarSelect
        label={t('transport.speed')}
        hint={t('transport.speedMultiplier')}
        options={SPEEDS.map(value => ({
          value: String(value),
          label: `${value}x`,
        }))}
        value={String(speed)}
        onChange={value => {
          const next = Number(value);
          setSpeed(next);
          getAppServices().player.setTempoMultiplier(next);
        }}
      >
        <Text className="text-foreground text-xs">{`${speed}x`}</Text>
      </ToolbarSelect>

      <View className="w-24 flex-row items-center gap-1">
        <Text className="text-foreground text-xs">{t('transport.volume')}</Text>
        <LevelSlider
          className="flex-1"
          label={t('transport.masterVolume')}
          value={volume}
          onChange={next => {
            setVolume(next);
            // Continuous: a gain must be audible while the finger moves.
            getAppServices().player.setMasterVolume(next);
          }}
        />
      </View>

      <PositionScrubber
        endTick={endTick}
        transport={transport}
        measureCount={measureCount}
      />
      <Timecode
        transport={transport}
        tempoMap={tempoMap}
        maxTick={endTick}
        totalSeconds={totalSeconds}
      />
      {/*
        Last, and self-effacing: it renders nothing once the engine is ready,
        which is every press of Play after the first.
      */}
      <SynthLoadIndicator />
    </View>
  );
}

/**
 * Play/Pause, and the only control that knows the synth may not be ready.
 *
 * Its own subscriber for the reason the position readouts are: the load
 * reports per percent, and read at the bar's top level each of those would
 * re-render every control in the row. Here it touches one button.
 */
function PlayPauseButton({
  playing,
  onPress,
}: {
  playing: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const load = useSynthLoad();
  // Only the *first* load blocks: once the synth is up the engine reports
  // `ready` and stays there, so this is disabled for seconds once per session
  // rather than on every press.
  const loading = load.status === 'loading';
  return (
    <IconButton
      label={playing ? t('transport.pause') : t('transport.play')}
      disabled={loading}
      onPress={onPress}
    >
      {playing ? (
        <PauseIcon size={ICON_SIZE} className="text-foreground" />
      ) : (
        <PlayIcon size={ICON_SIZE} className="text-foreground" />
      )}
    </IconButton>
  );
}

/**
 * Bar and beat. Its own subscriber, so a position report re-renders these two
 * numbers and nothing else.
 */
export const MeasureBeatReadout = memo(function MeasureBeatReadout({
  score,
  transport,
}: {
  score: Score;
  transport: TransportApi;
}) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  useEffect(() => transport.onPosition(setTick), [transport]);
  const at = barBeatForTick(score, tick);
  return (
    // The name sits on a wrapper: this package's `Text` styles text and takes
    // no accessibility props of its own.
    <View accessibilityLabel={t('transport.measureBeat')} className="w-14">
      <Text className="text-foreground text-center text-sm tabular-nums">
        {at ? `${at.bar}.${Math.floor(at.beat)}` : '-.-'}
      </Text>
    </View>
  );
});

/** Elapsed time over total. Also its own subscriber, for the same reason. */
const Timecode = memo(function Timecode({
  transport,
  tempoMap,
  maxTick,
  totalSeconds,
}: {
  transport: TransportApi;
  tempoMap: TempoMap;
  maxTick: number;
  totalSeconds: number;
}) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  useEffect(() => transport.onPosition(setTick), [transport]);
  const seconds = tempoMap.ticksToSeconds(Math.min(tick, maxTick));
  return (
    <View accessibilityLabel={t('transport.time')} className="w-24">
      <Text className="text-foreground text-right text-xs tabular-nums">
        {`${formatTimecode(seconds)} / ${formatTimecode(totalSeconds)}`}
      </Text>
    </View>
  );
});

/**
 * Where you are, and where you can drag to.
 *
 * Seeks on release rather than continuously: a seek rebuilds the engine's
 * lookahead, and doing that per frame while a finger moves is what makes a
 * scrubber stutter. That is the one place this deliberately differs from the
 * web, which seeks on every event because a mouse drag is cheap.
 *
 * Painted from a local draft while dragging, so the fill follows the finger
 * rather than waiting for the engine's next position report.
 */
const PositionScrubber = memo(function PositionScrubber({
  endTick,
  transport,
  measureCount,
}: {
  endTick: number;
  transport: TransportApi;
  measureCount: number;
}) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  useEffect(() => transport.onPosition(setTick), [transport]);

  return (
    <View className="min-w-24 flex-1">
      <LevelSlider
        label={t('transport.position')}
        value={dragging ?? tick}
        min={0}
        max={Math.max(1, endTick)}
        step={1}
        disabled={measureCount === 0}
        onChange={setDragging}
        onSlidingComplete={next => {
          setDragging(null);
          transport.seek(next);
        }}
      />
    </View>
  );
});
