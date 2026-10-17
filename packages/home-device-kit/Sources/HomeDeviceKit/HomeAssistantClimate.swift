import Foundation
import Observation

public enum HAConnectionState: Equatable, Sendable {
  case disconnected, needsToken, connecting, online, offline
  public var name: String {
    switch self {
    case .disconnected: "未连接"
    case .needsToken: "需要令牌"
    case .connecting: "正在连接"
    case .online: "已连接"
    case .offline: "连接已断开"
    }
  }
}

/// One bound climate device. UI-independent: callers provide only endpoint,
/// credentials, entity selection, and explicit user changes. Connecting,
/// restoring, and reconnecting only subscribe/read; they never replay commands.
@MainActor @Observable public final class HomeAssistantClimate {
  public private(set) var state = HAConnectionState.disconnected
  public private(set) var endpoint: HAEndpoint?
  public private(set) var binding: HABinding?
  public private(set) var entities: [HAClimateSnapshot] = []
  public private(set) var error: String?
  public private(set) var snapshot: HAClimateSnapshot?
  public private(set) var entityRooms: [String: String] = [:]
  public private(set) var roomLookupFailed = false
  private var systemTemperatureUnit: String?
  private var active: ClimateIntent?
  private var queued: ClimateIntent?
  private var draftMode: String?
  private var draftTemperature: Double?
  @ObservationIgnored private let client: HomeAssistantClient
  @ObservationIgnored private let credentials: any HACredentialStore
  @ObservationIgnored private let confirmationTimeout: Duration
  @ObservationIgnored private let debounce: Duration
  @ObservationIgnored private let reconnectDelay: Duration
  @ObservationIgnored private var sessionToken: String?
  @ObservationIgnored private var generation = 0
  @ObservationIgnored private var revision = 0
  @ObservationIgnored private var commandTask: Task<Void, Never>?
  @ObservationIgnored private var debounceTask: Task<Void, Never>?
  @ObservationIgnored private var reconnectTask: Task<Void, Never>?
  @ObservationIgnored private var confirmationTask: Task<Void, Never>?
  @ObservationIgnored private var confirmationWaiter: CheckedContinuation<Bool, Never>?
  @ObservationIgnored private var buffering = false
  @ObservationIgnored private var buffered: [String: HAEntity?] = [:]
  @ObservationIgnored private var reconnectAttempt = 0

  public init(client: HomeAssistantClient? = nil, credentials: (any HACredentialStore)? = nil,
              confirmationTimeout: Duration = .seconds(5), debounce: Duration = .milliseconds(600),
              reconnectDelay: Duration = .seconds(1)) {
    self.client = client ?? HomeAssistantClient()
    self.credentials = credentials ?? HAKeychainCredentials()
    self.confirmationTimeout = confirmationTimeout
    self.debounce = debounce
    self.reconnectDelay = reconnectDelay
    self.client.onStateEvent = { [weak self] in self?.receiveEvent($0) }
    // Invalidate cached units before accepting states after a unit-system change.
    self.client.onConfigurationChanged = { [weak self] in self?.lostConnection(.disconnected) }
    self.client.onDisconnect = { [weak self] in self?.lostConnection($0) }
  }

  public var pending: Bool { active != nil || queued != nil }
  public var canControl: Bool { state == .online && snapshot?.available == true && snapshot?.unsupportedReason == nil }
  public var displayPower: Bool { queued?.power ?? active?.power ?? snapshot?.isOn ?? false }
  public var displayMode: String {
    queued?.mode ?? active?.mode ?? draftMode ?? preferredMode
  }
  public var displayTemperature: Double {
    queued?.temperature ?? active?.temperature ?? draftTemperature ?? snapshot?.targetTemperature ?? 26
  }
  private var preferredMode: String {
    if let mode = snapshot?.mode, mode != "off" { return mode }
    return snapshot?.modes.contains("cool") == true ? "cool" : "heat"
  }

  /// A connection test lists devices, but neither binds nor saves a token.
  public func connect(to endpoint: HAEndpoint, token: String) async throws {
    disconnect()
    binding = nil
    snapshot = nil
    self.endpoint = endpoint
    sessionToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
    let current = generation
    do { try await establish() }
    catch {
      guard generation == current else { throw error }
      state = error as? HAError == .invalidToken ? .needsToken : .offline
      self.error = (error as? HAError ?? .disconnected).localizedDescription
      throw error
    }
  }

  /// After a successful test, callers explicitly select a supported entity.
  /// Only this operation persists the credential; binding metadata is app-owned.
  public func bind(entityID: String) throws -> HABinding {
    guard state == .online, let endpoint, let sessionToken else { throw HAError.disconnected }
    guard let entity = entities.first(where: { $0.id == entityID }) else { throw HAError.entityMissing }
    guard entity.unsupportedReason == nil else { throw HAError.unsupported }
    let binding = try HABinding(endpoint: endpoint, entityID: entityID)
    try credentials.save(sessionToken, for: endpoint)
    generation += 1
    cancelCommands()
    self.binding = binding
    snapshot = entity
    error = nil
    return binding
  }

