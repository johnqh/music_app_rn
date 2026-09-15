/**
 * The score, drawn with Skia — the picture `ScoreCanvas` last recorded.
 *
 * Nothing about notation, layout or colour is decided here any more. The
 * canvas (music_drawing's `ScoreCanvas`, driven through `useScoreCanvas`)
 * decides what to paint and when, records the renderer's output into an
 * `SkPicture`, and this replays it. That split is what keeps a frame cheap: a
 * scroll or a colour change records one picture off React's render path, and
 * React only swaps which picture is shown.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Picture, useCanvasSize } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';

export type ScoreViewProps = {
  picture: SkPicture | null;
  /** The view's real size, measured — never the display's. */
  height: number;
};

export function ScoreView({ picture, height }: ScoreViewProps) {
  /*
    A picture handed to a surface that does not exist yet is never painted, and
    nothing re-renders on its own afterwards. `useCanvasSize` reports a size only
    once the native view is there, so redrawing then covers that frame.
  */
  const { ref, size } = useCanvasSize();
  useEffect(() => {
    if (size.width > 0 && size.height > 0) ref.current?.redraw();
  }, [ref, size.width, size.height, picture]);

  return (
    <View style={[styles.fill, { height }]}>
      <Canvas ref={ref} style={styles.fill}>
        {picture ? <Picture picture={picture} /> : null}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, width: '100%' } });
