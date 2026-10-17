import Foundation

/// Cross-app metadata only. Tokens remain in HAKeychainCredentials; the selected
/// device belongs to each host app and is deliberately absent from this file.
public struct HASharedDevice: Codable, Equatable, Identifiable, Sendable {
  public let binding: HABinding
  public let name: String
  public let roomID: String
  public let roomName: String
  public var id: String { binding.endpoint.baseURL.absoluteString + "|" + binding.entityID }
  public var label: String { "\(roomName) · \(name)" }
  public init(binding: HABinding, name: String, roomID: String, roomName: String) {
    self.binding = binding; self.name = name; self.roomID = roomID; self.roomName = roomName
  }
}

@MainActor public protocol HABindingCatalogStore {
  func load() throws -> [HASharedDevice]
  func save(_ devices: [HASharedDevice]) throws
}

/// Home is the writer; companion apps read this catalog. Atomic replacement
/// prevents readers seeing a partially written binding list.
@MainActor public final class HAFileBindingCatalog: HABindingCatalogStore {
  public let url: URL
  private struct Document: Codable { var version = 1; var devices: [HASharedDevice] }
  public init(url: URL? = nil) {
    self.url = url ?? FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Application Support/YunHome/ha-bindings.json")
  }
  public func load() throws -> [HASharedDevice] {
    guard FileManager.default.fileExists(atPath: url.path) else { return [] }
    let document = try JSONDecoder().decode(Document.self, from: Data(contentsOf: url))
    guard document.version == 1 else { throw CocoaError(.coderReadCorrupt) }
    var ids = Set<String>()
    return document.devices.filter { ids.insert($0.id).inserted }
  }
  public func save(_ devices: [HASharedDevice]) throws {
    let directory = url.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                            attributes: [.posixPermissions: 0o700])
    let data = try JSONEncoder().encode(Document(devices: devices))
    // .atomic retains existing permissions; also restrict the first write.
    try data.write(to: url, options: .atomic)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
  }
}
