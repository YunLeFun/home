import Foundation

public enum HAValue: Codable, Equatable, Sendable {
  case object([String: HAValue]), array([HAValue]), string(String), number(Double), bool(Bool), null

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if container.decodeNil() { self = .null }
    else if let value = try? container.decode(Bool.self) { self = .bool(value) }
    else if let value = try? container.decode(Double.self) { self = .number(value) }
    else if let value = try? container.decode(String.self) { self = .string(value) }
    else if let value = try? container.decode([String: HAValue].self) { self = .object(value) }
    else { self = .array(try container.decode([HAValue].self)) }
  }
  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .object(let value): try container.encode(value)
    case .array(let value): try container.encode(value)
    case .string(let value): try container.encode(value)
    case .number(let value): try container.encode(value)
    case .bool(let value): try container.encode(value)
    case .null: try container.encodeNil()
    }
  }
  public subscript(_ key: String) -> HAValue { if case .object(let value) = self { return value[key] ?? .null }; return .null }
  public var string: String? { if case .string(let value) = self { return value }; return nil }
  public var number: Double? { if case .number(let value) = self { return value }; return nil }
  public var bool: Bool? { if case .bool(let value) = self { return value }; return nil }
  public var array: [HAValue] { if case .array(let value) = self { return value }; return [] }
  func decode<T: Decodable>(_ type: T.Type) throws -> T { try JSONDecoder().decode(type, from: JSONEncoder().encode(self)) }
  func text() throws -> String { String(decoding: try JSONEncoder().encode(self), as: UTF8.self) }
}

public enum HAError: Error, LocalizedError, Equatable {
  case invalidEndpoint, insecureEndpoint, invalidToken, disconnected, timeout, protocolError, serviceFailed
  case unavailable, unsupported, entityMissing, unconfirmed, credentialStore
  public var errorDescription: String? {
    switch self {
    case .invalidEndpoint: "请输入不带路径、凭据或参数的 HTTP(S) Home Assistant 地址。"
    case .insecureEndpoint: "公网地址请使用 HTTPS；HTTP 仅支持本机和局域网地址。"
    case .invalidToken: "Home Assistant 令牌无效或已撤销，请重新输入。"
    case .disconnected: "无法连接 Home Assistant，请检查地址、网络和证书。"
    case .timeout: "Home Assistant 响应超时，请检查连接后重试。"
    case .protocolError: "Home Assistant 返回了无法识别的数据。"
    case .serviceFailed: "Home Assistant 未接受操作，请检查实体权限和设备支持情况。"
    case .unavailable: "设备当前不可用，恢复连接后才能操作。"
    case .unsupported: "此实体暂不支持当前操作。"
    case .entityMissing: "未找到绑定的空调实体，请检查设备或重新绑定。"
    case .unconfirmed: "设备未确认操作，已重新读取 Home Assistant 状态。"
    case .credentialStore: "无法访问钥匙串，令牌未能保存或读取。"
    }
  }
}
