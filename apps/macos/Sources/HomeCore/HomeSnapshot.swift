import Foundation

public struct HomeSnapshot: Codable, Equatable {
  /// 2 adds plugin devices; version 1 archives load with none.
  public static let currentVersion = 2
  public var version = Self.currentVersion
  public var airConditioner = ACState()
  public var fan = FanState()
  public var robotVacuum = RobotState()
  public var handWarmer = WarmerState()
  public var television = TelevisionState()
  public var rooms: [String: HomeRoom] = [
    DeviceKind.airConditioner.rawValue: .living, DeviceKind.fan.rawValue: .living,
    DeviceKind.robotVacuum.rawValue: .utility, DeviceKind.handWarmer.rawValue: .bedroom,
    DeviceKind.television.rawValue: .living,
  ]
  public var changedAt = Date(timeIntervalSince1970: 0)
  public var plugins: [PluginInstance] = []
  public init() {}

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    version = try container.decode(Int.self, forKey: .version)
    airConditioner = try container.decode(ACState.self, forKey: .airConditioner)
    fan = try container.decode(FanState.self, forKey: .fan)
    robotVacuum = try container.decode(RobotState.self, forKey: .robotVacuum)
    handWarmer = try container.decode(WarmerState.self, forKey: .handWarmer)
    television = try container.decode(TelevisionState.self, forKey: .television)
    rooms = try container.decode([String: HomeRoom].self, forKey: .rooms)
    changedAt = try container.decode(Date.self, forKey: .changedAt)
    plugins = try container.decodeIfPresent([PluginInstance].self, forKey: .plugins) ?? []
  }

  public func plugin(_ id: String) -> PluginInstance? { plugins.first { $0.id == id } }

  public func room(for device: DeviceKind) -> HomeRoom { rooms[device.rawValue] ?? .living }
  public func isActive(_ device: DeviceKind) -> Bool {
    switch device {
    case .airConditioner: airConditioner.status
    case .fan: fan.power
    case .robotVacuum: robotVacuum.status == .cleaning || robotVacuum.status == .returning
    case .handWarmer: handWarmer.power
    case .television: television.power
    }
  }
  public var activeCount: Int { DeviceKind.allCases.filter(isActive).count }
  public var nextAutoOff: Date? { [fan.autoOffAt, handWarmer.autoOffAt].compactMap { $0 }.min() }

  public func status(for device: DeviceKind) -> String {
    switch device {
    case .airConditioner:
      return airConditioner.status ? "\(airConditioner.mode == .cold ? "制冷" : "制热") · \(airConditioner.temperatureLabel)°C" : "待机 · \(airConditioner.temperatureLabel)°C"
    case .fan: return fan.power ? "\(fan.speed) 档风 · \(fan.oscillating ? "摇头" : "定向")" : "已关闭"
    case .robotVacuum:
      switch robotVacuum.status {
      case .docked: return "已停靠"
      case .cleaning: return "正在清扫"
      case .paused: return "已暂停"
      case .returning: return "正在回充"
      case .charging: return "充电中"
      }
    case .handWarmer: return handWarmer.power ? "\(handWarmer.level.name) · \(handWarmer.temperature)°C" : "已关闭"
    case .television: return television.power ? (television.playing ? "正在播放" : "已开机") : "已关闭"
    }
  }

  public mutating func apply(_ action: HomeAction, at now: Date = Date()) {
    switch action {
    case .ac(let action):
      switch action {
      case .toggle: airConditioner.status.toggle()
      case .temperature(let value): airConditioner.temperature = min(31, max(16, value))
      case .mode(let value): airConditioner.mode = value
      }
    case .fan(let action):
      switch action {
      case .toggle: fan.power.toggle()
      case .speed(let value): fan.speed = min(3, max(1, value)); fan.power = true
      case .oscillation: fan.oscillating.toggle()
      case .timer(let minutes): fan.autoOffAt = Self.deadline(minutes, now: now)
      }
      fan.stateChangedAt = now
    case .robot(let action):
      switch action {
      case .start:
        if robotVacuum.progress >= 1 { robotVacuum.progress = 0 }
        robotVacuum.status = .cleaning
      case .resume: robotVacuum.status = .cleaning
      case .pause: robotVacuum.status = .paused
      case .return: robotVacuum.status = .returning
      case .dock: robotVacuum.status = .charging; robotVacuum.progress = 0
      case .mode(let value): robotVacuum.mode = value
      }
      robotVacuum.stateChangedAt = now
    case .warmer(let action):
      switch action {
      case .toggle: handWarmer.power.toggle()
      case .level(let value):
        handWarmer.level = value; handWarmer.temperature = value.temperature; handWarmer.power = true
      case .timer(let minutes): handWarmer.autoOffAt = Self.deadline(minutes, now: now)
      }
      handWarmer.stateChangedAt = now
    case .tv(let action):
      switch action {
      case .toggle:
        television.power.toggle()
        if !television.power { television.playing = false }
      case .play: television.power = true; television.playing = true
      case .pause: television.playing = false
      case .volume(let value): television.volume = min(100, max(0, value))
      case .mute: television.muted.toggle()
      case .source(let value):
        guard TelevisionState.isValidSource(value) else { return }
        television.sourceUrl = value; television.power = true; television.playing = false
      }
      television.stateChangedAt = now
    case .move(let device, let room): rooms[device.rawValue] = room
    case .allOff:
      airConditioner.status = false
      fan.power = false; fan.autoOffAt = nil; fan.stateChangedAt = now
      handWarmer.power = false; handWarmer.autoOffAt = nil; handWarmer.stateChangedAt = now
      television.power = false; television.playing = false; television.stateChangedAt = now
      if robotVacuum.status == .cleaning || robotVacuum.status == .returning {
        robotVacuum.status = .paused; robotVacuum.stateChangedAt = now
      }
    }
    changedAt = now
  }

  @discardableResult
  public mutating func expireTimers(at now: Date = Date()) -> Bool {
    var changed = false
    if let deadline = fan.autoOffAt, deadline <= now {
      fan.power = false; fan.autoOffAt = nil; fan.stateChangedAt = now; changed = true
    }
    if let deadline = handWarmer.autoOffAt, deadline <= now {
      handWarmer.power = false; handWarmer.autoOffAt = nil; handWarmer.stateChangedAt = now; changed = true
    }
    if changed { changedAt = now }
    return changed
  }

  public mutating func normalize() {
    airConditioner.temperature = min(31, max(16, airConditioner.temperature))
    fan.speed = min(3, max(1, fan.speed))
    television.volume = min(100, max(0, television.volume))
    television.playing = television.power && television.playing
    if !TelevisionState.isValidSource(television.sourceUrl) { television.sourceUrl = TelevisionState.defaultSource }
    handWarmer.temperature = handWarmer.level.temperature
    robotVacuum.battery = min(100, max(0, robotVacuum.battery))
    robotVacuum.progress = robotVacuum.progress.isFinite ? min(1, max(0, robotVacuum.progress)) : 0
    robotVacuum.cleanedArea = robotVacuum.cleanedArea.isFinite ? min(999, max(0, robotVacuum.cleanedArea)) : 0
  }

  private static func deadline(_ minutes: Int?, now: Date) -> Date? {
    minutes.map { now.addingTimeInterval(Double(min(1440, max(0, $0))) * 60) }
  }
}
