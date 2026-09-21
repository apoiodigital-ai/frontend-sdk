import Foundation
import UIKit

@objc(CaneViewScanner)
public class CaneViewScanner: NSObject {

  private var pendingWorkItem: DispatchWorkItem?
  private let debounceSeconds: TimeInterval

  @objc public init(debounceMs: Double) {
    self.debounceSeconds = debounceMs / 1000.0
    super.init()
  }

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

  private func identifier(for view: UIView) -> String {
    if let identifier = view.accessibilityIdentifier, !identifier.isEmpty {
      return identifier
    }
    if let label = view.accessibilityLabel, !label.isEmpty {
      return label
    }
    return "view-\(ObjectIdentifier(view).hashValue)"
  }

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
