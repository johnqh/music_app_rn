/**
 * The Spatial view, stubbed.
 *
 * `@sudobility/music_spatial_rn` draws through Skia and projects through
 * `three`, neither of which jest can run or, in three's case, even parse
 * without more babel than the React Native preset carries. The stage is
 * checked by running the app, like the notation canvas (`jest.skia.cjs`);
 * what a component test asks is whether the toggle mounts it in the score's
 * place, so it becomes an inert, findable view.
 */
const React = require('react');
const { View } = require('react-native');

module.exports = {
  SpatialView: () => React.createElement(View, { testID: 'spatial-view' }),
};
