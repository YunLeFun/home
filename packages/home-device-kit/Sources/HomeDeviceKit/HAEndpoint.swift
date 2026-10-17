import Foundation

public struct HAEndpoint: Codable, Hashable, Sendable {
  public let baseURL: URL
  public init(_ value: String) throws {
    guard var parts = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
          let scheme = parts.scheme?.lowercased(), ["http", "https"].contains(scheme),
          let host = parts.host?.lowercased(), !host.isEmpty,
          parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
          parts.path.allSatisfy({ $0 == "/" }),
          parts.port == nil || (1...65535).contains(parts.port!) else { throw HAError.invalidEndpoint }
    if scheme == "http" && !Self.isLocalHost(host) { throw HAError.insecureEndpoint }
    parts.scheme = scheme
    parts.host = host
    parts.path = ""
    if (scheme == "https" && parts.port == 443) || (scheme == "http" && parts.port == 80) { parts.port = nil }
    guard let url = parts.url else { throw HAError.invalidEndpoint }
    baseURL = url
  }
  public init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer().decode(String.self)
    try self.init(value)
  }
  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(baseURL.absoluteString)
  }
  public var webSocketURL: URL {
    var parts = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
    parts.scheme = parts.scheme == "https" ? "wss" : "ws"
    parts.path = "/api/websocket"
    return parts.url!
  }
  public static func isLocalHost(_ host: String) -> Bool {
    let host = host.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
    if host == "localhost" || host == "::1" || host.hasSuffix(".local") || host.hasSuffix(".local.") || host.hasSuffix(".home.arpa") { return true }
    let labels = host.split(separator: ".")
    let parts = labels.compactMap { Int($0) }
    if labels.count == 4 && parts.count == 4 && parts.allSatisfy({ (0...255).contains($0) })
      && zip(labels, parts).allSatisfy({ String($0.1) == $0.0 }) {
      return parts[0] == 10 || parts[0] == 127 || (parts[0] == 192 && parts[1] == 168)
        || (parts[0] == 172 && (16...31).contains(parts[1])) || (parts[0] == 169 && parts[1] == 254)
    }
    return host.contains(":") && (host.hasPrefix("fc") || host.hasPrefix("fd") || host.hasPrefix("fe80:"))
  }
}

public struct HABinding: Codable, Equatable, Sendable {
  public let endpoint: HAEndpoint
  public let entityID: String
  public init(endpoint: HAEndpoint, entityID: String) throws {
    guard entityID.range(of: #"^climate\.[a-z0-9_]+$"#, options: .regularExpression) != nil else { throw HAError.entityMissing }
    self.endpoint = endpoint
    self.entityID = entityID
  }
  public init(from decoder: Decoder) throws {
    let values = try decoder.container(keyedBy: CodingKeys.self)
    try self.init(endpoint: values.decode(HAEndpoint.self, forKey: .endpoint), entityID: values.decode(String.self, forKey: .entityID))
  }
}
