#include "pch.h"
#include "MainPage.h"
#if __has_include("MainPage.g.cpp")
#include "MainPage.g.cpp"
#endif

#include "App.h"
#include "MenuBridgeModule.h"

using namespace winrt;
using namespace xaml;

namespace winrt::MoosiacRN::implementation
{
    MainPage::MainPage()
    {
        InitializeComponent();
        auto app = Application::Current().as<App>();
        ReactRootView().ReactNativeHost(app->Host());
    }

    // Each handler names the one command it posts — see MenuBridgeModule.h
    // for what "posts" means here, and src/app/menu-commands.ts for the
    // full list this project answers to.
    void MainPage::OnFileNew(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"file.new"); }
    void MainPage::OnFileOpen(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"file.open"); }
    void MainPage::OnFileSave(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"file.save"); }
    void MainPage::OnFileSaveAs(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"file.saveAs"); }
    void MainPage::OnFilePrint(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"file.print"); }
    void MainPage::OnFileSnapshots(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"file.snapshots"); }
    void MainPage::OnImportMidi(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"import.midi"); }
    void MainPage::OnImportMusicXml(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"import.musicxml"); }
    void MainPage::OnImportTracker(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"import.tracker"); }
    void MainPage::OnImportAudio(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"import.audio"); }
    void MainPage::OnExportMidi(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"export.midi"); }
    void MainPage::OnExportMusicXml(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"export.musicxml"); }
    void MainPage::OnExportXm(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"export.xm"); }
    void MainPage::OnExportWav(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"export.wav"); }
    void MainPage::OnExportMp3(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"export.mp3"); }
    void MainPage::OnEditUndo(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"edit.undo"); }
    void MainPage::OnEditRedo(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"edit.redo"); }
    void MainPage::OnNavProjects(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"nav.projects"); }
    void MainPage::OnNavSettings(IInspectable const&, RoutedEventArgs const&) { MenuBridgeModule::Emit(L"nav.settings"); }
}
