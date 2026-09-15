/**
 * What the score view tells the canvas.
 *
 * The canvas is music_drawing's and decides everything geometric; what can go
 * wrong here is the wiring — and three pieces of it were missing on this side
 * while the web had them. Hidden tracks were still drawn, notes an instrument
 * cannot play were never marked, and the caret was a hardcoded red that
 * ignored the theme. Each is pinned against a recording canvas.
 *
 * And one thing about *when*: a new picture, cursor or scroll offset must not
 * re-render the score view. During playback those change on every note, and a
 * re-render per note was measured at 7% of the JavaScript thread.
 */
import { jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { act } from '@testing-library/react-native';
import { DARK_RENDER_THEME } from '@sudobility/music_drawing';
import { createEmptyScore } from '@sudobility/music_types';
import type { Pitch, Score } from '@sudobility/music_types';
import { twinkleScore } from '@sudobility/music_types/test';
import { renderWithApp } from '@/test/render';

type Call = { method: string; args: unknown[] };
const mockCalls: Call[] = [];
const mockCursorColors: string[] = [];
const mockRenders = { count: 0 };

jest.mock('./useScoreCanvas', () => {
  const actual = jest.requireActual(
    './useScoreCanvas',
  ) as typeof import('./useScoreCanvas');
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      mockCalls.push({ method, args });
    };
  const canvas = {
    setScore: record('setScore'),
    setStoredScore: record('setStoredScore'),
    setView: record('setView'),
    setActiveTrack: record('setActiveTrack'),
    setSelectedNotes: record('setSelectedNotes'),
    setSelectedMeasures: record('setSelectedMeasures'),
    setOutOfRangeNotes: record('setOutOfRangeNotes'),
    setScroll: record('setScroll'),
    setCursorTick: record('setCursorTick'),
    animateCursor: record('animateCursor'),
    setPlayingNotes: record('setPlayingNotes'),
    contentSize: () => ({ width: 800, height: 600 }),
    hitTest: () => null,
  };
  const signals = {
    picture: actual.createSignal<unknown>(null),
    cursor: actual.createSignal({
      path: null,
      motion: { tick: 0, atMs: 0, ticksPerSecond: 0 },
      id: 0,
    }),
    scroll: actual.createSignal({ left: 0, top: 0 }),
  };
  return {
    ...actual,
    mockSignals: signals,
    useScoreCanvas: () => ({ canvas, ...signals }),
  };
});

// Measured from the first render: the view only sizes the canvas once it
// knows its own size, and a test renderer measures nothing.
jest.mock('@/features/layout/useContainerSize', () => ({
  // Called once per render of the score view, which is what makes it a counter.
  useContainerSize: () => ({
    ...(mockRenders.count++, {}),
    size: { width: 800, height: 600 },
    onLayout: () => undefined,
    measured: true,
  }),
}));

jest.mock('./ScoreView', () => ({ ScoreView: () => null }));

jest.mock('./PlaybackCursor', () => ({
  PlaybackCursor: ({ color }: { color: string; children?: ReactNode }) => {
    mockCursorColors.push(color);
    return null;
  },
}));

jest.mock('@sudobility/music_drawing', () => {
  const actual = jest.requireActual(
    '@sudobility/music_drawing',
  ) as typeof import('@sudobility/music_drawing');
  // Playback is the shared binding's and has its own tests; here it would
  // reach for a player the test does not have.
  return {
    ...actual,
    bindPlaybackToCanvas: () => () => undefined,
  };
});

const { ScrollingScore } =
  require('./ScrollingScore') as typeof import('./ScrollingScore');
const { mockSignals } = require('./useScoreCanvas') as {
  mockSignals: {
    picture: { set: (next: unknown) => void };
    cursor: { set: (next: unknown) => void };
    scroll: { set: (next: { left: number; top: number }) => void };
  };
};

function lastCall(method: string): unknown[] | undefined {
  return [...mockCalls].reverse().find(call => call.method === method)?.args;
}

/**
 * A B-flat clarinet playing Twinkle, with its first note pushed far above the
 * top of the instrument.
 */
function clarinetScore(): Score {
  const base = twinkleScore();
  const track = base.tracks[0]!;
  const [first, ...rest] = track.measures;
  const voice = first!.voices[0]!;
  const [note, ...others] = voice.events;
  const tooHigh = {
    ...note!,
    pitch: { ...(note as { pitch: Pitch }).pitch, octave: 8 },
  } as typeof note;
  return {
    ...base,
    tracks: [
      {
        ...track,
        midiProgram: 71,
        instrumentName: 'Clarinet',
        measures: [
          { ...first!, voices: [{ ...voice, events: [tooHigh!, ...others] }] },
          ...rest,
        ],
      },
    ],
  };
}

beforeEach(() => {
  mockCalls.length = 0;
  mockCursorColors.length = 0;
  mockRenders.count = 0;
});

describe('ScrollingScore', () => {
  it('draws only the tracks it is given', () => {
    const score = createEmptyScore({ title: 'Test', measures: 2 });
    const ids = [score.tracks[0]!.id];
    renderWithApp(<ScrollingScore score={score} trackIds={ids} />);
    expect(lastCall('setView')?.[0]).toMatchObject({ trackIds: ids });
  });

  it('draws every track when no list is given', () => {
    const score = createEmptyScore({ title: 'Test', measures: 2 });
    renderWithApp(<ScrollingScore score={score} />);
    expect(lastCall('setView')?.[0]).not.toHaveProperty('trackIds');
  });

  it('hands the canvas the stored score and the reading mode, not a drawn score', () => {
    /*
      In written pitch the lens moves a clarinet up a tone, so marking notes
      from the drawn score would judge the part a tone away from where it
      sounds. The canvas applies the lens and scans the stored pitches itself
      (\`ScoreCanvas.setStoredScore\`, tested in music_drawing); what can go wrong
      here is handing it the wrong one.
    */
    const score = clarinetScore();
    renderWithApp(<ScrollingScore score={score} pitchDisplay="written" />);
    expect(lastCall('setStoredScore')).toEqual([score, 'written']);
    expect(lastCall('setScore')).toBeUndefined();
  });

  it('does not re-render for a new picture, cursor or scroll offset', () => {
    const score = createEmptyScore({ title: 'Test', measures: 2 });
    renderWithApp(<ScrollingScore score={score} />);
    const settled = mockRenders.count;
    act(() => {
      mockSignals.picture.set({});
      mockSignals.cursor.set({
        path: null,
        motion: { tick: 480, atMs: 0, ticksPerSecond: 960 },
        id: 1,
      });
      mockSignals.scroll.set({ left: 0, top: 120 });
    });
    expect(mockRenders.count).toBe(settled);
  });

  it('colours the caret from the render theme', () => {
    const score = createEmptyScore({ title: 'Test', measures: 1 });
    renderWithApp(<ScrollingScore score={score} theme={DARK_RENDER_THEME} />);
    expect(mockCursorColors.at(-1)).toBe(DARK_RENDER_THEME.caret);
  });
});
