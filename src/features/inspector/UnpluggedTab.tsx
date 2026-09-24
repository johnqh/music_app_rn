/**
 * The Unplugged tab: an instrument arrangement on a stage, dragged into place.
 *
 * Plugged, a track's volume and pan come straight from its own `volume`/
 * `pan` fields, set by the Track tab's sliders. Unplugged replaces that:
 * every track's volume and pan are computed from where it stands relative
 * to the listener (`unpluggedMixes`, music_lib), and the reader arranges
 * the stage by dragging instead of sliding faders. The two never fight over
 * one track's mix — Unplugged's positions live on `score.unplugged`, never
 * on `track.volume`/`track.pan` — and only one is actually driving playback
 * at a time: `unpluggedActive`, set true for as long as this tab is the one
 * showing (see `bind-player.ts`'s `scoreForPlayback`).
 *
 * Drawn on a plain `View` canvas rather than the notation Skia surface —
 * this is a handful of draggable icons, not a score, and a `View` gets
 * ordinary RN layout and `react-native-gesture-handler` for free. It is
 * deliberately not inside the inspector's shared `ScrollView`
 * (`InspectorPanel.tsx` renders this tab outside it): a vertical scroll and
 * a free 2D drag on the same surface would fight over the gesture.
 *
 * **Every drag is drafted locally and throttled to one store write per
 * animation frame, not one per gesture event.** `dispatchCommand`
 * (`music_editing`) is not cheap: it runs Immer's `produceWithPatches` over
 * the *whole score* to record an undo entry, `validateScore` over the whole
 * score, and a `JSON.stringify` of the whole score twice (the dirty-check
 * fingerprint) — real costs the Track tab's volume/pan sliders already
 * avoid by drafting locally and committing only on release. This tab still
 * wants the mix to move live while dragging, which a release-only commit
 * would not give, so it keeps writing to the store during the drag but caps
 * the rate at `requestAnimationFrame` — a pan gesture reports far more
 * often than the screen repaints, and every one of those extra writes was
 * pure waste, and the measured cause of this tab's own reported lag. The
 * dragged marker's own on-screen position is local `useState`, updated on
 * every gesture event regardless, so it tracks the finger exactly even
 * though the store lags a frame behind it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { View } from 'react-native';
import type { View as RNView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Button, MIN_TOUCH_TARGET, Text } from '@sudobility/components-rn';
import { controlLocked, selectEditLocked } from '@sudobility/music_editing';
import {
  effectiveUnpluggedArrangement,
  UNPLUGGED_RADIUS,
} from '@sudobility/music_lib';
import type { Track } from '@sudobility/music_types';
import { InstrumentIcon } from '@/components/icons/InstrumentIcon';
import { useNotationInk } from '@/components/icons/notation-ink';
import type { MusicDocument } from '@/documents/document';

export type UnpluggedTabProps = {
  document: MusicDocument;
};

const STAGE_EXTENT = UNPLUGGED_RADIUS * 1.6;
const ICON_SIZE = 22;
const LISTENER_SIZE = 28;
/** How far the facing triangle sits from the listener's own centre. Close, so it reads as one marker rather than two unrelated dots. */
const HANDLE_DISTANCE = UNPLUGGED_RADIUS * 0.3;

function toPixels(stage: { x: number; z: number }, canvasSize: number) {
  return {
    x: ((stage.x + STAGE_EXTENT) / (2 * STAGE_EXTENT)) * canvasSize,
    // Larger z is further into the arc, drawn higher on the canvas.
    y:
      canvasSize - ((stage.z + STAGE_EXTENT) / (2 * STAGE_EXTENT)) * canvasSize,
  };
}

/** A pixel drag delta, as the stage-space delta it represents — the inverse scale `toPixels` uses. */
function pixelsToStageDelta(dx: number, dy: number, canvasSize: number) {
  const scale = (2 * STAGE_EXTENT) / canvasSize;
  return { dx: dx * scale, dz: -dy * scale };
}

