import Foundation
import Testing
@testable import HomeDeviceKit

@Test func validatesEndpointsAndBindingMetadata() throws {
  #expect(try HAEndpoint(" HTTPS://Example.COM:443/ ").baseURL.absoluteString == "https://example.com")
  #expect(try HAEndpoint("http://192.168.1.2:8123").webSocketURL.absoluteString == "ws://192.168.1.2:8123/api/websocket")
  #expect(try HAEndpoint("http://[::1]:8123").baseURL.host != nil)
  for value in ["https://example.com/path", "https://user:secret@example.com", "https://example.com?token=x", "https://example.com#hash", "file:///tmp", "http://public.example.com", "http://10.0.invalid.0.1", "http://010.1.2.3"] {
    #expect(throws: (any Error).self) { try HAEndpoint(value) }
  }
  let endpoint = try HAEndpoint("https://example.com")
  #expect(throws: (any Error).self) { try HABinding(endpoint: endpoint, entityID: "switch.ac") }
  let binding = try HABinding(endpoint: endpoint, entityID: "climate.test_ac")
  #expect(!String(decoding: try JSONEncoder().encode(binding), as: UTF8.self).contains("token"))
}

@Test func preservesCapabilitiesAndUnsupportedModes() {
  let snapshot = HAClimateSnapshot(climateEntity(mode: "dry", temperature: 24.5))
  #expect(snapshot.mode == "dry" && snapshot.targetTemperature == 24.5)
  #expect(snapshot.step == 0.5 && snapshot.maximum == 32)
  #expect(snapshot.clamp(31.8) == 32 && snapshot.clamp(24.3) == 24.5)
}

@Test func bonjourResolvesLocalAndAdvertisedEndpoints() {
  #expect(discoveryEndpoint(host: "ha.local.", port: 8123, records: [:])?.baseURL.absoluteString == "http://ha.local:8123")
  #expect(discoveryEndpoint(host: "ha.local.", port: 8123, records: ["internal_url": Data("https://home.example.com".utf8)])?.baseURL.absoluteString == "https://home.example.com")
  #expect(discoveryEndpoint(host: "ha.local.", port: 8123, records: ["internal_url": Data("http://user:token@malicious.example.com".utf8)])?.baseURL.absoluteString == "http://ha.local:8123")
}

@MainActor @Test func newerPowerOffSupersedesAnExecutingPowerOn() async throws {
  let server = MockHAServer(); server.serviceDelay = .milliseconds(30)
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  controller.request(.power(true))
  #expect(await waitUntil { server.commands.count == 1 })
  controller.request(.power(false))
  #expect(await waitUntil { !controller.pending })
  #expect(server.commands.count == 2)
  #expect(server.commands.allSatisfy { $0["service"].string == "set_hvac_mode" })
  #expect(controller.snapshot?.isOn == false)
}

@MainActor @Test func serviceFailureReadsBackAndShowsError() async throws {
  let server = MockHAServer(); server.rejectService = true
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  controller.request(.power(true))
  #expect(await waitUntil { !controller.pending })
  #expect(controller.error == HAError.serviceFailed.localizedDescription)
  #expect(controller.snapshot?.isOn == false)
}

@MainActor @Test func revokedCredentialStopsAutomaticReconnects() async throws {
  let server = MockHAServer()
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  server.rejectAuthentication = true
  server.sockets.last?.close()
  #expect(await waitUntil { controller.state == .needsToken })
  try await Task.sleep(for: .milliseconds(70))
  #expect(server.sockets.count == 2 && server.commands.isEmpty)
}

@MainActor @Test func externalPowerOnReplacesOffStateDraftPreferences() async throws {
  let server = MockHAServer()
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  controller.request(.mode("heat"))
  controller.request(.temperature(29))
  server.report(climateEntity(mode: "cool", temperature: 22, updated: 3))
  #expect(await waitUntil { controller.displayMode == "cool" && controller.displayTemperature == 22 })
  #expect(server.commands.isEmpty)
}

@MainActor @Test func unavailableEntityCancelsDebouncedCommand() async throws {
  let server = MockHAServer(); server.entity = climateEntity(mode: "cool")
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  controller.request(.temperature(29))
  server.report(climateEntity(mode: "unavailable", updated: 3))
  #expect(await waitUntil { !controller.canControl })
  try await Task.sleep(for: .milliseconds(30))
  #expect(server.commands.isEmpty && !controller.pending)
}

