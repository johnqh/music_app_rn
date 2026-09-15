/**
 * What the score view tells the canvas.
 *
 * The canvas is music_drawing's and decides everything geometric; what can go
 * wrong here is the wiring — and three pieces of it were missing on this side
 * while the web had them. Hidden tracks were still drawn, notes an instrument
 * cannot play were never marked, and the caret was a hardcoded red that
 * ignored the theme. Each is pinned against a recording canvas.
 */
import { jest } from '@jest/globals';
import type { ReactNode } from 'react';
import {
  DARK_RENDER_THEME,
  outOfRangeNoteIds,
} from '@sudobility/music_drawing';
import { createEmptyScore, displayScore } from '@sudobility/music_types';
import type { Pitch, Score } from '@sudobility/music_types';
import { twinkleScore } from '@sudobility/music_types/test';
import { renderWithApp } from '@/test/render';

type Call = { method: string; args: unknown[] };
const mockCalls: Call[] = [];
const mockCursorColors: string[] = [];
const mockScanned: (Score | null)[] = [];

jest.mock('./useScoreCanvas', () => {
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      mockCalls.push({ method, args });
    };
  const canvas = {
    setScore: record('setScore'),
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
  return {
    useScoreCanvas: () => ({
      canvas,
      picture: null,
      cursor: {
        path: null,
        motion: { tick: 0, atMs: 0, ticksPerSecond: 0 },
        id: 0,
      },
    }),
  };
});

// Measured from the first render: the view only sizes the canvas once it
// knows its own size, and a test renderer measures nothing.
jest.mock('@/features/layout/useContainerSize', () => ({
  useContainerSize: () => ({
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
    // Recorded, so the test can say *which* score was scanned.
    outOfRangeNoteIds: (score: Score | null) => {
      mockScanned.push(score);
      return actual.outOfRangeNoteIds(score);
    },
  };
});

const { ScrollingScore } =
  require('./ScrollingScore') as typeof import('./ScrollingScore');

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
  mockScanned.length = 0;
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

  it('marks out-of-range notes from the stored score, not the drawn one', () => {
    /*
      In written pitch the lens moves a clarinet up a tone, so scanning the
      drawn score would judge the part a tone away from where it sounds. The
      ids survive the lens, which is why the stored scan is the right one.
    */
    const score = clarinetScore();
    const expected = outOfRangeNoteIds(score).ids;
    expect(expected.length).toBeGreaterThan(0);
    renderWithApp(<ScrollingScore score={score} pitchDisplay="written" />);
    expect(lastCall('setOutOfRangeNotes')?.[0]).toEqual(expected);
    // The lens really did produce a different score, and it was not scanned.
    expect(displayScore(score, 'written')).not.toBe(score);
    expect(mockScanned.at(-1)).toBe(score);
  });

  it('colours the caret from the render theme', () => {
    const score = createEmptyScore({ title: 'Test', measures: 1 });
    renderWithApp(<ScrollingScore score={score} theme={DARK_RENDER_THEME} />);
    expect(mockCursorColors.at(-1)).toBe(DARK_RENDER_THEME.caret);
  });
});
