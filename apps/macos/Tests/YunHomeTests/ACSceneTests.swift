import AppKit
import CuteACKit
import Metal
import RealityKit
import Testing
import HomeCore
@testable import YunHome

// Asset loading needs a Metal device, which isn't available on every CI host.
@Suite(.enabled(if: MTLCreateSystemDefaultDevice() != nil))
@MainActor
struct ACSceneTests {
  @Test func originalAssetRetainsPartsAndDisplayTexture() async throws {
    let controller = try await ACSceneController.load()
    let louver = try #require(controller.model.findEntity(named: "Louver"))
    let resting = louver.transform
    let display = try #require(controller.model.findEntity(named: "Display"))
    let led = try #require(controller.model.findEntity(named: "Led"))

    for mode in ACMode.allCases {
      for temperature in [16.0, 26.0, 26.5, 31.0] {
        controller.apply(ACState(status: true, mode: mode, temperature: temperature), room: nil, animated: false)
        let expected = resting.rotation * simd_quatf(angle: 40 * .pi / 180, axis: [1, 0, 0])
        #expect(simd_length(louver.orientation.vector - expected.vector) < 0.0001)
        #expect(louver.position == resting.translation)
        #expect(louver.scale == resting.scale)
        let displayMaterial = try #require(firstMaterial(in: display) as? UnlitMaterial)
        #expect(displayMaterial.color.texture != nil)
        let ledMaterial = try #require(firstMaterial(in: led) as? UnlitMaterial)
        #expect(colorDistance(ledMaterial.color.tint, ACPalette.accent(for: mode)) < 0.01)
      }
    }
    controller.apply(ACState(), room: nil, animated: false)
    #expect(simd_length(louver.orientation.vector - resting.rotation.vector) < 0.0001)
    let offMaterial = try #require(firstMaterial(in: led) as? UnlitMaterial)
    #expect(colorDistance(offMaterial.color.tint, ACPalette.accent(for: .cold)) > 0.1)
    #expect(colorDistance(offMaterial.color.tint, ACPalette.accent(for: .hot)) > 0.1)
    #expect(controller.airflowOrigin.x.isFinite && controller.airflowOrigin.y.isFinite)
  }

  @Test func hidingDuringAnimationCommitsLatestPose() async throws {
    let controller = try await ACSceneController.load()
    let louver = try #require(controller.model.findEntity(named: "Louver"))
    let resting = louver.transform
    let originalModel = controller.model.transform
    controller.apply(ACState(), room: nil, animated: false)
    controller.apply(ACState(status: true), room: nil, animated: true)
    controller.apply(ACState(status: false), room: nil, animated: true)
    controller.finishAnimations()
    #expect(louver.transform == resting)
    #expect(controller.model.transform == originalModel)
    controller.apply(ACState(status: true, mode: .hot), room: nil, animated: true)
    controller.finishAnimations()
    let expected = resting.rotation * simd_quatf(angle: 40 * .pi / 180, axis: [1, 0, 0])
    #expect(simd_length(louver.orientation.vector - expected.vector) < 0.0001)
    #expect(controller.model.transform == originalModel)
  }

  @Test func cameraOrbitAndZoomStayWithinLimits() async throws {
    let controller = try await ACSceneController.load()
    let target = SIMD3<Float>(0, -0.02, 0)
    let start = controller.camera.position
    let originalRadius = simd_length(start - target)
    controller.orbit(delta: CGPoint(x: 80, y: 10_000))
    let offset = controller.camera.position - target
    #expect(controller.camera.position != start)
    #expect(abs(simd_length(offset) - originalRadius) < 0.0001)
    // #expect type-checks each side alone, so an untyped right side becomes Double.
    let maxPitch: Float = 25 * .pi / 180 + 0.0001
    #expect(abs(asin(offset.y / originalRadius)) <= maxPitch)
    controller.zoom(delta: -10_000)
    #expect(abs(simd_length(controller.camera.position - target) - 1.9) < 0.0001)
    controller.zoom(delta: 10_000)
    #expect(abs(simd_length(controller.camera.position - target) - 6) < 0.0001)
  }

  @Test func detailAndDesktopKeepIndependentEntities() async throws {
    let detail = try await ACSceneController.load()
    let desktop = try await ACSceneController.load()
    let desktopLouver = try #require(desktop.model.findEntity(named: "Louver"))
    let resting = desktopLouver.transform
    detail.apply(ACState(status: true), room: nil, animated: false)
    #expect(detail.model !== desktop.model)
    #expect(detail.anchor !== desktop.anchor)
    #expect(desktopLouver.transform == resting)
  }

  private func firstMaterial(in entity: Entity) -> (any Material)? {
    if let model = entity.components[ModelComponent.self] { return model.materials.first }
    return entity.children.lazy.compactMap { firstMaterial(in: $0) }.first
  }

  private func colorDistance(_ lhs: NSColor, _ rhs: NSColor) -> CGFloat {
    guard let lhs = lhs.usingColorSpace(.extendedSRGB), let rhs = rhs.usingColorSpace(.extendedSRGB) else {
      return .infinity
    }
    return abs(lhs.redComponent - rhs.redComponent) + abs(lhs.greenComponent - rhs.greenComponent)
      + abs(lhs.blueComponent - rhs.blueComponent)
  }
}
