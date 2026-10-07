#include "pch.h"
#include "FileSystemModule.h"
#include "FileSystemUtils.h"
#include "MoosiacRN.h"

#include <winrt/Windows.Storage.h>

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <vector>

namespace winrt::MoosiacRN::implementation {

namespace {
std::vector<char> DecodeBase64(const std::string &input) {
  constexpr char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::vector<char> output;
  unsigned int accumulator = 0;
  int bits = -8;
  for (const unsigned char c : input) {
    if (c == '=') break;
    const char *digit = std::find(std::begin(alphabet), std::end(alphabet) - 1, c);
    if (digit == std::end(alphabet) - 1) continue;
    accumulator = (accumulator << 6) | static_cast<unsigned int>(digit - alphabet);
    bits += 6;
    if (bits >= 0) {
      output.push_back(static_cast<char>((accumulator >> bits) & 0xff));
      bits -= 8;
    }
  }
  return output;
}
} // namespace

void FileSystemModule::getDocumentDirectoryPath(
    React::ReactPromise<std::string> result) noexcept {
  result.Resolve(winrt::to_string(
      winrt::Windows::Storage::ApplicationData::Current().LocalFolder().Path()));
}

void FileSystemModule::getMainBundlePath(
    React::ReactPromise<std::string> result) noexcept {
  // The executable's folder, where the project's Content files are deployed
  // — not the package root (see MoosiacRN.h).
  result.Resolve(winrt::to_string(::MoosiacApp::AppDirectory()));
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
    std::string path, std::string content, std::string encoding,
    React::ReactPromise<bool> result) noexcept {
  const auto filePath = std::filesystem::u8path(path);
  std::error_code error;
  std::filesystem::create_directories(filePath.parent_path(), error);
  std::ofstream output(filePath, std::ios::binary | std::ios::trunc);
  if (!output) {
    result.Reject(React::ReactError{"EACCES", "Could not write file."});
    return;
  }
  if (encoding == "base64") {
    const auto decoded = DecodeBase64(content);
    output.write(decoded.data(), static_cast<std::streamsize>(decoded.size()));
  } else {
    output.write(content.data(), static_cast<std::streamsize>(content.size()));
  }
  if (!output) {
    result.Reject(React::ReactError{"EIO", "Could not write file."});
    return;
  }
  result.Resolve(true);
}

} // namespace winrt::MoosiacRN::implementation
