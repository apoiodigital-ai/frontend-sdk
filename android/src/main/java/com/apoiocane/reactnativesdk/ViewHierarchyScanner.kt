package com.apoiocane.reactnativesdk

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.EditText
import android.widget.TextView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.atomic.AtomicBoolean

class ViewHierarchyScanner(private val debounceMs: Long = 400L) {

  private val mainHandler = Handler(Looper.getMainLooper())

  fun scan(activity: Activity, callback: (WritableArray) -> Unit) {
    val decorView = activity.window?.decorView
    if (decorView == null) {
      callback(Arguments.createArray())
      return
    }

    val resolved = AtomicBoolean(false)
    var listener: ViewTreeObserver.OnGlobalLayoutListener? = null
    var settleRunnable: Runnable? = null

    fun cleanup() {
      settleRunnable?.let { mainHandler.removeCallbacks(it) }
      listener?.let {
        if (decorView.viewTreeObserver.isAlive) {
          decorView.viewTreeObserver.removeOnGlobalLayoutListener(it)
        }
      }
    }

    fun consolidate() {
      if (!resolved.compareAndSet(false, true)) return
      cleanup()
      val result = Arguments.createArray()
      try {
        walk(decorView, result)
      } catch (e: Exception) {
      }
      callback(result)
    }

    val runnable = Runnable { consolidate() }
    settleRunnable = runnable

    val globalLayoutListener = ViewTreeObserver.OnGlobalLayoutListener {
      mainHandler.removeCallbacks(runnable)
      mainHandler.postDelayed(runnable, debounceMs)
    }
    listener = globalLayoutListener

    val observer = decorView.viewTreeObserver
    if (observer.isAlive) {
      observer.addOnGlobalLayoutListener(globalLayoutListener)
    }

    mainHandler.postDelayed(runnable, debounceMs)
  }

  private fun walk(view: View, out: WritableArray) {
    if (view.visibility != View.VISIBLE) return

    captureNode(view)?.let { out.pushMap(it) }

    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        walk(view.getChildAt(i), out)
      }
    }
  }

  private fun captureNode(view: View): WritableMap? {
    val width = view.width
    val height = view.height
    if (width <= 0 || height <= 0) return null

    val locationOnScreen = IntArray(2)
    view.getLocationOnScreen(locationOnScreen)

    val isSecure = isSecureField(view)

    val map = Arguments.createMap()
    map.putString("viewId", resolveViewId(view))
    map.putString("className", view.javaClass.simpleName)
    map.putDouble("x", locationOnScreen[0].toDouble())
    map.putDouble("y", locationOnScreen[1].toDouble())
    map.putDouble("width", width.toDouble())
    map.putDouble("height", height.toDouble())
    map.putBoolean("isSecure", isSecure)
    map.putBoolean("isInteractive", isInteractive(view))
    map.putString("text", if (isSecure) "" else extractText(view))
    return map
  }

  private fun resolveViewId(view: View): String {
    if (view.id != View.NO_ID) {
      try {
        val name = view.resources.getResourceEntryName(view.id)
        if (!name.isNullOrBlank()) return name
      } catch (e: Exception) {
      }
    }

    val contentDescription = view.contentDescription?.toString()
    if (!contentDescription.isNullOrBlank()) return contentDescription

    return "view-${System.identityHashCode(view)}"
  }

  private fun isSecureField(view: View): Boolean {
    if (view !is EditText) return false
    return isPasswordVariation(view.inputType)
  }

  private fun isPasswordVariation(inputType: Int): Boolean {
    val cls = inputType and InputType.TYPE_MASK_CLASS
    val variation = inputType and InputType.TYPE_MASK_VARIATION
    return when (cls) {
      InputType.TYPE_CLASS_TEXT ->
        variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
          variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD ||
          variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
      InputType.TYPE_CLASS_NUMBER ->
        variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD
      else -> false
    }
  }

  private fun isInteractive(view: View): Boolean {
    if (view.isClickable || view.isLongClickable) return true
    if (view is EditText) return true
    return false
  }

  private fun extractText(view: View): String {
    val direct = when (view) {
      is EditText -> view.text?.toString()
      is TextView -> view.text?.toString()
      else -> null
    }
    if (!direct.isNullOrBlank()) return direct

    val contentDescription = view.contentDescription?.toString()
    if (!contentDescription.isNullOrBlank()) return contentDescription

    return ""
  }
}
