#include "pch.h"
#include "WindowTitleModule.h"

#include <winrt/Windows.UI.ViewManagement.h>

namespace winrt::MoosiacRN::implementation {

void WindowTitleModule::setTitle(std::string title) noexcept {
  auto view = winrt::Windows::UI::ViewManagement::ApplicationView::GetForCurrentView();
  view.Title(winrt::to_hstring(title));
}

} // namespace winrt::MoosiacRN::implementation
