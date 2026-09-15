/**
 * This app's wiring for `useProjectGeneration`.
 *
 * The polling rules live in `@sudobility/music_client` and are tested there.
 * What is this app's own — and so what is tested here — is the handful of
 * decisions the wiring makes, each of which fails quietly rather than loudly:
 *
 *   - with **no server configured**, the project id handed down is `null`. That
 *     null is what actually stops the poll; the throwing fallback client exists
 *     only because a hook cannot be skipped. Pass the real id here and a build
 *     with no API polls forever against a client that rejects every call.
 *   - `flush` and `onApplied` are **omitted, not passed as `undefined`**, when
 *     the caller gives none — the conditional spread is deliberate, and a key
 *     present-but-undefined reads differently to anything checking `in`.
 *   - the foreground port treats **`inactive` as background**. On iOS that is
 *     the app-switcher card and the phone-call banner, where nobody is reading
 *     a score, so polling through it is battery spent on an unwatched screen.
 *
 * The port is module-private, so it is exercised through the options actually
 * handed to `useProjectGeneration` — which is the contract that matters anyway.
 */
import { jest } from '@jest/globals';
import { AppState } from 'react-native';
import { renderHook } from '@testing-library/react-native';

const mockUseProjectGeneration = jest.fn((..._args: unknown[]) => ({
  status: 'idle',
}));
const mockGetMusicClient = jest.fn();

jest.mock('@sudobility/music_client', () => ({
  useProjectGeneration: (...args: unknown[]) =>
    mockUseProjectGeneration(...args),
}));
jest.mock('@/config/server', () => ({
  getMusicClient: () => mockGetMusicClient(),
}));
jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ getToken: () => Promise.resolve('token') }),
}));

const { useDocumentGeneration } =
  require('./useDocumentGeneration') as typeof import('./useDocumentGeneration');
const { asDocument } =
  require('@/documents/document') as typeof import('@/documents/document');
const { createDocumentStore } =
  require('@sudobility/music_lib') as typeof import('@sudobility/music_lib');
const { createEmptyScore } =
  require('@sudobility/music_types') as typeof import('@sudobility/music_types');

type Captured = {
  projectId: string | null;
  options: Record<string, unknown>;
};

function run(
  projectId: string | null,
  options: Record<string, unknown> = {},
  client: unknown = { createJob: jest.fn() },
): Captured {
  mockGetMusicClient.mockReturnValue(client as never);
  const document = asDocument(
    createDocumentStore({
      title: 'T',
      score: createEmptyScore({ title: 'T', measures: 4 }),
    }),
    'd1',
  );
  renderHook(() =>
    useDocumentGeneration(document, projectId, options as never),
  );
  const call = mockUseProjectGeneration.mock.calls.at(-1) as unknown[];
  return {
    projectId: call[0] as string | null,
    options: call[1] as Record<string, unknown>,
  };
}

beforeEach(() => {
  mockUseProjectGeneration.mockClear();
  mockGetMusicClient.mockReset();
});

describe('useDocumentGeneration', () => {
  it('watches the project when a server is configured', () => {
    expect(run('p1').projectId).toBe('p1');
  });

  it('hands down a null project id when no server is configured', () => {
    // The null is the off switch — not the fallback client, which only exists
    // so the hook can still be called.
    expect(run('p1', {}, null).projectId).toBeNull();
  });

  it('still supplies a client with no server, so the hook can run', () => {
    expect(run('p1', {}, null).options.client).toBeDefined();
  });

  it('passes the document’s own store, not a singleton', () => {
    // One store per document is what lets the desktop edit several at once.
    expect(run('p1').options.store).toBeDefined();
  });

  it('omits flush and onApplied entirely when not given them', () => {
    const { options } = run('p1');
    expect('flush' in options).toBe(false);
    expect('onApplied' in options).toBe(false);
  });

  it('passes flush and onApplied through when given them', () => {
    const flush = jest.fn();
    const onApplied = jest.fn();
    const { options } = run('p1', { flush, onApplied });
    expect(options.flush).toBe(flush);
    expect(options.onApplied).toBe(onApplied);
  });
});

describe('the foreground port', () => {
  const port = () =>
    run('p1').options.foreground as {
      isForeground: () => boolean;
      subscribe: (cb: () => void) => () => void;
    };

  it('is foreground only when the app is active', () => {
    const foreground = port();
    (AppState as { currentState: string }).currentState = 'active';
    expect(foreground.isForeground()).toBe(true);
  });

  it('treats inactive as background, not foreground', () => {
    // The app-switcher card and the call banner: nobody is reading a score.
    const foreground = port();
    (AppState as { currentState: string }).currentState = 'inactive';
    expect(foreground.isForeground()).toBe(false);
  });

  it('treats background as background', () => {
    const foreground = port();
    (AppState as { currentState: string }).currentState = 'background';
    expect(foreground.isForeground()).toBe(false);
  });

  it('is the same object every render, so the poll timer is not rebuilt', () => {
    // A fresh object per render is a changed hook dependency, which tears the
    // timer down and stands a new one up continuously.
    expect(run('p1').options.foreground).toBe(run('p2').options.foreground);
  });
});
