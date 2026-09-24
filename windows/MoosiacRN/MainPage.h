#pragma once
#include "MainPage.g.h"
#include <winrt/Microsoft.ReactNative.h>

namespace winrt::MoosiacRN::implementation
{
    struct MainPage : MainPageT<MainPage>
    {
        MainPage();

        // The menu bar's own click handlers (MainPage.xaml) — each just
        // forwards a command string to MenuBridgeModule::Emit, matching what
        // AppDelegate.mm's `moosiacFileNew:` and its siblings do on macOS.
        // See MenuBridgeModule.h for why the same command string reaches JS
        // on both platforms as one `menuCommand` event.
        void OnFileNew(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnFileOpen(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnFileSave(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnFileSaveAs(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnFilePrint(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnFileSnapshots(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnImportMidi(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnImportMusicXml(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnImportTracker(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnImportAudio(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnExportMidi(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnExportMusicXml(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnExportXm(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnExportWav(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnExportMp3(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnEditUndo(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnEditRedo(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnNavProjects(IInspectable const& sender, xaml::RoutedEventArgs const& args);
        void OnNavSettings(IInspectable const& sender, xaml::RoutedEventArgs const& args);
    };
}

namespace winrt::MoosiacRN::factory_implementation
{
    struct MainPage : MainPageT<MainPage, implementation::MainPage>
    {
    };
}

