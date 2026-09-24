#pragma once

#include "pch.h"
#include "NativeModules.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation {

/**
 * A *separate* native window for the desktop Projects screen — the Windows
 * half of `MoosiacProjectsWindow`. `AppDelegate.mm`'s macOS half is the far
 * more thoroughly verified sibling; read its file comment first for the
 * design (one bridge, two root views; created once and reused; opened
 * non-modally so the editor stays interactive).
 *
 * **This is the least-verified native code in this whole session — read
 * before trusting it.** Classic UWP's only sanctioned way to a genuinely
 * separate, independently movable, non-modal top-level window is
 * `CoreApplication::CreateNewView`, which runs the new window on its *own*
 * thread with its own dispatcher — a real architectural difference from
 * macOS's same-thread `NSWindow`, not just a different API for the same
 * shape. Every cross-window call (`focusMain` reaching back to the main
 * view, `show`'s reuse path reaching the already-open Projects view) has to
 * be correct about which thread it runs on, and none of it has been built,
 * launched, or clicked once. Test on an actual Windows machine before
 * relying on it.
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
};

} // namespace winrt::MoosiacRN::implementation