@MainActor @Test func authenticationListsWithoutIssuingCommands() async throws {
  let server = MockHAServer()
  let credentials = MemoryCredentials()
  let controller = server.controller(credentials: credentials)
  defer { controller.disconnect() }
  let endpoint = try HAEndpoint("http://127.0.0.1:8123")
  try await controller.connect(to: endpoint, token: "fixture-token")
  #expect(controller.state == .online && controller.entities.count == 1)
  #expect(server.commands.isEmpty && credentials.tokens.isEmpty)
  _ = try controller.bind(entityID: "climate.test_ac")
  #expect(credentials.tokens[endpoint] == "fixture-token")
  #expect(controller.canControl)
}

@MainActor @Test func authenticationFailureIsSanitized() async throws {
  let server = MockHAServer(); server.rejectAuthentication = true
  let controller = server.controller()
  defer { controller.disconnect() }
  await #expect(throws: HAError.invalidToken) { try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "secret-fixture") }
  #expect(controller.state == .needsToken)
  #expect(controller.error?.contains("secret") == false)
  #expect(server.sockets.count == 1)
}

@MainActor @Test func handshakeHasDeadline() async throws {
  let server = MockHAServer(); server.silent = true
  let client = HomeAssistantClient(timeout: .milliseconds(20), factory: server.socket)
  defer { client.disconnect() }
  await #expect(throws: HAError.timeout) { try await client.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture") }
  #expect(!client.connected)
}

@MainActor @Test func offStatePreferencesApplyOnlyOnExplicitPowerOn() async throws {
  let server = MockHAServer()
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  controller.request(.temperature(31.5))
  controller.request(.mode("heat"))
  #expect(server.commands.isEmpty)
  controller.request(.power(true))
  #expect(await waitUntil { !controller.pending })
  #expect(controller.snapshot?.mode == "heat" && controller.snapshot?.targetTemperature == 31.5)
  #expect(server.commands.map { $0["service"].string } == ["set_hvac_mode", "set_temperature"])
  #expect(server.commands.allSatisfy { $0["target"]["entity_id"].string == "climate.test_ac" })
}

@MainActor @Test func temperatureChangesAreDebouncedAndDoNotChangeDryMode() async throws {
  let server = MockHAServer(); server.entity = climateEntity(mode: "dry")
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  controller.request(.temperature(25))
  controller.request(.temperature(26.5))
  controller.request(.temperature(27))
  #expect(await waitUntil { !controller.pending })
  #expect(server.commands.count == 1)
  #expect(server.commands.first?["service"].string == "set_temperature")
  #expect(controller.snapshot?.mode == "dry" && controller.snapshot?.targetTemperature == 27)
}

@MainActor @Test func serviceAcknowledgementDoesNotConfirmPhysicalState() async throws {
  let server = MockHAServer(); server.confirmCommands = false
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  controller.request(.power(true))
  #expect(await waitUntil { !controller.pending })
  #expect(controller.error == HAError.unconfirmed.localizedDescription)
  #expect(controller.snapshot?.isOn == false && !controller.displayPower)
}

@MainActor @Test func reconnectOnlyReadsAndNeverReplaysQueuedChanges() async throws {
  let server = MockHAServer(); server.entity = climateEntity(mode: "cool")
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  controller.request(.temperature(29))
  server.sockets.last?.close()
  #expect(await waitUntil { server.sockets.count == 2 && controller.state == .online })
  #expect(server.commands.isEmpty)
  #expect(controller.snapshot?.targetTemperature == 24 && !controller.pending)
}

@MainActor @Test func deviceRemovalDisablesControlsWithoutVirtualFallback() async throws {
  let server = MockHAServer()
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  server.removeEntity()
  #expect(await waitUntil { controller.snapshot == nil })
  controller.request(.power(true))
  #expect(controller.binding != nil && !controller.canControl && server.commands.isEmpty)
}

@MainActor @Test func initialSnapshotCannotOverwriteNewerSubscriptionEvent() async throws {
  let server = MockHAServer()
  server.readingEvent = climateEntity(mode: "heat", temperature: 28.5, updated: 5)
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  #expect(controller.snapshot?.mode == "heat" && controller.snapshot?.targetTemperature == 28.5)
}

@MainActor @Test func restoreWithoutCredentialRemainsBound() async throws {
  let server = MockHAServer()
  let controller = server.controller()
  defer { controller.disconnect() }
  let binding = try HABinding(endpoint: HAEndpoint("http://localhost:8123"), entityID: "climate.test_ac")
  await controller.restore(binding)
  #expect(controller.state == .needsToken && controller.binding == binding)
  #expect(server.sockets.isEmpty && !controller.canControl)
}
