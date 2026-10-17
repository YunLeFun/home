import AppKit
import Combine
import CuteACKit
import RealityKit
import HomeCore

@MainActor
protocol ACSceneRendering: AnyObject {
  var anchor: AnchorEntity { get }
  var showsAirflow: Bool { get }
  var settlingDuration: Duration { get }
  var airflowOrigin: SIMD3<Float> { get }
  /// `room` feeds the LCD (room temperature, wind bars); renderers without
  /// a display ignore it.
  func apply(_ state: ACState, room: RoomReading?, animated: Bool)
  func finishAnimations()
  func orbit(delta: CGPoint)
  func zoom(delta: CGFloat)
}

extension ACSceneRendering {
  var showsAirflow: Bool { false }
  var settlingDuration: Duration { .milliseconds(700) }
  var airflowOrigin: SIMD3<Float> { .zero }
  func orbit(delta: CGPoint) {}
  func zoom(delta: CGFloat) {}
}

/// Keeps the original USDZ hierarchy so the exported louver pivot and display
/// UVs work in RealityKit without changing the model or device state.
@MainActor
final class ACSceneController: ACSceneRendering {
  let anchor = AnchorEntity(world: .zero)
  let camera = PerspectiveCamera()
  let model: Entity
  var showsAirflow: Bool { true }

  private let louver: Entity
  private let display: Entity
  private let led: Entity
  private let restingLouver: Transform
  private var targetLouver: Transform
  private let restingModel: Transform
  private var lastState: ACState?
  private var lastRoom: RoomReading?
  private var yaw = Float(atan2(0.55, 3.0))
  private var pitch = Float(atan2(-0.43, hypot(0.55, 3.0)))
  private var distance = Float(sqrt(0.55 * 0.55 + 0.43 * 0.43 + 3 * 3))
  private static let cameraTarget = SIMD3<Float>(0, -0.02, 0)

  enum ModelError: LocalizedError {
    case missingResource, missingPart(String)
    var errorDescription: String? {
      switch self {
      case .missingResource: "找不到空调模型。"
      case .missingPart(let name): "空调模型缺少部件：\(name)。"
      }
    }
  }

  /// The unit itself comes from CuteACKit, shared with the CuteAC menu bar app.
  static func load() async throws -> ACSceneController {
    guard let url = ACModel.url else { throw ModelError.missingResource }
    return try ACSceneController(model: await loadModel(at: url))
  }

  static func loadModel(named name: String) async throws -> Entity {
    guard let url = Bundle.module.url(forResource: name, withExtension: "usdz") else {
      throw ModelError.missingResource
    }
    return try await loadModel(at: url)
  }

