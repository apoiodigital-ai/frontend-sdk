package com.apoiocane.reactnativesdk

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

class ReactNativeSdkModule(reactContext: ReactApplicationContext) :
  NativeReactNativeSdkSpec(reactContext) {

  private val scanner = ViewHierarchyScanner()

  override fun captureViewHierarchy(promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.resolve(Arguments.createArray())
      return
    }

    try {
      activity.runOnUiThread {
        try {
          scanner.scan(activity) { result -> promise.resolve(result) }
        } catch (e: Exception) {
          promise.resolve(Arguments.createArray())
        }
      }
    } catch (e: Exception) {
      promise.resolve(Arguments.createArray())
    }
  }

  companion object {
    const val NAME = NativeReactNativeSdkSpec.NAME
  }
}
