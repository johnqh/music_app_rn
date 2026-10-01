/**
 * This app's wiring for `useProjectGeneration`.
 *
 * The rules — poll the *project* rather than the job, compare `updatedAt`
 * strictly, reload before unlocking, slow the cadence when nothing is running —
 * live in `@sudobility/music_client`, because they are rules about this server
 * and both apps obey them. What lives here is what only this app knows: which
 * store (a per-document one, not a singleton), which client, and how to tell
 * whether anybody is looking.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useProjectGeneration } from '@sudobility/music_client';
import type {
  ForegroundPort,
  GenerationClient,
  LiveGenerationFinal,
  ProjectGeneration,
} from '@sudobility/music_client';
import { InsufficientCreditsError } from '@sudobility/music_client';
import { getMusicClient } from '@/config/server';
import { useAuth } from '@/auth/AuthContext';
import { trackButtonClick, trackError, trackEvent } from '@/analytics';
import type { MusicDocument } from '@/documents/document';

/**
 * A native app is in the foreground when `AppState` says `active`.
 *
 * Module-level rather than built per render: it is passed as a hook dependency,
 * and a fresh object each render would tear down and rebuild the poll timer
 * continuously.
 *
 * `inactive` counts as background deliberately — on iOS that is the app-switcher
 * card and a phone call banner, where nobody is reading a score.
 */
const APP_FOREGROUND: ForegroundPort = {
  isForeground: () => AppState.currentState === 'active',
  subscribe: onForeground => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') onForeground();
    });
    return () => subscription.remove();
  },
};

export type UseDocumentGenerationOptions = {
  /** Called when the server's copy has moved on. Awaited before unlocking. */
  onApplied?: () => void | Promise<void>;
  /**
   * Called with a generation's final score when the live stream delivered
   * it. Awaited before unlocking; `onApplied` is then the polling fallback
   * rather than a second adoption.
   */
  onComplete?: (final: LiveGenerationFinal) => void | Promise<void>;
  /**
   * Writes any pending edit before the job starts.
   *
   * The job reads the *stored* score, so anything unwritten would be invisible
   * to it and then overwritten by its result. The editor passes the document
   * store's own `saveNow` — a no-op when nothing is dirty. An option rather
   * than read off the store because `useProjectGeneration` is music_client's
   * and knows no store library.
   */
  flush?: () => Promise<unknown> | unknown;
  /** Tests inject a stub; production uses the configured client. */
  client?: GenerationClient;
  /**
   * Raises the paywall when a start is refused for want of credits.
   *
   * Handed in rather than decided here, because the *remedy* is a screen and
   * this hook knows nothing about navigation. Returning true from
   * `onStartError` marks the failure handled, which is what leaves the inline
   * overlay message empty — the sheet is the report, and showing both would say
   * the same thing twice in two registers.
   */
  onInsufficientCredits?: () => void;
};

/**
 * Watches a project, or reports a permanently idle one when there is no server.
 *
 * A build with no API configured, or a document that is not a server project,
 * still has to answer "are you generating?" — and the honest answer is no,
 * rather than a hook that throws or a screen that has to check first.
 */
export function useDocumentGeneration(
  document: MusicDocument,
  projectId: string | null,
  options: UseDocumentGenerationOptions = {},
): ProjectGeneration {
  const { getToken } = useAuth();
  const configured = options.client ?? getMusicClient();

  /*
    A client that answers nothing, for a build with no server.

    `useProjectGeneration` must still be called — hooks cannot be skipped — so
    it is handed a client whose calls never happen, together with a null
    project id, which is what actually stops the poll.
  */
  const client = useMemo<GenerationClient>(
    () =>
      configured ??
      ({
        createJob: () => Promise.reject(new Error('No server configured.')),
        getJob: () => Promise.reject(new Error('No server configured.')),
        cancelJob: () => Promise.resolve(undefined),
        cancelProjectGeneration: () => Promise.resolve(undefined),
        getProjectStatus: () => Promise.reject(new Error('No server.')),
      } as unknown as GenerationClient),
    [configured],
  );

  /*
    The live stream, from the same server the client talks to. Only with a
    real client: a test's stub has no socket to open, and the hook opens none
    when no `live` is given.
  */
  const live = useMemo(() => {
    const baseUrl =
      configured &&
      'baseUrl' in configured &&
      typeof configured.baseUrl === 'string'
        ? configured.baseUrl
        : null;
    return baseUrl ? { baseUrl } : undefined;
  }, [configured]);

  const generation = useProjectGeneration(configured ? projectId : null, {
    store: document.store,
    client,
    getToken,
    foreground: APP_FOREGROUND,
    ...(live ? { live } : {}),
    ...(options.flush ? { flush: options.flush } : {}),
    ...(options.onApplied ? { onApplied: options.onApplied } : {}),
    ...(options.onComplete ? { onComplete: options.onComplete } : {}),
    /*
      A 402 is the one API refusal with an obvious remedy, so it raises the
      paywall rather than reporting a failure — and returning true marks it
      handled, which leaves the inline overlay message empty. The sheet is the
      report; showing both would say the same thing twice in two registers.

      `InsufficientCreditsError` is music_client's, used directly: a local
      `isInsufficientCredits` wrapper around one `instanceof` was a duplicate of
      the class itself.
    */
    onStartError: error => {
      if (!(error instanceof InsufficientCreditsError)) {
        trackError(
          error instanceof Error ? error.message : String(error),
          'generation_start_failed',
        );
        return false;
      }
      trackEvent('generation_insufficient_credits');
      options.onInsufficientCredits?.();
      return true;
    },
  });

  return useTrackedGeneration(generation);
}

/**
 * `generation`, reported to analytics: each start and cancel as it is pressed,
 * and the outcome read off the hook's own state — busy to ready with no
 * error is `generation_complete`, a new error is a failure. Read off the
 * state rather than a callback because a job can finish through the live
 * stream or through the poll, and the state is what both arrive at.
 */
function useTrackedGeneration(
  generation: ProjectGeneration,
): ProjectGeneration {
  const { start: rawStart, cancel: rawCancel, generating, error } = generation;
  const wasGenerating = useRef(generating);
  useEffect(() => {
    if (wasGenerating.current && !generating && !error) {
      trackEvent('generation_complete');
    }
    wasGenerating.current = generating;
  }, [generating, error]);
  useEffect(() => {
    if (error) trackError(error, 'generation_failed');
  }, [error]);

  const start = useCallback<ProjectGeneration['start']>(
    (kind, request) => {
      trackButtonClick('generate', { kind });
      return rawStart(kind, request);
    },
    [rawStart],
  );
  const cancel = useCallback(() => {
    trackButtonClick('generation_cancel');
    return rawCancel();
  }, [rawCancel]);
  return useMemo(
    () => ({ ...generation, start, cancel }),
    [generation, start, cancel],
  );
}
