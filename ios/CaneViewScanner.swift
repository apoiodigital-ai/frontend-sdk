import Foundation
import UIKit

/// In-App View Scanner (iOS).
///
/// Mirrors `android/.../ViewHierarchyScanner.kt`: walks the host app's OWN
/// `UIWindow` hierarchy (never any accessibility service, never another
/// process) and produces a flattened, privacy-scrubbed snapshot of what is
/// currently on screen. See the SDK README's "Privacy design" section for
/// why this only ever runs on-demand and never streams continuously.
///
/// IMPORTANT -- environment limitation: this file was written on a Windows
/// machine with no Xcode/macOS toolchain available. It has NOT been
/// compiled, run, or tested against a real UIKit runtime. It's written
/// carefully from documented UIKit/Swift-ObjC-interop APIs, but treat it as
/// unverified until someone builds it in Xcode. See README "What could not
/// be built/verified in this environment."
@objc(CaneViewScanner)
public class CaneViewScanner: NSObject {

  private var pendingWorkItem: DispatchWorkItem?
  private let debounceSeconds: TimeInterval

  @objc public init(debounceMs: Double) {
    self.debounceSeconds = debounceMs / 1000.0
    super.init()
  }

  /// Schedules a single debounced read of the key window's view hierarchy.
  /// `completion` is always invoked exactly once, on the main thread, and
  /// never throws -- any internal failure resolves with an empty array so
  /// the JS side can fail safe instead of surfacing a native crash.
  @objc public func scan(completion: @escaping ([[String: Any]]) -> Void) {
    pendingWorkItem?.cancel()

    let work = DispatchWorkItem { [weak self] in
      guard let self = self else {
        completion([])
        return
      }
      guard let window = CaneViewScanner.resolveKeyWindow() else {
        completion([])
        return
      }
      var results: [[String: Any]] = []
      self.walk(view: window, window: window, into: &results)
      completion(results)
    }
    pendingWorkItem = work
    DispatchQueue.main.asyncAfter(deadline: .now() + debounceSeconds, execute: work)
  }

  private static func resolveKeyWindow() -> UIWindow? {
    if #available(iOS 13.0, *) {
      let scenes = UIApplication.shared.connectedScenes
      for scene in scenes {
        guard let windowScene = scene as? UIWindowScene else { continue }
        if let keyWindow = windowScene.windows.first(where: { $0.isKeyWindow }) {
          return keyWindow
        }
      }
      // Fall back to the first available window if none is flagged "key"
      // yet (can happen very early in app launch).
      return (scenes.first as? UIWindowScene)?.windows.first
    }
    return UIApplication.shared.keyWindow
  }

  private func walk(view: UIView, window: UIWindow, into results: inout [[String: Any]]) {
    if view.isHidden || view.alpha <= 0.01 { return }

    if let node = captureNode(view: view, window: window) {
      results.append(node)
    }

    for subview in view.subviews {
      walk(view: subview, window: window, into: &results)
    }
  }

  private func captureNode(view: UIView, window: UIWindow) -> [String: Any]? {
    // Convert this view's local bounds into the window's coordinate space,
    // per the spec: `view.convert(view.bounds, to: window)`.
    let frameInWindow = view.convert(view.bounds, to: window)
    guard frameInWindow.width > 0, frameInWindow.height > 0 else { return nil }

    let isSecure = isSecureField(view)

    let node: [String: Any] = [
      "viewId": identifier(for: view),
      "className": String(describing: type(of: view)),
      "x": Double(frameInWindow.origin.x),
      "y": Double(frameInWindow.origin.y),
      "width": Double(frameInWindow.width),
      "height": Double(frameInWindow.height),
      "isSecure": isSecure,
      "isInteractive": isInteractive(view),
      "text": isSecure ? "" : extractText(view),
    ]
    return node
  }

  /// Priority order mirrors the Android scanner:
  ///  1. `accessibilityIdentifier` -- this is what RN's `testID` prop maps
  ///     to on iOS, so it's the closest thing to a stable, developer-chosen id.
  ///  2. `accessibilityLabel` -- populated by RN's `accessibilityLabel`
  ///     prop; commonly set anyway for real accessibility purposes.
  ///  3. A synthetic per-instance fallback.
  private func identifier(for view: UIView) -> String {
    if let identifier = view.accessibilityIdentifier, !identifier.isEmpty {
      return identifier
    }
    if let label = view.accessibilityLabel, !label.isEmpty {
      return label
    }
    return "view-\(ObjectIdentifier(view).hashValue)"
  }

  /// Masks secure-entry fields before anything ever leaves native code.
  /// Only `UITextField.isSecureTextEntry` is checked -- UIKit's `UITextView`
  /// has no equivalent secure-entry concept, matching the Android side
  /// where only `EditText` variations are checked.
  private func isSecureField(_ view: UIView) -> Bool {
    if let field = view as? UITextField {
      return field.isSecureTextEntry
    }
    return false
  }

  private func isInteractive(_ view: UIView) -> Bool {
    if view is UIControl { return true }
    if let recognizers = view.gestureRecognizers, !recognizers.isEmpty { return true }
    return false
  }

  private func extractText(_ view: UIView) -> String {
    if let label = view as? UILabel, let text = label.text, !text.isEmpty {
      return text
    }
    if let button = view as? UIButton, let text = button.titleLabel?.text, !text.isEmpty {
      return text
    }
    if let field = view as? UITextField, let text = field.text, !text.isEmpty {
      return text
    }
    if let textView = view as? UITextView, !textView.text.isEmpty {
      return textView.text
    }
    if let label = view.accessibilityLabel, !label.isEmpty {
      return label
    }
    return ""
  }
}
