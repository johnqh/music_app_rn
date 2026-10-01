#pragma once

#include "pch.h"
#include "NativeModules.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation {

/**
 * Sets the editor window's title bar text from JavaScript — the Windows half
 * of `MoosiacWindowTitle`. `AppDelegate.mm` (macOS) is the other half, and
 * `src/platform/windowTitle.ts` is the one JS call site both answer to —
 * `WindowTitleSync.tsx` calls it with `${CONSTANTS.APP_NAME} - ${document
 * title}` every time the active document or its title changes.
 *
 * The title is the main `AppWindow`'s (`MoosiacRN.cpp`), set on the UI
 * thread. Only the editor window: the Projects window keeps its own title.
 *
 * NOTE: not built or run here — there is no Windows toolchain in this
 * environment. Verify on a Windows machine.
 */
REACT_MODULE(MoosiacWindowTitle)
struct WindowTitleModule {
  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const &context) noexcept;

  REACT_METHOD(setTitle)
  void setTitle(std::string title) noexcept;

 private:
  winrt::Microsoft::ReactNative::ReactContext m_context;
};

} // namespace winrt::MoosiacRN::implementation
