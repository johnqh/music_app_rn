import { describe, expect, it } from 'vitest';
import { openLinkFor, openLinkUrl } from './open-links';

describe('openLinkFor', () => {
  it('opens a document from moosiac://open?path=', () => {
    expect(
      openLinkFor('moosiac://open?path=%2FUsers%2Fme%2FSong%20One.moo'),
    ).toEqual({ kind: 'document', path: '/Users/me/Song One.moo' });
  });

  it('still opens a document saved under the old extension', () => {
    expect(openLinkFor('moosiac://open?path=/a/Old.moosiac')).toEqual({
      kind: 'document',
      path: '/a/Old.moosiac',
    });
  });

  it('imports what the importers read, by extension, case-insensitively', () => {
    expect(openLinkFor('moosiac://open?path=/a/b.MID')).toEqual({
      kind: 'import',
      format: 'midi',
      path: '/a/b.MID',
    });
    expect(openLinkFor('moosiac://open?path=/a/b.musicxml')).toMatchObject({
      format: 'musicxml',
    });
    expect(openLinkFor('moosiac://open?path=/a/b.xm')).toMatchObject({
      format: 'tracker',
    });
  });

  it('accepts a file URL, which is how Finder hands a file over', () => {
    expect(openLinkFor('file:///Users/me/My%20Song.moo')).toEqual({
      kind: 'document',
      path: '/Users/me/My Song.moo',
    });
  });

  it('refuses anything it cannot open rather than guessing', () => {
    expect(openLinkFor('moosiac://open?path=/etc/passwd')).toBeNull();
    expect(openLinkFor('moosiac://open?path=relative/a.moo')).toBeNull();
    expect(openLinkFor('moosiac://open')).toBeNull();
    expect(openLinkFor('moosiac://delete?path=/a.moo')).toBeNull();
    expect(openLinkFor('https://example.com/a.moo')).toBeNull();
    expect(openLinkFor('not a url')).toBeNull();
  });

  it('round-trips a path through the link it builds', () => {
    const path = '/tmp/a b/c&d=e?.mid';
    expect(openLinkFor(openLinkUrl(path))).toEqual({
      kind: 'import',
      format: 'midi',
      path,
    });
  });
});
