package com.moosiacrn

import android.content.pm.ActivityInfo
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
  /**
   * Phones are landscape-only; tablets are free.
   *
   * Set here rather than in the manifest because a manifest attribute cannot
   * ask how wide the screen is — `R.bool.lock_landscape` is true by default and
   * false under `values-sw600dp`, which is exactly the question being asked.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    requestedOrientation =
        if (resources.getBoolean(R.bool.lock_landscape))
            ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    super.onCreate(savedInstanceState)
  }


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
