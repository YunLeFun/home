import Foundation
import Observation
import HomeDeviceKit
import HomePlugins

@MainActor @Observable
public final class HomeStore {
  public private(set) var snapshot: HomeSnapshot
  public private(set) var storageMessage: String?
  public private(set) var haDevices: [HADeviceBinding] = []
  public private(set) var selectedHAID: String?
  public private(set) var haConnections: [String: HomeAssistantClimate] = [:]
  private let virtualConnection: HomeAssistantClimate
  public var selectedHADevice: HADeviceBinding? { haDevices.first { $0.id == selectedHAID } }
  public var haBinding: HABinding? { selectedHADevice?.binding }
  public var homeAssistant: HomeAssistantClimate { selectedHAID.flatMap { haConnections[$0] } ?? virtualConnection }
  public var acDisplayName: String { selectedHADevice?.label ?? DeviceKind.airConditioner.name }
  public var showMenuBarIcon: Bool {
    didSet { defaults.set(showMenuBarIcon, forKey: "yun-home:menu-bar-icon") }
  }
  public var showDesktopAC: Bool {
    didSet { defaults.set(showDesktopAC, forKey: "yun-home:desktop-ac") }
  }
  public var showDesktopRemote: Bool {
    didSet { defaults.set(showDesktopRemote, forKey: "yun-home:desktop-remote") }
  }
  public var desktopAlwaysOnTop: Bool {
    didSet { defaults.set(desktopAlwaysOnTop, forKey: "yun-home:desktop-on-top") }
  }
  @ObservationIgnored private let defaults: UserDefaults
  @ObservationIgnored private let key = "yun-home:native:v1"
  @ObservationIgnored private var restoreTasks: [String: Task<Void, Never>] = [:]
  @ObservationIgnored private let connectionFactory: () -> HomeAssistantClimate
  @ObservationIgnored private let sharedBindings: (any HABindingCatalogStore)?

  /// Installed sandbox plugins by plugin id.
  public private(set) var installedPlugins: [String: InstalledPlugin] = [:]
  /// Last presentation reported by each plugin device; rendering never calls into JavaScript.
  public private(set) var pluginPresentations: [String: PluginPresentation] = [:]
  /// Most recent failure per plugin device, cleared on the next success.
  public private(set) var pluginErrors: [String: String] = [:]
  /// The Mac seen as the room, fed by the app's `ThermalMonitor` while
  /// something shows it. Only plugins granted `sensor:thermal` receive it.
  public private(set) var room: RoomReading?
  /// Catalog updates that add permissions and so wait for the user, by plugin id.
  public private(set) var pluginUpdates: [String: PluginUpdate] = [:]
  @ObservationIgnored private let pluginInstaller: PluginInstaller
  @ObservationIgnored private let pluginHost: PluginHostClient
  @ObservationIgnored private var pluginQueues: [String: Task<Void, Never>] = [:]

  public init(defaults: UserDefaults = .standard, now: Date = Date(), homeAssistant: HomeAssistantClimate? = nil,
              pluginRoot: URL? = nil, pluginHostExecutable: URL? = nil,
              connectionFactory: (() -> HomeAssistantClimate)? = nil,
              sharedBindings: (any HABindingCatalogStore)? = nil) {
    self.defaults = defaults
    self.sharedBindings = sharedBindings
    pluginInstaller = PluginInstaller(root: pluginRoot ?? PluginInstaller.defaultRoot())
    pluginHost = PluginHostClient(executable: pluginHostExecutable ?? PluginHostClient.bundledExecutable())
    self.virtualConnection = homeAssistant ?? connectionFactory?() ?? HomeAssistantClimate()
    self.connectionFactory = connectionFactory ?? { HomeAssistantClimate() }
    showMenuBarIcon = defaults.object(forKey: "yun-home:menu-bar-icon") as? Bool ?? true
    showDesktopAC = defaults.bool(forKey: "yun-home:desktop-ac")
    showDesktopRemote = defaults.bool(forKey: "yun-home:desktop-remote")
    desktopAlwaysOnTop = defaults.bool(forKey: "yun-home:desktop-on-top")
    if let data = defaults.data(forKey: key) {
      do {
        var loaded = try JSONDecoder().decode(HomeSnapshot.self, from: data)
        guard (1...HomeSnapshot.currentVersion).contains(loaded.version) else { throw CocoaError(.coderReadCorrupt) }
        loaded.version = HomeSnapshot.currentVersion
        loaded.normalize()
        snapshot = loaded
      } catch {
        defaults.set(data, forKey: "\(key):recovery")
        snapshot = HomeSnapshot()
        storageMessage = "本机存档未能读取，已保留恢复副本。"
      }
    } else {
      snapshot = HomeSnapshot()
    }
    expireTimers(at: now)
    loadPlugins()
    loadHABindings()
  }

