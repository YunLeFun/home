import Foundation
import Testing
@testable import HomeDeviceKit

private func legacyClimate(mode: String = "cool", updated: Int = 1) -> HAEntity {
  let original = climateEntity(mode: mode, updated: updated)
  var attributes = original.attributes
  attributes.removeValue(forKey: "temperature_unit")
  return HAEntity(entityID: original.entity_id, state: original.state, attributes: attributes, lastUpdated: original.last_updated)
}

@Test func temperatureFallbackRequiresAKnownUnitAndHonorsExplicitUnit() {
  #expect(HAClimateSnapshot(legacyClimate()).unsupportedReason != nil)
  #expect(HAClimateSnapshot(legacyClimate(), systemTemperatureUnit: "°F").unsupportedReason != nil)
  #expect(HAClimateSnapshot(legacyClimate(), systemTemperatureUnit: "°C").unsupportedReason == nil)
  #expect(HAClimateSnapshot(climateEntity(), systemTemperatureUnit: "°F").temperatureUnit == "°C")
  var attributes = legacyClimate().attributes
  attributes["temperature_unit"] = .string("°F")
  let fahrenheit = HAEntity(entityID: "climate.test_ac", state: "cool", attributes: attributes, lastUpdated: "")
  #expect(HAClimateSnapshot(fahrenheit, systemTemperatureUnit: "°C").unsupportedReason != nil)
}

@MainActor @Test func legacyUnitSurvivesStateEventsAndRefreshesOnReconnect() async throws {
  let server = MockHAServer(); server.entity = legacyClimate()
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  _ = try controller.bind(entityID: "climate.test_ac")
  #expect(controller.canControl && controller.snapshot?.temperatureUnit == "°C")
  server.report(legacyClimate(mode: "heat", updated: 3))
  #expect(await waitUntil { controller.snapshot?.mode == "heat" })
  #expect(controller.canControl)
  server.config = .object(["unit_system": .object(["temperature": .string("°F")])])
  server.sockets.last?.push(.object(["type": .string("event"), "event": .object([
    "event_type": .string("core_config_updated"), "data": .object([:]),
  ])]))
  #expect(await waitUntil { server.sockets.count == 2 && controller.state == .online })
  #expect(!controller.canControl && controller.snapshot?.temperatureUnit == "°F")
  #expect(server.commands.isEmpty)
}

@MainActor @Test func missingSystemAndEntityUnitsPreventBinding() async throws {
  let server = MockHAServer(); server.entity = legacyClimate(); server.config = .null
  let controller = server.controller()
  defer { controller.disconnect() }
  try await controller.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  #expect(throws: HAError.unsupported) { try controller.bind(entityID: "climate.test_ac") }
  #expect(server.commands.isEmpty)
}

@Test func entityAreaOverridesDeviceAreaAndMissingMetadataStaysUnassigned() {
  let areas: HAValue = .array([
    .object(["area_id": .string("living"), "name": .string("客厅")]),
    .object(["area_id": .string("main"), "name": .string("主卧")]),
  ])
  let devices: HAValue = .array([.object(["id": .string("ac"), "area_id": .string("living")])])
  let entities: HAValue = .array([
    .object(["entity_id": .string("climate.first"), "device_id": .string("ac"), "area_id": .null]),
    .object(["entity_id": .string("climate.second"), "device_id": .string("ac"), "area_id": .string("main")]),
    .object(["entity_id": .string("climate.third"), "device_id": .string("missing")]),
  ])
  #expect(haEntityRooms(areas: areas, devices: devices, entities: entities) == ["climate.first": "客厅", "climate.second": "主卧"])
}
