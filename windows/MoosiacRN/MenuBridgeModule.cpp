#include "pch.h"
#include "MenuBridgeModule.h"

namespace winrt::MoosiacRN::implementation {

MenuBridgeModule *MenuBridgeModule::s_instance = nullptr;

void MenuBridgeModule::Initialize(
    winrt::Microsoft::ReactNative::ReactContext const & /*context*/) noexcept {
  s_instance = this;
}

void MenuBridgeModule::Emit(std::wstring const &command) noexcept {
  if (!s_instance || !s_instance->OnMenuCommand) return;
  s_instance->OnMenuCommand(React::JSValue(React::JSValueObject{
      {"command", winrt::to_string(command)},
  }));
}

} // namespace winrt::MoosiacRN::implementation
