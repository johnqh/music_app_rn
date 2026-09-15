/**
 * The native playback caret — macOS only.
 *
 * `requireNativeComponent` rather than codegen: this is a legacy view manager,
 * which the new architecture renders through its interop layer, so the package
 * needs no generated component descriptor of its own.
 *
 * **The colour is processed here.** React Native converts a legacy view
 * manager's colour prop only when the manager declares it `UIColor`; this one
 * declares `NSColor`, so a CSS string such as the theme's caret reached AppKit
 * as a string, converted to nil, and the line drew transparent — the caret was
 * invisible on the Mac from the day it started taking the theme's colour. The
 * wrapper hands native the processed value `RCTConvert` expects, so callers
 * pass any colour React Native accepts.
 */
import { createElement, forwardRef } from 'react';
import { Platform, processColor, requireNativeComponent } from 'react-native';

const NativePlayhead =
  Platform.OS === 'macos' ? requireNativeComponent('MoosiacPlayhead') : null;

export const PlayheadView = NativePlayhead
  ? forwardRef(function PlayheadView({ lineColor, ...props }, ref) {
      return createElement(NativePlayhead, {
        ...props,
        ref,
        lineColor: processColor(lineColor),
      });
    })
  : null;
