#pragma once

#include "pch.h"
#include "NativeModules.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation {

/**
 * A *separate* native window for the desktop Projects screen — the Windows
 * half of `MoosiacProjectsWindow`. `AppDelegate.mm`'s macOS half is the more
 * thoroughly verified sibling; read its file comment first for the design
 * (one bridge, two root views; created once and reused; opened non-modally so
 * the editor stays interactive).
 *
 * The window is a second `ReactNativeWindow` rendering the `MoosiacProjects`
 * component on the *same* `ReactNativeHost` as the editor, so both windows
 * share one JS runtime. Every window of a Composition app lives on the one UI
 * thread, so each method posts to the UI dispatcher and none of them has to
 * reason about which thread a window belongs to.
 *
 * It is created on the first `show()` and then kept: the native close button
 * and `close()` both *hide* it, as macOS's `releasedWhenClosed = NO` does, so
 * a half-typed sign-in field or a scroll position survives reopening it.
 *
 * NOTE: written against the react-native-windows 0.81 Composition API but not
 * built or run here — there is no Windows toolchain in this environment.
 * Build and click-test on a Windows machine before relying on it.
 */
REACT_MODULE(MoosiacProjectsWindow)
struct WindowManagerModule {
  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const &context) noexcept;

  REACT_METHOD(show)
  void show() noexcept;

  REACT_METHOD(focusMain)
  void focusMain() noexcept;

  REACT_METHOD(close)
  void close() noexcept;

  /**
   * Destroys the Projects window, if one was made. Called by the app shell
   * when the editor window closes: the editor is the window whose closing
   * quits the app, and a hidden Projects window must not outlive it.
   */
  static void Shutdown() noexcept;

 private:
  winrt::Microsoft::ReactNative::ReactContext m_context;
};

} // namespace winrt::MoosiacRN::implementation
