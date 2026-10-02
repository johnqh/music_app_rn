import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScreenshotLink } from './screenshot-links';

describe('parseScreenshotLink', () => {
  it('reads a language-only link, with or without the trailing slash', () => {
    expect(parseScreenshotLink('moosiac:///en/')).toEqual({
      language: 'en',
      scene: null,
    });
    expect(parseScreenshotLink('moosiac:///zh-Hant')).toEqual({
      language: 'zh-Hant',
      scene: null,
    });
  });

  it('reads every editor option, and defaults the rest off', () => {
    expect(
      parseScreenshotLink(
        'moosiac:///de/editor?demo=1&keyboard=1&spatial=1&play=1&track=2&sheet=print',
      ),
    ).toEqual({
      language: 'de',
      scene: {
        screen: 'editor',
        demo: true,
        keyboard: true,
        spatial: true,
        play: true,
        track: 2,
        sheet: 'print',
      },
    });
    expect(parseScreenshotLink('moosiac:///en/editor')).toEqual({
      language: 'en',
      scene: {
        screen: 'editor',
        demo: false,
        keyboard: false,
        spatial: false,
        play: false,
        track: null,
        sheet: null,
      },
    });
  });

  it('ignores a sheet it does not know and a track that is not a count', () => {
    const link = parseScreenshotLink(
      'moosiac:///en/editor?sheet=export&track=0',
    );
    expect(link?.scene).toMatchObject({ sheet: null, track: null });
    expect(
      parseScreenshotLink('moosiac:///en/editor?track=-1')?.scene,
    ).toMatchObject({ track: null });
  });

  it('reads New Project, with Generate on or off', () => {
    expect(
      parseScreenshotLink('moosiac:///ja/projects/new?generate=1')?.scene,
    ).toEqual({ screen: 'new-project', generate: true });
    expect(parseScreenshotLink('moosiac:///ja/projects/new')?.scene).toEqual({
      screen: 'new-project',
      generate: false,
    });
  });

  it('leaves links that are not screenshot links alone', () => {
    expect(parseScreenshotLink('moosiac://open?path=/a/b.moo')).toBeNull();
    expect(parseScreenshotLink('moosiac:///en/settings')).toBeNull();
    expect(parseScreenshotLink('moosiac:///not a language/')).toBeNull();
    expect(parseScreenshotLink('https:///en/editor')).toBeNull();
  });

  it('reads every path the capture script will send', () => {
    // An entry is a path, or a path with the longer wait it needs.
    const paths = (
      JSON.parse(
        readFileSync(
          resolve(__dirname, '../../../app_store/paths.json'),
          'utf8',
        ),
      ) as (string | { path: string; delay?: number })[]
    ).map(entry => (typeof entry === 'string' ? entry : entry.path));
    const languages = JSON.parse(
      readFileSync(
        resolve(__dirname, '../../../app_store/languages.json'),
        'utf8',
      ),
    ) as string[];
    for (const language of languages) {
      expect(parseScreenshotLink(`moosiac:///${language}/`)).not.toBeNull();
      for (const path of paths) {
        expect(
          parseScreenshotLink(`moosiac:///${language}${path}`)?.scene,
          path,
        ).not.toBeNull();
      }
    }
  });
});
