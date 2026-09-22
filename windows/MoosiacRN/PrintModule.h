#pragma once

#include "pch.h"
#include "NativeModules.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation {

REACT_MODULE(MoosiacPrint)
struct PrintModule {
  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft.ReactNative::ReactContext const &context) noexcept;

  REACT_METHOD(printPages)
  void printPages(std::string jobName, React::JSValueArray pages,
                  React::ReactPromise<bool> result) noexcept;

 private:
  winrt::Microsoft.ReactNative::ReactContext m_context;
};

} // namespace winrt::MoosiacRN::implementation
