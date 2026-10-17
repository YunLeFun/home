import Foundation
import Observation
import HomeDeviceKit
import HomePlugins

@MainActor @Observable
public final class HomeStore {
  public private(set) var snapshot: HomeSnapshot
  public private(set) var storageMessage: String?
  public private(set) var homeAssistant: HomeAssistantClimate
  public private(set) var haBinding: HABinding?
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
  @ObservationIgnored private var restoreTask: Task<Void, Never>?

  /// Installed sandbox plugins by plugin id.
  public private(set) var installedPlugins: [String: InstalledPlugin] = [:]
  /// Last presentation reported by each plugin device; rendering never calls into JavaScript.
  public private(set) var pluginPresentations: [String: PluginPresentation] = [:]
  /// Most recent failure per plugin device, cleared on the next success.
  public private(set) var pluginErrors: [String: String] = [:]
  /// The Mac seen as the room, fed by the app's `ThermalMonitor` while
  /// something shows it. Only plugins granted `sensor:thermal` receive it.
  public private(set) var room: RoomReading?
  @ObservationIgnored private let pluginInstaller: PluginInstaller
  @ObservationIgnored private let pluginHost: PluginHostClient
  @ObservationIgnored private var pluginQueues: [String: Task<Void, Never>] = [:]

  public init(defaults: UserDefaults = .standard, now: Date = Date(), homeAssistant: HomeAssistantClimate? = nil,
              pluginRoot: URL? = nil, pluginHostExecutable: URL? = nil) {
    self.defaults = defaults
    pluginInstaller = PluginInstaller(root: pluginRoot ?? PluginInstaller.defaultRoot())
    pluginHost = PluginHostClient(executable: pluginHostExecutable ?? PluginHostClient.bundledExecutable())
    self.homeAssistant = homeAssistant ?? HomeAssistantClimate()
    showMenuBarIcon = defaults.object(forKey: "yun-home:menu-bar-icon") as? Bool ?? true
    if let data = defaults.data(forKey: "yun-home:ha-binding:v1") {
      haBinding = try? JSONDecoder().decode(HABinding.self, from: data)
    }
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
    if let binding = haBinding {
      let connection = self.homeAssistant
      restoreTask = Task { await connection.restore(binding) }
    }
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
    DeviceKind.allCases.filter(isActive).count + snapshot.plugins.filter { isActive(plugin: $0) }.count
  }
  public func status(for device: DeviceKind) -> String {
    guard device == .airConditioner, haBinding != nil else { return snapshot.status(for: device) }
    guard homeAssistant.state == .online else { return homeAssistant.state.name }
    guard let state = homeAssistant.snapshot else { return "未找到空调实体" }
    return "\(haModeName(state.mode)) · \(acState.temperatureLabel)°C\(homeAssistant.pending ? " · 等待确认" : "")"
  }

  public func bindHomeAssistant(_ candidate: HomeAssistantClimate, entityID: String) throws {
    let binding = try candidate.bind(entityID: entityID)
    let data = try JSONEncoder().encode(binding)
    restoreTask?.cancel(); restoreTask = nil
    if homeAssistant !== candidate {
      homeAssistant.disconnect()
      homeAssistant = candidate
    }
    haBinding = binding
    defaults.set(data, forKey: "yun-home:ha-binding:v1")
  }
  public func unbindHomeAssistant() {
    restoreTask?.cancel(); restoreTask = nil
    homeAssistant.disconnect()
    homeAssistant = HomeAssistantClimate()
    haBinding = nil
    defaults.removeObject(forKey: "yun-home:ha-binding:v1")
  }

  public func send(_ action: HomeAction, at now: Date = Date()) {
    if haBinding != nil {
      if case .ac(let command) = action {
        switch command {
        case .toggle: homeAssistant.request(.power(!homeAssistant.displayPower))
        case .temperature(let temperature): homeAssistant.request(.temperature(temperature))
        case .mode(let mode): homeAssistant.request(.mode(mode == .hot ? "heat" : "cool"))
        }
        return
      }
      if case .allOff = action { homeAssistant.request(.power(false)) }
    }
    if case .allOff = action { turnOffPlugins() }
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
