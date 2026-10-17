import Foundation

/// An arbitrary JSON value. Plugin state, actions and controls bindings travel
/// between the app and the sandboxed plugin host in this form.
public enum JSONValue: Codable, Hashable, Sendable {
  case null
  case bool(Bool)
  case number(Double)
  case string(String)
  case array([JSONValue])
  case object([String: JSONValue])

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if container.decodeNil() { self = .null }
    else if let value = try? container.decode(Bool.self) { self = .bool(value) }
    else if let value = try? container.decode(Double.self) { self = .number(value) }
    else if let value = try? container.decode(String.self) { self = .string(value) }
    else if let value = try? container.decode([JSONValue].self) { self = .array(value) }
    else { self = .object(try container.decode([String: JSONValue].self)) }
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .null: try container.encodeNil()
    case .bool(let value): try container.encode(value)
    case .number(let value): try container.encode(value)
    case .string(let value): try container.encode(value)
    case .array(let value): try container.encode(value)
    case .object(let value): try container.encode(value)
    }
  }

  public subscript(key: String) -> JSONValue? {
    if case .object(let object) = self { return object[key] }
    return nil
  }

  public var boolValue: Bool? { if case .bool(let value) = self { value } else { nil } }
  public var numberValue: Double? { if case .number(let value) = self { value } else { nil } }
  public var stringValue: String? { if case .string(let value) = self { value } else { nil } }

  /// Replace every `"$value"` string with `value`, for slider-style action templates.
  public func substituting(_ value: JSONValue) -> JSONValue {
    switch self {
    case .string("$value"): value
    case .array(let items): .array(items.map { $0.substituting(value) })
    case .object(let object): .object(object.mapValues { $0.substituting(value) })
    default: self
    }
  }

  /// Compact JSON text with sorted keys, stable across runs.
  public func jsonString() throws -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    return String(decoding: try encoder.encode(self), as: UTF8.self)
  }

  public static func parse(_ text: String) throws -> JSONValue {
    try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
  }
}
