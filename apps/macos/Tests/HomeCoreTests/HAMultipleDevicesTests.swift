import Foundation
import Testing
import HomeDeviceKit
@testable import HomeCore

@MainActor @Test func multiDeviceCommandsRoomsAndSelectionSurviveRestart() async throws {
  let suite = "fun.yunle.home.fleet-test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: suite))
  defer { defaults.removePersistentDomain(forName: suite) }
  let fixture = FleetFixture()
  let store = HomeStore(defaults: defaults, connectionFactory: fixture.controller)
  let candidate = fixture.controller()
  try await candidate.connect(to: HAEndpoint("http://localhost:8123"), token: "fleet-fixture")
  let selections = [HADeviceSelection(entityID: "climate.living", room: .living),
                    HADeviceSelection(entityID: "climate.bedroom", room: HomeRoom(name: "主卧"))]
  try store.bindHomeAssistants(candidate, selections: selections)
  #expect(await eventually { store.haConnections.values.allSatisfy { $0.state == .online } })
  #expect(store.haDevices.count == 2 && fixture.commands.isEmpty && store.activeCount == 2)
  let living = store.haDevices[0].id, bedroom = store.haDevices[1].id
  store.selectHADevice(bedroom)
  store.send(.ac(.temperature(27.5)))
  // A selection change cannot redirect the prior device's debounced command.
  store.selectHADevice(living)
  #expect(await eventually { fixture.commands.count == 1 && store.haConnections.values.allSatisfy { !$0.pending } })
  #expect(fixture.commands[0]["target"]["entity_id"].string == "climate.bedroom")
  #expect(store.haConnections[living]?.snapshot?.targetTemperature == 24)
  #expect(store.haConnections[bedroom]?.snapshot?.targetTemperature == 27.5)
  store.moveHADevice(bedroom, to: HomeRoom(name: "次卧"))
  store.selectHADevice(bedroom)
  let restored = HomeStore(defaults: defaults, connectionFactory: fixture.controller)
  #expect(await eventually { restored.haConnections.values.allSatisfy { $0.state == .online } })
  #expect(restored.haDevices.count == 2 && restored.selectedHAID == bedroom)
  #expect(restored.selectedHADevice?.room.name == "次卧")
  #expect(restored.rooms.contains(HomeRoom(name: "次卧")))
  #expect(fixture.commands.count == 1)
  store.removeHADevice(living)
  #expect(store.haDevices.count == 1 && store.haConnections[bedroom]?.canControl == true)
  #expect(store.haConnections[living] == nil)
  try restored.forgetHACredential(at: HAEndpoint("http://localhost:8123"))
  #expect(restored.haConnections.values.allSatisfy { $0.state == .needsToken && !$0.canControl })
  #expect(fixture.credentials.token == nil)
  for device in store.haDevices { store.removeHADevice(device.id) }
  for device in restored.haDevices { restored.removeHADevice(device.id) }
}

@MainActor @Test func repeatedBindingUpdatesMetadataAndAllOffTargetsEveryBoundDevice() async throws {
  let suite = "fun.yunle.home.fleet-test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: suite))
  defer { defaults.removePersistentDomain(forName: suite) }
  let fixture = FleetFixture()
  let store = HomeStore(defaults: defaults, connectionFactory: fixture.controller)
  let candidate = fixture.controller()
  try await candidate.connect(to: HAEndpoint("http://localhost:8123"), token: "fleet-fixture")
  try store.bindHomeAssistants(candidate, selections: [
    HADeviceSelection(entityID: "climate.living", room: .living),
    HADeviceSelection(entityID: "climate.bedroom", room: .bedroom),
  ])
  let replacement = fixture.controller()
  try await replacement.connect(to: HAEndpoint("http://localhost:8123"), token: "fleet-fixture")
  try store.bindHomeAssistants(replacement, selections: [HADeviceSelection(entityID: "climate.bedroom", room: HomeRoom(name: "书房"))])
  #expect(await eventually { store.haConnections.values.allSatisfy { $0.canControl } })
  #expect(store.haDevices.count == 2 && store.selectedHADevice?.room.name == "书房")
  #expect(fixture.commands.isEmpty)
  store.send(.allOff)
  #expect(await eventually { fixture.commands.count == 2 && store.activeCount == 0 })
  #expect(Set(fixture.commands.compactMap { $0["target"]["entity_id"].string }) == ["climate.living", "climate.bedroom"])
  for device in store.haDevices { store.removeHADevice(device.id) }
}

@Test func roomArchiveKeepsExistingIdentifiersAndCustomNames() throws {
  #expect(try JSONDecoder().decode(HomeRoom.self, from: Data("\"bedroom\"".utf8)) == .bedroom)
  let custom = HomeRoom(name: "  主卧  ")
  #expect(custom.name == "主卧")
  #expect(try JSONDecoder().decode(HomeRoom.self, from: JSONEncoder().encode(custom)) == custom)
  #expect(HomeRoom(name: "") == .unassigned && HomeRoom(name: "客厅") == .living)
}

