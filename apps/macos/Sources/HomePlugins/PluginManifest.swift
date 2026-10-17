import Foundation

/// SDK version of the sandbox plugin contract this host implements.
public let supportedPluginSDK = 1

public enum PluginError: LocalizedError, Equatable {
  case invalidManifest(String)
  case invalidControls(String)
  case invalidPackage(String)
  case integrityMismatch
  case host(String)
  case timeout
  case notLoaded(String)

  public var errorDescription: String? {
    switch self {
    case .invalidManifest(let reason): "插件清单无效：\(reason)"
    case .invalidControls(let reason): "插件控件描述无效：\(reason)"
    case .invalidPackage(let reason): "插件包无效：\(reason)"
    case .integrityMismatch: "插件包与市场记录的校验值不一致，已拒绝安装。"
    case .host(let reason): "插件运行出错：\(reason)"
    case .timeout: "插件响应超时，已被停止。"
    case .notLoaded(let id): "插件 \(id) 未加载。"
    }
  }
}

/// Capabilities a plugin may request. Unknown permissions are rejected so a
/// newer plugin cannot silently gain access on an older host.
public enum PluginPermission {
  public static let known: Set<String> = ["storage", "notify", "sensor:compute-pressure", "home-assistant:climate"]

  public static func isKnown(_ permission: String) -> Bool {
    if known.contains(permission) { return true }
    guard permission.hasPrefix("network:"), let url = URL(string: String(permission.dropFirst(8))) else { return false }
    return url.scheme == "https" && url.host != nil && url.path.isEmpty
  }

  /// Plain-language explanation shown before installation.
  public static func describe(_ permission: String) -> String {
    switch permission {
    case "storage": "保存本设备的状态（不超过 16 KB），随家园存档保存"
    case "notify": "在家园内显示提示"
    case "sensor:compute-pressure": "读取电脑的 CPU 负载等级"
    case "home-assistant:climate": "通过家园代为控制你为它绑定的 Home Assistant 空调实体，无法读取令牌"
    default: permission.hasPrefix("network:") ? "访问 \(permission.dropFirst(8))" : permission
    }
  }
}

/// Host-provided renderers a plugin may ask for, keyed by name.
public enum PluginRenderer {
  public static let known: Set<String> = ["cute-ac-3d"]
}

/// `manifest.json` of a `.yunplugin` package. Shared with the web plugin market.
public struct PluginManifest: Codable, Equatable, Sendable {
  public struct Author: Codable, Equatable, Sendable {
    public var name: String
    public var url: String?
  }
  public struct Entry: Codable, Equatable, Sendable {
    public var state: String
    public var controls: String
  }

  public var id: String
  public var version: String
  public var sdk: Int
  public var runtime: String
  public var name: String
  public var description: String
  public var author: Author
  public var category: String
  /// SF Symbol shown when the plugin has no `appIcon`
  public var symbol: String
  public var tint: String?
  /// The plugin's own app icon, shared with the web
  public var appIcon: PluginIcon?
  public var permissions: [String]
  public var renderer: String?
  public var entry: Entry

  public func validate() throws {
    func fail(_ reason: String) -> PluginError { .invalidManifest(reason) }
    let idPattern = #"^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*){2,}$"#
    guard id.count <= 128, id.range(of: idPattern, options: .regularExpression) != nil else { throw fail("id 需为反向域名，例如 com.example.device") }
    guard version.range(of: #"^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$"#, options: .regularExpression) != nil else { throw fail("版本号需符合 semver") }
    guard sdk == supportedPluginSDK else { throw fail("需要 SDK \(sdk)，此版本仅支持 SDK \(supportedPluginSDK)") }
    guard runtime == "sandbox" else { throw fail("原生端只支持 sandbox 运行时") }
    guard !name.isEmpty, name.count <= 40 else { throw fail("名称长度需在 1–40 字之间") }
    guard description.count <= 280 else { throw fail("简介过长") }
    guard !symbol.isEmpty, symbol.count <= 80 else { throw fail("缺少图标") }
    if let tint, tint.range(of: #"^#[0-9A-Fa-f]{6}$"#, options: .regularExpression) == nil { throw fail("颜色需为 #RRGGBB") }
    for permission in permissions where !PluginPermission.isKnown(permission) { throw fail("不支持的权限 \(permission)") }
    if let renderer, !PluginRenderer.known.contains(renderer) { throw fail("不支持的渲染器 \(renderer)") }
    for file in [entry.state, entry.controls] where file.contains("/") || file.hasPrefix(".") { throw fail("入口文件需位于包根目录") }
  }
}
