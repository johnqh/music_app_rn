/**
 * The playback bar, mirroring the web app's.
 *
 * Same controls in the same order: go to start, previous bar, play/pause,
 * stop, next bar, loop, metronome, the bar:beat readout, tempo, speed, volume,
 * the position scrubber and the timecode.
 *
 * **Every position-driven readout is its own subscriber.** Position arrives
 * about thirty times a second; reading it here would re-render the whole bar —
 * and, through it, the notation — at that rate. The web app learned this by
 * profiling (124 renders in 4s) and split `MeasureBeatReadout`,
 * `PositionScrubber` and `Timecode` out for exactly this reason. Same split
 * here, same reason.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Slider, Text } from '@sudobility/components-rn';
import {
  ArrowPathRoundedSquareIcon,
  BackwardIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
} from 'react-native-heroicons/solid';
import { barBeatForTick, TempoMap } from '@sudobility/music_types';
import type { Score } from '@sudobility/music_types';
import { getAppServices } from '@/config/initialize';
import { SynthLoadIndicator, useSynthLoad } from './SynthLoadIndicator';
import { IconButton } from '@/components/layout/IconButton';
import type { TransportApi } from './useTransport';

const ICON_SIZE = 18;

/** The multipliers the web app offers. */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type TransportBarProps = {
  score: Score;
  transport: TransportApi;
};

export function TransportBar({ score, transport }: TransportBarProps) {
  const { t } = useTranslation();
  const [loop, setLoop] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const playing = transport.state === 'playing';

  const measureCount = score.tracks[0]?.measures.length ?? 0;
  const maxTick = score.tracks[0]?.measures.at(-1);
  const endTick = maxTick ? maxTick.startTick + maxTick.durationTicks : 0;

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

  return (
    <View className="border-border bg-card flex-row items-center gap-1 border-t px-2 py-1">
      <IconButton
        label={t('transport.goToStart')}
        onPress={() => transport.seek(0)}
      >
        <BackwardIcon size={ICON_SIZE} className="text-foreground" />
      </IconButton>
      <IconButton
        label={t('transport.previousMeasure')}
        onPress={() => stepMeasure(-1)}
      >
        <BackwardIcon size={ICON_SIZE} className="text-foreground" />
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
        <ForwardIcon size={ICON_SIZE} className="text-foreground" />
      </IconButton>
      <IconButton
        label={t('transport.toggleLoop')}
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
        onPress={() => {
          const next = !metronome;
          setMetronome(next);
          getAppServices().player.setMetronome(next);
        }}
      >
        <Text className={metronome ? 'text-primary' : 'text-foreground'}>
          ♩
        </Text>
      </IconButton>

      <MeasureBeatReadout score={score} transport={transport} />

      <SpeedSelect
        speed={speed}
        onChange={next => {
          setSpeed(next);
          getAppServices().player.setTempoMultiplier(next);
        }}
      />

      <View className="w-24 flex-row items-center gap-1">
        <Text className="text-foreground text-xs">{t('transport.volume')}</Text>
        <Slider
          className="flex-1"
          value={volume}
          onValueChange={next => {
            setVolume(next);
            // Continuous: a gain must be audible while the finger moves.
            getAppServices().player.setMasterVolume(next);
          }}
          accessibilityLabel={t('transport.volume')}
        />
      </View>

      <PositionScrubber
        endTick={endTick}
        transport={transport}
        measureCount={measureCount}
      />
      <Timecode score={score} transport={transport} />
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
  const [tick, setTick] = useState(0);
  useEffect(() => transport.onPosition(setTick), [transport]);
  const at = barBeatForTick(score, tick);
  return (
    <Text className="text-foreground w-16 text-center text-sm tabular-nums">
      {at ? `${at.bar}:${Math.floor(at.beat)}` : '—'}
    </Text>
  );
});

/** Elapsed time. Also its own subscriber, for the same reason. */
const Timecode = memo(function Timecode({
  score,
  transport,
}: {
  score: Score;
  transport: TransportApi;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => transport.onPosition(setTick), [transport]);
  const tempo = new TempoMap([...score.tempoMap], score.ppq);
  const seconds = tempo.ticksToSeconds(tick);
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return (
    <Text className="text-muted-foreground w-14 text-right text-xs tabular-nums">
      {`${mm}:${String(ss).padStart(2, '0')}`}
    </Text>
  );
});

/**
 * Where you are, and where you can drag to.
 *
 * Seeks on release rather than continuously: a seek rebuilds the engine's
 * lookahead, and doing that per frame while a finger moves is what makes a
 * scrubber stutter.
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
      <Slider
        value={dragging ?? tick}
        min={0}
        max={Math.max(1, endTick)}
        onValueChange={setDragging}
        onSlidingComplete={next => {
          setDragging(null);
          transport.seek(next);
        }}
        disabled={measureCount === 0}
        accessibilityLabel={t('transport.position')}
      />
    </View>
  );
});

function SpeedSelect({
  speed,
  onChange,
}: {
  speed: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const next = () => {
    const index = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    onChange(SPEEDS[(index + 1) % SPEEDS.length] ?? 1);
  };
  return (
    <IconButton label={t('transport.speedMultiplier')} onPress={next}>
      <Text className="text-foreground text-xs">{`${speed}×`}</Text>
    </IconButton>
  );
}