@MainActor @Test func homePublishesRoomChangesAndRemovalsForCompanionApps() async throws {
  let suite = "fun.yunle.home.catalog-test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: suite))
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { defaults.removePersistentDomain(forName: suite); try? FileManager.default.removeItem(at: directory) }
  let catalog = HAFileBindingCatalog(url: directory.appendingPathComponent("bindings.json"))
  let fixture = FleetFixture()
  let store = HomeStore(defaults: defaults, connectionFactory: fixture.controller, sharedBindings: catalog)
  let candidate = fixture.controller()
  try await candidate.connect(to: HAEndpoint("http://localhost:8123"), token: "fixture")
  try store.bindHomeAssistants(candidate, selections: [HADeviceSelection(entityID: "climate.bedroom", room: .bedroom)])
  let id = try #require(store.haDevices.first?.id)
  #expect(try catalog.load().first?.id == id)
  store.moveHADevice(id, to: HomeRoom(name: "次卧"))
  #expect(try catalog.load().first?.roomName == "次卧")
  #expect(try catalog.load().first?.roomID == "room:次卧")
  store.removeHADevice(id)
  #expect(try catalog.load().isEmpty)
  #expect(fixture.commands.isEmpty)
}

@MainActor private final class FleetCredentials: HACredentialStore {
  var token: String?
  func load(for endpoint: HAEndpoint) throws -> String? { token }
  func save(_ token: String, for endpoint: HAEndpoint) throws { self.token = token }
  func remove(for endpoint: HAEndpoint) throws { token = nil }
}

@MainActor private final class FleetFixture {
  let credentials = FleetCredentials()
  var commands: [HAValue] = []
  var sockets: [FleetSocket] = []
  var entities: [String: HAEntity] = Dictionary(uniqueKeysWithValues: ["living", "bedroom"].map {
    let id = "climate." + $0
    return (id, HAEntity(entityID: id, state: "cool", attributes: [
      "friendly_name": .string($0), "temperature": .number(24), "target_temp_step": .number(0.5),
      "hvac_modes": .array(["off", "cool", "heat"].map(HAValue.string)), "supported_features": .number(1),
    ], lastUpdated: "2026-10-18T00:00:00Z"))
  })
  func controller() -> HomeAssistantClimate {
    HomeAssistantClimate(client: HomeAssistantClient(factory: { [unowned self] _ in
      let socket = FleetSocket(server: self); sockets.append(socket); return socket
    }), credentials: credentials, confirmationTimeout: .milliseconds(100), debounce: .milliseconds(30))
  }
  func handle(_ message: HAValue, on socket: FleetSocket) throws {
    if message["type"].string == "auth" { socket.push(.object(["type": .string("auth_ok")])); return }
    var result: HAValue = .null
    switch message["type"].string {
    case "get_config": result = .object(["unit_system": .object(["temperature": .string("°C")])])
    case "get_states": result = try value(Array(entities.values))
    case "call_service":
      commands.append(message)
      let id = message["target"]["entity_id"].string!
      let old = entities[id]!
      var attributes = old.attributes
      if let temperature = message["service_data"]["temperature"].number { attributes["temperature"] = .number(temperature) }
      let entity = HAEntity(entityID: id, state: message["service_data"]["hvac_mode"].string ?? old.state,
                            attributes: attributes, lastUpdated: "2026-10-18T00:00:10Z")
      entities[id] = entity
      for client in sockets {
        client.push(.object(["type": .string("event"), "event": .object([
          "event_type": .string("state_changed"), "data": .object(["entity_id": .string(id), "new_state": try value(entity)]),
        ])]))
      }
    default: break
    }
    socket.push(.object(["type": .string("result"), "id": message["id"], "success": .bool(true), "result": result]))
  }
  private func value<T: Encodable>(_ value: T) throws -> HAValue { try JSONDecoder().decode(HAValue.self, from: JSONEncoder().encode(value)) }
}

@MainActor private final class FleetSocket: HAWebSocket {
  unowned let server: FleetFixture
  var iterator: AsyncThrowingStream<String, Error>.Iterator
  let continuation: AsyncThrowingStream<String, Error>.Continuation
  init(server: FleetFixture) {
    self.server = server
    let pair = AsyncThrowingStream<String, Error>.makeStream()
    iterator = pair.stream.makeAsyncIterator(); continuation = pair.continuation
    push(.object(["type": .string("auth_required")]))
  }
  func push(_ message: HAValue) { continuation.yield(String(decoding: try! JSONEncoder().encode(message), as: UTF8.self)) }
  func send(_ text: String) async throws { try server.handle(JSONDecoder().decode(HAValue.self, from: Data(text.utf8)), on: self) }
  func receive() async throws -> String {
    var iterator = self.iterator
    let value = try await iterator.next()
    self.iterator = iterator
    guard let value else { throw HAError.disconnected }; return value
  }
  func close() { continuation.finish(throwing: HAError.disconnected) }
}

@MainActor private func eventually(_ predicate: () -> Bool) async -> Bool {
  for _ in 0..<200 {
    if predicate() { return true }
    try? await Task.sleep(for: .milliseconds(5))
  }
  return predicate()
}
