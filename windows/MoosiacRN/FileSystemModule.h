#pragma once

#include "pch.h"
#include "NativeModules.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation {

REACT_MODULE(FileSystemModule, L"MoosiacFileSystem")
struct FileSystemModule {
  REACT_METHOD(getDocumentDirectoryPath)
  void getDocumentDirectoryPath(React::ReactPromise<std::string> result) noexcept;

  REACT_METHOD(getMainBundlePath)
  void getMainBundlePath(React::ReactPromise<std::string> result) noexcept;

  REACT_METHOD(readFile)
  void readFile(std::string path, std::string encoding,
                React::ReactPromise<std::string> result) noexcept;

  REACT_METHOD(writeFile)
  void writeFile(std::string path, std::string content, std::string encoding,
                 React::ReactPromise<bool> result) noexcept;
};

} // namespace winrt::MoosiacRN::implementation
