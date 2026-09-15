/**
 * The native playback caret — macOS only.
 *
 * `requireNativeComponent` rather than codegen: this is a legacy view manager,
 * which the new architecture renders through its interop layer, so the package
 * needs no generated component descriptor of its own.
 */
import { Platform, requireNativeComponent } from 'react-native';

export const PlayheadView =
  Platform.OS === 'macos' ? requireNativeComponent('MoosiacPlayhead') : null;
