import Foundation
import HomePlugins

/// A device provided by an installed sandbox plugin. Its state is opaque JSON
/// owned by the plugin; the app only stores it and renders it through the
/// plugin's declarative controls.
public struct PluginInstance: Codable, Equatable, Identifiable {
  public var id: String
  public var pluginId: String
  public var name: String
  public var room: HomeRoom
  public var state: JSONValue
  public var changedAt: Date

  public init(id: String = UUID().uuidString, pluginId: String, name: String, room: HomeRoom = .living,
              state: JSONValue, changedAt: Date = Date()) {
    self.id = id; self.pluginId = pluginId; self.name = name
    self.room = room; self.state = state; self.changedAt = changedAt
  }
}
