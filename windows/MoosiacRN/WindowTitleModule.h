#pragma once

#include "pch.h"
#include "NativeModules.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation {

/**
 * Sets the window's title bar text from JavaScript — the Windows half of
 * `MoosiacWindowTitle`. `AppDelegate.mm` (macOS) is the other half, and
 * `src/platform/windowTitle.ts` is the one JS call site both answer to —
 * `WindowTitleSync.tsx` calls it with `${CONSTANTS.APP_NAME} - ${document
 * title}` every time the active document or its title changes, now that
 * neither desktop platform's own title bar carries it any more.
 *
 * `ApplicationView::Title` is UWP's API for this — `Window::Current()` used
 * elsewhere in this project (`App.cpp`) is what confirms this app is UWP-
 * windowed rather than an unpackaged WinAppSDK one, where the title would
 * instead be a plain property on a `Microsoft::UI::Xaml::Window`.
 *
 * NOTE: written against documented UWP/RNW APIs but not built or run here —
 * see `MenuBridgeModule.h`'s identical caveat. Verify on a Windows machine.
 */
REACT_MODULE(MoosiacWindowTitle)
struct WindowTitleModule {
  REACT_METHOD(setTitle)
  void setTitle(std::string title) noexcept;
};

} // namespace winrt::MoosiacRN::implementation
