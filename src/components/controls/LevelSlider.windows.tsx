// React Native Windows has no implementation of
// @react-native-community/slider. The gesture-driven desktop control is
// platform-neutral and is already used by the macOS renderer.
export {
  LevelSlider,
  PositionSlider,
  type LevelSliderProps,
} from './LevelSlider.macos';