  static func loadModel(at url: URL) async throws -> Entity {
    let model: Entity
    if #available(macOS 15, *) {
      model = try await Entity(contentsOf: url)
    } else {
      // The publisher is the asynchronous loading API available on macOS 14.
      guard let loaded = try await Entity.loadAsync(contentsOf: url).values.first(where: { _ in true }) else {
        throw ModelError.missingResource
      }
      model = loaded
    }
    try Task.checkCancellation()
    return model
  }

  init(model: Entity) throws {
    self.model = model
    guard let louver = model.findEntity(named: ACModel.Part.louver) else { throw ModelError.missingPart(ACModel.Part.louver) }
    guard let display = model.findEntity(named: ACModel.Part.display).flatMap(Self.firstModel(in:)) else {
      throw ModelError.missingPart(ACModel.Part.display)
    }
    guard let led = model.findEntity(named: ACModel.Part.led).flatMap(Self.firstModel(in:)) else {
      throw ModelError.missingPart(ACModel.Part.led)
    }
    self.louver = louver
    self.display = display
    self.led = led
    restingLouver = louver.transform
    targetLouver = louver.transform
    restingModel = model.transform
    anchor.addChild(model)
    setUpLightsAndCamera()
  }

  func apply(_ state: ACState, room: RoomReading?, animated: Bool) {
    let previous = lastState
    let stateChanged = previous != state
    guard stateChanged || room != lastRoom else { return }
    lastState = state
    lastRoom = room
    updateDisplay(state, room: room)
    guard stateChanged else { return }

    targetLouver = restingLouver
    targetLouver.rotation *= simd_quatf(angle: state.status ? Float(ACModel.openLouverAngle) : 0, axis: [1, 0, 0])
    louver.stopAllAnimations()
    if animated {
      louver.move(to: targetLouver, relativeTo: louver.parent, duration: 0.5, timingFunction: .easeInOut)
    } else {
      louver.transform = targetLouver
    }

    Self.setMaterial(UnlitMaterial(color: ACPalette.led(for: state)), on: led)
    if animated && state.status && previous?.status == false { bounce() }
  }

  /// The LCD texture is CuteACKit's, so both apps show the same readout.
  private func updateDisplay(_ state: ACState, room: RoomReading?) {
    let image = ACDisplay.image(for: state, room: room)
    if let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
      do {
        let texture = try TextureResource.generate(from: cgImage, options: .init(semantic: .color))
        var material = UnlitMaterial()
        material.color = .init(tint: .white, texture: .init(texture))
        Self.setMaterial(material, on: display)
      } catch {
        NSLog("Unable to update air conditioner display: %@", error.localizedDescription)
      }
    }
  }

  /// Also commits animation targets when a window is hidden mid-transition.
  func finishAnimations() {
    model.stopAllAnimations(recursive: true)
    model.transform = restingModel
    louver.transform = targetLouver
  }

  func orbit(delta: CGPoint) {
    yaw -= Float(delta.x) * 0.01
    pitch = min(25 * .pi / 180, max(-25 * .pi / 180, pitch - Float(delta.y) * 0.01))
    updateCamera()
  }

  func zoom(delta: CGFloat) {
    distance = min(6, max(1.9, distance + Float(delta) * 0.015))
    updateCamera()
  }

  var airflowOrigin: SIMD3<Float> {
    let world = louver.position(relativeTo: nil)
    return world + SIMD3(0, -0.1, 0.05)
  }

  // MARK: Motion and setup

  private func bounce() {
    model.stopAllAnimations(recursive: false)
    model.transform = restingModel
    var enlarged = restingModel
    enlarged.scale *= 1.03
    do {
      let up = try AnimationResource.generate(with: FromToByAnimation(
        from: restingModel, to: enlarged, duration: 0.12, timing: .easeOut, bindTarget: .transform))
      let down = try AnimationResource.generate(with: FromToByAnimation(
        from: enlarged, to: restingModel, duration: 0.3, timing: .easeInOut, bindTarget: .transform))
      model.playAnimation(try .sequence(with: [up, down]))
    } catch {
      model.transform = restingModel
    }
  }

  private func setUpLightsAndCamera() {
    camera.camera = PerspectiveCameraComponent(near: 0.1, far: 20, fieldOfViewInDegrees: 24)
    updateCamera()
    anchor.addChild(camera)

    let key = DirectionalLight()
    key.light.color = .white
    key.light.intensity = 1800
    key.look(at: .zero, from: [-3, 4, 5], relativeTo: nil)
    anchor.addChild(key)
    let fill = DirectionalLight()
    fill.light.color = NSColor(calibratedRed: 1, green: 0.95, blue: 0.9, alpha: 1)
    fill.light.intensity = 600
    fill.look(at: .zero, from: [3, 1, 2], relativeTo: nil)
    anchor.addChild(fill)
  }

  private func updateCamera() {
    let offset = SIMD3<Float>(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * distance
    camera.look(at: Self.cameraTarget, from: Self.cameraTarget + offset, relativeTo: nil)
  }

  /// USD exports may place ModelComponent on a descendant of the named Xform.
  private static func firstModel(in entity: Entity) -> Entity? {
    if entity.components[ModelComponent.self] != nil { return entity }
    for child in entity.children {
      if let found = firstModel(in: child) { return found }
    }
    return nil
  }

  private static func setMaterial(_ material: any Material, on entity: Entity) {
    guard var model = entity.components[ModelComponent.self] else { return }
    model.materials = [material]
    entity.components.set(model)
  }
}
