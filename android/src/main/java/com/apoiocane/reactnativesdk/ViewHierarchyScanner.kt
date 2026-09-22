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
import com.facebook.react.R
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.atomic.AtomicBoolean

class ViewHierarchyScanner(private val debounceMs: Long = 400L) {

  private data class ScanFrame(val originX: Int, val originY: Int, val density: Float)

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
        walk(decorView, result, resolveFrame(decorView))
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

  private fun resolveFrame(decorView: View): ScanFrame {
    val origin = IntArray(2)
    findHostView(decorView)?.getLocationOnScreen(origin)
    return ScanFrame(origin[0], origin[1], decorView.resources.displayMetrics.density)
  }

  private fun findHostView(view: View): View? {
    if (testIdOf(view) == HOST_TEST_ID) return view
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        findHostView(view.getChildAt(i))?.let { return it }
      }
    }
    return null
  }

  private fun testIdOf(view: View): String? =
    (view.getTag(R.id.react_test_id) as? String) ?: (view.tag as? String)

  private fun walk(view: View, out: WritableArray, frame: ScanFrame) {
    if (view.visibility != View.VISIBLE) return

    captureNode(view, frame)?.let { out.pushMap(it) }

    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        walk(view.getChildAt(i), out, frame)
      }
    }
  }

  private fun captureNode(view: View, frame: ScanFrame): WritableMap? {
    val width = view.width
    val height = view.height
    if (width <= 0 || height <= 0) return null

    val locationOnScreen = IntArray(2)
    view.getLocationOnScreen(locationOnScreen)

    val isSecure = isSecureField(view)

    val map = Arguments.createMap()
    map.putString("viewId", resolveViewId(view))
    map.putString("className", view.javaClass.simpleName)
    map.putDouble("x", pxToDp(locationOnScreen[0] - frame.originX, frame.density))
    map.putDouble("y", pxToDp(locationOnScreen[1] - frame.originY, frame.density))
    map.putDouble("width", pxToDp(width, frame.density))
    map.putDouble("height", pxToDp(height, frame.density))
    map.putBoolean("isSecure", isSecure)
    map.putBoolean("isInteractive", isInteractive(view))
    map.putString("text", if (isSecure) "" else extractText(view))
    return map
  }

  private fun pxToDp(px: Int, density: Float): Double {
    if (density <= 0f) return px.toDouble()
    return px / density.toDouble()
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

  companion object {
    const val HOST_TEST_ID = "cane-sdk-host"
  }
}