  public var acState: ACState {
    guard haBinding != nil else { return snapshot.airConditioner }
    // Real devices may expose a wider range and fractional temperature steps.
    // Do not apply the virtual device's 16–31°C limits to their reports.
    var state = ACState()
    state.status = homeAssistant.state == .online && homeAssistant.displayPower
    state.mode = homeAssistant.displayMode == "heat" ? .hot : .cold
    state.temperature = homeAssistant.displayTemperature
    return state
  }
  public var acCanControl: Bool { haBinding == nil || homeAssistant.canControl }
  public var acMinimum: Double { haBinding == nil ? 16 : homeAssistant.snapshot?.minimum ?? 16 }
  public var acMaximum: Double { haBinding == nil ? 31 : homeAssistant.snapshot?.maximum ?? 31 }
  public var acStep: Double { haBinding == nil ? 1 : homeAssistant.snapshot?.step ?? 1 }
  public func isActive(plugin instance: PluginInstance) -> Bool { pluginPresentations[instance.id]?.active ?? false }
  public func isActive(_ device: DeviceKind) -> Bool {
    if device == .airConditioner && haBinding != nil { return homeAssistant.state == .online && homeAssistant.snapshot?.isOn == true }
    return snapshot.isActive(device)
  }
  public var activeCount: Int {
    virtualDevices.filter(isActive).count + haDevices.filter { isHAActive($0.id) }.count
      + snapshot.plugins.filter { isActive(plugin: $0) }.count
  }
  public func status(for device: DeviceKind) -> String {
    guard device == .airConditioner, haBinding != nil else { return snapshot.status(for: device) }
    guard homeAssistant.state == .online else { return homeAssistant.state.name }
    guard let state = homeAssistant.snapshot else { return "未找到空调实体" }
    return "\(haModeName(state.mode)) · \(acState.temperatureLabel)°C\(homeAssistant.pending ? " · 等待确认" : "")"
  }

  public func send(_ action: HomeAction, at now: Date = Date()) {
    if haBinding != nil {
      if case .ac(let command) = action {
        switch command {
        case .toggle: homeAssistant.request(.power(!homeAssistant.displayPower))
        case .temperature(let temperature): homeAssistant.request(.temperature(temperature))
        case .mode(let mode): homeAssistant.request(.mode(mode == .hot ? "heat" : "cool"))
        // Fan speed is the virtual unit's only; real devices keep theirs.
        case .fan: break
        }
        return
      }
    }
    if case .allOff = action {
      for connection in haConnections.values where connection.canControl { connection.request(.power(false)) }
      turnOffPlugins()
    }
    snapshot.apply(action, at: now)
    snapshot.expireTimers(at: now)
    persist()
  }

  public func toggle(_ device: DeviceKind) {
    switch device {
    case .airConditioner: send(.ac(.toggle))
    case .fan: send(.fan(.toggle))
    case .robotVacuum: send(.robot(snapshot.isActive(device) ? .pause : .start))
    case .handWarmer: send(.warmer(.toggle))
    case .television: send(.tv(.toggle))
    }
  }

  public func expireTimers(at now: Date = Date()) {
    if snapshot.expireTimers(at: now) { persist() }
  }

  private func persist() {
    do { defaults.set(try JSONEncoder().encode(snapshot), forKey: key) }
    catch { storageMessage = "本次更改未能保存到本机。" }
  }

  // MARK: Real air conditioners

