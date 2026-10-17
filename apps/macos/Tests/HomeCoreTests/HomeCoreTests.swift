import Foundation
import Testing
import HomeDeviceKit
@testable import HomeCore

@MainActor private final class EmptyHACredentials: HACredentialStore {
  func load(for endpoint: HAEndpoint) throws -> String? { nil }
  func save(_ token: String, for endpoint: HAEndpoint) throws {}
  func remove(for endpoint: HAEndpoint) throws {}
}

@MainActor @Test func boundDeviceDoesNotFallBackToVirtualState() async throws {
  let name = "fun.yunle.home.test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: name))
  defer { defaults.removePersistentDomain(forName: name) }
  var virtual = HomeSnapshot()
  virtual.airConditioner = ACState(status: true, temperature: 20)
  defaults.set(try JSONEncoder().encode(virtual), forKey: "yun-home:native:v1")
  let binding = try HABinding(endpoint: HAEndpoint("http://localhost:8123"), entityID: "climate.test_ac")
  defaults.set(try JSONEncoder().encode(binding), forKey: "yun-home:ha-binding:v1")
  let connection = HomeAssistantClimate(credentials: EmptyHACredentials())
  let store = HomeStore(defaults: defaults, homeAssistant: connection)
  await Task.yield()
  #expect(store.haBinding == binding && !store.acCanControl)
  #expect(!store.isActive(.airConditioner))
  store.send(.ac(.toggle))
  store.send(.ac(.temperature(30)))
  #expect(store.snapshot.airConditioner.temperature == 20)
  #expect(store.status(for: .airConditioner) == "需要令牌")
  store.unbindHomeAssistant()
  #expect(store.acCanControl && store.acState.temperature == 20 && store.acState.status)
}

@Test func airConditionerRetainsWebContract() throws {
  var home = HomeSnapshot()
  home.apply(.ac(.temperature(99)))
  home.apply(.ac(.mode(.hot)))
  home.apply(.ac(.toggle))
  // Heating starts from its own set point, not cooling's.
  #expect(home.airConditioner.status && home.airConditioner.mode == .hot && home.airConditioner.temperature == 26)
  home.apply(.ac(.temperature(-10)))
  #expect(home.airConditioner.temperature == 16)
  home.apply(.ac(.mode(.cold)))
  #expect(home.airConditioner.temperature == 31)
  #expect(home.airConditioner.temperatures == ACModeTemperatures(cold: 31, hot: 16))
  home.apply(.ac(.fan(.high)))
  #expect(home.airConditioner.fan == .high && home.airConditioner.windLevel(room: nil) == 3)
  let object = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(home.airConditioner)) as? [String: Any])
  #expect(object["mode"] as? String == "cold")
  #expect(object["status"] as? Bool == true)
  #expect(object["temperature"] as? Int == 31)
  #expect(object["temperatures"] as? [String: Int] == ["cold": 31, "hot": 16])
  #expect(object["fan"] as? String == "high")
}

@MainActor @Test func versionTwoArchiveWithoutFanOrPerModeTemperaturesLoads() throws {
  let name = "fun.yunle.home.test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: name))
  defer { defaults.removePersistentDomain(forName: name) }
  // A v2 save written before ACState gained `temperatures` and `fan`.
  var saved = HomeSnapshot()
  saved.airConditioner = ACState(status: true, mode: .hot, temperature: 29)
  var archive = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(saved)) as? [String: Any])
  archive["airConditioner"] = ["status": true, "mode": "hot", "temperature": 29]
  #expect(archive["version"] as? Int == 2)
  defaults.set(try JSONSerialization.data(withJSONObject: archive), forKey: "yun-home:native:v1")

  let store = HomeStore(defaults: defaults)
  #expect(store.storageMessage == nil)
  let ac = store.snapshot.airConditioner
  #expect(ac.status && ac.mode == .hot && ac.temperature == 29)
  #expect(ac.temperatures == ACModeTemperatures(cold: 29, hot: 29) && ac.fan == .auto)
  store.send(.ac(.mode(.cold)))
  #expect(store.snapshot.airConditioner.temperature == 29)
}

@Test func deviceRulesMatchWebBehavior() {
  var home = HomeSnapshot()
  home.apply(.fan(.speed(2)))
  #expect(home.fan.power && home.fan.speed == 2)
  home.apply(.warmer(.level(.high)))
  #expect(home.handWarmer.power && home.handWarmer.temperature == 48)
  home.apply(.tv(.play))
  #expect(home.television.power && home.television.playing)
  home.apply(.tv(.toggle))
  #expect(!home.television.power && !home.television.playing)
  home.apply(.robot(.start))
  home.apply(.robot(.return))
  #expect(home.robotVacuum.status == .returning)
  home.apply(.robot(.dock))
  #expect(home.robotVacuum.status == .charging)
}

