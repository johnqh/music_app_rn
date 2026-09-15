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
import type { Toast } from '@sudobility/music_editing';
import type { ToastSink } from '@sudobility/music_lib';

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

export function Toasts({ queue = appToasts }: { queue?: ToastQueue }) {
  const { t } = useTranslation();
  const toasts = useSyncExternalStore(
    listener => queue.subscribe(listener),
    () => queue.toasts,
  );
  const current = toasts[0] ?? null;

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
  const assertive =
    current.severity === 'error' || current.severity === 'warning';

  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-4 left-4 right-4 items-start"
    >
      <View
        accessibilityRole={assertive ? 'alert' : 'text'}
        accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
        className={SEVERITY_CLASS[current.severity] ?? SEVERITY_CLASS.info}
      >
        <Text className="text-primary-foreground flex-shrink text-sm">
          {current.message}
        </Text>
        {current.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={touchSlop(0, 0)}
            onPress={() => {
              current.action?.onClick();
              dismiss();
            }}
          >
            <Text className="text-primary-foreground text-sm font-semibold">
              {current.action.label}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={touchSlop(0, 0)}
          onPress={dismiss}
        >
          <Text className="text-primary-foreground text-lg">×</Text>
        </Pressable>
      </View>
    </View>
  );
}
