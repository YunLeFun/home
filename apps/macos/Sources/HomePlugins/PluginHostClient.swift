import Foundation

/// Talks to the out-of-process `YunHomePluginHost`. A hung or crashed plugin
/// can never block or crash the app: every call has a deadline, the host is
/// killed when one is missed, and it restarts on the next call. A plugin that
/// keeps faulting is disabled until it is reinstalled.
public actor PluginHostClient {
  public static let maxFaults = 3

  private let executable: URL
  private let timeout: Duration
  private let loadTimeout: Duration
  private var process: Process?
  private var input: FileHandle?
  private var nextID = 1
  private var pending: [Int: (plugin: String, continuation: CheckedContinuation<PluginHostResponse, Error>)] = [:]
  private var sources: [String: String] = [:]
  private var loaded: Set<String> = []
  private var faults: [String: Int] = [:]

  public init(executable: URL, timeout: Duration = .milliseconds(250), loadTimeout: Duration = .seconds(2)) {
    self.executable = executable
    self.timeout = timeout
    self.loadTimeout = loadTimeout
    // A write to a host that just died must fail, not kill the app.
    signal(SIGPIPE, SIG_IGN)
  }

  /// `YunHomePluginHost` next to the running executable, as laid out by both
  /// `swift build` and the app bundle.
  public static func bundledExecutable() -> URL {
    let main = Bundle.main.executableURL ?? URL(fileURLWithPath: CommandLine.arguments[0])
    return main.deletingLastPathComponent().appendingPathComponent("YunHomePluginHost")
  }

  public func register(plugin: String, source: String) {
    if sources[plugin] != source { loaded.remove(plugin) }
    sources[plugin] = source
  }

  public func unregister(plugin: String) async {
    sources[plugin] = nil
    faults[plugin] = nil
    if loaded.remove(plugin) != nil, process?.isRunning == true {
      _ = try? await send(PluginHostRequest(id: 0, method: .unload, plugin: plugin), deadline: timeout)
    }
  }

  public func isDisabled(_ plugin: String) -> Bool { (faults[plugin] ?? 0) >= Self.maxFaults }

  public func create(plugin: String) async throws -> PluginStateResult {
    try await call(PluginHostRequest(id: 0, method: .create, plugin: plugin))
  }

  public func present(plugin: String, state: JSONValue) async throws -> PluginStateResult {
    try await call(PluginHostRequest(id: 0, method: .present, plugin: plugin, state: state))
  }

  public func dispatch(plugin: String, state: JSONValue, action: JSONValue, context: JSONValue? = nil) async throws -> PluginStateResult {
    try await call(PluginHostRequest(id: 0, method: .dispatch, plugin: plugin, state: state, action: action, context: context))
  }

  public func shutdown() {
    process?.terminate()
    reset(failing: PluginError.host("插件宿主已关闭"))
  }

  private func call(_ request: PluginHostRequest) async throws -> PluginStateResult {
    guard !isDisabled(request.plugin) else { throw PluginError.host("插件多次超时或出错，已停用；重新安装后可恢复") }
    guard let source = sources[request.plugin] else { throw PluginError.notLoaded(request.plugin) }
    if !loaded.contains(request.plugin) {
      let load = try await send(PluginHostRequest(id: 0, method: .load, plugin: request.plugin, source: source), deadline: loadTimeout)
      if let error = load.error { throw PluginError.host(error) }
      loaded.insert(request.plugin)
    }
    let response = try await send(request, deadline: timeout)
    if let error = response.error { throw PluginError.host(error) }
    guard let result = response.result else { throw PluginError.host("插件没有返回结果") }
    return result
  }

  private func send(_ request: PluginHostRequest, deadline: Duration) async throws -> PluginHostResponse {
    try startIfNeeded()
    var request = request
    request.id = nextID
    nextID += 1
    var line = try JSONEncoder().encode(request)
    line.append(0x0A)
    let id = request.id
    return try await withCheckedThrowingContinuation { continuation in
      pending[id] = (request.plugin, continuation)
      do { try input?.write(contentsOf: line) }
      catch {
        fail(id, with: PluginError.host("无法连接插件宿主"))
        return
      }
      Task { [weak self] in
        try? await Task.sleep(for: deadline)
        await self?.expire(id)
      }
    }
  }

  private func startIfNeeded() throws {
    if process?.isRunning == true { return }
    let process = Process()
    process.executableURL = executable
    let stdin = Pipe(), stdout = Pipe()
    process.standardInput = stdin
    process.standardOutput = stdout
    process.standardError = FileHandle.nullDevice
    process.terminationHandler = { [weak self] terminated in
      Task { await self?.hostExited(terminated) }
    }
    do { try process.run() }
    catch { throw PluginError.host("无法启动插件宿主") }
    self.process = process
    input = stdin.fileHandleForWriting
    loaded.removeAll()
    Self.readLines(from: stdout.fileHandleForReading) { [weak self] data in
      Task { await self?.receive(data) }
    }
  }

  // Lines are split on a dedicated thread so ordering within the stream is
  // preserved; responses are then matched by id.
  private nonisolated static func readLines(from handle: FileHandle, onLine: @escaping @Sendable (Data) -> Void) {
    let thread = Thread {
      var buffer = Data()
      while true {
        let chunk = handle.availableData
        if chunk.isEmpty { return }
        buffer.append(chunk)
        while let newline = buffer.firstIndex(of: 0x0A) {
          let line = buffer[buffer.startIndex..<newline]
          buffer.removeSubrange(buffer.startIndex...newline)
          if !line.isEmpty { onLine(Data(line)) }
        }
      }
    }
    thread.name = "fun.yunle.home.plugin-host.reader"
    thread.start()
  }

  private func receive(_ data: Data) {
    guard let response = try? JSONDecoder().decode(PluginHostResponse.self, from: data),
          let entry = pending.removeValue(forKey: response.id) else { return }
    entry.continuation.resume(returning: response)
  }

  private func expire(_ id: Int) {
    guard let entry = pending[id] else { return }
    faults[entry.plugin, default: 0] += 1
    // The host is single-threaded, so a missed deadline means it is stuck.
    process?.terminate()
    reset(failing: PluginError.timeout)
  }

  private func hostExited(_ terminated: Process) {
    guard terminated === process else { return }
    for entry in pending.values { faults[entry.plugin, default: 0] += 1 }
    reset(failing: PluginError.host("插件宿主意外退出"))
  }

  private func fail(_ id: Int, with error: Error) {
    pending.removeValue(forKey: id)?.continuation.resume(throwing: error)
  }

  private func reset(failing error: Error) {
    let waiting = pending
    pending.removeAll()
    process = nil
    input = nil
    loaded.removeAll()
    for entry in waiting.values { entry.continuation.resume(throwing: error) }
  }
}