  public var virtualDevices: [DeviceKind] { DeviceKind.allCases.filter { $0 != .airConditioner || haDevices.isEmpty } }
  public var rooms: [HomeRoom] {
    var result = HomeRoom.allCases
    for room in haDevices.map(\.room) + Array(snapshot.rooms.values) + snapshot.plugins.map(\.room) {
      if !result.contains(room) { result.append(room) }
    }
    return result
  }
  public func isHAActive(_ id: String) -> Bool {
    guard let connection = haConnections[id] else { return false }
    return connection.state == .online && connection.snapshot?.isOn == true
  }
  public func haStatus(_ id: String) -> String {
    guard let connection = haConnections[id] else { return "未连接" }
    guard connection.state == .online else { return connection.state.name }
    guard let state = connection.snapshot else { return "未找到空调实体" }
    let temperature = state.targetTemperature.map { " · \($0.formatted())\(state.temperatureUnit ?? "")" } ?? ""
    return haModeName(state.mode) + temperature + (connection.pending ? " · 等待确认" : "")
  }
  public func selectHADevice(_ id: String) {
    guard haDevices.contains(where: { $0.id == id }) else { return }
    selectedHAID = id
    persistHABindings()
  }
  public func toggleHADevice(_ id: String) {
    guard let connection = haConnections[id], connection.canControl else { return }
    connection.request(.power(!connection.displayPower))
  }
  public func moveHADevice(_ id: String, to room: HomeRoom) {
    guard let index = haDevices.firstIndex(where: { $0.id == id }) else { return }
    haDevices[index].room = room
    persistHABindings()
  }
  public func bindHomeAssistant(_ candidate: HomeAssistantClimate, entityID: String) throws {
    try bindHomeAssistants(candidate, selections: [HADeviceSelection(entityID: entityID,
      room: HomeRoom(name: candidate.entityRooms[entityID] ?? ""))])
  }
  public func bindHomeAssistants(_ candidate: HomeAssistantClimate, selections: [HADeviceSelection]) throws {
    guard candidate.state == .online, let endpoint = candidate.endpoint, !selections.isEmpty,
          Set(selections.map(\.entityID)).count == selections.count else { throw HAError.disconnected }
    // Validate the whole selection before writing the credential or changing bindings.
    let additions = try selections.map { selection -> HADeviceBinding in
      guard let entity = candidate.entities.first(where: { $0.id == selection.entityID }) else { throw HAError.entityMissing }
      guard entity.unsupportedReason == nil else { throw HAError.unsupported }
      return HADeviceBinding(binding: try HABinding(endpoint: endpoint, entityID: selection.entityID),
                             name: entity.name, room: selection.room)
    }
    _ = try candidate.bind(entityID: additions[0].binding.entityID)
    for (index, device) in additions.enumerated() {
      restoreTasks.removeValue(forKey: device.id)?.cancel()
      if let old = haConnections[device.id], old !== candidate { old.disconnect() }
      if let previous = haDevices.firstIndex(where: { $0.id == device.id }) { haDevices[previous] = device }
      else { haDevices.append(device) }
      let connection = index == 0 ? candidate : connectionFactory()
      haConnections[device.id] = connection
      if index != 0 { restore(device, using: connection) }
    }
    let updatedIDs = Set(additions.map(\.id))
    for device in haDevices where device.binding.endpoint == endpoint && !updatedIDs.contains(device.id) {
      if let connection = haConnections[device.id] { restore(device, using: connection) }
    }
    selectedHAID = additions[0].id
    persistHABindings()
  }
  public func unbindHomeAssistant() {
    if let selectedHAID { removeHADevice(selectedHAID) }
  }
  public func removeHADevice(_ id: String) {
    restoreTasks.removeValue(forKey: id)?.cancel()
    haConnections.removeValue(forKey: id)?.disconnect()
    haDevices.removeAll { $0.id == id }
    if selectedHAID == id { selectedHAID = haDevices.first?.id }
    persistHABindings()
  }
  public func reconnectHADevices(at endpoint: HAEndpoint) {
    // Clear a denied/stale read once, then share the new read across this fleet.
    haDevices.first(where: { $0.binding.endpoint == endpoint })
      .flatMap { haConnections[$0.id] }?.reloadCredentialOnNextRestore()
    for device in haDevices where device.binding.endpoint == endpoint {
      if let connection = haConnections[device.id] { restore(device, using: connection) }
    }
  }
  public func forgetHACredential(at endpoint: HAEndpoint) throws {
    for device in haDevices where device.binding.endpoint == endpoint {
      restoreTasks.removeValue(forKey: device.id)?.cancel()
      try haConnections[device.id]?.forgetCredential()
    }
  }
  private func restore(_ device: HADeviceBinding, using connection: HomeAssistantClimate) {
    restoreTasks.removeValue(forKey: device.id)?.cancel()
    // Disable controls immediately, before the asynchronous restore starts.
    connection.disconnect()
    restoreTasks[device.id] = Task { await connection.restore(device.binding) }
  }
  private func loadHABindings() {
    if let data = defaults.data(forKey: "yun-home:ha-devices:v2") {
      do {
        let saved = try JSONDecoder().decode([HADeviceBinding].self, from: data)
        var seen = Set<String>()
        haDevices = saved.filter { seen.insert($0.id).inserted }
      } catch {
        defaults.set(data, forKey: "yun-home:ha-devices:v2:recovery")
        storageMessage = "真实设备绑定未能读取，已保留恢复副本，请重新连接。"
      }
    } else if let data = defaults.data(forKey: "yun-home:ha-binding:v1"),
              let binding = try? JSONDecoder().decode(HABinding.self, from: data) {
      haDevices = [HADeviceBinding(binding: binding, name: "空调", room: snapshot.room(for: .airConditioner))]
    }
    let savedSelection = defaults.string(forKey: "yun-home:ha-selected:v2")
    selectedHAID = haDevices.first(where: { $0.id == savedSelection })?.id ?? haDevices.first?.id
    for device in haDevices {
      let connection = device.id == haDevices.first?.id ? virtualConnection : connectionFactory()
      haConnections[device.id] = connection
      restore(device, using: connection)
    }
    if !haDevices.isEmpty { persistHABindings() }
    else { exportHABindings() }
  }
  private func persistHABindings() {
    do {
      defaults.set(try JSONEncoder().encode(haDevices), forKey: "yun-home:ha-devices:v2")
      defaults.set(selectedHAID, forKey: "yun-home:ha-selected:v2")
      defaults.removeObject(forKey: "yun-home:ha-binding:v1")
      exportHABindings()
    } catch { storageMessage = "真实设备绑定未能保存，请重试。" }
  }

