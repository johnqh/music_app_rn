import UIKit
import React

/// Owns the window, on the scene it belongs to.
///
/// `AppDelegate` still builds the React Native factory once, at launch — the
/// same object, the same moment as before this file existed. Only where the
/// window comes from moved: `UIWindow(windowScene:)` rather than
/// `UIWindow(frame: UIScreen.main.bounds)`, because a window with no scene is
/// exactly what iOS 27 now refuses to run.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "MoosiacRN",
      in: window,
      launchOptions: appDelegate.launchOptions
    )
  }
}
