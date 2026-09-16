package com.moosiacrn

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * Orientation is the manifest's, and only the manifest's.
 *
 * Every device this app runs on is landscape-only, so there is no screen-size
 * question left to ask and `android:screenOrientation="sensorLandscape"` says
 * the whole of it. This class used to answer it again in `onCreate` — locking
 * phones and setting `SCREEN_ORIENTATION_UNSPECIFIED` on anything over
 * `sw600dp` — and a `setRequestedOrientation` call beats the manifest, so the
 * tablet launched in portrait while the manifest said it could not. Don't
 * reintroduce one: it makes the manifest stop being the answer.
 */
class MainActivity : ReactActivity() {
  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MoosiacRN"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