  private func exportHABindings() {
    do {
      try sharedBindings?.save(haDevices.map {
        HASharedDevice(binding: $0.binding, name: $0.name, roomID: $0.room.rawValue, roomName: $0.room.name)
      })
    } catch { storageMessage = "设备已保存，但共享绑定目录未能更新，请检查本机文件权限。" }
  }

  // MARK: Plugins

  public func installedPlugin(for instance: PluginInstance) -> InstalledPlugin? { installedPlugins[instance.pluginId] }

  public func status(for instance: PluginInstance) -> String {
    if installedPlugins[instance.pluginId] == nil { return "插件未安装" }
    if let error = pluginErrors[instance.id] { return error }
    return pluginPresentations[instance.id]?.summary ?? PluginPresentation.unknown.summary
  }

  /// Install a reviewed plugin from the bundled catalog and add one device.
  @discardableResult
  public func install(_ entry: PluginCatalogEntry, from directory: URL) async throws -> PluginInstance {
    let plugin = try pluginInstaller.install(archive: directory.appendingPathComponent(entry.package), expectedSHA256: entry.sha256)
    return try await activate(plugin)
  }

  /// Read a `.yunplugin` without installing it, so its permissions can be confirmed first.
  public func inspect(file: URL) throws -> PluginPackage { try pluginInstaller.inspect(archive: file) }

  /// Install an unreviewed `.yunplugin` picked by the user.
  @discardableResult
  public func install(file: URL) async throws -> PluginInstance {
    try await activate(try pluginInstaller.install(archive: file))
  }

  /// Compare installed market plugins with the bundled catalog. Updates that
  /// ask for no new permission are applied right away; the rest are listed in
  /// `pluginUpdates` until `applyPluginUpdate` is called. Device state is kept:
  /// the new package only replaces the plugin's files, then re-presents.
  public func checkPluginUpdates(catalog: [PluginCatalogEntry], directory: URL) async {
    for entry in catalog {
      guard let installed = installedPlugins[entry.id] else { continue }
      let archive = directory.appendingPathComponent(entry.package)
      guard let update = try? pluginInstaller.availableUpdate(for: installed, entry: entry, archive: archive) else {
        pluginUpdates[entry.id] = nil
        continue
      }
      if update.needsConsent {
        pluginUpdates[entry.id] = update
      } else {
        try? await apply(update, from: directory)
      }
    }
  }

  /// Install a pending update the user accepted, including its new permissions.
  public func applyPluginUpdate(_ id: String, from directory: URL) async throws {
    guard let update = pluginUpdates[id] else { return }
    try await apply(update, from: directory)
  }

  private func apply(_ update: PluginUpdate, from directory: URL) async throws {
    let plugin = try pluginInstaller.install(archive: directory.appendingPathComponent(update.entry.package),
                                             expectedSHA256: update.entry.sha256)
    pluginUpdates[plugin.id] = nil
    // Re-registers the new script and re-presents existing devices with it.
    _ = try await activate(plugin)
  }

  /// Remove a plugin, its devices and its files.
  public func uninstall(plugin id: String) async {
    let removed = snapshot.plugins.filter { $0.pluginId == id }.map(\.id)
    snapshot.plugins.removeAll { $0.pluginId == id }
    for instance in removed {
      pluginPresentations[instance] = nil
      pluginErrors[instance] = nil
      pluginQueues[instance]?.cancel()
      pluginQueues[instance] = nil
    }
    installedPlugins[id] = nil
    pluginUpdates[id] = nil
    try? pluginInstaller.uninstall(id: id)
    await pluginHost.unregister(plugin: id)
    snapshot.changedAt = Date()
    persist()
  }

