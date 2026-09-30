/**
 * Which documentation topics have a figure, and how large it is drawn.
 *
 * A `Record` over the topic vocabulary, not a list of the topics that have
 * one: a topic added to `DOCS_TOPIC_IDS` fails to compile here until somebody
 * decides whether it gets a picture. `null` is that decision made. The
 * reference topics are tables built from live data, and a picture of a table
 * is a copy of it that goes stale; `sharing` has none because a snapshot
 * belongs to a project on the server, and the figures are captured from a
 * document that has never been there.
 *
 * These are this app's own pictures, captured from it: the web's docs show
 * the web's. The words under them are shared (`docs.<topic>.figure`), which
 * is why they say what the element is and not which app drew it.
 *
 * The sizes are points. The files are twice that in pixels, and stating the
 * size here is what gives the image its shape before it has loaded — an
 * `Image` with no size is no size. `figures.test.ts` reads each file's header
 * and holds this table to it.
 *
 * The files themselves are in `figure-assets.ts`, apart from this table: a
 * `require` of a PNG is Metro's, and keeping it out of here is what lets the
 * table be read by a test that has no bundler.
 */
import type { DocsTopicId } from '@sudobility/music_types';

export type DocsFigure = {
  /** Width in points; the file is twice this in pixels. */
  width: number;
  /** Height in points; the file is twice this in pixels. */
  height: number;
};

export const DOCS_FIGURES: Record<DocsTopicId, DocsFigure | null> = {
  'getting-started': { width: 889, height: 441 },
  navigation: { width: 532, height: 53 },
  editor: { width: 786, height: 301 },
  notation: { width: 786, height: 45 },
  structure: { width: 279, height: 459 },
  tracks: { width: 279, height: 493 },
  playback: { width: 605, height: 47 },
  'midi-input': { width: 786, height: 122 },
  inspector: { width: 279, height: 459 },
  generation: { width: 889, height: 652 },
  sharing: null,
  settings: { width: 1210, height: 355 },
  shortcuts: null,
  instruments: null,
  formats: null,
  limits: null,
};

/** The locale key for what a topic's figure shows. */
export function docsFigureLabelKey(topic: DocsTopicId): string {
  return `docs.${topic}.figure`;
}
