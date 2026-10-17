import Foundation

/// Declarative controls (`controls.json`). The host renders them with native
/// components; plugins never ship UI code.
public struct PluginControls: Codable, Equatable, Sendable {
  public static let supportedSchema = 1
  public var schema: Int
  public var controls: [PluginControl]

  public func validate() throws {
    guard schema == Self.supportedSchema else { throw PluginError.invalidControls("不支持 schema \(schema)") }
    guard !controls.isEmpty, controls.count <= 24 else { throw PluginError.invalidControls("控件数量需在 1–24 个之间") }
    for control in controls { try control.validate() }
  }

  /// The control that powers the device on or off, used by "all off".
  public var power: PluginControl? { controls.first { $0.type == .power } }
}

public struct PluginControlOption: Codable, Equatable, Sendable, Identifiable {
  public var value: JSONValue
  public var label: String
  public var symbol: String?
  public var action: JSONValue
  public var id: String { (try? value.jsonString()) ?? label }
}

public struct PluginControl: Codable, Equatable, Sendable, Identifiable {
  public enum Kind: String, Codable, Sendable {
    /// Toggle bound to a boolean field
    case power
    /// Large circular gauge with step buttons for a numeric field
    case dial
    /// Compact numeric stepper
    case stepper
    /// One of several values, each with its own action
    case segmented
    /// Continuous number; `action` may contain `"$value"`
    case slider
  }

  public var type: Kind
  public var bind: String
  public var label: String
  public var unit: String?
  public var min: Double?
  public var max: Double?
  public var step: Double?
  public var action: JSONValue?
  public var increment: JSONValue?
  public var decrement: JSONValue?
  public var options: [PluginControlOption]?
  public var id: String { "\(type.rawValue):\(bind)" }

  func validate() throws {
    func fail(_ reason: String) -> PluginError { .invalidControls("\(label.isEmpty ? bind : label) \(reason)") }
    guard bind.range(of: #"^[A-Za-z_][A-Za-z0-9_]*$"#, options: .regularExpression) != nil else { throw fail("绑定字段无效") }
    guard label.count <= 24 else { throw fail("标题过长") }
    switch type {
    case .power:
      guard action != nil else { throw fail("缺少 action") }
    case .dial, .stepper:
      guard let min, let max, let step, min < max, step > 0 else { throw fail("需要有效的 min、max、step") }
      guard increment != nil, decrement != nil else { throw fail("缺少 increment 或 decrement") }
    case .slider:
      guard let min, let max, min < max else { throw fail("需要有效的 min、max") }
      guard action != nil else { throw fail("缺少 action") }
    case .segmented:
      guard let options, (2...6).contains(options.count) else { throw fail("需要 2–6 个选项") }
    }
  }
}
