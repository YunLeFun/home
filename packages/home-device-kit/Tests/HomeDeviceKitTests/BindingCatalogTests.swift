import Foundation
import Testing
@testable import HomeDeviceKit

@MainActor @Test func catalogSharesMetadataWithoutTokenOrSelection() throws {
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? FileManager.default.removeItem(at: directory) }
  let writer = HAFileBindingCatalog(url: directory.appendingPathComponent("bindings.json"))
  let reader = HAFileBindingCatalog(url: writer.url)
  #expect(try reader.load().isEmpty)
  let device = HASharedDevice(binding: try HABinding(endpoint: HAEndpoint("http://localhost:8123"), entityID: "climate.bedroom"),
                              name: "空调", roomID: "room:次卧", roomName: "次卧")
  try writer.save([device, device])
  #expect(try reader.load() == [device])
  let json = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: writer.url)) as? [String: Any])
  #expect(Set(json.keys) == ["version", "devices"])
  let records = try #require(json["devices"] as? [[String: Any]])
  #expect(Set(records[0].keys) == ["binding", "name", "roomID", "roomName"])
  let permissions = try FileManager.default.attributesOfItem(atPath: writer.url.path)[.posixPermissions] as? NSNumber
  #expect(permissions?.intValue == 0o600)
  try writer.save([])
  #expect(try reader.load().isEmpty)
  try Data("{\"version\":99,\"devices\":[]}".utf8).write(to: writer.url)
  #expect(throws: (any Error).self) { try reader.load() }
}

@MainActor @Test func deviceCollectionKeepsCommandsOnTheirOriginalConnection() async throws {
  let firstServer = MockHAServer(), secondServer = MockHAServer()
  firstServer.entity = climateEntity(mode: "cool")
  secondServer.entity = climateEntity(mode: "cool")
  let firstEndpoint = try HAEndpoint("http://localhost:8123")
  let secondEndpoint = try HAEndpoint("http://localhost:8124")
  let credentials = MemoryCredentials()
  credentials.tokens = [firstEndpoint: "fixture", secondEndpoint: "fixture"]
  let first = HASharedDevice(binding: try HABinding(endpoint: firstEndpoint, entityID: "climate.test_ac"), name: "A", roomID: "a", roomName: "客厅")
  let second = HASharedDevice(binding: try HABinding(endpoint: secondEndpoint, entityID: "climate.test_ac"), name: "B", roomID: "b", roomName: "次卧")
  var factories = [firstServer, secondServer]
  let collection = HADeviceCollection { factories.removeFirst().controller(credentials: credentials) }
  defer { collection.disconnectAll() }
  collection.update([first, second])
  #expect(collection.selectedID == nil && collection.connections.isEmpty)
  collection.select(first.id)
  #expect(await waitUntil { collection.connection?.canControl == true })
  collection.connection?.request(.temperature(27.5))
  collection.select(second.id)
  #expect(await waitUntil {
    collection.connection?.canControl == true && firstServer.commands.count == 1
      && firstServer.entity.attributes["temperature"]?.number == 27.5
  })
  #expect(firstServer.entity.attributes["temperature"]?.number == 27.5)
  #expect(secondServer.commands.isEmpty)
  #expect(collection.connection?.displayTemperature == 24)
  collection.update([first])
  #expect(collection.selectedID == nil && collection.connections[second.id] == nil)
  #expect(secondServer.sockets.allSatisfy { $0.closed })
}
