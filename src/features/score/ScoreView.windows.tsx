/** Windows score surface backed by the shared renderer's SVG adapter. */
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSignal } from './useScoreCanvas';
import type { Signal } from './useScoreCanvas';

export type ScoreViewProps = {
  picture: Signal<string | null>;
  height: number;
};

export function ScoreView({ picture: pictureSignal, height }: ScoreViewProps) {
  const picture = useSignal(pictureSignal);
  return (
    <View style={[styles.fill, { height }]}>
      {picture ? <SvgXml xml={picture} width="100%" height={height} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
});
