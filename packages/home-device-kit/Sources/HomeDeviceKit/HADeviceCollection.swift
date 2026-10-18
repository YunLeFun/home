import Foundation
import Observation

/// A companion app's connections. Switching targets never redirects an already
/// queued command: every device owns its own HomeAssistantClimate instance.
@MainActor @Observable public final class HADeviceCollection {
  public private(set) var devices: [HASharedDevice] = []
  public private(set) var selectedID: String?
  public private(set) var connections: [String: HomeAssistantClimate] = [:]
  public var selectedDevice: HASharedDevice? { devices.first { $0.id == selectedID } }
  public var connection: HomeAssistantClimate? { selectedID.flatMap { connections[$0] } }
  @ObservationIgnored private let factory: () -> HomeAssistantClimate
  @ObservationIgnored private var tasks: [String: Task<Void, Never>] = [:]

  public init(factory: (() -> HomeAssistantClimate)? = nil) {
    self.factory = factory ?? { HomeAssistantClimate() }
  }

  public func update(_ devices: [HASharedDevice]) {
    var seen = Set<String>()
    self.devices = devices.filter { seen.insert($0.id).inserted }
    for id in Array(connections.keys) where !seen.contains(id) {
      tasks.removeValue(forKey: id)?.cancel()
      connections.removeValue(forKey: id)?.disconnect()
    }
    // Removing a selected device returns to virtual mode, never another AC.
    if let selectedID, !seen.contains(selectedID) { self.selectedID = nil }
  }

  public func select(_ id: String?) {
    guard let id else { selectedID = nil; return }
    guard let device = devices.first(where: { $0.id == id }) else { return }
    selectedID = id
    if connections[id] == nil {
      let connection = factory()
      connections[id] = connection
      restore(device, connection)
    }
  }

  public func reconnectSelected() {
    guard let device = selectedDevice, let connection else { return }
    connection.reloadCredentialOnNextRestore()
    restore(device, connection)
  }

  public func disconnectAll() {
    tasks.values.forEach { $0.cancel() }; tasks.removeAll()
    connections.values.forEach { $0.disconnect() }; connections.removeAll()
    selectedID = nil
  }

  private func restore(_ device: HASharedDevice, _ connection: HomeAssistantClimate) {
    tasks.removeValue(forKey: device.id)?.cancel()
    connection.disconnect()
    tasks[device.id] = Task { await connection.restore(device.binding) }
  }
}
