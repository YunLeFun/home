import Foundation
import Testing
@testable import HomeDeviceKit

@MainActor private final class CountingCredentials: HACredentialStore {
  var tokens: [HAEndpoint: String] = [:]
  var loads = 0
  var denied = false
  var failWrites = false
  func load(for endpoint: HAEndpoint) throws -> String? {
    loads += 1
    if denied { throw HAError.credentialStore }
    return tokens[endpoint]
  }
  func save(_ token: String, for endpoint: HAEndpoint) throws {
    if failWrites { throw HAError.credentialStore }
    tokens[endpoint] = token
  }
  func remove(for endpoint: HAEndpoint) throws {
    if failWrites { throw HAError.credentialStore }
    tokens.removeValue(forKey: endpoint)
  }
}

@MainActor @Test func credentialSessionScopesReadsAndRefreshesWrites() throws {
  let store = CountingCredentials(), otherStore = CountingCredentials()
  let first = try HAEndpoint("http://localhost:8123")
  let normalized = try HAEndpoint(" HTTP://LOCALHOST:8123/ ")
  let second = try HAEndpoint("http://localhost:8124")
  store.tokens = [first: "first", second: "second"]
  otherStore.tokens = [first: "other-service"]
  let session = HASessionCredentials(store: store)
  #expect(try session.load(for: first) == "first")
  #expect(try session.load(for: normalized) == "first")
  #expect(store.loads == 1)
  #expect(try session.load(for: second) == "second")
  #expect(try HASessionCredentials(store: otherStore).load(for: first) == "other-service")
  try session.save("replacement", for: first)
  #expect(try session.load(for: first) == "replacement")
  #expect(store.loads == 2 && store.tokens[first] == "replacement")
  try session.remove(for: first)
  #expect(try session.load(for: first) == nil)
  #expect(store.tokens[first] == nil)
  // An explicit reload sees credentials updated by another app.
  store.tokens[first] = "external-update"
  session.invalidate(for: first)
  #expect(try session.load(for: first) == "external-update")
  #expect(store.loads == 3)
}

@MainActor @Test func deniedReadWaitsForExplicitRetryAndFailedWritesClearCache() throws {
  let store = CountingCredentials(), session: HASessionCredentials
  session = HASessionCredentials(store: store)
  let endpoint = try HAEndpoint("http://localhost:8123")
  store.tokens[endpoint] = "existing"
  store.denied = true
  for _ in 0..<3 { #expect(throws: HAError.credentialStore) { try session.load(for: endpoint) } }
  #expect(store.loads == 1)
  store.denied = false
  session.invalidate(for: endpoint)
  #expect(try session.load(for: endpoint) == "existing")
  store.failWrites = true
  #expect(throws: HAError.credentialStore) { try session.save("unsaved", for: endpoint) }
  #expect(try session.load(for: endpoint) == "existing")
  #expect(store.loads == 3)
  #expect(throws: HAError.credentialStore) { try session.remove(for: endpoint) }
  #expect(try session.load(for: endpoint) == "existing")
  #expect(store.loads == 4)
}

@MainActor @Test func switchingThreeDevicesAndNetworkReconnectReadCredentialOnce() async throws {
  let endpoint = try HAEndpoint("http://localhost:8123")
  let store = CountingCredentials(); store.tokens[endpoint] = "existing"
  let session = HASessionCredentials(store: store)
  let servers = (0..<3).map { _ in MockHAServer() }
  let devices = try servers.enumerated().map { index, server in
    let original = server.entity
    server.entity = HAEntity(entityID: "climate.ac_\(index)", state: original.state,
      attributes: original.attributes, lastUpdated: original.last_updated)
    return HASharedDevice(binding: try HABinding(endpoint: endpoint, entityID: server.entity.entity_id),
      name: "AC \(index)", roomID: "room-\(index)", roomName: "Room \(index)")
  }
  var index = 0
  let collection = HADeviceCollection {
    defer { index += 1 }
    return servers[index].controller(credentials: session)
  }
  defer { collection.disconnectAll() }
  collection.update(devices)
  for device in devices {
    collection.select(device.id)
    #expect(await waitUntil { collection.connection?.canControl == true })
  }
  servers[2].sockets.last?.close()
  #expect(await waitUntil { servers[2].sockets.count == 2 && collection.connection?.canControl == true })
  #expect(store.loads == 1)
  collection.reconnectSelected()
  #expect(await waitUntil { servers[2].sockets.count == 3 && collection.connection?.canControl == true })
  #expect(store.loads == 2)
  #expect(servers.allSatisfy { $0.commands.isEmpty })
}

@MainActor @Test func rejectedTokenInvalidatesSessionWithoutDeletingBinding() async throws {
  let endpoint = try HAEndpoint("http://localhost:8123")
  let store = CountingCredentials(); store.tokens[endpoint] = "revoked"
  let session = HASessionCredentials(store: store)
  let server = MockHAServer(); server.rejectAuthentication = true
  let controller = server.controller(credentials: session)
  let binding = try HABinding(endpoint: endpoint, entityID: server.entity.entity_id)
  defer { controller.disconnect() }
  await controller.restore(binding)
  #expect(controller.state == .needsToken && controller.binding == binding)
  store.tokens[endpoint] = "rotated-in-other-app"
  server.rejectAuthentication = false
  await controller.restore(binding)
  #expect(controller.state == .online && store.loads == 2)
  #expect(server.messages.last(where: { $0["type"].string == "auth" })?["access_token"].string == "rotated-in-other-app")
  #expect(server.commands.isEmpty)
}
