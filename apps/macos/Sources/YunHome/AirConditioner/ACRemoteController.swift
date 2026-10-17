import AppKit
import RealityKit
import HomeCore
import HomeDeviceKit

/// Commands always go through HomeStore, including real-device capability and
/// availability checks. Merely opening the remote never sends a command.
enum ACRemoteAction: String, CaseIterable {
  case power = "PowerButton"
  case temperatureDown = "TemperatureDownButton"
  case temperatureUp = "TemperatureUpButton"
  case mode = "ModeButton"

  var label: String {
    switch self {
    case .power: "遥控器电源"
    case .temperatureDown: "遥控器降低温度"
    case .temperatureUp: "遥控器升高温度"
    case .mode: "遥控器切换冷暖模式"
    }
  }

  @MainActor
  static func nextMode(in store: HomeStore) -> ACMode? {
    guard store.haBinding != nil else { return store.acState.mode == .cold ? .hot : .cold }
    let modes = store.homeAssistant.snapshot?.modes ?? []
    let current = store.homeAssistant.displayMode
    if current != "heat", modes.contains("heat") { return .hot }
    if current != "cool", modes.contains("cool") { return .cold }
    return nil
  }

  @MainActor
  func isEnabled(in store: HomeStore) -> Bool {
    guard store.acCanControl else { return false }
    let canSetTemperature = store.haBinding == nil || store.homeAssistant.snapshot?.supportsTemperature == true
    switch self {
    case .power: return true
    case .temperatureDown: return canSetTemperature && store.acState.temperature > store.acMinimum
    case .temperatureUp: return canSetTemperature && store.acState.temperature < store.acMaximum
    case .mode: return Self.nextMode(in: store) != nil
    }
  }

  @MainActor @discardableResult
  func perform(in store: HomeStore) -> Bool {
    // Recheck on release: a device can disconnect or become busy while held.
    guard isEnabled(in: store) else { return false }
    switch self {
    case .power: store.send(.ac(.toggle))
    case .temperatureDown:
      store.send(.ac(.temperature(max(store.acMinimum, store.acState.temperature - store.acStep))))
    case .temperatureUp:
      store.send(.ac(.temperature(min(store.acMaximum, store.acState.temperature + store.acStep))))
    case .mode:
      guard let next = Self.nextMode(in: store) else { return false }
      store.send(.ac(.mode(next)))
    }
    return true
  }
}

struct ACRemotePresentation: Equatable {
  var state: ACState
  var modeTitle: String
  var statusTitle: String
  var enabledActions: Set<ACRemoteAction>

  @MainActor init(store: HomeStore) {
    state = store.acState
    if store.haBinding == nil {
      modeTitle = state.mode == .cold ? "制冷" : "制热"
      statusTitle = state.status ? "运行中" : "待机"
    } else {
      modeTitle = haModeName(store.homeAssistant.displayMode)
      statusTitle = store.homeAssistant.pending ? "等待确认" : store.homeAssistant.state.name
    }
    enabledActions = Set(ACRemoteAction.allCases.filter { $0.isEnabled(in: store) })
  }
}

@MainActor
final class ACRemoteController: ACSceneRendering {
  let anchor = AnchorEntity(world: .zero)
  let camera = PerspectiveCamera()
  let model: Entity
  var settlingDuration: Duration { .milliseconds(220) }
  private let screen: Entity
  private let buttons: [ACRemoteAction: Entity]
  private let resting: [ACRemoteAction: Transform]
  private let buttonMaterials: [ACRemoteAction: [any Material]]
  private(set) var presentation: ACRemotePresentation?
  private(set) var pressed: ACRemoteAction?
  private static let fieldOfView: Float = 32

  static func load() async throws -> ACRemoteController {
    try await ACRemoteController(model: ACSceneController.loadModel(named: "ACRemote"))
  }

  init(model: Entity) throws {
    self.model = model
    guard let screen = model.findEntity(named: "Screen").flatMap(Self.firstModel(in:)) else {
      throw ACSceneController.ModelError.missingPart("Screen")
    }
    self.screen = screen
    var buttons: [ACRemoteAction: Entity] = [:]
    for action in ACRemoteAction.allCases {
      guard let entity = model.findEntity(named: action.rawValue) else {
        throw ACSceneController.ModelError.missingPart(action.rawValue)
      }
      buttons[action] = entity
    }
    self.buttons = buttons
    resting = buttons.mapValues(\.transform)
    buttonMaterials = buttons.compactMapValues { Self.firstModel(in: $0)?.components[ModelComponent.self]?.materials }
    model.orientation = simd_quatf(angle: -0.055, axis: [0, 0, 1]) * model.orientation
    anchor.addChild(model)
    camera.camera = PerspectiveCameraComponent(near: 0.1, far: 20, fieldOfViewInDegrees: Self.fieldOfView)
    camera.look(at: .zero, from: [0.18, 0.12, 3.05], relativeTo: nil)
    anchor.addChild(camera)
    let key = DirectionalLight()
    key.light.intensity = 1900
    key.look(at: .zero, from: [-3, 4, 5], relativeTo: nil)
    anchor.addChild(key)
    let fill = DirectionalLight()
    fill.light.intensity = 700
    fill.look(at: .zero, from: [3, -1, 4], relativeTo: nil)
    anchor.addChild(fill)
    if let brand = model.findEntity(named: "Brand").flatMap(Self.firstModel(in:)) {
      let image = NSImage(size: NSSize(width: 400, height: 100), flipped: false) { rect in
        NSColor(calibratedRed: 0.91, green: 0.925, blue: 0.9, alpha: 1).setFill(); rect.fill()
        let text = NSAttributedString(string: "Y U N  H O M E", attributes: [
          .font: NSFont.systemFont(ofSize: 36, weight: .medium),
          .foregroundColor: NSColor(calibratedRed: 0.32, green: 0.43, blue: 0.37, alpha: 1),
        ])
        text.draw(at: NSPoint(x: (rect.width - text.size().width) / 2, y: 30))
        return true
      }
      Self.setTexture(image, on: brand)
    }
  }

