/**
 * The figure files, by topic.
 *
 * Each `require` is written out: Metro resolves an asset from the literal it
 * can read at build time, so a path assembled from the topic id bundles
 * nothing. `figures.test.ts` checks this list against `DOCS_FIGURES`, since a
 * topic missing here draws an empty frame of exactly the right size.
 */
import type { ImageSourcePropType } from 'react-native';
import type { DocsTopicId } from '@sudobility/music_types';

export const DOCS_FIGURE_ASSETS: Partial<
  Record<DocsTopicId, ImageSourcePropType>
> = {
  'getting-started': require('../../../assets/docs/figures/getting-started.png'),
  navigation: require('../../../assets/docs/figures/navigation.png'),
  editor: require('../../../assets/docs/figures/editor.png'),
  notation: require('../../../assets/docs/figures/notation.png'),
  structure: require('../../../assets/docs/figures/structure.png'),
  tracks: require('../../../assets/docs/figures/tracks.png'),
  playback: require('../../../assets/docs/figures/playback.png'),
  'midi-input': require('../../../assets/docs/figures/midi-input.png'),
  inspector: require('../../../assets/docs/figures/inspector.png'),
  generation: require('../../../assets/docs/figures/generation.png'),
  settings: require('../../../assets/docs/figures/settings.png'),
};
