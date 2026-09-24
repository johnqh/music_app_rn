#pragma once
#include "ProjectsPage.g.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation
{
    struct ProjectsPage : ProjectsPageT<ProjectsPage>
    {
        ProjectsPage();
    };
}

namespace winrt::MoosiacRN::factory_implementation
{
    struct ProjectsPage : ProjectsPageT<ProjectsPage, implementation::ProjectsPage>
    {
    };
}
