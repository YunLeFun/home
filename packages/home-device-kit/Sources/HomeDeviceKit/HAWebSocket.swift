import Foundation

@MainActor public protocol HAWebSocket: AnyObject {
  func send(_ text: String) async throws
  func receive() async throws -> String
  func close()
}

@MainActor public final class URLSessionHAWebSocket: NSObject, HAWebSocket, URLSessionTaskDelegate {
  private var session: URLSession!
  private var task: URLSessionWebSocketTask!
  public init(url: URL) {
    super.init()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil
    configuration.urlCredentialStorage = nil
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    task = session.webSocketTask(with: url)
    task.resume()
  }
  public func send(_ text: String) async throws { try await task.send(.string(text)) }
  public func receive() async throws -> String {
    switch try await task.receive() {
    case .string(let text): return text
    case .data(let data): return String(decoding: data, as: UTF8.self)
    @unknown default: throw HAError.protocolError
    }
  }
  public func close() {
    task.cancel(with: .goingAway, reason: nil)
    session.invalidateAndCancel()
  }
  public nonisolated func urlSession(_ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

/// Authenticates one HA endpoint and correlates request IDs. It never follows
/// HTTP redirects or sends an Authorization header to another origin.
@MainActor public final class HomeAssistantClient {
  public var onStateEvent: ((HAValue) -> Void)?
  public var onConfigurationChanged: (() -> Void)?
  public var onDisconnect: ((HAError) -> Void)?
  public private(set) var connected = false
  private let factory: (URL) -> any HAWebSocket
  private let timeout: Duration
  private var socket: (any HAWebSocket)?
  private var receiver: Task<Void, Never>?
  private var authTimer: Task<Void, Never>?
  private var heartbeat: Task<Void, Never>?
  private var authentication: CheckedContinuation<Void, Error>?
  private var pending: [Int: Pending] = [:]
  private var nextID = 0
  private var generation = 0
  private var token: String?
  private var authSent = false

  private struct Pending {
    let continuation: CheckedContinuation<HAValue, Error>
    let timeout: Task<Void, Never>
  }

  public init(timeout: Duration = .seconds(10), factory: ((URL) -> any HAWebSocket)? = nil) {
    self.timeout = timeout
    self.factory = factory ?? { URLSessionHAWebSocket(url: $0) }
  }

  public func connect(to endpoint: HAEndpoint, token: String) async throws {
    disconnect()
    guard !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw HAError.invalidToken }
    try Task.checkCancellation()
    let current = generation
    let socket = factory(endpoint.webSocketURL)
    self.socket = socket
    self.token = token
    authSent = false
    try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        authentication = continuation
        authTimer = Task { [weak self, timeout] in
          do { try await Task.sleep(for: timeout) } catch { return }
          guard let self, self.generation == current else { return }
          self.fail(.timeout)
        }
        receiver = Task { [weak self] in
          do {
            while !Task.isCancelled {
              let text = try await socket.receive()
              guard let self, self.generation == current else { return }
              let value = try JSONDecoder().decode(HAValue.self, from: Data(text.utf8))
              try await self.receive(value)
            }
          } catch {
            guard let self, self.generation == current else { return }
            self.fail(error as? HAError ?? .disconnected)
          }
        }
      }
    } onCancel: {
      Task { @MainActor [weak self] in
        guard let self, self.generation == current else { return }
        self.disconnect()
      }
    }
    guard generation == current, connected else { throw HAError.disconnected }
    heartbeat = Task { [weak self] in
      while !Task.isCancelled {
        do { try await Task.sleep(for: .seconds(30)) } catch { return }
        guard let self, self.generation == current else { return }
        do { _ = try await self.request("ping") }
        catch { if self.generation == current { self.fail(.disconnected) }; return }
      }
    }
  }

  public func request(_ type: String, fields: [String: HAValue] = [:]) async throws -> HAValue {
    guard connected, let socket else { throw HAError.disconnected }
    try Task.checkCancellation()
    nextID += 1
    let id = nextID
    let current = generation
    var message = fields
    message["type"] = .string(type)
    message["id"] = .number(Double(id))
    let text = try HAValue.object(message).text()
    return try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        let timer = Task { [weak self, timeout] in
          do { try await Task.sleep(for: timeout) } catch { return }
          self?.finish(id, with: .failure(HAError.timeout))
        }
        pending[id] = Pending(continuation: continuation, timeout: timer)
        Task { [weak self] in
          guard let self, self.generation == current, self.pending[id] != nil else { return }
          do { try await socket.send(text) }
          catch { if self.generation == current { self.fail(.disconnected) } }
        }
      }
    } onCancel: {
      Task { @MainActor [weak self] in self?.finish(id, with: .failure(CancellationError())) }
    }
  }

  public func disconnect() {
    terminate(.disconnected)
  }
  private func terminate(_ reason: HAError) {
    generation += 1
    connected = false
    receiver?.cancel(); receiver = nil
    authTimer?.cancel(); authTimer = nil
    heartbeat?.cancel(); heartbeat = nil
    socket?.close(); socket = nil
    token = nil
    let waiter = authentication
    authentication = nil
    waiter?.resume(throwing: reason)
    for id in Array(pending.keys) { finish(id, with: .failure(reason)) }
  }

  private func receive(_ value: HAValue) async throws {
    switch value["type"].string {
    case "auth_required":
      guard !authSent, let token, let socket else { throw HAError.protocolError }
      authSent = true
      try await socket.send(HAValue.object(["type": .string("auth"), "access_token": .string(token)]).text())
      self.token = nil
    case "auth_ok":
      guard authSent, authentication != nil else { throw HAError.protocolError }
      connected = true
      authTimer?.cancel(); authTimer = nil
      let waiter = authentication
      authentication = nil
      waiter?.resume()
    case "auth_invalid": throw HAError.invalidToken
    case "result", "pong":
      guard connected, let valueID = value["id"].number, valueID > 0, valueID < Double(Int.max) else { throw HAError.protocolError }
      let id = Int(valueID)
      if value["type"].string == "pong" || value["success"].bool == true { finish(id, with: .success(value["result"])) }
      else { finish(id, with: .failure(value["error"]["code"].string == "unauthorized" ? HAError.invalidToken : HAError.serviceFailed)) }
    case "event":
      guard connected else { throw HAError.protocolError }
      if value["event"]["event_type"].string == "state_changed" { onStateEvent?(value["event"]["data"]) }
      if value["event"]["event_type"].string == "core_config_updated" { onConfigurationChanged?() }
    default: throw HAError.protocolError
    }
  }

  private func finish(_ id: Int, with result: Result<HAValue, Error>) {
    guard let request = pending.removeValue(forKey: id) else { return }
    request.timeout.cancel()
    request.continuation.resume(with: result)
  }
  private func fail(_ error: HAError) {
    terminate(error)
    onDisconnect?(error)
  }
}
