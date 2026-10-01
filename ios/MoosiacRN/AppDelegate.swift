import UIKit
import FirebaseCore
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  // The window and the `startReactNative` call live in `SceneDelegate` now —
  // Xcode 27's iOS 27 SDK crashes at launch (`EXC_BREAKPOINT` in
  // `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`) for an app
  // with no scene adoption at all, where earlier SDKs only warned. The factory
  // is still built here, once, at the same point it always was; the scene
  // delegate reaches back into it through `UIApplication.shared.delegate`.
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Native Firebase — analytics, crashlytics, messaging, remote config —
    // configured from `GoogleService-Info.plist`. Auth is not this: it runs
    // on Firebase's JS SDK, configured from `.env` (see `src/auth`).
    FirebaseApp.configure()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

    return true
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // React-Core-prebuilt ships RCTBundleURLProvider already compiled, with
    // RCT_METRO_PORT baked in at 8081 by the upstream artifact — no build
    // setting in this project can change it. sudojo_app_rn and svgr_app_rn
    // hit the same wall and settled on this: override the port at runtime,
    // the one thing `jsLocation` is for, rather than the app's compiled default.
    let provider = RCTBundleURLProvider.sharedSettings()
    provider.jsLocation = "localhost:8091"
    return provider.jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
