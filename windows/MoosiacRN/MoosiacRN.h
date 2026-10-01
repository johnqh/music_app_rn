#pragma once

#include "resource.h"

#include <string>

/**
 * What the app shell (`MoosiacRN.cpp`) owns and the native modules reach for:
 * the one `ReactNativeHost` both windows share, the main window, and the
 * folder the executable runs from.
 *
 * Everything here lives on the UI thread — the thread `WinMain` runs the
 * dispatcher queue on, which is also what a module's `UIDispatcher()` posts
 * to. Composition apps have one UI thread for every window, unlike the UWP
 * template this project replaced, where each window had a thread of its own.
 */
namespace MoosiacApp {

winrt::Microsoft::ReactNative::ReactNativeHost Host() noexcept;

/** The editor window. Null before `WinMain` has built it. */
winrt::Microsoft::ReactNative::ReactNativeWindow MainWindow() noexcept;

/**
 * The folder holding `MoosiacRN.exe`, with no trailing separator. Where the
 * bundled files (`Bundle\`, `soundfont\`) are, packaged or not — a packaged
 * Win32 app's `Package::InstalledLocation` is the package root, one folder
 * *above* the executable's, so it is not the same answer.
 */
std::wstring AppDirectory() noexcept;

/** Brings `hwnd` to the front and gives it focus, restoring it if minimised. */
void BringToFront(HWND hwnd) noexcept;

} // namespace MoosiacApp
