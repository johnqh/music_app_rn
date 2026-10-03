/**
 * Toasts: where the libraries' messages reach the reader.
 *
 * Every store built from a `StoreContext` with a `toasts` sink sends its toasts
 * here — a failed autosave, a playback error, a failed generation job, an edit
 * refused because the note is out of the instrument's range, and a refused
 * paste with the Undo that gets the cut notes back. Before this the native app
 * had no sink, so every one of those was pushed into a store list that nothing
 * read: a save could fail and the only sign was a dirty dot.
 *
 * **A queue beside the stores, not a list inside each.** music_lib's sink exists
 * for exactly this host: with a store per document, a list in each store would
 * need a renderer per document and would strand a failure raised by a tab that
 * is not in front. One queue for the app shows whichever document spoke.
 *
 * Shaped like the web's `Toasts`: one toast at a time, oldest first, errors
 * lingering longest so a failure is not missed, and an action that runs and
 * then dismisses. The id arrives already assigned — the store hands it back to
 * its caller, which is how a refused paste's Undo dismisses its own toast.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, touchSlop } from '@sudobility/components-rn';
import type { ToastSink } from '@sudobility/music_lib';
import type { Toast } from '@sudobility/music_types';
import { useSafeAreaInsets } from '@/platform/SafeArea';
import { useSafeEdges } from '@/platform/safe-edges';

export type ToastQueue = ToastSink & {
  /** The toasts waiting, oldest first. A stable reference between changes. */
  readonly toasts: readonly Toast[];
  subscribe(listener: () => void): () => void;
};

export function createToastQueue(): ToastQueue {
  let toasts: readonly Toast[] = [];
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    get toasts() {
      return toasts;
    },
    push(toast) {
      toasts = [...toasts, toast];
      changed();
    },
    dismiss(id) {
      const next = toasts.filter(t => t.id !== id);
      if (next.length === toasts.length) return;
      toasts = next;
      changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The app's queue, handed to every document store by the composition root. */
export const appToasts = createToastQueue();

/** How long each severity stays up. A failure lingers so it is not missed. */
export const AUTO_HIDE_MS: Record<Toast['severity'], number> = {
  error: 8000,
  warning: 6000,
  success: 4000,
  info: 4000,
};

/*
  Complete class literals per severity: Tailwind extracts classes by scanning
  text, so a class assembled from parts is never generated.
*/
const SEVERITY_CLASS: Record<Toast['severity'], string> = {
  error: 'bg-destructive flex-row items-center gap-3 rounded-md px-4 py-3',
  warning: 'bg-warning flex-row items-center gap-3 rounded-md px-4 py-3',
  success: 'bg-success flex-row items-center gap-3 rounded-md px-4 py-3',
  info: 'bg-primary flex-row items-center gap-3 rounded-md px-4 py-3',
};

/*
  The ink that goes with each surface. It was `primary-foreground` on all
  four, which is right only by coincidence: on the warning surface in light
  mode the theme's own pairing is `warning-foreground`, and a theme whose
  warning is pale would have put white on it.
*/
const MESSAGE_CLASS: Record<Toast['severity'], string> = {
  error: 'text-destructive-foreground flex-shrink text-sm',
  warning: 'text-warning-foreground flex-shrink text-sm',
  success: 'text-success-foreground flex-shrink text-sm',
  info: 'text-primary-foreground flex-shrink text-sm',
};
const ACTION_CLASS: Record<Toast['severity'], string> = {
  error: 'text-destructive-foreground text-sm font-semibold',
  warning: 'text-warning-foreground text-sm font-semibold',
  success: 'text-success-foreground text-sm font-semibold',
  info: 'text-primary-foreground text-sm font-semibold',
};
const CLOSE_CLASS: Record<Toast['severity'], string> = {
  error: 'text-destructive-foreground text-lg',
  warning: 'text-warning-foreground text-lg',
  success: 'text-success-foreground text-lg',
  info: 'text-primary-foreground text-lg',
};

/** The toast's distance from the screen's edges — `bottom-4`, `left-4`, `right-4`. */
const TOAST_MARGIN = 16;

export function Toasts({ queue = appToasts }: { queue?: ToastQueue }) {
  const { t } = useTranslation();
  const toasts = useSyncExternalStore(
    listener => queue.subscribe(listener),
    () => queue.toasts,
  );
  const current = toasts[0] ?? null;
  // Clear of whatever the one rule (`useSafeEdges`) clears: the notch's side
  // on a phone, the home indicator on a tablet. A toast 16 points from the
  // edge of a phone held notch-left sat under the camera housing.
  const insets = useSafeAreaInsets();
  const edges = useSafeEdges();

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(
      () => queue.dismiss(current.id),
      AUTO_HIDE_MS[current.severity] ?? AUTO_HIDE_MS.info,
    );
    return () => clearTimeout(timer);
  }, [current, queue]);

  if (!current) return null;
  const dismiss = () => queue.dismiss(current.id);
  const runAction = () => {
    current.action?.onClick();
    dismiss();
  };
  const severity =
    current.severity in SEVERITY_CLASS ? current.severity : 'info';
  const assertive =
    current.severity === 'error' || current.severity === 'warning';

  return (
    <View
      pointerEvents="box-none"
      className="absolute items-start"
      style={{
        bottom: TOAST_MARGIN + (edges.bottom ? insets.bottom : 0),
        left: TOAST_MARGIN + (edges.left ? insets.left : 0),
        right: TOAST_MARGIN + (edges.right ? insets.right : 0),
      }}
    >
      <View
        accessibilityRole={assertive ? 'alert' : 'text'}
        accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
        className={SEVERITY_CLASS[severity]}
      >
        <Text className={MESSAGE_CLASS[severity]}>{current.message}</Text>
        {current.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={touchSlop(0, 0)}
            onPress={runAction}
            // macOS has no synthesized-touch fallback for an assistive press,
            // so a VoiceOver activation reaches a Pressable only through
            // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
            onAccessibilityTap={runAction}
          >
            <Text className={ACTION_CLASS[severity]}>
              {current.action.label}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={touchSlop(0, 0)}
          onPress={dismiss}
          onAccessibilityTap={dismiss}
        >
          <Text className={CLOSE_CLASS[severity]}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}
