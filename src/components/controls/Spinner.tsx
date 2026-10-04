/**
 * A loading spinner drawn in the theme's accent.
 *
 * The library's `Spinner` passes `ActivityIndicator` a fixed `colors.raw`
 * blue in both themes (its own TODO says so): off-palette under Swiss, whose
 * accent is red, and the web spinner beside it is the theme's `primary`. An
 * `ActivityIndicator` takes its colour as a prop rather than a class, so the
 * token is resolved by `useNotationInk()`. Same name and role as the
 * library's, so a call site changes only its import; drop this once the
 * library's follows the theme.
 */
import { ActivityIndicator, View } from 'react-native';
import { useNotationInk } from '@/components/icons/notation-ink';

export function Spinner({
  size = 'small',
  accessibilityLabel = 'Loading',
}: {
  size?: 'small' | 'large';
  accessibilityLabel?: string;
}) {
  const ink = useNotationInk();
  return (
    <View
      className="items-center justify-center"
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <ActivityIndicator size={size} color={ink.primary} />
    </View>
  );
}
