// YunHomePluginHost runs third-party plugin state scripts out of the app's
// process. Each plugin gets its own JavaScriptCore virtual machine with no
// timers, network, file or module APIs. The app talks to it over
// line-delimited JSON on stdin/stdout and kills it if a call hangs.
import Foundation
import HomePlugins
import JavaScriptCore

let maxResultBytes = 64 * 1024

struct SandboxError: Error { let message: String }

final class Sandbox {
  private let context: JSContext
  private var exception: String?

  init(source: String) throws {
    guard let context = JSContext(virtualMachine: JSVirtualMachine()) else { throw SandboxError(message: "无法创建 JavaScript 环境") }
    self.context = context
    context.exceptionHandler = { [weak self] _, value in self?.exception = value?.toString() ?? "未知错误" }
    // Capture JSON before plugin code runs and expose a frozen call bridge, so
    // values only ever leave the sandbox as JSON text.
    context.evaluateScript("""
      (() => {
        const parse = JSON.parse, stringify = JSON.stringify;
        Object.defineProperty(globalThis, '__yunhome', {
          value: Object.freeze({
            call(name, argsJSON) {
              const plugin = globalThis.plugin;
              if (!plugin || typeof plugin[name] !== 'function') throw new Error('plugin.' + name + ' is not a function');
              return stringify(plugin[name](...parse(argsJSON)));
            },
          }),
        });
        delete globalThis.WebAssembly;
        delete globalThis.console;
      })();
      """)
    try check()
    context.evaluateScript(source)
    try check()
    for name in ["create", "normalize", "isAction", "reduce", "present"] {
      let value = context.evaluateScript("typeof globalThis.plugin?.\(name)")?.toString()
      guard value == "function" else { throw SandboxError(message: "缺少 plugin.\(name)") }
    }
  }

  func call(_ name: String, _ arguments: [JSONValue]) throws -> JSONValue {
    let argumentsJSON = try JSONValue.array(arguments).jsonString()
    let bridge = context.objectForKeyedSubscript("__yunhome")
    let result = bridge?.invokeMethod("call", withArguments: [name, argumentsJSON])
    try check()
    guard let result, result.isString, let text = result.toString() else { throw SandboxError(message: "plugin.\(name) 没有返回 JSON 值") }
    guard text.utf8.count <= maxResultBytes else { throw SandboxError(message: "plugin.\(name) 返回的数据过大") }
    return try JSONValue.parse(text)
  }

  private func check() throws {
    if let exception {
      self.exception = nil
      throw SandboxError(message: exception)
    }
  }
}

var sandboxes: [String: Sandbox] = [:]

func presentation(from value: JSONValue) throws -> PluginPresentation {
  guard let active = value["active"]?.boolValue, let tone = value["tone"]?.stringValue,
        let summary = value["summary"]?.stringValue else {
    throw SandboxError(message: "plugin.present 需要返回 { active, tone, summary }")
  }
  return PluginPresentation(active: active, tone: tone, summary: String(summary.prefix(80)))
}

/// `context` carries host data such as device limits and, for official plugins
/// granted `sensor:thermal`, the room reading.
func result(_ sandbox: Sandbox, state: JSONValue, context: JSONValue?) throws -> PluginStateResult {
  PluginStateResult(state: state, presentation: try presentation(from: sandbox.call("present", [state, context ?? .object([:])])))
}

func handle(_ request: PluginHostRequest) throws -> PluginStateResult? {
  if request.method == .load {
    sandboxes[request.plugin] = try Sandbox(source: request.source ?? "")
    return nil
  }
  if request.method == .unload {
    sandboxes[request.plugin] = nil
    return nil
  }
  guard let sandbox = sandboxes[request.plugin] else { throw SandboxError(message: "插件未加载") }
  switch request.method {
  case .create:
    return try result(sandbox, state: sandbox.call("create", []), context: request.context)
  case .present:
    return try result(sandbox, state: sandbox.call("normalize", [request.state ?? .null]), context: request.context)
  case .dispatch:
    let action = request.action ?? .null
    guard try sandbox.call("isAction", [action]).boolValue == true else { throw SandboxError(message: "插件不支持这个操作") }
    let reduced = try sandbox.call("reduce", [request.state ?? .null, action, request.context ?? .object([:])])
    return try result(sandbox, state: sandbox.call("normalize", [reduced]), context: request.context)
  case .load, .unload:
    return nil
  }
}

let encoder = JSONEncoder()
let decoder = JSONDecoder()
while let line = readLine(strippingNewline: true) {
  guard !line.isEmpty else { continue }
  let response: PluginHostResponse
  do {
    let request = try decoder.decode(PluginHostRequest.self, from: Data(line.utf8))
    do { response = PluginHostResponse(id: request.id, result: try handle(request)) }
    catch let error as SandboxError { response = PluginHostResponse(id: request.id, error: error.message) }
    catch { response = PluginHostResponse(id: request.id, error: String(describing: error)) }
  } catch {
    continue
  }
  if var data = try? encoder.encode(response) {
    data.append(0x0A)
    FileHandle.standardOutput.write(data)
  }
}
