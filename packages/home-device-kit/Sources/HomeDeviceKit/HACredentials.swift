import Foundation
import Security

@MainActor public protocol HACredentialStore {
  func load(for endpoint: HAEndpoint) throws -> String?
  func save(_ token: String, for endpoint: HAEndpoint) throws
  func remove(for endpoint: HAEndpoint) throws
}

@MainActor public final class HAKeychainCredentials: HACredentialStore {
  private let service: String
  public init(service: String = "fun.yunle.home.home-assistant") { self.service = service }
  private func query(_ endpoint: HAEndpoint) -> [String: Any] {
    [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
     kSecAttrAccount as String: endpoint.baseURL.absoluteString]
  }
  public func load(for endpoint: HAEndpoint) throws -> String? {
    var query = query(endpoint)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = result as? Data, let token = String(data: data, encoding: .utf8) else { throw HAError.credentialStore }
    return token
  }
  public func save(_ token: String, for endpoint: HAEndpoint) throws {
    let attributes = [kSecValueData as String: Data(token.utf8)]
    let status = SecItemUpdate(query(endpoint) as CFDictionary, attributes as CFDictionary)
    if status == errSecSuccess { return }
    guard status == errSecItemNotFound else { throw HAError.credentialStore }
    var item = query(endpoint).merging(attributes) { _, new in new }
    item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw HAError.credentialStore }
  }
  public func remove(for endpoint: HAEndpoint) throws {
    let status = SecItemDelete(query(endpoint) as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else { throw HAError.credentialStore }
  }
}
