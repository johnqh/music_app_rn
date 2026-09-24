#include "pch.h"
#include "ProjectsPage.h"
#if __has_include("ProjectsPage.g.cpp")
#include "ProjectsPage.g.cpp"
#endif

#include "App.h"

using namespace winrt;
using namespace xaml;

namespace winrt::MoosiacRN::implementation
{
    // Same shape as MainPage's constructor, and the same ReactNativeHost —
    // both windows are one bridge, two root views. See ProjectsPage.xaml's
    // comment and WindowManagerModule.cpp, which is what actually creates
    // the window this page lives in.
    ProjectsPage::ProjectsPage()
    {
        InitializeComponent();
        auto app = Application::Current().as<App>();
        ReactRootView().ReactNativeHost(app->Host());
    }
}
