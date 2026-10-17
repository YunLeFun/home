import AppKit
import SwiftUI
import HomeCore

final class ACRemoteContainerView: ACSceneContainerView {
  private let remote: ACRemoteController
  private let store: HomeStore
  private let draggable: Bool
  private var downAction: ACRemoteAction?
  private var downPoint: CGPoint?
  private var dragged = false
  private var accessibilityButtons: [ACRemoteAccessibilityButton] = []
  private var releaseTask: Task<Void, Never>?

  init(controller: ACRemoteController, store: HomeStore, draggable: Bool) {
    remote = controller
    self.store = store
    self.draggable = draggable
    super.init(controller: controller)
    setAccessibilityElement(true)
    setAccessibilityRole(.group)
    setAccessibilityLabel("三维空调遥控器")
    accessibilityButtons = ACRemoteAction.allCases.map { action in
      let element = ACRemoteAccessibilityButton()
      element.owner = self
      element.action = action
      element.setAccessibilityRole(.button)
      element.setAccessibilityLabel(action.label)
      element.setAccessibilityParent(self)
      return element
    }
    setAccessibilityChildren(accessibilityButtons)
    toolTip = draggable ? "点击按钮控制空调；拖动机身移动；右键打开菜单。" : "点击遥控器按钮控制空调。"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  deinit { releaseTask?.cancel() }

  func updatePresentation(_ presentation: ACRemotePresentation) {
    let changed = remote.configure(presentation)
    if let pressed = remote.pressed, !presentation.enabledActions.contains(pressed) {
      remote.setPressed(nil)
    }
    update(state: presentation.state, active: true, forceRedraw: changed)
    updateAccessibility()
    window?.invalidateCursorRects(for: self)
  }

  override func layout() { super.layout(); updateAccessibility() }
  override func viewDidMoveToWindow() { super.viewDidMoveToWindow(); updateAccessibility() }

  override func stopRendering() {
    releaseTask?.cancel()
    downAction = nil
    downPoint = nil
    remote.setPressed(nil)
    super.stopRendering()
  }

  private func updateAccessibility() {
    setAccessibilityValue("\(store.status(for: .airConditioner))，\(store.acState.temperatureLabel)摄氏度")
    for element in accessibilityButtons {
      element.setAccessibilityEnabled(element.action.isEnabled(in: store))
      let rect = convert(remote.buttonFrame(element.action, in: bounds.size), to: nil)
      element.setAccessibilityFrame(window?.convertToScreen(rect) ?? .zero)
    }
  }

  override func resetCursorRects() {
    for action in ACRemoteAction.allCases where action.isEnabled(in: store) {
      addCursorRect(remote.buttonFrame(action, in: bounds.size), cursor: .pointingHand)
    }
  }

  override func mouseDown(with event: NSEvent) {
    releaseTask?.cancel()
    downAction = nil
    let point = convert(event.locationInWindow, from: nil)
    downPoint = point
    dragged = false
    if let action = remote.action(at: point, in: bounds.size) {
      guard action.isEnabled(in: store) else { return }
      downAction = action
      renderForChange()
      remote.setPressed(action)
    } else if draggable {
      window?.performDrag(with: event)
    }
  }

  override func mouseDragged(with event: NSEvent) {
    guard let action = downAction, let downPoint else { return }
    let point = convert(event.locationInWindow, from: nil)
    if hypot(point.x - downPoint.x, point.y - downPoint.y) > 6 { dragged = true }
    renderForChange()
    remote.setPressed(!dragged && remote.action(at: point, in: bounds.size) == action ? action : nil)
  }

  override func mouseUp(with event: NSEvent) {
    guard let action = downAction else { return }
    let point = convert(event.locationInWindow, from: nil)
    renderForChange()
    remote.setPressed(nil)
    downAction = nil
    downPoint = nil
    if !dragged && remote.action(at: point, in: bounds.size) == action { action.perform(in: store) }
  }

  @discardableResult
  func activate(_ action: ACRemoteAction) -> Bool {
    guard action.isEnabled(in: store) else { return false }
    releaseTask?.cancel()
    renderForChange()
    remote.setPressed(action)
    let performed = action.perform(in: store)
    releaseTask = Task { @MainActor [weak self] in
      do { try await Task.sleep(for: .milliseconds(120)) } catch { return }
      guard let self else { return }
      self.renderForChange()
      self.remote.setPressed(nil)
    }
    return performed
  }

  // The remote keeps a fixed view so the button positions stay predictable.
  override func scrollWheel(with event: NSEvent) { nextResponder?.scrollWheel(with: event) }
}

private final class ACRemoteAccessibilityButton: NSAccessibilityElement {
  weak var owner: ACRemoteContainerView?
  var action: ACRemoteAction = .power
  override func accessibilityPerformPress() -> Bool { owner?.activate(action) ?? false }
}

struct ACRemoteSceneView: NSViewRepresentable {
  let controller: ACRemoteController
  let store: HomeStore
  let presentation: ACRemotePresentation
  var draggable = false

  func makeNSView(context: Context) -> ACRemoteContainerView {
    ACRemoteContainerView(controller: controller, store: store, draggable: draggable)
  }
  func updateNSView(_ view: ACRemoteContainerView, context: Context) { view.updatePresentation(presentation) }
  static func dismantleNSView(_ view: ACRemoteContainerView, coordinator: ()) { view.stopRendering() }
}

struct ACRemotePreview: View {
  let store: HomeStore
  var draggable = false
  @State private var controller: ACRemoteController?
  @State private var errorMessage: String?

  var body: some View {
    Group {
      if let controller {
        ACRemoteSceneView(controller: controller, store: store,
                          presentation: ACRemotePresentation(store: store), draggable: draggable)
      } else if let errorMessage {
        Label(errorMessage, systemImage: "exclamationmark.triangle")
          .font(.caption).foregroundStyle(.secondary)
      } else { ProgressView().controlSize(.small) }
    }
    .task {
      guard controller == nil else { return }
      do { controller = try await ACRemoteController.load(); errorMessage = nil }
      catch is CancellationError {}
      catch { errorMessage = error.localizedDescription }
    }
  }
}