  public func restore(_ binding: HABinding) async {
    guard !Task.isCancelled else { return }
    disconnect()
    self.binding = binding
    endpoint = binding.endpoint
    snapshot = nil
    let current = generation
    do {
      guard let token = try credentials.load(for: binding.endpoint), !token.isEmpty else {
        state = .needsToken
        error = "请在此 Mac 输入 Home Assistant 令牌。"
        return
      }
      sessionToken = token
      try await establish()
    } catch {
      guard generation == current else { return }
      state = error as? HAError == .invalidToken ? .needsToken : .offline
      self.error = (error as? HAError ?? .disconnected).localizedDescription
      if state == .offline { scheduleReconnect() }
    }
  }

  public func disconnect() {
    generation += 1
    cancelCommands()
    reconnectTask?.cancel(); reconnectTask = nil
    client.disconnect()
    sessionToken = nil
    state = .disconnected
    buffering = false
    buffered.removeAll()
  }

  public func forgetCredential() throws {
    if let endpoint { try credentials.remove(for: endpoint) }
    disconnect()
    state = .needsToken
    error = "本机令牌已删除，请重新输入后连接。"
  }

  public func request(_ change: HAClimateChange) {
    guard canControl, let snapshot else { error = HAError.unavailable.localizedDescription; return }
    var intent = ClimateIntent(power: displayPower, mode: displayMode, temperature: displayTemperature,
                               fields: (active?.fields ?? []).union(queued?.fields ?? []))
    switch change {
    case .power(let value):
      intent.power = value
      intent.fields.insert("power")
      if value {
        if !["cool", "heat"].contains(intent.mode) { intent.mode = snapshot.modes.contains("cool") ? "cool" : "heat" }
        intent.fields.insert("mode")
        if snapshot.supportsTemperature { intent.fields.insert("temperature") }
        draftMode = nil; draftTemperature = nil
      } else {
        draftMode = intent.mode; draftTemperature = intent.temperature
        intent.fields = ["power"]
      }
    case .temperature(let value):
      guard snapshot.supportsTemperature, value.isFinite else { error = HAError.unsupported.localizedDescription; return }
      intent.temperature = snapshot.clamp(value)
      intent.fields.insert("temperature")
      if !intent.power { draftTemperature = intent.temperature; error = nil; return }
    case .mode(let value):
      guard ["cool", "heat"].contains(value), snapshot.modes.contains(value) else { error = HAError.unsupported.localizedDescription; return }
      intent.mode = value
      intent.fields.insert("mode")
      if !intent.power { draftMode = value; error = nil; return }
    }
    revision += 1
    intent.revision = revision
    queued = intent
    error = nil
    resolveConfirmation(false)
    debounceTask?.cancel()
    if case .temperature = change {
      debounceTask = Task { [weak self, debounce] in
        do { try await Task.sleep(for: debounce) } catch { return }
        self?.debounceTask = nil
        self?.flush()
      }
    } else {
      debounceTask = nil
      flush()
    }
  }

  private func establish() async throws {
    guard let endpoint, let token = sessionToken else { throw HAError.invalidToken }
    let current = generation
    state = .connecting
    try await client.connect(to: endpoint, token: token)
    guard generation == current else { throw CancellationError() }
    buffering = true
    buffered.removeAll()
    _ = try await client.request("subscribe_events", fields: ["event_type": .string("state_changed")])
    _ = try await client.request("subscribe_events", fields: ["event_type": .string("core_config_updated")])
    // Older HA versions expose the converted unit only through get_config.
    // Never guess Celsius from the numeric range of a device.
    let config = try await client.request("get_config")
    guard generation == current else { throw CancellationError() }
    systemTemperatureUnit = config["unit_system"]["temperature"].string
    let states = try await client.request("get_states").decode([HAEntity].self)
    guard generation == current else { throw CancellationError() }
    entities = states.filter { $0.entity_id.hasPrefix("climate.") }
      .map { HAClimateSnapshot($0, systemTemperatureUnit: systemTemperatureUnit) }
    buffering = false
    for (id, entity) in buffered { apply(entity, id: id) }
    buffered.removeAll()
    updateSelected()
    if snapshot?.isOn == true && active == nil && queued == nil {
      draftMode = nil; draftTemperature = nil
    }
    state = .online
    reconnectAttempt = 0
    error = binding != nil && snapshot == nil ? HAError.entityMissing.localizedDescription : nil
  }

  /// Optional metadata for a binding form. Lack of registry permissions must
  /// not prevent state reads or manual room assignment.
  public func loadRooms() async {
    let current = generation
    do {
      let areas = try await client.request("config/area_registry/list")
      let devices = try await client.request("config/device_registry/list")
      let entities = try await client.request("config/entity_registry/list")
      guard generation == current else { return }
      entityRooms = haEntityRooms(areas: areas, devices: devices, entities: entities)
      roomLookupFailed = false
    } catch {
      guard generation == current else { return }
      entityRooms = [:]
      roomLookupFailed = true
    }
  }

