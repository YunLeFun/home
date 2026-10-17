import AppKit
import Metal
import RealityKit
import Testing
import HomeCore
import HomeDeviceKit
@testable import YunHome

@MainActor
struct ACRemoteCommandTests {
  @Test func commandsShareStateAndRespectTemperatureLimits() throws {
    let name = "fun.yunle.home.remote-test.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: name))
    defer { defaults.removePersistentDomain(forName: name) }
    let store = HomeStore(defaults: defaults)
    #expect(ACRemoteAction.power.perform(in: store))
    #expect(store.acState.status)
    #expect(ACRemoteAction.temperatureUp.perform(in: store))
    #expect(store.acState.temperature == 27)
    #expect(ACRemoteAction.temperatureDown.perform(in: store))
    #expect(store.acState.temperature == 26)
    #expect(ACRemoteAction.mode.perform(in: store))
    #expect(store.acState.mode == .hot)
    store.send(.ac(.temperature(31)))
    #expect(!ACRemoteAction.temperatureUp.perform(in: store))
    #expect(!ACRemotePresentation(store: store).enabledActions.contains(.temperatureUp))
    store.send(.ac(.temperature(16)))
    #expect(!ACRemoteAction.temperatureDown.perform(in: store))
    #expect(store.acState.temperature == 16)
    #expect(ACRemoteAction.power.perform(in: store))
    #expect(!store.acState.status)
    store.showDesktopRemote = true
    let restored = HomeStore(defaults: defaults)
    #expect(restored.showDesktopRemote && restored.acState == store.acState)
    #expect(!restored.showDesktopAC)
  }

  @Test func disconnectedRealDeviceCannotReceiveRemoteCommands() async throws {
    let name = "fun.yunle.home.remote-test.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: name))
    defer { defaults.removePersistentDomain(forName: name) }
    let binding = try HABinding(endpoint: HAEndpoint("http://localhost:8123"), entityID: "climate.test_ac")
    defaults.set(try JSONEncoder().encode(binding), forKey: "yun-home:ha-binding:v1")
    let connection = HomeAssistantClimate(credentials: NoRemoteTestCredentials())
    let store = HomeStore(defaults: defaults, homeAssistant: connection)
    await Task.yield()
    let original = store.snapshot.airConditioner
    #expect(ACRemotePresentation(store: store).enabledActions.isEmpty)
    for action in ACRemoteAction.allCases { #expect(!action.perform(in: store)) }
    #expect(store.snapshot.airConditioner == original)
    #expect(!connection.pending)
    store.unbindHomeAssistant()
  }
}

@MainActor private final class NoRemoteTestCredentials: HACredentialStore {
  func load(for endpoint: HAEndpoint) throws -> String? { nil }
  func save(_ token: String, for endpoint: HAEndpoint) throws {}
  func remove(for endpoint: HAEndpoint) throws {}
}

@Suite(.enabled(if: MTLCreateSystemDefaultDevice() != nil))
@MainActor
struct ACRemoteModelTests {
  @Test func originalRemoteHasScreenAndFourIndependentPressPivots() async throws {
    let remote = try await ACRemoteController.load()
    #expect(remote.model.findEntity(named: "Screen") != nil)
    #expect(remote.model.findEntity(named: "Brand") != nil)
    #expect(!remote.showsAirflow)
    for action in ACRemoteAction.allCases {
      let button = try #require(remote.model.findEntity(named: action.rawValue))
      let resting = button.position
      remote.setPressed(action)
      remote.finishAnimations()
      #expect(abs(button.position.z - (resting.z - 0.012)) < 0.0001)
      #expect(button.position.x == resting.x && button.position.y == resting.y)
      remote.setPressed(nil)
      remote.finishAnimations()
      #expect(simd_length(button.position - resting) < 0.0001)
    }
  }

  @Test func buttonPickingUsesModelProjectionWithoutLiveRenderer() async throws {
    let remote = try await ACRemoteController.load()
    for size in [CGSize(width: 144, height: 264), CGSize(width: 160, height: 300)] {
      var frames: [CGRect] = []
      for action in ACRemoteAction.allCases {
        let frame = remote.buttonFrame(action, in: size)
        #expect(frame.width > 10 && frame.height > 10)
        #expect(CGRect(origin: .zero, size: size).contains(frame))
        #expect(remote.action(at: CGPoint(x: frame.midX, y: frame.midY), in: size) == action)
        for other in frames { #expect(!frame.intersects(other)) }
        frames.append(frame)
      }
      #expect(remote.action(at: .zero, in: size) == nil)
    }
  }
}
