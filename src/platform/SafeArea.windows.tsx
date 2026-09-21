import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { ViewProps } from 'react-native';

export function SafeAreaProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SafeAreaView({
  children,
  ...props
}: ViewProps & { children?: ReactNode }) {
  return <View {...props}>{children}</View>;
}

export function useSafeAreaInsets() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}
