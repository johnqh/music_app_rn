/**
 * Windows score surface placeholder.
 *
 * The shared native score surface currently depends on Skia, which does not
 * ship a Windows implementation. Keeping this fallback visible is safer than
 * importing Skia and failing during application startup.
 */
import { StyleSheet, Text, View } from 'react-native';

export type ScoreViewProps = {
  picture: unknown;
  height: number;
};

export function ScoreView({ height }: ScoreViewProps) {
  return (
    <View style={[styles.fill, { height }]} accessible accessibilityRole="text">
      <Text style={styles.message}>
        Score rendering is not available on Windows yet.
      </Text>
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
  message: {
    color: '#666666',
    maxWidth: 360,
    padding: 24,
    textAlign: 'center',
  },
});
