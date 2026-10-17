import Foundation

public struct HAEntity: Codable, Equatable, Sendable {
  public let entity_id: String
  public let state: String
  public let attributes: [String: HAValue]
  public let last_updated: String
  public init(entityID: String, state: String, attributes: [String: HAValue], lastUpdated: String) {
    entity_id = entityID; self.state = state; self.attributes = attributes; last_updated = lastUpdated
  }
}

public struct HAClimateSnapshot: Equatable, Identifiable, Sendable {
  public let entity: HAEntity
  public let systemTemperatureUnit: String?
  public var temperatureUnit: String? { entity.attributes["temperature_unit"]?.string ?? systemTemperatureUnit }
  public var id: String { entity.entity_id }
  public var name: String { entity.attributes["friendly_name"]?.string ?? id }
  public var mode: String { entity.state }
  public var available: Bool { !["unavailable", "unknown"].contains(mode) }
  public var isOn: Bool { available && mode != "off" }
  public var modes: [String] { entity.attributes["hvac_modes"]?.array.compactMap(\.string) ?? [] }
  public var minimum: Double { entity.attributes["min_temp"]?.number ?? 7 }
  public var maximum: Double { max(minimum, entity.attributes["max_temp"]?.number ?? 35) }
  public var step: Double { max(0.01, entity.attributes["target_temp_step"]?.number ?? 1) }
  public var targetTemperature: Double? { entity.attributes["temperature"]?.number }
  public var currentTemperature: Double? { entity.attributes["current_temperature"]?.number }
  public var supportsTemperature: Bool {
    let value = entity.attributes["supported_features"]?.number ?? 0
    return value.isFinite && value >= 0 && value < Double(Int.max) && (Int(value) & 1) != 0
  }
  public var unsupportedReason: String? {
    if temperatureUnit == nil { return "无法确认温标，请检查 Home Assistant 的单位设置后重新连接。" }
    if temperatureUnit != "°C" { return "目前仅支持摄氏度空调实体。" }
    if !modes.contains("off") || !modes.contains(where: { ["cool", "heat"].contains($0) }) { return "需要支持关闭，以及制冷或制热模式的空调实体。" }
    return nil
  }
  public init(_ entity: HAEntity, systemTemperatureUnit: String? = nil) {
    self.entity = entity
    self.systemTemperatureUnit = systemTemperatureUnit
  }
  public func clamp(_ value: Double) -> Double {
    let snapped = ((value - minimum) / step).rounded() * step + minimum
    return (min(maximum, max(minimum, snapped)) * 10_000).rounded() / 10_000
  }
  var reportedAt: Date {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: entity.last_updated) ?? ISO8601DateFormatter().date(from: entity.last_updated) ?? .distantPast
  }
}

public enum HAClimateChange: Sendable {
  case power(Bool), temperature(Double), mode(String)
}

struct ClimateIntent {
  var power: Bool
  var mode: String
  var temperature: Double
  var fields: Set<String> = []
  var revision = 0

  func matches(_ snapshot: HAClimateSnapshot) -> Bool {
    snapshot.available && fields.allSatisfy {
      switch $0 {
      case "power": return snapshot.isOn == power
      case "mode": return snapshot.mode == mode
      case "temperature": return snapshot.targetTemperature.map { abs($0 - temperature) < 0.001 } ?? false
      default: return false
      }
    }
  }
}

struct ClimateService {
  let name: String
  let data: [String: HAValue]
}

func climateServices(from snapshot: HAClimateSnapshot, to intent: ClimateIntent) throws -> [ClimateService] {
  if !intent.power { return [ClimateService(name: "set_hvac_mode", data: ["hvac_mode": .string("off")])] }
  var services: [ClimateService] = []
  if intent.fields.contains("mode") || intent.fields.contains("power") {
    guard snapshot.modes.contains(intent.mode) else { throw HAError.unsupported }
    services.append(ClimateService(name: "set_hvac_mode", data: ["hvac_mode": .string(intent.mode)]))
  }
  if snapshot.supportsTemperature && (intent.fields.contains("temperature") || intent.fields.contains("power")) {
    services.append(ClimateService(name: "set_temperature", data: ["temperature": .number(snapshot.clamp(intent.temperature))]))
  }
  return services
}

public func haModeName(_ mode: String) -> String {
  ["off": "待机", "cool": "制冷", "heat": "制热", "dry": "除湿", "fan_only": "送风", "auto": "自动", "heat_cool": "自动冷暖", "unavailable": "设备不可用", "unknown": "状态未知"][mode] ?? mode
}
