#include "pch.h"
#include "WindowManagerModule.h"
#include "ProjectsPage.h"

#include <winrt/Windows.ApplicationModel.Core.h>
#include <winrt/Windows.UI.Core.h>
#include <winrt/Windows.UI.ViewManagement.h>

using namespace winrt::Windows::ApplicationModel::Core;
using namespace winrt::Windows::UI::Core;
using namespace winrt::Windows::UI::ViewManagement;
using namespace xaml;
using namespace xaml::Controls;

namespace winrt::MoosiacRN::implementation {

// The main window's own ApplicationView id, captured once — every module's
// Initialize runs on the main view's thread the first time the app starts,
// since the Projects view does not exist yet to have initialized one of
// its own.
static int32_t sMainViewId = 0;
static bool sHaveMainViewId = false;

// 0 until the Projects window has been created once; classic UWP has no
// cross-thread pointer back into a secondary CoreApplicationView's own
// state, so a view id plus ApplicationViewSwitcher — not a stored
// reference — is the sanctioned way to address one from elsewhere.
static int32_t sProjectsViewId = 0;

void WindowManagerModule::Initialize(
    winrt::Microsoft::ReactNative::ReactContext const & /*context*/) noexcept {
  if (!sHaveMainViewId) {
    sMainViewId = ApplicationView::GetForCurrentView().Id();
    sHaveMainViewId = true;
  }
}

void WindowManagerModule::show() noexcept {
  if (sProjectsViewId != 0) {
    // Already created — bring the existing one forward, never a second
    // copy, the same rule `AppDelegate.mm`'s `showProjectsWindow` follows.
    ApplicationViewSwitcher::SwitchAsync(sProjectsViewId);
    return;
  }

  CoreApplicationView newView = CoreApplication::CreateNewView();
  // A freshly created view's content must be built on *its own* dispatcher
  // thread, not the caller's — CoreApplicationView's documented contract.
  newView.Dispatcher().RunAsync(CoreDispatcherPriority::Normal, [] {
    Frame rootFrame;
    rootFrame.Navigate(xaml_typename<MoosiacRN::ProjectsPage>(), nullptr);
    Window::Current().Content(rootFrame);
    Window::Current().Activate();

    sProjectsViewId = ApplicationView::GetForCurrentView().Id();
    ApplicationViewSwitcher::TryShowAsStandaloneAsync(sProjectsViewId);
  });
}

void WindowManagerModule::focusMain() noexcept {
  ApplicationViewSwitcher::SwitchAsync(sMainViewId);
}

void WindowManagerModule::close() noexcept {
  // Consolidates (closes) *this* view — safe to call from the Projects
  // view's own thread, which is the only thread `close()` is ever called
  // from (New/Template/Import landing a project, all JS running inside
  // this window's own root).
  //
  // Unlike macOS's `orderOut:` + `releasedWhenClosed = NO`, this does not
  // keep the window alive for a fast, state-preserving reuse — classic UWP
  // has no "hide but keep alive" for a secondary CoreApplicationView, only
  // "close it". `show()`'s next call creates a fresh one from scratch,
  // which means a half-typed sign-in field or a scroll position is lost on
  // Windows in a way it is not on macOS. A real capability gap, not an
  // oversight — flagged here rather than left silently different.
  sProjectsViewId = 0;
  ApplicationView::GetForCurrentView().TryConsolidateAsync();
}

} // namespace winrt::MoosiacRN::implementation
