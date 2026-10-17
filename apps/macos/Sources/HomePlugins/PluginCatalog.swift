import Foundation

/// A plugin listed in the market.
public struct PluginCatalogEntry: Codable, Equatable, Sendable, Identifiable {
  public var id: String
  public var name: String
  public var description: String
  public var author: String
  public var category: String
  /// SF Symbol shown when the plugin has no `appIcon`
  public var symbol: String
  public var tint: String?
  /// The plugin's own app icon, shared with the web
  public var appIcon: PluginIcon?
  /// Tone the icon previews in the market (`cool`, `heat`, `warm`, `active`)
  public var previewTone: String?
  public var version: String
  public var permissions: [String]
  public var renderer: String?
  /// Package file bundled with the app
  public var package: String
  public var sha256: String
  /// Reviewed by YunLe before listing
  public var verified: Bool
  public var homepage: String?

  public init(id: String, name: String, description: String, author: String, category: String, symbol: String,
              tint: String? = nil, appIcon: PluginIcon? = nil, previewTone: String? = nil, version: String,
              permissions: [String] = [], renderer: String? = nil,
              package: String, sha256: String, verified: Bool, homepage: String? = nil) {
    self.id = id; self.name = name; self.description = description; self.author = author
    self.category = category; self.symbol = symbol; self.tint = tint; self.appIcon = appIcon
    self.previewTone = previewTone; self.version = version
    self.permissions = permissions; self.renderer = renderer; self.package = package
    self.sha256 = sha256; self.verified = verified; self.homepage = homepage
  }
}

public struct PluginCatalog: Codable, Equatable, Sendable {
  public var version: Int
  public var plugins: [PluginCatalogEntry]

  public static func load(from url: URL) throws -> PluginCatalog {
    try JSONDecoder().decode(PluginCatalog.self, from: Data(contentsOf: url))
  }
}
