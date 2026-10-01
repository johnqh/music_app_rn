#include "pch.h"
#include "WindowTitleModule.h"
#include "MoosiacRN.h"

namespace winrt::MoosiacRN::implementation {

void WindowTitleModule::Initialize(
    winrt::Microsoft::ReactNative::ReactContext const &context) noexcept {
  m_context = context;
}

void WindowTitleModule::setTitle(std::string title) noexcept {
  m_context.UIDispatcher().Post([title = winrt::to_hstring(title)] {
    if (auto window = ::MoosiacApp::MainWindow()) window.AppWindow().Title(title);
  });
}

} // namespace winrt::MoosiacRN::implementation
