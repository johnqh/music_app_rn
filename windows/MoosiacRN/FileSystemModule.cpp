#include "pch.h"
#include "FileSystemModule.h"
#include "FileSystemUtils.h"

#include <winrt/Windows.ApplicationModel.h>
#include <winrt/Windows.Storage.h>

#include <filesystem>
#include <fstream>
#include <iterator>
#include <vector>

namespace winrt::MoosiacRN::implementation {

void FileSystemModule::getDocumentDirectoryPath(
    React::ReactPromise<std::string> result) noexcept {
  result.Resolve(winrt::to_string(
      winrt::Windows::Storage::ApplicationData::Current().LocalFolder().Path()));
}

void FileSystemModule::getMainBundlePath(
    React::ReactPromise<std::string> result) noexcept {
  result.Resolve(winrt::to_string(
      winrt::Windows::ApplicationModel::Package::Current().InstalledLocation().Path()));
}

void FileSystemModule::readFile(
    std::string path, std::string encoding,
    React::ReactPromise<std::string> result) noexcept {
  std::ifstream input(std::filesystem::u8path(path), std::ios::binary);
  if (!input) {
    result.Reject(React::ReactError{"ENOENT", "Could not read file."});
    return;
  }
  std::vector<char> bytes((std::istreambuf_iterator<char>(input)),
                          std::istreambuf_iterator<char>());
  if (encoding == "base64") {
    const auto encoded = BuildingBlocksRN::Windows::EncodeBase64(bytes);
    if (encoded.empty() && !bytes.empty()) {
      result.Reject(React::ReactError{"EIO", "Could not encode file."});
      return;
    }
    result.Resolve(encoded);
    return;
  }
  result.Resolve(std::string(bytes.begin(), bytes.end()));
}

void FileSystemModule::writeFile(
    std::string path, std::string content, std::string /*encoding*/,
    React::ReactPromise<bool> result) noexcept {
  const auto filePath = std::filesystem::u8path(path);
  std::error_code error;
  std::filesystem::create_directories(filePath.parent_path(), error);
  std::ofstream output(filePath, std::ios::binary | std::ios::trunc);
  if (!output) {
    result.Reject(React::ReactError{"EACCES", "Could not write file."});
    return;
  }
  output.write(content.data(), static_cast<std::streamsize>(content.size()));
  if (!output) {
    result.Reject(React::ReactError{"EIO", "Could not write file."});
    return;
  }
  result.Resolve(true);
}

} // namespace winrt::MoosiacRN::implementation
