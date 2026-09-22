#include "pch.h"
#include "FilePickerModule.h"

#include <ReactCoreInjection.h>
#include <shobjidl_core.h>

#include <string>

namespace winrt::MoosiacRN::implementation {

void FilePickerModule::Initialize(
    winrt::Microsoft::ReactNative::ReactContext const &context) noexcept {
  m_context = context;
}

static HWND TopLevelWindow(
    winrt::Microsoft::ReactNative::ReactContext const &context) noexcept {
  return reinterpret_cast<HWND>(
      winrt::Microsoft::ReactNative::ReactCoreInjection::GetTopLevelWindowId(
          context.Properties().Handle()));
}

void FilePickerModule::pickFile(
    React::JSValueArray extensions,
    React::ReactPromise<React::JSValue> result) noexcept {
  m_context.UIDispatcher().Post(
      [context = m_context, extensions = std::move(extensions),
       result = std::move(result)]() mutable {
        IFileOpenDialog *dialog = nullptr;
        if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr,
                                    CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog)))) {
          result.Resolve(React::JSValue{nullptr});
          return;
        }

        DWORD options = 0;
        dialog->GetOptions(&options);
        dialog->SetOptions(options | FOS_FORCEFILESYSTEM);
        dialog->SetTitle(L"Open Music File");

        // IFileOpenDialog expects semicolon-separated wildcard patterns in a
        // single filter entry. Unlike mobile pickers, Windows can filter on
        // arbitrary extensions directly, including the app's custom formats.
        std::wstring patterns;
        for (const auto &extensionValue : extensions) {
          if (!extensionValue.IsString()) continue;
          std::string extension = extensionValue.AsString();
          while (!extension.empty() && extension.front() == '.') {
            extension.erase(extension.begin());
          }
          if (extension.empty()) continue;

          bool valid = true;
          for (const unsigned char character : extension) {
            if (!((character >= 'a' && character <= 'z') ||
                  (character >= 'A' && character <= 'Z') ||
                  (character >= '0' && character <= '9') || character == '-' ||
                  character == '_')) {
              valid = false;
              break;
            }
          }
          if (!valid) continue;

          if (!patterns.empty()) patterns += L';';
          patterns += L"*.";
          patterns += winrt::to_hstring(extension).c_str();
        }
        if (!patterns.empty()) {
          const std::wstring description = L"Supported music and document files";
          const COMDLG_FILTERSPEC filters[] = {
              {description.c_str(), patterns.c_str()},
          };
          if (FAILED(dialog->SetFileTypes(ARRAYSIZE(filters), filters))) {
            dialog->Release();
            result.Reject(React::ReactError{
                "FILE_PICKER_ERROR", "Could not configure the file type filter."});
            return;
          }
          dialog->SetFileTypeIndex(1);
        }

        HRESULT hr = dialog->Show(TopLevelWindow(context));
        if (FAILED(hr)) {
          dialog->Release();
          result.Resolve(React::JSValue{nullptr});
          return;
        }

        IShellItem *item = nullptr;
        hr = dialog->GetResult(&item);
        dialog->Release();
        if (FAILED(hr) || !item) {
          result.Resolve(React::JSValue{nullptr});
          return;
        }

        PWSTR path = nullptr;
        hr = item->GetDisplayName(SIGDN_FILESYSPATH, &path);
        item->Release();
        if (FAILED(hr) || !path) {
          result.Resolve(React::JSValue{nullptr});
          return;
        }

        std::string value = winrt::to_string(std::wstring(path));
        CoTaskMemFree(path);
        result.Resolve(React::JSValue{value});
      });
}

void FilePickerModule::pickSaveLocation(
    std::string suggestedName,
    React::ReactPromise<React::JSValue> result) noexcept {
  m_context.UIDispatcher().Post(
      [context = m_context, suggestedName = std::move(suggestedName),
       result = std::move(result)]() mutable {
        IFileSaveDialog *dialog = nullptr;
        if (FAILED(CoCreateInstance(CLSID_FileSaveDialog, nullptr,
                                    CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog)))) {
          result.Resolve(React::JSValue{nullptr});
          return;
        }

        dialog->SetTitle(L"Save Music File");
        std::wstring name = winrt::to_hstring(suggestedName).c_str();
        if (!name.empty()) dialog->SetFileName(name.c_str());
        DWORD options = 0;
        dialog->GetOptions(&options);
        dialog->SetOptions(options | FOS_FORCEFILESYSTEM | FOS_OVERWRITEPROMPT);

        HRESULT hr = dialog->Show(TopLevelWindow(context));
        if (FAILED(hr)) {
          dialog->Release();
          result.Resolve(React::JSValue{nullptr});
          return;
        }

        IShellItem *item = nullptr;
        hr = dialog->GetResult(&item);
        dialog->Release();
        if (FAILED(hr) || !item) {
          result.Resolve(React::JSValue{nullptr});
          return;
        }

        PWSTR path = nullptr;
        hr = item->GetDisplayName(SIGDN_FILESYSPATH, &path);
        item->Release();
        if (FAILED(hr) || !path) {
          result.Resolve(React::JSValue{nullptr});
          return;
        }

        std::string value = winrt::to_string(std::wstring(path));
        CoTaskMemFree(path);
        result.Resolve(React::JSValue{value});
      });
}

} // namespace winrt::MoosiacRN::implementation
