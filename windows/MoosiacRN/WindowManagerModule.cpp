#include "pch.h"
#include "WindowManagerModule.h"
#include "MoosiacRN.h"


#include <utility>

using namespace winrt::Microsoft::ReactNative;
using namespace winrt::Microsoft::UI::Windowing;

namespace winrt::MoosiacRN::implementation {

namespace {

// Created on the first `show()` and kept until the editor closes. UI thread
// only, like everything that touches it.
ReactNativeWindow g_projectsWindow{nullptr};
winrt::event_token g_closingToken{};

HWND HwndOf(ReactNativeWindow const &window) noexcept {
  if (!window) return nullptr;
  return winrt::Microsoft::UI::GetWindowFromWindowId(window.AppWindow().Id());
}

void CreateProjectsWindow() {
  auto mainWindow = ::MoosiacApp::MainWindow();
  auto host = ::MoosiacApp::Host();
  if (!mainWindow || !host) return;

  // The editor's compositor: one compositor per UI thread.
  auto window = ReactNativeWindow::CreateFromCompositor(mainWindow.ReactNativeIsland().Compositor());
  window.ResizePolicy(ContentSizePolicy::ResizeContentToParentWindow);

  auto appWindow = window.AppWindow();
  appWindow.Title(L"Projects");
  // The same icon as the editor window (see MoosiacRN.cpp).
  appWindow.SetIcon(winrt::Microsoft::UI::GetIconIdFromIcon(
      LoadIconW(GetModuleHandleW(nullptr), MAKEINTRESOURCEW(IDI_ICON1))));
  appWindow.Resize({960, 680});

  // The native close button hides rather than destroys, the same as
  // `close()` — see the header.
  g_closingToken = appWindow.Closing([](AppWindow const &sender, AppWindowClosingEventArgs const &args) {
    args.Cancel(true);
    sender.Hide();
  });

  ReactViewOptions options;
  options.ComponentName(L"MoosiacProjects");
  window.ReactNativeIsland().ReactViewHost(ReactCoreInjection::MakeViewHost(host, options));

  g_projectsWindow = window;
}

} // namespace

void WindowManagerModule::Initialize(ReactContext const &context) noexcept {
  m_context = context;
}

void WindowManagerModule::show() noexcept {
  m_context.UIDispatcher().Post([] {
    // Created once, then brought forward — never a second copy, the same
    // rule `AppDelegate.mm`'s `showProjectsWindow` follows.
    if (!g_projectsWindow) CreateProjectsWindow();
    if (!g_projectsWindow) return;
    g_projectsWindow.AppWindow().Show();
    ::MoosiacApp::BringToFront(HwndOf(g_projectsWindow));
  });
}

void WindowManagerModule::focusMain() noexcept {
  m_context.UIDispatcher().Post([] { ::MoosiacApp::BringToFront(HwndOf(::MoosiacApp::MainWindow())); });
}

void WindowManagerModule::close() noexcept {
  m_context.UIDispatcher().Post([] {
    if (g_projectsWindow) g_projectsWindow.AppWindow().Hide();
  });
}

void WindowManagerModule::Shutdown() noexcept {
  if (!g_projectsWindow) return;
  auto window = std::exchange(g_projectsWindow, nullptr);
  window.AppWindow().Closing(g_closingToken);
  // Detaches the React root, then destroys the AppWindow.
  window.ReactNativeIsland().ReactViewHost(nullptr);
  window.Close();
}

} // namespace winrt::MoosiacRN::implementation
