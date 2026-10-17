import AppKit
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
  let airflowLayer = CALayer()
  private let snapshotView = NSImageView()
  private let controller: any ACSceneRendering
  private let interactive: Bool
  private var airflowMode: ACMode?
  private var lastState: ACState?
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
    update(state: state, active: requestedActive)
  }

  deinit {
    snapshotTask?.cancel()
    NotificationCenter.default.removeObserver(self)
  }

  func update(state: ACState, active requested: Bool, forceRedraw: Bool = false) {
    requestedActive = requested
    let wasActive = active
    active = requested && !isHiddenOrHasHiddenAncestor && window?.isVisible == true
      && window?.occlusionState.contains(.visible) == true
    let changed = state != lastState || forceRedraw
    if active && (!wasActive || changed) { beginRendering() }
    if changed {
      lastState = state
      controller.apply(state, animated: active && wasActive)
    }
    if active {
      if !wasActive || changed { scheduleSnapshot() }
    } else {
      stopRendering()
    }
    let mode: ACMode? = controller.showsAirflow && active && state.status ? state.mode : nil
    if mode != airflowMode {
      airflowMode = mode
      configureAirflow(for: mode)
    }
  }

  func stopRendering() {
    renderGeneration += 1
    snapshotTask?.cancel()
    snapshotTask = nil
    controller.finishAnimations()
    releaseRenderer()
    snapshotView.isHidden = false
    airflowMode = nil
    configureAirflow(for: nil)
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

  /// Cold: a few snowflakes drift down and spin. Hot: warm wavy strokes.
  /// Both are plain repeating CA animations, so the render server runs them
  /// and the app process does no per-frame work (unlike CAEmitterLayer,
  /// which cost ~10% CPU here).
  private func configureAirflow(for mode: ACMode?) {
    airflowLayer.sublayers?.forEach { $0.removeFromSuperlayer() }
    guard let mode else { return }

    let color = ACSceneController.accent(for: mode)
    let now = CACurrentMediaTime()
    let span = min(260, bounds.width * 0.78)

    switch mode {
    case .cold:
      let flake = Self.snowflakeImage(color: color)
      let count = 6
      for index in 0..<count {
        let layer = CALayer()
        let size: CGFloat = index.isMultiple(of: 2) ? 14 : 10
        layer.bounds = CGRect(x: 0, y: 0, width: size, height: size)
        layer.contents = flake
        layer.position = CGPoint(x: span * (CGFloat(index) / CGFloat(count - 1) - 0.5), y: -6)
        layer.opacity = 0
        layer.add(Self.flowAnimation(
          distance: index.isMultiple(of: 2) ? -42 : -34,
          duration: 2.4,
          spin: index.isMultiple(of: 2) ? .pi : -.pi,
          beginTime: now + Double((index * 5) % count) * 0.4
        ), forKey: "flow")
        airflowLayer.addSublayer(layer)
      }
    case .hot:
      let spacing = span / 3
      for index in 0..<3 {
        let line = CAShapeLayer()
        line.bounds = CGRect(x: 0, y: -6, width: 64, height: 12)
        line.position = CGPoint(x: CGFloat(index - 1) * spacing, y: -8)
        line.path = Self.windPath(width: 64, amplitude: 6)
        line.strokeColor = color.cgColor
        line.fillColor = nil
        line.lineWidth = 2.4
        line.lineCap = .round
        line.opacity = 0
        line.add(Self.flowAnimation(distance: -30, duration: 1.8, spin: 0, beginTime: now + Double(index) * 0.6), forKey: "flow")
        airflowLayer.addSublayer(line)
      }
    }
    positionAirflow()
  }

  private static func flowAnimation(distance: CGFloat, duration: CFTimeInterval, spin: CGFloat, beginTime: CFTimeInterval) -> CAAnimation {
    let drift = CABasicAnimation(keyPath: "transform.translation.y")
    drift.fromValue = 0
    drift.toValue = distance
    let fade = CAKeyframeAnimation(keyPath: "opacity")
    fade.values = [0, 0.9, 0]
    fade.keyTimes = [0, 0.3, 1]
    var animations: [CAAnimation] = [drift, fade]
    if spin != 0 {
      let rotate = CABasicAnimation(keyPath: "transform.rotation.z")
      rotate.fromValue = 0
      rotate.toValue = spin
      animations.append(rotate)
    }
    let group = CAAnimationGroup()
    group.animations = animations
    group.duration = duration
    group.repeatCount = .infinity
    group.beginTime = beginTime
    group.fillMode = .backwards
    return group
  }

  private static func snowflakeImage(color: NSColor) -> CGImage? {
    let image = NSImage(size: NSSize(width: 28, height: 28), flipped: false) { rect in
      guard let symbol = NSImage(systemSymbolName: "snowflake", accessibilityDescription: nil)?
        .withSymbolConfiguration(.init(pointSize: 22, weight: .bold)) else { return false }
      symbol.draw(in: rect.insetBy(dx: 2, dy: 2))
      color.set()
      rect.fill(using: .sourceAtop)
      return true
    }
    return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
  }

  private static func windPath(width: CGFloat, amplitude: CGFloat) -> CGPath {
    let path = CGMutablePath()
    path.move(to: .zero)
    path.addCurve(
      to: CGPoint(x: width / 2, y: 0),
      control1: CGPoint(x: width / 6, y: amplitude),
      control2: CGPoint(x: width / 3, y: amplitude)
    )
    path.addCurve(
      to: CGPoint(x: width, y: 0),
      control1: CGPoint(x: width * 2 / 3, y: -amplitude),
      control2: CGPoint(x: width * 5 / 6, y: -amplitude)
    )
    return path
  }
}

struct ACSceneView: NSViewRepresentable {
  let controller: ACSceneController
  let state: ACState
  let isActive: Bool
  var interactive = true

  func makeNSView(context: Context) -> ACSceneContainerView {
    ACSceneContainerView(controller: controller, interactive: interactive)
  }

  func updateNSView(_ view: ACSceneContainerView, context: Context) {
    view.update(state: state, active: isActive)
  }

  static func dismantleNSView(_ view: ACSceneContainerView, coordinator: ()) {
    view.stopRendering()
  }
}
