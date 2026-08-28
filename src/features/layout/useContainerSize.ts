/**
 * The size of the view this is attached to.
 *
 * **Not `useWindowDimensions`.** On macOS that reports the *display*, not the
 * app's window — measured: a 1280pt window on a 3440pt screen laid the keyboard
 * out at 3440 and clipped it, so the app showed three octaves of an
 * eighty-eight-key keyboard and a score whose bars ran off the right edge. The
 * same bug appears on iPad in Split View, and in any resizable window.
 *
 * `onLayout` reports what the view actually got, which is the honest number on
 * every platform, and it updates on resize — which `useWindowDimensions` does
 * not do for a window that is not fullscreen.
 */
import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export type ContainerSize = { width: number; height: number };

export type Measured = {
  size: ContainerSize;
  /** Spread onto the View whose size is wanted. */
  onLayout: (event: LayoutChangeEvent) => void;
  /** False until the first layout pass; nothing should draw before then. */
  measured: boolean;
};

export function useContainerSize(): Measured {
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize(previous =>
      // Guarded: `onLayout` fires on every layout pass, and setting an equal
      // size would re-render the score renderer for nothing.
      previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  }, []);

  return { size, onLayout, measured: size.width > 0 && size.height > 0 };
}