  private func receiveEvent(_ data: HAValue) {
    guard let id = data["entity_id"].string, id.hasPrefix("climate.") else { return }
    let entity = try? data["new_state"].decode(HAEntity.self)
    if buffering { buffered[id] = .some(entity) }
    else { apply(entity, id: id) }
  }
  private func apply(_ entity: HAEntity?, id: String) {
    if let entity {
      let snapshot = HAClimateSnapshot(entity, systemTemperatureUnit: systemTemperatureUnit)
      if let previous = entities.first(where: { $0.id == id }), previous.reportedAt > snapshot.reportedAt { return }
      entities.removeAll { $0.id == id }
      entities.append(snapshot)
    } else { entities.removeAll { $0.id == id } }
    updateSelected()
    if snapshot?.isOn == true && active == nil && queued == nil {
      draftMode = nil; draftTemperature = nil
    }
    if let snapshot, let active, active.matches(snapshot) { resolveConfirmation(true) }
    if binding != nil && snapshot?.available != true {
      cancelCommands()
      error = (snapshot == nil ? HAError.entityMissing : .unavailable).localizedDescription
    }
  }
  private func updateSelected() {
    snapshot = binding.flatMap { binding in entities.first { $0.id == binding.entityID } }
  }

  private func flush() {
    guard commandTask == nil, debounceTask == nil, let intent = queued, canControl,
          let snapshot, let binding else { return }
    queued = nil
    active = intent
    let current = generation
    commandTask = Task { [weak self] in
      guard let self else { return }
      do {
        let services = try climateServices(from: snapshot, to: intent)
        for service in services {
          guard self.generation == current, self.revision == intent.revision, !Task.isCancelled else { break }
          _ = try await self.client.request("call_service", fields: [
            "domain": .string("climate"), "service": .string(service.name),
            "service_data": .object(service.data), "target": .object(["entity_id": .string(binding.entityID)]),
          ])
        }
        guard self.generation == current, !Task.isCancelled else { return }
        if self.revision == intent.revision {
          let confirmed = await self.confirm(intent)
          guard self.generation == current, !Task.isCancelled else { return }
          if !confirmed && self.revision == intent.revision {
            try await self.reread()
            if self.snapshot.map({ intent.matches($0) }) != true { throw HAError.unconfirmed }
          }
        }
      } catch {
        guard self.generation == current, !Task.isCancelled else { return }
        if self.revision == intent.revision {
          // Read failure must also preserve a visible error, never claim success.
          try? await self.reread()
          guard self.generation == current else { return }
          self.error = (error as? HAError ?? .disconnected).localizedDescription
          if error as? HAError == .invalidToken { self.lostConnection(.invalidToken); return }
        }
      }
      guard self.generation == current else { return }
      self.active = nil
      self.commandTask = nil
      self.flush()
    }
  }
  private func confirm(_ intent: ClimateIntent) async -> Bool {
    if snapshot.map({ intent.matches($0) }) == true { return true }
    return await withCheckedContinuation { waiter in
      confirmationWaiter = waiter
      confirmationTask = Task { [weak self, confirmationTimeout] in
        do { try await Task.sleep(for: confirmationTimeout) } catch { return }
        self?.resolveConfirmation(false)
      }
    }
  }
  private func resolveConfirmation(_ result: Bool) {
    confirmationTask?.cancel(); confirmationTask = nil
    let waiter = confirmationWaiter
    confirmationWaiter = nil
    waiter?.resume(returning: result)
  }
  private func reread() async throws {
    let current = generation
    let states = try await client.request("get_states").decode([HAEntity].self)
    guard generation == current else { throw CancellationError() }
    for entity in states where entity.entity_id.hasPrefix("climate.") { apply(entity, id: entity.entity_id) }
    if let binding, !states.contains(where: { $0.entity_id == binding.entityID }) { apply(nil, id: binding.entityID) }
  }
  private func cancelCommands() {
    revision += 1
    commandTask?.cancel(); commandTask = nil
    debounceTask?.cancel(); debounceTask = nil
    resolveConfirmation(false)
    active = nil; queued = nil
    draftMode = nil; draftTemperature = nil
  }
  private func lostConnection(_ failure: HAError) {
    generation += 1
    cancelCommands()
    client.disconnect()
    state = failure == .invalidToken ? .needsToken : .offline
    error = failure.localizedDescription
    if failure != .invalidToken { scheduleReconnect() }
  }
  private func scheduleReconnect() {
    guard binding != nil, sessionToken != nil, reconnectTask == nil else { return }
    let current = generation
    let multiplier = min(30, 1 << min(5, reconnectAttempt))
    reconnectAttempt += 1
    reconnectTask = Task { [weak self, reconnectDelay] in
      do { try await Task.sleep(for: reconnectDelay * multiplier) } catch { return }
      guard let self, self.generation == current else { return }
      self.reconnectTask = nil
      do { try await self.establish() }
      catch {
        guard self.generation == current else { return }
        self.state = error as? HAError == .invalidToken ? .needsToken : .offline
        self.error = (error as? HAError ?? .disconnected).localizedDescription
        if self.state == .offline { self.scheduleReconnect() }
      }
    }
  }
}
