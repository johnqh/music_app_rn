/** Windows score surface backed by the shared renderer's SVG adapter. */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSignal } from './useScoreCanvas';
import type { Signal, SvgPicture } from './useScoreCanvas.windows';

export type ScoreViewProps = {
  picture: Signal<SvgPicture | null>;
  height: number;
};

export function ScoreView({ picture: pictureSignal, height }: ScoreViewProps) {
  const picture = useSignal(pictureSignal);
  return (
    <View style={[styles.fill, { height }]}>
      {picture ? (
        <>
          <SvgLayer xml={picture.base} height={height} />
          <SvgLayer xml={picture.overlay} height={height} />
        </>
      ) : null}
    </View>
  );
}

// Preserve the native base tree when only the playing note colors change.
const SvgLayer = memo(function SvgLayer({
  xml,
  height,
}: {
  xml: string;
  height: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <SvgXml xml={xml} width="100%" height={height} />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
});