/**
 * One dragged value: tracked locally for instant visual feedback, written
 * to the store at most once per animation frame, and always written exactly
 * once more — synchronously — on release, so the store never ends up
 * holding a stale mid-drag position because the last rAF tick lost the race
 * with the gesture ending.
 */
function useThrottledDrag<T>(commit: (value: T) => void) {
  const [live, setLive] = useState<T | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<T | null>(null);

  const update = useCallback(
    (value: T) => {
      setLive(value);
      pendingRef.current = value;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (pendingRef.current !== null) commit(pendingRef.current);
        });
      }
    },
    [commit],
  );

  const finish = useCallback(
    (value: T) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      commit(value);
      pendingRef.current = null;
      setLive(null);
    },
    [commit],
  );

  return { live, update, finish };
}

export function UnpluggedTab({ document }: UnpluggedTabProps) {
  const { t } = useTranslation();
  const ink = useNotationInk();
  const store = document.store;
  const score = useStore(store, s => s.score);
  const locked = useStore(
    store,
    s => selectEditLocked(s) && controlLocked(s, 'unpluggedArrangement'),
  );
  const [canvasSize, setCanvasSize] = useState(0);
  const canvasViewRef = useRef<RNView | null>(null);
  /**
   * The canvas's own top-left corner, in screen coordinates — refreshed on
   * every layout pass. `GestureDetector` reports a gesture's position
   * relative to whichever view it is attached to, not to this canvas, so
   * turning the listener needs a way back to canvas-relative coordinates:
   * a gesture's screen-absolute position (`e.absoluteX`/`absoluteY`) minus
   * this origin. `measureInWindow` is asynchronous, but a reader cannot
   * begin a drag before the canvas has already laid out and had its origin
   * measured at least once, so it is always fresh by the time it matters.
   */
  const originRef = useRef({ x: 0, y: 0 });

  // Unplugged mixing is in effect for exactly as long as this tab is the one
  // showing — never persisted, never true when nothing is mounted to show it.
  useEffect(() => {
    store.getState().setUnpluggedActive(true);
    return () => store.getState().setUnpluggedActive(false);
  }, [store]);

  if (!score) return null;
  const arrangement = effectiveUnpluggedArrangement(score);

  return (
    <View className="flex-1 gap-3 p-3">
      <Text className="text-muted-foreground text-sm">
        {t('inspector.unpluggedHint')}
      </Text>
      <View
        ref={canvasViewRef}
        className="border-border bg-card flex-1 self-stretch overflow-hidden rounded-lg border"
        accessibilityLabel={t('inspector.unpluggedStage')}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          const size = Math.max(1, Math.min(width, height));
          setCanvasSize(size);
          // The inner `canvasSize` square is centred within this (usually
          // non-square) bordered view, so its own screen origin is offset
          // from this view's by half of whichever dimension is larger.
          canvasViewRef.current?.measureInWindow((x, y) => {
            originRef.current = {
              x: x + (width - size) / 2,
              y: y + (height - size) / 2,
            };
          });
        }}
      >
        {canvasSize > 0 ? (
          <View
            style={{
              width: canvasSize,
              height: canvasSize,
              alignSelf: 'center',
            }}
          >
            {score.tracks.map(track => {
              const point = arrangement.tracks[track.id];
              if (!point) return null;
              return (
                <TrackMarker
                  key={track.id}
                  track={track}
                  point={point}
                  canvasSize={canvasSize}
                  locked={locked}
                  ink={ink.primary}
                  onDrag={next =>
                    store.getState().setUnpluggedTrackPosition(track.id, next)
                  }
                />
              );
            })}

            {/* The listener: drag the body to move, drag the triangle to turn. */}
            <ListenerMarker
              originRef={originRef}
              listener={arrangement.listener}
              canvasSize={canvasSize}
              locked={locked}
              label={t('inspector.unpluggedListener')}
              handleLabel={t('inspector.unpluggedTurnHandle')}
              color={ink.foreground}
              onMove={next => store.getState().setUnpluggedListener(next)}
              onTurn={facingDeg =>
                store.getState().setUnpluggedListener({ facingDeg })
              }
            />
          </View>
        ) : null}
      </View>
      <Button
        variant="outline"
        disabled={locked}
        onPress={() => store.getState().resetUnpluggedArrangement()}
      >
        {t('inspector.unpluggedReset')}
      </Button>
    </View>
  );
}