  /// Context changes (offline/pending/capabilities) also invalidate the image.
  func configure(_ presentation: ACRemotePresentation) -> Bool {
    guard self.presentation != presentation else { return false }
    self.presentation = presentation
    for (action, entity) in buttons {
      guard let geometry = Self.firstModel(in: entity), var component = geometry.components[ModelComponent.self] else { continue }
      component.materials = presentation.enabledActions.contains(action)
        ? (buttonMaterials[action] ?? component.materials)
        : [SimpleMaterial(color: NSColor(calibratedWhite: 0.52, alpha: 1), roughness: 1, isMetallic: false)]
      geometry.components.set(component)
    }
    return true
  }

  func apply(_ state: ACState, animated: Bool) {
    Self.setTexture(displayImage(state), on: screen)
  }

  func setPressed(_ action: ACRemoteAction?) {
    pressed = action
    for (key, entity) in buttons {
      guard var transform = resting[key] else { continue }
      if key == action { transform.translation.z -= 0.012 }
      entity.stopAllAnimations()
      entity.move(to: transform, relativeTo: entity.parent, duration: 0.08, timingFunction: .easeOut)
    }
  }

  func finishAnimations() {
    for (key, entity) in buttons {
      entity.stopAllAnimations(recursive: true)
      guard var transform = resting[key] else { continue }
      if key == pressed { transform.translation.z -= 0.012 }
      entity.transform = transform
    }
  }

  /// Project actual button geometry using the fixed camera. This works while
  /// ARView is released, so hovering and clicking never need a render loop.
  func buttonFrame(_ action: ACRemoteAction, in size: CGSize) -> CGRect {
    guard let entity = buttons[action], size.width > 0, size.height > 0 else { return .zero }
    let bounds = entity.visualBounds(relativeTo: entity)
    let half = bounds.extents / 2
    var points: [CGPoint] = []
    for x: Float in [-1, 1] {
      for y: Float in [-1, 1] {
        let local = bounds.center + SIMD3(x * half.x, y * half.y, half.z)
        let world = entity.convert(position: local, to: nil)
        let point = camera.convert(position: world, from: nil)
        guard point.z < -0.1 else { continue }
        let tangent = tan(Self.fieldOfView * .pi / 360)
        let ndcX = point.x / (-point.z * tangent * Float(size.width / size.height))
        let ndcY = point.y / (-point.z * tangent)
        points.append(CGPoint(x: (CGFloat(ndcX) + 1) * size.width / 2,
                              y: (CGFloat(ndcY) + 1) * size.height / 2))
      }
    }
    guard let minX = points.map(\.x).min(), let maxX = points.map(\.x).max(),
          let minY = points.map(\.y).min(), let maxY = points.map(\.y).max() else { return .zero }
    return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY).insetBy(dx: -3, dy: -3)
  }

  func action(at point: CGPoint, in size: CGSize) -> ACRemoteAction? {
    ACRemoteAction.allCases.first { buttonFrame($0, in: size).contains(point) }
  }

  private func displayImage(_ state: ACState) -> NSImage {
    let presentation = presentation
    return NSImage(size: NSSize(width: 500, height: 400), flipped: false) { rect in
      NSColor(calibratedRed: 0.66, green: 0.77, blue: 0.68, alpha: 1).setFill(); rect.fill()
      let ink = NSColor(calibratedRed: 0.09, green: 0.19, blue: 0.15, alpha: 1)
      func draw(_ string: String, font: NSFont, x: CGFloat, y: CGFloat, alpha: CGFloat = 1) {
        NSAttributedString(string: string, attributes: [.font: font, .foregroundColor: ink.withAlphaComponent(alpha)])
          .draw(at: NSPoint(x: x, y: y))
      }
      draw("YUN HOME", font: .systemFont(ofSize: 23, weight: .medium), x: 32, y: 340, alpha: 0.7)
      let value = state.status ? state.temperatureLabel : "OFF"
      let size: CGFloat = value.count > 4 ? 138 : (value.count > 2 ? 184 : 226)
      draw(value, font: state.status ? ACFonts.digital(size: size) : .systemFont(ofSize: 138, weight: .light), x: 32, y: 126)
      if state.status { draw("°C", font: .systemFont(ofSize: 38, weight: .medium), x: 390, y: 202) }
      draw(state.status ? (presentation?.modeTitle ?? "制冷") : "待机",
           font: .systemFont(ofSize: 38, weight: .medium), x: 32, y: 72)
      draw(presentation?.statusTitle ?? "", font: .systemFont(ofSize: 25), x: 300, y: 78, alpha: 0.7)
      return true
    }
  }

  private static func firstModel(in entity: Entity) -> Entity? {
    if entity.components[ModelComponent.self] != nil { return entity }
    return entity.children.lazy.compactMap { firstModel(in: $0) }.first
  }

  private static func setTexture(_ image: NSImage, on entity: Entity) {
    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
          var component = entity.components[ModelComponent.self] else { return }
    do {
      let texture = try TextureResource.generate(from: cgImage, options: .init(semantic: .color))
      var material = UnlitMaterial()
      material.color = .init(tint: .white, texture: .init(texture))
      component.materials = [material]
      entity.components.set(component)
    } catch { NSLog("Unable to update remote display: %@", error.localizedDescription) }
  }
}
