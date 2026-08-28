import { describe, expect, it, vi } from 'vitest';
import { createDocument } from './document.js';
import { exportDocument, exportFilename } from './export.js';
import type { ScoreExporter } from './export.js';
import {
  changeMetadataCommand,
  createEmptyScore,
} from '@sudobility/music_types';

function doc(title: string) {
  return createDocument({
    id: 'd',
    title: 'file name',
    score: createEmptyScore({ title }),
  });
}

type Recorded = {
  midi: string[];
  xml: string[];
  tracker: string[];
  audio: string[];
};

function exporter(): ScoreExporter & Recorded {
  const midi: string[] = [];
  const xml: string[] = [];
  const tracker: string[] = [];
  const audio: string[] = [];
  return {
    midi,
    xml,
    tracker,
    audio,
    saveMidi: vi.fn(async (_s, f: string) => void midi.push(f)),
    saveMusicXml: vi.fn(async (_s, f: string) => void xml.push(f)),
    saveTracker: vi.fn(async (_m, f: string) => void tracker.push(f)),
    saveAudio: vi.fn(async (_s, _r, _fmt, f: string) => void audio.push(f)),
  };
}

describe('exporting', () => {
  it('names the file after the score, not the document', async () => {
    const d = doc('String Quartet');
    // The document is called something else entirely; the music wins.
    const e = exporter();
    await exportDocument(d, e, 'midi');
    expect(e.midi).toEqual(['String Quartet.mid']);
  });

  it('follows a retitled score', async () => {
    const d = doc('String Quartet');
    d.store
      .getState()
      .dispatchCommand(
        changeMetadataCommand({ title: 'Wedding March' }, 'Retitle'),
      );
    const e = exporter();
    await exportDocument(d, e, 'musicxml');
    expect(e.xml).toEqual(['Wedding March.musicxml']);
  });

  it('makes a filename safe, and never empty', () => {
    const score = createEmptyScore({ title: 'A/B:C' });
    expect(exportFilename(score, 'midi')).toBe('A-B-C.mid');
    expect(exportFilename(createEmptyScore({ title: '  ' }), 'midi')).toBe(
      'Untitled.mid',
    );
  });
});

describe('the formats beyond notation', () => {
  it('writes a tracker module through music_io, not by hand', async () => {
    const d = doc('Jig');
    const e = exporter();
    await exportDocument(d, e, 'xm');
    expect(e.tracker).toEqual(['Jig.xm']);
  });

  it('refuses audio without a renderer rather than writing silence', async () => {
    /*
      Audio is the one format this app renders itself — a live synth in
      music_player, handed over as PCM — so a caller that forgot to supply one
      must fail loudly. Writing an empty file would look like a working export.
    */
    const d = doc('Jig');
    const e = exporter();
    await expect(exportDocument(d, e, 'wav')).rejects.toThrow(/renderer/i);
    expect(e.audio).toEqual([]);
  });

  it('hands the rendered samples to music_io to encode', async () => {
    const d = doc('Jig');
    const e = exporter();
    const render = vi.fn(async () => ({
      samples: new Float32Array([0, 1]),
      sampleRate: 44100,
    }));
    await exportDocument(d, e, 'wav', render);
    expect(render).toHaveBeenCalled();
    expect(e.audio).toEqual(['Jig.wav']);
  });
});
