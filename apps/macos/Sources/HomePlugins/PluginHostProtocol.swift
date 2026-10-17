import Foundation

/// Line-delimited JSON-RPC between the app and `YunHomePluginHost`.
public struct PluginHostRequest: Codable, Sendable {
  public enum Method: String, Codable, Sendable {
    /// Evaluate a plugin's state script in a fresh context
    case load
    case unload
    /// `create()` then `present()`
    case create
    /// `normalize(state)` then `present()`
    case present
    /// `isAction(action)`, `reduce(state, action, context)`, then `present()`
    case dispatch
  }

  public var id: Int
  public var method: Method
  public var plugin: String
  public var source: String?
  public var state: JSONValue?
  public var action: JSONValue?
  public var context: JSONValue?

  public init(id: Int, method: Method, plugin: String, source: String? = nil,
              state: JSONValue? = nil, action: JSONValue? = nil, context: JSONValue? = nil) {
    self.id = id; self.method = method; self.plugin = plugin
    self.source = source; self.state = state; self.action = action; self.context = context
  }
}

/// How a device looks in lists and the scene, as reported by its plugin.
public struct PluginPresentation: Codable, Equatable, Sendable {
  public var active: Bool
  public var tone: String
  public var summary: String

  public init(active: Bool, tone: String, summary: String) {
    self.active = active; self.tone = tone; self.summary = summary
  }

  public static let unknown = PluginPresentation(active: false, tone: "idle", summary: "正在加载…")
}

/// State plus presentation, returned by every state-changing call so the app
/// needs a single round trip per user action.
public struct PluginStateResult: Codable, Equatable, Sendable {
  public var state: JSONValue
  public var presentation: PluginPresentation

  public init(state: JSONValue, presentation: PluginPresentation) {
    self.state = state; self.presentation = presentation
  }
}

public struct PluginHostResponse: Codable, Sendable {
  public var id: Int
  public var result: PluginStateResult?
  public var error: String?

  public init(id: Int, result: PluginStateResult? = nil, error: String? = nil) {
    self.id = id; self.result = result; self.error = error
  }
}