function TrackMarker({
  track,
  point,
  canvasSize,
  locked,
  ink,
  onDrag,
}: {
  track: Pick<Track, 'id' | 'name' | 'instrumentName' | 'clef' | 'midiProgram'>;
  point: { x: number; z: number };
  canvasSize: number;
  locked: boolean;
  ink: string;
  onDrag: (next: { x: number; z: number }) => void;
}) {
  const pointRef = useRef(point);
  pointRef.current = point;
  const liveRef = useRef<{ x: number; z: number } | null>(null);

  const { live, update, finish } = useThrottledDrag<{ x: number; z: number }>(
    onDrag,
  );
  liveRef.current = live;

  const pan = Gesture.Pan()
    .enabled(!locked)
    .onChange(e => {
      const { dx, dz } = pixelsToStageDelta(e.changeX, e.changeY, canvasSize);
      const base = liveRef.current ?? pointRef.current;
      update({ x: base.x + dx, z: base.z + dz });
    })
    .onEnd(() => {
      if (liveRef.current) finish(liveRef.current);
    });

  const rendered = live ?? point;
  const pixels = toPixels(rendered, canvasSize);
  const letter = track.instrumentName.trim().charAt(0).toUpperCase();

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityLabel={track.name}
        style={{
          position: 'absolute',
          left: pixels.x - MIN_TOUCH_TARGET / 2,
          top: pixels.y - MIN_TOUCH_TARGET / 2,
          width: MIN_TOUCH_TARGET,
          height: MIN_TOUCH_TARGET,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          className="bg-card border-border border"
          style={{
            width: ICON_SIZE + 10,
            height: ICON_SIZE + 10,
            borderRadius: (ICON_SIZE + 10) / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <InstrumentIcon track={track} size={ICON_SIZE} color={ink} />
        </View>
        {/*
          The letter is a label, not a control — it must not sit where it
          could intercept the drag. Sized to fit a real 14px character
          (`text-sm`, this app's own floor for anything but incidental
          marks — see `legibility.test.ts`), not shrunk to fit a smaller
          badge.
        */}
        <View
          pointerEvents="none"
          className="bg-foreground border-card"
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text className="text-background text-sm font-semibold leading-none">
            {letter}
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

function ListenerMarker({
  originRef,
  listener,
  canvasSize,
  locked,
  label,
  handleLabel,
  color,
  onMove,
  onTurn,
}: {
  /** The canvas's screen origin — see `UnpluggedTab`'s own comment on why the turn gesture needs it. */
  originRef: RefObject<{ x: number; y: number }>;
  listener: { x: number; z: number; facingDeg: number };
  canvasSize: number;
  locked: boolean;
  label: string;
  handleLabel: string;
  color: string;
  onMove: (next: { x: number; z: number }) => void;
  onTurn: (facingDeg: number) => void;
}) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  const bodyThrottle = useThrottledDrag<{ x: number; z: number }>(onMove);
  const bodyLiveRef = useRef<{ x: number; z: number } | null>(null);
  bodyLiveRef.current = bodyThrottle.live;

  const bodyPan = Gesture.Pan()
    .enabled(!locked)
    .onChange(e => {
      const { dx, dz } = pixelsToStageDelta(e.changeX, e.changeY, canvasSize);
      const base = bodyLiveRef.current ?? {
        x: listenerRef.current.x,
        z: listenerRef.current.z,
      };
      bodyThrottle.update({ x: base.x + dx, z: base.z + dz });
    })
    .onEnd(() => {
      if (bodyLiveRef.current) bodyThrottle.finish(bodyLiveRef.current);
    });

  const turnThrottle = useThrottledDrag<number>(onTurn);
  const turnLiveRef = useRef<number | null>(null);
  turnLiveRef.current = turnThrottle.live;

  /**
   * The listener's facing, tracked from the finger's *current* screen
   * position relative to the listener's fixed centre — never from an
   * accumulated delta. A delta-based drag was the earlier bug: each frame
   * recomputed the triangle's "current" offset from `facingDeg` via trig
   * and then added a delta to *that*, so the angle compounded one frame's
   * rounding into the next rather than ever being re-derived from where
   * the finger actually is. This instead asks one question, fresh, on
   * every event: "at this exact finger position, what bearing is that from
   * the centre?" — which cannot drift, because it never depends on its own
   * previous answer. `e.absoluteX`/`absoluteY` are screen-absolute
   * regardless of which view the gesture is attached to; `originRef` is
   * what converts that back to this canvas's own coordinates.
   */
  const bearingAt = useCallback(
    (absoluteX: number, absoluteY: number): number | null => {
      const center = toPixels(
        { ...listenerRef.current, ...(bodyLiveRef.current ?? {}) },
        canvasSize,
      );
      const relX = absoluteX - originRef.current.x - center.x;
      const relY = absoluteY - originRef.current.y - center.y;
      if (relX === 0 && relY === 0) return null;
      return (Math.atan2(relX, -relY) * 180) / Math.PI;
    },
    [canvasSize, originRef],
  );

  const handlePan = Gesture.Pan()
    .enabled(!locked)
    .onChange(e => {
      const facingDeg = bearingAt(e.absoluteX, e.absoluteY);
      if (facingDeg !== null) turnThrottle.update(facingDeg);
    })
    .onEnd(e => {
      const facingDeg = bearingAt(e.absoluteX, e.absoluteY);
      turnThrottle.finish(
        facingDeg ?? turnLiveRef.current ?? listener.facingDeg,
      );
    });

  const renderedListener = {
    ...listener,
    ...(bodyThrottle.live ?? {}),
    facingDeg: turnThrottle.live ?? listener.facingDeg,
  };
  const pixels = toPixels(renderedListener, canvasSize);
  const facingRad = (renderedListener.facingDeg * Math.PI) / 180;
  const handlePixels = toPixels(
    {
      x: renderedListener.x + HANDLE_DISTANCE * Math.sin(facingRad),
      z: renderedListener.z + HANDLE_DISTANCE * Math.cos(facingRad),
    },
    canvasSize,
  );

  return (
    <>
      <GestureDetector gesture={bodyPan}>
        <View
          accessibilityLabel={label}
          style={{
            position: 'absolute',
            left: pixels.x - MIN_TOUCH_TARGET / 2,
            top: pixels.y - MIN_TOUCH_TARGET / 2,
            width: MIN_TOUCH_TARGET,
            height: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: LISTENER_SIZE,
              height: LISTENER_SIZE,
              borderRadius: LISTENER_SIZE / 2,
              backgroundColor: color,
            }}
          />
        </View>
      </GestureDetector>
      {/*
        The facing indicator: a triangle, not a dot, so which way the
        listener faces reads at a glance. `rotate: 0deg` points it straight
        up, which is this stage's "dead ahead" (`+z`) — the same convention
        `facingDeg` itself uses, so the visual rotation and the stored angle
        never need reconciling.
      */}
      <GestureDetector gesture={handlePan}>
        <View
          accessibilityLabel={handleLabel}
          style={{
            position: 'absolute',
            left: handlePixels.x - MIN_TOUCH_TARGET / 2,
            top: handlePixels.y - MIN_TOUCH_TARGET / 2,
            width: MIN_TOUCH_TARGET,
            height: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 7,
              borderRightWidth: 7,
              borderBottomWidth: 12,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: color,
              transform: [{ rotate: `${renderedListener.facingDeg}deg` }],
            }}
          />
        </View>
      </GestureDetector>
    </>
  );
}
