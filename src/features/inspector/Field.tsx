/**
 * A labelled row in the property sheet.
 *
 * The web inspector puts the label above its control in a narrow column; this
 * does the same, so the two read alike. Kept here rather than inlined because
 * four tabs use it and a panel whose rows are each spaced slightly differently
 * looks broken in a way nobody can point at.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@sudobility/components-rn';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-1">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      {children}
      {hint ? (
        <Text className="text-muted-foreground text-sm">{hint}</Text>
      ) : null}
    </View>
  );
}

/** What a tab shows when nothing is selected. */
export function EmptyTab({ message }: { message: string }) {
  return (
    <View className="items-center py-6">
      <Text className="text-muted-foreground text-base">{message}</Text>
    </View>
  );
}