@Test func deadlinesUseAbsoluteTimeAndSurviveSleep() {
  let now = Date(timeIntervalSince1970: 1_700_000_000)
  var home = HomeSnapshot()
  home.apply(.fan(.toggle), at: now)
  home.apply(.fan(.timer(15)), at: now)
  home.apply(.warmer(.level(.low)), at: now)
  home.apply(.warmer(.timer(30)), at: now)
  #expect(home.nextAutoOff == now.addingTimeInterval(900))
  let beforeDeadline = home.expireTimers(at: now.addingTimeInterval(899))
  let afterDeadline = home.expireTimers(at: now.addingTimeInterval(1801))
  #expect(!beforeDeadline)
  #expect(afterDeadline)
  #expect(!home.fan.power && !home.handWarmer.power)
  #expect(home.nextAutoOff == nil)
}

@Test func allOffIsSafeAndKeepsPreferences() {
  var home = HomeSnapshot()
  home.apply(.ac(.toggle)); home.apply(.ac(.temperature(23)))
  home.apply(.fan(.speed(3))); home.apply(.fan(.timer(30)))
  home.apply(.robot(.start)); home.apply(.warmer(.level(.high))); home.apply(.tv(.play))
  #expect(home.activeCount == 5)
  home.apply(.allOff)
  #expect(home.activeCount == 0)
  #expect(home.airConditioner.temperature == 23 && home.fan.speed == 3)
  #expect(home.robotVacuum.status == .paused && home.nextAutoOff == nil)
}

@Test func invalidVideoSourcesAreRejected() {
  for source in ["http://example.com/movie.mp4", "file:///etc/passwd", "javascript:alert(1)", "https://user:password@example.com/a.mp4", "https:///", ""] {
    #expect(!TelevisionState.isValidSource(source))
    var home = HomeSnapshot()
    home.apply(.tv(.source(source)))
    #expect(home.television.sourceUrl == TelevisionState.defaultSource)
    #expect(!home.television.power)
  }
  #expect(TelevisionState.isValidSource(TelevisionState.defaultSource))
}

@MainActor @Test func persistenceAndRoomPlacementRoundTrip() throws {
  let name = "fun.yunle.home.test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: name))
  defer { defaults.removePersistentDomain(forName: name) }
  let store = HomeStore(defaults: defaults)
  store.send(.ac(.toggle))
  store.send(.move(.airConditioner, .bedroom))
  store.showDesktopAC = true
  let restored = HomeStore(defaults: defaults)
  #expect(restored.snapshot.airConditioner.status)
  #expect(restored.snapshot.room(for: .airConditioner) == .bedroom)
  #expect(restored.showDesktopAC)
}

@MainActor @Test func expiredTimerReconcilesOnLaunch() throws {
  let name = "fun.yunle.home.test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: name))
  defer { defaults.removePersistentDomain(forName: name) }
  let now = Date(timeIntervalSince1970: 1_700_000_000)
  let store = HomeStore(defaults: defaults, now: now)
  store.send(.fan(.speed(3)), at: now)
  store.send(.fan(.timer(1)), at: now)
  let restored = HomeStore(defaults: defaults, now: now.addingTimeInterval(61))
  #expect(!restored.snapshot.fan.power && restored.snapshot.fan.autoOffAt == nil)
}

@MainActor @Test func corruptSaveIsPreserved() throws {
  let name = "fun.yunle.home.test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: name))
  defer { defaults.removePersistentDomain(forName: name) }
  let corrupt = Data("not-json".utf8)
  defaults.set(corrupt, forKey: "yun-home:native:v1")
  let store = HomeStore(defaults: defaults)
  #expect(store.storageMessage != nil)
  #expect(defaults.data(forKey: "yun-home:native:v1:recovery") == corrupt)
  #expect(store.snapshot.activeCount == 0)
}

@Test func restoredValuesAreNormalized() {
  var home = HomeSnapshot()
  home.airConditioner.temperature = 70
  home.fan.speed = -1
  home.television.volume = 101
  home.television.playing = true
  home.handWarmer.temperature = 90
  home.normalize()
  #expect(home.airConditioner.temperature == 31)
  #expect(home.fan.speed == 1)
  #expect(home.television.volume == 100 && !home.television.playing)
  #expect(home.handWarmer.temperature == 42)
}
