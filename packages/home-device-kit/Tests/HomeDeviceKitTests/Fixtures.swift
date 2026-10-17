import Foundation
import HomeDeviceKit

@MainActor final class MemoryCredentials: HACredentialStore {
  var tokens: [HAEndpoint: String] = [:]
  func load(for endpoint: HAEndpoint) throws -> String? { tokens[endpoint] }
  func save(_ token: String, for endpoint: HAEndpoint) throws { tokens[endpoint] = token }
  func remove(for endpoint: HAEndpoint) throws { tokens.removeValue(forKey: endpoint) }
}

func climateEntity(mode: String = "off", temperature: Double = 24, updated: Int = 0) -> HAEntity {
  HAEntity(entityID: "climate.test_ac", state: mode, attributes: [
    "friendly_name": .string("测试空调"), "temperature": .number(temperature),
    "current_temperature": .number(27), "temperature_unit": .string("°C"),
    "min_temp": .number(16), "max_temp": .number(32), "target_temp_step": .number(0.5),
    "hvac_modes": .array(["off", "cool", "heat", "dry", "fan_only"].map(HAValue.string)),
    "supported_features": .number(1),
  ], lastUpdated: "2026-10-16T00:00:\(String(format: "%02d", updated)).000Z")
}

@MainActor final class MockHAServer {
  var entity = climateEntity()
  var sockets: [MockSocket] = []
  var commands: [HAValue] = []
  var messages: [HAValue] = []
  var confirmCommands = true
  var rejectAuthentication = false
  var rejectService = false
  var silent = false
  var revision = 1
  var serviceDelay = Duration.zero
  var readingEvent: HAEntity?
  var config: HAValue = .object(["unit_system": .object(["temperature": .string("°C")])])

  func socket(_ url: URL) -> any HAWebSocket {
    let socket = MockSocket(server: self)
    sockets.append(socket)
    return socket
  }
  func report(_ entity: HAEntity) {
    self.entity = entity
    sockets.last?.push(.object(["type": .string("event"), "id": .number(1), "event": .object([
      "event_type": .string("state_changed"), "data": .object([
        "entity_id": .string(entity.entity_id), "new_state": encoded(entity),
      ]),
    ])]))
  }
  func removeEntity() {
    sockets.last?.push(.object(["type": .string("event"), "id": .number(1), "event": .object([
      "event_type": .string("state_changed"), "data": .object([
        "entity_id": .string(entity.entity_id), "new_state": .null,
      ]),
    ])]))
  }
  func handle(_ message: HAValue, socket: MockSocket) async throws {
    messages.append(message)
    let type = message["type"].string
    if type == "auth" {
      socket.push(.object(["type": .string(rejectAuthentication ? "auth_invalid" : "auth_ok"), "message": .string("Do not display server-provided secrets")]))
      return
    }
    if type == "call_service" {
      commands.append(message)
      try await Task.sleep(for: serviceDelay)
      if rejectService {
        socket.push(.object(["type": .string("result"), "id": message["id"], "success": .bool(false), "error": .object(["code": .string("home_assistant_error")])]))
        return
      }
      if confirmCommands {
        let data = message["service_data"]
        report(climateEntity(mode: data["hvac_mode"].string ?? entity.state,
                             temperature: data["temperature"].number ?? entity.attributes["temperature"]!.number!,
                             updated: revision))
        revision += 1
      }
    }
    if type == "get_config" {
      socket.push(result(message, value: config))
    } else if type == "get_states", let event = readingEvent {
      readingEvent = nil
      let stale = entity
      report(event)
      socket.push(result(message, value: .array([encoded(stale)])))
    } else {
      socket.push(result(message, value: type == "get_states" ? .array([encoded(entity)]) : .null))
    }
  }
  func result(_ message: HAValue, value: HAValue) -> HAValue {
    .object(["type": .string(message["type"].string == "ping" ? "pong" : "result"), "id": message["id"], "success": .bool(true), "result": value])
  }
  func controller(credentials: MemoryCredentials? = nil) -> HomeAssistantClimate {
    HomeAssistantClimate(client: HomeAssistantClient(timeout: .milliseconds(250), factory: socket),
                         credentials: credentials ?? MemoryCredentials(), confirmationTimeout: .milliseconds(40),
                         debounce: .milliseconds(20), reconnectDelay: .milliseconds(20))
  }
}

@MainActor final class MockSocket: HAWebSocket {
  let stream: AsyncThrowingStream<String, Error>
  var iterator: AsyncThrowingStream<String, Error>.Iterator
  let continuation: AsyncThrowingStream<String, Error>.Continuation
  unowned let server: MockHAServer
  var closed = false
  init(server: MockHAServer) {
    self.server = server
    let (stream, continuation) = AsyncThrowingStream<String, Error>.makeStream()
    self.stream = stream; self.continuation = continuation; iterator = stream.makeAsyncIterator()
    if !server.silent { push(.object(["type": .string("auth_required")])) }
  }
  func push(_ message: HAValue) { continuation.yield(String(decoding: try! JSONEncoder().encode(message), as: UTF8.self)) }
  func send(_ text: String) async throws {
    guard !closed else { throw HAError.disconnected }
    try await server.handle(JSONDecoder().decode(HAValue.self, from: Data(text.utf8)), socket: self)
  }
  func receive() async throws -> String {
    var iterator = self.iterator
    let message = try await iterator.next()
    self.iterator = iterator
    guard let message else { throw HAError.disconnected }
    return message
  }
  func close() { closed = true; continuation.finish(throwing: HAError.disconnected) }
}

func encoded<T: Encodable>(_ value: T) -> HAValue { try! JSONDecoder().decode(HAValue.self, from: JSONEncoder().encode(value)) }

@MainActor func waitUntil(_ predicate: () -> Bool) async -> Bool {
  for _ in 0..<200 {
    if predicate() { return true }
    try? await Task.sleep(for: .milliseconds(5))
  }
  return predicate()
}
