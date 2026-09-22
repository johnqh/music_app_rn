#pragma once

#include "pch.h"
#include "NativeModules.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation {

REACT_MODULE(MoosiacFilePicker)
struct FilePickerModule {
  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const &context) noexcept;

  REACT_METHOD(pickFile)
  void pickFile(React::JSValueArray extensions,
                React::ReactPromise<React::JSValue> result) noexcept;

  REACT_METHOD(pickSaveLocation)
  void pickSaveLocation(std::string suggestedName,
                        React::ReactPromise<React::JSValue> result) noexcept;

 private:
  winrt::Microsoft::ReactNative::ReactContext m_context;
};

} // namespace winrt::MoosiacRN::implementation
