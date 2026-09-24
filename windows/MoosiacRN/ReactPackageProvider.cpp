#include "pch.h"
#include "ReactPackageProvider.h"
#include "NativeModules.h"
#include "FilePickerModule.h"
#include "PrintModule.h"
#include "FileSystemModule.h"
#include "SynthModule.h"
#include "MenuBridgeModule.h"
#include "WindowManagerModule.h"
#include "WindowTitleModule.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::MoosiacRN::implementation
{

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
    AddAttributedModules(packageBuilder, true);
}

} // namespace winrt::MoosiacRN::implementation
