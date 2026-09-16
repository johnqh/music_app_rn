/**
 * The score, drawn with Skia — the picture `ScoreCanvas` last recorded.
 *
 * Nothing about notation, layout or colour is decided here any more. The
 * canvas (music_drawing's `ScoreCanvas`, driven through `useScoreCanvas`)
 * decides what to paint and when, records the renderer's output into an
 * `SkPicture`, and this replays it. That split is what keeps a frame cheap: a
 * scroll or a colour change records one picture off React's render path, and
 * only this component re-renders to show it — it reads the picture from a
 * signal, so nothing above it does.
 *
 * **The first picture a freshly mounted canvas is handed can be lost, so it is
 * sent again.** `Canvas` ships a picture from a layout effect, through
 * reanimated's UI runtime (`runOnUI` → `SkiaViewApi.setJsiProperty`), which
 * lands on the main thread some time after the commit that created the view;
 * a picture that gets there before that view's drawing surface is ready is
 * dropped without a word, and there is no acknowledgement to wait for. On this
 * react-native-macos build that happened to about half of the score views that
 * painted **once** — which is every score shorter than the viewport, since a
 * sheet that needs no scrolling is painted a single time and never again.
 * Measured: the eight-bar starting score came back blank on one tab activation
 * in two, a long score never, and any second picture (a zoom, a resize) drew
 * it correctly.
 *
 * `ref.current.redraw()` was the previous attempt at this and cannot work: it
 * is `requestRedraw`, which asks the view to present the picture it *holds*,
 * and it holds none. What re-sends a picture is another `Canvas` render — the
 * element identity is what its layout effect watches — so that is what
 * `RESEND_FRAMES` does, once per frame for the first few frames of the view's
 * life. Two spare sends of one picture at mount, and nothing at all after
 * that: during playback, where a picture a frame is the cost that matters,
 * this is inert.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Picture, useCanvasSize } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { useSignal } from './useScoreCanvas';
import type { Signal } from './useScoreCanvas';

export type ScoreViewProps = {
  picture: Signal<SkPicture | null>;
  /** The view's real size, measured — never the display's. */
  height: number;
};

/**
 * How many frames after the first picture to send it again.
 *
 * Two, not one: a frame is what the mount needs to reach the main thread, and
 * the second is the margin — there is no signal back from the view saying a
 * picture arrived, so the only defence is to repeat it while the view is young.
 */
export const RESEND_FRAMES = 2;

export function ScoreView({ picture: pictures, height }: ScoreViewProps) {
  const picture = useSignal(pictures);
  const { ref } = useCanvasSize();

  /*
    Bumped once a frame for the first `RESEND_FRAMES` frames after a picture
    first exists, purely to re-render: a new render is a new `Picture` element,
    which is what makes `Canvas` send it again. It is the `key` as well, so the
    send cannot be collapsed as an unchanged node.
  */
  const [resend, setResend] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!picture || started.current) return;
    started.current = true;
    let frame = 0;
    let id = requestAnimationFrame(function again() {
      frame += 1;
      setResend(frame);
      if (frame < RESEND_FRAMES) id = requestAnimationFrame(again);
    });
    return () => cancelAnimationFrame(id);
  }, [picture]);

  return (
    <View style={[styles.fill, { height }]}>
      <Canvas ref={ref} style={styles.fill}>
        {picture ? <Picture key={resend} picture={picture} /> : null}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, width: '100%' } });
