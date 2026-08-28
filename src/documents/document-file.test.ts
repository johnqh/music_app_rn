import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_FORMAT_VERSION,
  DocumentParseError,
  documentFilename,
  parseDocument,
  serializeDocument,
} from './document-file.js';
import { createEmptyScore } from '@sudobility/music_types';

const score = createEmptyScore({ title: 'Piece' });

describe('document files', () => {
  it('round-trips a score', () => {
    const text = serializeDocument({ title: 'Piece', score });
    const back = parseDocument(text);
    expect(back.title).toBe('Piece');
    expect(back.version).toBe(DOCUMENT_FORMAT_VERSION);
    expect(back.score.tracks).toHaveLength(score.tracks.length);
    expect(back.score.metadata.title).toBe(score.metadata.title);
  });

  it('refuses a file from a newer build rather than reading it hopefully', () => {
    const text = JSON.stringify({ version: 99, title: 'X', score });
    expect(() => parseDocument(text)).toThrow(DocumentParseError);
    expect(() => parseDocument(text)).toThrow(/newer version/i);
  });

  it('refuses anything that is not a document', () => {
    expect(() => parseDocument('not json')).toThrow(/invalid JSON/i);
    expect(() => parseDocument('null')).toThrow(DocumentParseError);
    expect(() => parseDocument('{}')).toThrow(/format version/i);
  });

  it('validates the score rather than trusting the file', () => {
    const text = JSON.stringify({
      version: 1,
      title: 'X',
      score: { tracks: 'nope' },
    });
    expect(() => parseDocument(text)).toThrow(/could not be read/i);
  });

  it('defaults a missing title rather than failing on one', () => {
    const text = JSON.stringify({ version: 1, score });
    expect(parseDocument(text).title).toBe('Untitled');
  });

  it('makes a filename safe on every platform', () => {
    expect(documentFilename('Wedding March')).toBe('Wedding March.moosiac');
    expect(documentFilename('A/B:C*D?')).toBe('A-B-C-D-.moosiac');
    expect(documentFilename('   ')).toBe('Untitled.moosiac');
  });
});