  public func move(plugin id: String, to room: HomeRoom) {
    guard let index = snapshot.plugins.firstIndex(where: { $0.id == id }) else { return }
    snapshot.plugins[index].room = room
    snapshot.changedAt = Date()
    persist()
  }

  /// Run a plugin action. Actions for the same device run one after another,
  /// each against the latest state, so quick taps never overwrite each other.
  public func send(plugin id: String, action: JSONValue) {
    let previous = pluginQueues[id]
    pluginQueues[id] = Task { [weak self] in
      await previous?.value
      await self?.perform(plugin: id, action: action)
    }
  }

  /// Wait until queued actions for a device have finished; used by tests.
  public func settle(plugin id: String) async { await pluginQueues[id]?.value }

  /// Record a new room reading and let thermal-granted plugin devices
  /// re-present with it, so their summaries show the room temperature.
  public func updateRoom(_ reading: RoomReading?) {
    guard reading != room else { return }
    room = reading
    for instance in snapshot.plugins where installedPlugins[instance.pluginId]?.grants(PluginPermission.thermal) == true {
      Task { [weak self] in await self?.refresh(instance) }
    }
  }

  /// Host data passed to a plugin's `reduce` and `present`. The room reading
  /// is only included for plugins granted `sensor:thermal`.
  public func pluginContext(for pluginId: String) -> JSONValue? {
    guard let plugin = installedPlugins[pluginId], plugin.grants(PluginPermission.thermal), let room,
          let data = try? JSONEncoder().encode(room),
          let value = try? JSONDecoder().decode(JSONValue.self, from: data) else { return nil }
    return .object(["room": value])
  }

  private func perform(plugin id: String, action: JSONValue) async {
    guard let instance = snapshot.plugin(id), installedPlugins[instance.pluginId] != nil else { return }
    do {
      let result = try await pluginHost.dispatch(plugin: instance.pluginId, state: instance.state, action: action,
                                                 context: pluginContext(for: instance.pluginId))
      guard let index = snapshot.plugins.firstIndex(where: { $0.id == id }) else { return }
      snapshot.plugins[index].state = result.state
      snapshot.plugins[index].changedAt = Date()
      snapshot.changedAt = snapshot.plugins[index].changedAt
      pluginPresentations[id] = result.presentation
      pluginErrors[id] = nil
      persist()
    } catch {
      pluginErrors[id] = error.localizedDescription
    }
  }

  private func activate(_ plugin: InstalledPlugin) async throws -> PluginInstance {
    installedPlugins[plugin.id] = plugin
    await pluginHost.register(plugin: plugin.id, source: plugin.package.stateSource)
    if let existing = snapshot.plugins.first(where: { $0.pluginId == plugin.id }) {
      await refresh(existing)
      return existing
    }
    let created = try await pluginHost.create(plugin: plugin.id, context: pluginContext(for: plugin.id))
    let instance = PluginInstance(pluginId: plugin.id, name: plugin.manifest.name, state: created.state)
    snapshot.plugins.append(instance)
    snapshot.changedAt = instance.changedAt
    pluginPresentations[instance.id] = created.presentation
    persist()
    return instance
  }

  private func loadPlugins() {
    for plugin in pluginInstaller.installed() { installedPlugins[plugin.id] = plugin }
    let instances = snapshot.plugins
    guard !instances.isEmpty else { return }
    Task { [weak self] in
      guard let self else { return }
      for plugin in await self.installedPlugins.values {
        await self.pluginHost.register(plugin: plugin.id, source: plugin.package.stateSource)
      }
      for instance in instances { await self.refresh(instance) }
    }
  }

  private func refresh(_ instance: PluginInstance) async {
    guard installedPlugins[instance.pluginId] != nil else { return }
    do {
      let result = try await pluginHost.present(plugin: instance.pluginId, state: instance.state,
                                                context: pluginContext(for: instance.pluginId))
      pluginPresentations[instance.id] = result.presentation
      pluginErrors[instance.id] = nil
    } catch {
      pluginErrors[instance.id] = error.localizedDescription
    }
  }

  private func turnOffPlugins() {
    for instance in snapshot.plugins where isActive(plugin: instance) {
      guard let power = installedPlugins[instance.pluginId]?.package.controls.power?.action else { continue }
      send(plugin: instance.id, action: power)
    }
  }
}
