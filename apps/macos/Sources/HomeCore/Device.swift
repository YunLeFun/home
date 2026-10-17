import Foundation

public enum DeviceKind: String, Codable, CaseIterable, Identifiable {
  case airConditioner = "air-conditioner"
  case fan
  case robotVacuum = "robot-vacuum"
  case handWarmer = "hand-warmer"
  case television

  public var id: String { rawValue }
  public var name: String {
    switch self {
    case .airConditioner: "云端空调"
    case .fan: "云端风扇"
    case .robotVacuum: "扫地机器人"
    case .handWarmer: "暖手宝"
    case .television: "云端电视"
    }
  }
  public var symbol: String {
    switch self {
    case .airConditioner: "air.conditioner.horizontal"
    case .fan: "fan"
    case .robotVacuum: "circle.dotted.circle"
    case .handWarmer: "hand.raised.fingers.spread"
    case .television: "tv"
    }
  }
}

public enum HomeRoom: String, Codable, CaseIterable, Identifiable {
  case living = "living-room"
  case bedroom
  case utility = "utility-room"
  public var id: String { rawValue }
  public var name: String {
    switch self {
    case .living: "客厅"
    case .bedroom: "卧室"
    case .utility: "家政区"
    }
  }
  public var symbol: String {
    switch self {
    case .living: "sofa"
    case .bedroom: "bed.double"
    case .utility: "washer"
    }
  }
}

// Field names and enum raw values follow types/device.ts. Native storage is
// independent; this does not imply shared browser sessions or cloud sync.
public enum ACMode: String, Codable, CaseIterable {
  case cold, hot
}

public struct ACState: Codable, Equatable {
  public var status = false
  public var mode = ACMode.cold
  public var temperature = 26.0
  public static let temperatureRange = 16.0...31.0
  public var temperatureLabel: String { temperature.formatted(.number.precision(.fractionLength(0...2))) }
  public init(status: Bool = false, mode: ACMode = .cold, temperature: Double = 26) {
    self.status = status
    self.mode = mode
    self.temperature = min(31, max(16, temperature))
  }
}

public struct FanState: Codable, Equatable {
  public var power = false
  public var speed = 1
  public var oscillating = false
  public var autoOffAt: Date?
  public var stateChangedAt = Date(timeIntervalSince1970: 0)
  public init() {}
}

public enum RobotStatus: String, Codable {
  case docked, cleaning, paused, returning, charging
}
public enum RobotMode: String, Codable, CaseIterable {
  case quiet, standard, turbo
  public var name: String {
    switch self { case .quiet: "安静"; case .standard: "标准"; case .turbo: "强力" }
  }
}
public struct RobotState: Codable, Equatable {
  public var status = RobotStatus.docked
  public var mode = RobotMode.standard
  public var progress = 0.0
  public var battery = 86
  public var cleanedArea = 0.0
  public var stateChangedAt = Date(timeIntervalSince1970: 0)
  public init() {}
}

public enum WarmerLevel: String, Codable, CaseIterable {
  case low, medium, high
  public var temperature: Int {
    switch self { case .low: 38; case .medium: 42; case .high: 48 }
  }
  public var name: String {
    switch self { case .low: "低温"; case .medium: "适中"; case .high: "暖热" }
  }
}
public struct WarmerState: Codable, Equatable {
  public var power = false
  public var level = WarmerLevel.medium
  public var temperature = 42
  public var autoOffAt: Date?
  public var stateChangedAt = Date(timeIntervalSince1970: 0)
  public init() {}
}

public struct TelevisionState: Codable, Equatable {
  public static let defaultSource = "https://media.w3.org/2010/05/sintel/trailer.mp4"
  public var power = false
  public var playing = false
  public var volume = 45
  public var muted = false
  public var sourceUrl = Self.defaultSource
  public var stateChangedAt = Date(timeIntervalSince1970: 0)
  public init() {}

  public static func isValidSource(_ value: String) -> Bool {
    guard value.count <= 2048, let url = URL(string: value),
          url.scheme?.lowercased() == "https", let host = url.host, !host.isEmpty,
          url.user == nil, url.password == nil else { return false }
    return true
  }
}

public enum ACAction { case toggle, temperature(Double), mode(ACMode) }
public enum FanAction { case toggle, speed(Int), oscillation, timer(Int?) }
public enum RobotAction { case start, pause, resume, `return`, dock, mode(RobotMode) }
public enum WarmerAction { case toggle, level(WarmerLevel), timer(Int?) }
public enum TelevisionAction { case toggle, play, pause, volume(Int), mute, source(String) }
public enum HomeAction {
  case ac(ACAction), fan(FanAction), robot(RobotAction), warmer(WarmerAction), tv(TelevisionAction)
  case move(DeviceKind, HomeRoom), allOff
}
