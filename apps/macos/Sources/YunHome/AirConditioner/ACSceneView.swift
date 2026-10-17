import AppKit
import CuteACKit
import RealityKit
import SwiftUI
import HomeCore

/// Serialize live views to avoid camera/snapshot interference observed with
/// concurrent macOS ARViews; cached images keep every companion visible.
@MainActor
private enum ACRenderQueue {
  private final class Request {
    weak var view: ACSceneContainerView?
    init(_ view: ACSceneContainerView) { self.view = view }
  }
  private static weak var owner: ACSceneContainerView?
  private static var pending: [Request] = []

  static func request(_ view: ACSceneContainerView) {
    if owner === view { return }
    if owner == nil {
      owner = view
      view.startRenderer()
    } else if !pending.contains(where: { $0.view === view }) {
      pending.append(Request(view))
    }
  }

  static func release(_ view: ACSceneContainerView) {
    pending.removeAll { $0.view == nil || $0.view === view }
    guard owner === view else { return }
    owner = nil
    // Let snapshot callbacks finish and the old ARView deinitialize first.
    Task { @MainActor in
      await Task.yield()
      guard owner == nil else { return }
      while !pending.isEmpty {
        if let next = pending.removeFirst().view {
          owner = next
          next.startRenderer()
          break
        }
      }
    }
  }
}

/// RealityKit renders during changes; a transparent snapshot holds the resting
/// pose while Core Animation runs the cold/hot airflow independently.
class ACSceneContainerView: NSView {
  private var sceneView: ARView?
  let airflowLayer = ACAirflowLayer()
  private let snapshotView = NSImageView()
  private let controller: any ACSceneRendering
  private let interactive: Bool
  private var lastState: ACState?
  private var lastRoom: RoomReading?
  private var requestedActive = false
  private var active = false
  private var snapshotTask: Task<Void, Never>?
  private var renderGeneration = 0
  private var previousDragPoint: CGPoint?

