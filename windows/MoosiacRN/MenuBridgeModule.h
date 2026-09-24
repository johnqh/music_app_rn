#pragma once

#include "pch.h"
#include "NativeModules.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation {

/**
 * The Windows half of the File/Edit/Nav menu bridge — the counterpart of
 * macOS's `MoosiacMenuBridge` (`macos/music_app_rn-macOS/AppDelegate.mm`).
 * `MainPage`'s menu click handlers call the static `Emit`, never JS, and JS
 * hears it as the same `menuCommand` event `src/app/menu-commands.ts` already
 * listens for — under this exact module name, so that one JS file serves both
 * desktop platforms without knowing which one it is running on.
 *
 * A `REACT_MODULE` rather than `REACT_TURBO_MODULE`, on purpose: its
 * `REACT_EVENT` fires through the global `RCTDeviceEventEmitter`, which is
 * what `NativeEventEmitter(NativeModules.MoosiacMenuBridge)` reads from on the
 * JS side regardless of which native module posted to it — the same
 * mechanism `AppDelegate.mm`'s own comment documents for macOS's
 * `NSNotificationCenter` hop.
 *
 * NOTE: written against the `REACT_MODULE`/`REACT_EVENT` macros as documented
 * in `NativeModules.h`, but not built or run here — this repository has no
 * Windows toolchain available in this environment. Build and click-test on a
 * Windows machine before relying on it.
 */
REACT_MODULE(MoosiacMenuBridge)
struct MenuBridgeModule {
  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const &context) noexcept;

  REACT_EVENT(OnMenuCommand, L"menuCommand")
  std::function<void(React::JSValue const &)> OnMenuCommand;

  /**
   * Posts a command to JS. Called from `MainPage`'s menu handlers, never
   * from JS itself.
   *
   * Dropped rather than queued when nothing is listening yet (`OnMenuCommand`
   * unset) — the same rule `AppDelegate.mm`'s `NSNotificationCenter` post
   * follows on macOS, and for the same reason: a menu click before the app
   * has mounted has nothing to reach.
   */
  static void Emit(std::wstring const &command) noexcept;

 private:
  static MenuBridgeModule *s_instance;
};

} // namespace winrt::MoosiacRN::implementation
