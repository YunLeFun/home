import Foundation
import HomeDeviceKit

/// Only metadata is persisted here. All devices at one endpoint share its
/// Keychain credential, while commands and pending state remain per device.
public struct HADeviceBinding: Codable, Identifiable, Equatable, Sendable {
  public let binding: HABinding
  public var name: String
  public var room: HomeRoom
  public var id: String { binding.endpoint.baseURL.absoluteString + "|" + binding.entityID }
  public var label: String { "\(room.name) · \(name)" }
  public init(binding: HABinding, name: String, room: HomeRoom) {
    self.binding = binding; self.name = name; self.room = room
  }
}

public struct HADeviceSelection {
  public let entityID: String
  public let room: HomeRoom
  public init(entityID: String, room: HomeRoom) { self.entityID = entityID; self.room = room }
}
