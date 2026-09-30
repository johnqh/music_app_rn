/**
 * Text the reader can select and copy.
 *
 * For the two things in the app that exist to be copied — a new API key's
 * secret and a coupon's code — neither of which the library's `Text` can
 * offer: it takes no `selectable`. The platform's own `Text`, so a long press
 * raises the platform's own Copy.
 */
import { Text } from 'react-native';
import type { ReactNode } from 'react';

export function SelectableText({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Text selectable className={className}>
      {children}
    </Text>
  );
}