  /// The desktop panel handles its own dragging, double-click and context menu.
  init(controller: any ACSceneRendering, interactive: Bool = true) {
    self.controller = controller
    self.interactive = interactive
    super.init(frame: .zero)
    wantsLayer = true
    layer?.isOpaque = false
    snapshotView.imageScaling = .scaleAxesIndependently
    snapshotView.isEditable = false
    addSubview(snapshotView)
    layer?.addSublayer(airflowLayer)
    for name in [NSWindow.didChangeOcclusionStateNotification, NSWindow.didMiniaturizeNotification,
                 NSWindow.didDeminiaturizeNotification] {
      NotificationCenter.default.addObserver(self, selector: #selector(refreshActivity), name: name, object: nil)
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func layout() {
    super.layout()
    let resized = snapshotView.frame.size != bounds.size
    sceneView?.frame = bounds
    snapshotView.frame = bounds
    if resized && active { renderForChange() }
    positionAirflow()
  }

  override func viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    refreshActivity()
  }

  override func viewDidHide() { super.viewDidHide(); refreshActivity() }
  override func viewDidUnhide() { super.viewDidUnhide(); refreshActivity() }

  @objc private func refreshActivity() {
    guard let state = lastState else { return }
    update(state: state, room: lastRoom, active: requestedActive)
  }

  deinit {
    snapshotTask?.cancel()
    NotificationCenter.default.removeObserver(self)
  }

  func update(state: ACState, room: RoomReading? = nil, active requested: Bool, forceRedraw: Bool = false) {
    requestedActive = requested
    let wasActive = active
    active = requested && !isHiddenOrHasHiddenAncestor && window?.isVisible == true
      && window?.occlusionState.contains(.visible) == true
    let changed = state != lastState || room != lastRoom || forceRedraw
    if active && (!wasActive || changed) { beginRendering() }
    if changed {
      lastState = state
      lastRoom = room
      controller.apply(state, room: room, animated: active && wasActive)
    }
    if active {
      if !wasActive || changed { scheduleSnapshot() }
    } else {
      stopRendering()
    }
    let flow = controller.showsAirflow && active && state.status
      ? ACAirflowLayer.Flow(mode: state.mode, windLevel: state.windLevel(room: room)) : nil
    if flow != airflowLayer.flow { configureAirflow(flow) }
  }

  func stopRendering() {
    renderGeneration += 1
    snapshotTask?.cancel()
    snapshotTask = nil
    controller.finishAnimations()
    releaseRenderer()
    snapshotView.isHidden = false
    configureAirflow(nil)
    active = false
    previousDragPoint = nil
  }

  private func beginRendering() {
    renderGeneration += 1
    snapshotTask?.cancel()
    ACRenderQueue.request(self)
  }

  fileprivate func startRenderer() {
    guard active else { ACRenderQueue.release(self); return }
    controller.anchor.isEnabled = true
    if sceneView == nil {
      let view = ARView(frame: bounds)
      view.environment.background = .color(.clear)
      view.environment.lighting.intensityExponent = 0.3
      view.wantsLayer = true
      view.layer?.isOpaque = false
      view.scene.addAnchor(controller.anchor)
      addSubview(view, positioned: .below, relativeTo: snapshotView)
      sceneView = view
    }
    snapshotView.isHidden = true
    scheduleSnapshot()
  }

  /// Hiding ARView alone leaves its engine running. Release the view and its
  /// scene when idle, keeping the reusable entities and last rendered pixels.
  private func releaseRenderer() {
    sceneView?.scene.anchors.removeAll()
    sceneView?.removeFromSuperview()
    sceneView = nil
    controller.anchor.isEnabled = false
    ACRenderQueue.release(self)
  }

  func renderForChange() {
    guard active else { return }
    beginRendering()
    positionAirflow()
    scheduleSnapshot()
  }

  private func scheduleSnapshot() {
    guard sceneView != nil else { return }
    snapshotTask?.cancel()
    let generation = renderGeneration
    snapshotTask = Task { @MainActor [weak self] in
      do { try await Task.sleep(for: self?.controller.settlingDuration ?? .milliseconds(700)) } catch { return }
      guard let self, self.active, self.renderGeneration == generation else { return }
      self.controller.finishAnimations()
      self.positionAirflow()
      // A stale completion must never replace a newer state, camera or size.
      self.sceneView?.snapshot(saveToHDR: false) { [weak self] image in
        Task { @MainActor [weak self] in
          guard let self, self.active, self.renderGeneration == generation else { return }
          if let image { self.snapshotView.image = image }
          else { NSLog("Unable to capture a RealityKit companion snapshot") }
          self.snapshotView.isHidden = false
          self.releaseRenderer()
        }
      }
    }
  }

  override func hitTest(_ point: NSPoint) -> NSView? {
    guard interactive, !isHidden, bounds.contains(convert(point, from: superview)) else { return nil }
    return self
  }

  override func mouseDown(with event: NSEvent) {
    previousDragPoint = convert(event.locationInWindow, from: nil)
  }

  override func mouseDragged(with event: NSEvent) {
    let point = convert(event.locationInWindow, from: nil)
    if let previousDragPoint, active {
      controller.orbit(delta: CGPoint(x: point.x - previousDragPoint.x, y: point.y - previousDragPoint.y))
      renderForChange()
    }
    previousDragPoint = point
  }

  override func mouseUp(with event: NSEvent) { previousDragPoint = nil }

  override func scrollWheel(with event: NSEvent) {
    guard active else { return }
    controller.zoom(delta: event.scrollingDeltaY)
    renderForChange()
  }

  private func positionAirflow() {
    guard bounds.width > 0, let sceneView, let projected = sceneView.project(controller.airflowOrigin) else { return }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    airflowLayer.position = sceneView.convert(projected, to: self)
    CATransaction.commit()
  }

  /// CuteACKit's overlay: snowflakes or warm strokes, denser and faster as
  /// the room's wind level rises.
  private func configureAirflow(_ flow: ACAirflowLayer.Flow?) {
    airflowLayer.configure(flow, span: bounds.width * 0.78)
    positionAirflow()
  }
}

struct ACSceneView: NSViewRepresentable {
  let controller: ACSceneController
  let state: ACState
  var room: RoomReading?
  let isActive: Bool
  var interactive = true

  func makeNSView(context: Context) -> ACSceneContainerView {
    ACSceneContainerView(controller: controller, interactive: interactive)
  }

  func updateNSView(_ view: ACSceneContainerView, context: Context) {
    view.update(state: state, room: room, active: isActive)
  }

  static func dismantleNSView(_ view: ACSceneContainerView, coordinator: ()) {
    view.stopRendering()
  }
}
