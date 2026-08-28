/**
 * Skia, stubbed.
 *
 * The notation canvas draws through a real GPU surface, which jest has none of
 * — and rendering the score is not what a component test is asking about. What
 * matters is that the toolbar, the sheets and the panels around it behave, so
 * the canvas becomes an inert view and everything else is real.
 */
const React = require('react');
const { View } = require('react-native');

const Passthrough = ({ children }) => React.createElement(View, null, children);

module.exports = {
  Canvas: Passthrough,
  Picture: () => null,
  Group: Passthrough,
  createPicture: () => ({}),
  Skia: {},
  useCanvasRef: () => ({ current: null }),
};
