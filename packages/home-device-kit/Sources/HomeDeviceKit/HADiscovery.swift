import Foundation
import Observation

public struct HADiscoveredServer: Identifiable, Equatable {
  public let id: String
  public let name: String
  public let endpoint: HAEndpoint
}

/// User-triggered, bounded discovery: Bonjour plus this machine's standard
/// loopback port. It never probes subnets or sends credentials.
// Browsing starts on the main run loop. Foundation's delegate protocols
// predate concurrency annotations.
@MainActor @Observable public final class HADiscovery: NSObject, @preconcurrency NetServiceBrowserDelegate, @preconcurrency NetServiceDelegate {
  public private(set) var servers: [HADiscoveredServer] = []
  public private(set) var searching = false
  public private(set) var error: String?
  @ObservationIgnored private let browser = NetServiceBrowser()
  @ObservationIgnored private var resolving: [NetService] = []
  @ObservationIgnored private var timeout: Task<Void, Never>?
  @ObservationIgnored private var localProbe: Task<Void, Never>?
  @ObservationIgnored private var generation = 0

  public override init() { super.init(); browser.delegate = self }

  public func start() {
    stop()
    servers = []
    error = nil
    searching = true
    let current = generation
    localProbe = Task { [weak self] in
      guard let endpoint = try? HAEndpoint("http://127.0.0.1:8123"),
            await probeHomeAssistant(endpoint: endpoint),
            let self, self.searching, self.generation == current else { return }
      self.add(HADiscoveredServer(id: "loopback", name: "这台 Mac 上的 Home Assistant", endpoint: endpoint))
    }
    browser.searchForServices(ofType: "_home-assistant._tcp.", inDomain: "local.")
    timeout = Task { [weak self] in
      do { try await Task.sleep(for: .seconds(8)) } catch { return }
      self?.stop()
    }
  }
  public func stop() {
    generation += 1
    timeout?.cancel(); timeout = nil
    localProbe?.cancel(); localProbe = nil
    browser.stop()
    resolving.forEach { $0.stop() }
    resolving.removeAll()
    searching = false
  }
  public func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
    guard searching else { return }
    service.delegate = self
    resolving.append(service)
    service.resolve(withTimeout: 5)
  }
  public func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) {
    servers.removeAll { $0.id == service.name + "." + service.domain }
  }
  public func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) {
    error = "无法查找局域网服务，请检查本地网络权限，或手动填写地址。"
    // A denied Bonjour permission must not cancel the independent loopback probe.
    browser.stop()
  }
  public func netServiceDidResolveAddress(_ service: NetService) {
    guard searching, let host = service.hostName else { return }
    let records = service.txtRecordData().map(NetService.dictionary(fromTXTRecord:)) ?? [:]
    guard let endpoint = discoveryEndpoint(host: host, port: service.port, records: records) else { return }
    let id = service.name + "." + service.domain
    add(HADiscoveredServer(id: id, name: service.name, endpoint: endpoint))
  }
  private func add(_ server: HADiscoveredServer) {
    guard !servers.contains(where: { $0.endpoint == server.endpoint }) else { return }
    servers.removeAll { $0.id == server.id }
    servers.append(server)
  }
}

/// Read only the unauthenticated HA handshake. An arbitrary HTTP service on
/// port 8123 is not sufficient. The socket is closed on timeout/cancellation.
@MainActor func probeHomeAssistant(endpoint: HAEndpoint, timeout: Duration = .seconds(3),
                                  factory: ((URL) -> any HAWebSocket)? = nil) async -> Bool {
  guard !Task.isCancelled else { return false }
  let socket = factory?(endpoint.webSocketURL) ?? URLSessionHAWebSocket(url: endpoint.webSocketURL)
  let timer = Task {
    do { try await Task.sleep(for: timeout) } catch { return }
    socket.close()
  }
  defer { timer.cancel(); socket.close() }
  return await withTaskCancellationHandler {
    do {
      let text = try await socket.receive()
      try Task.checkCancellation()
      let value = try JSONDecoder().decode(HAValue.self, from: Data(text.utf8))
      return value["type"].string == "auth_required" && !(value["ha_version"].string ?? "").isEmpty
    } catch { return false }
  } onCancel: {
    Task { @MainActor in socket.close() }
  }
}

func discoveryEndpoint(host: String, port: Int, records: [String: Data]) -> HAEndpoint? {
  let advertisedURL = records["internal_url"].flatMap { String(data: $0, encoding: .utf8) }
  let secure = records["ssl"].flatMap { String(data: $0, encoding: .utf8) }?.lowercased() == "true"
  var components = URLComponents()
  components.scheme = secure ? "https" : "http"
  components.host = host.hasSuffix(".") ? String(host.dropLast()) : host
  components.port = port
  return advertisedURL.flatMap { try? HAEndpoint($0) } ?? components.string.flatMap { try? HAEndpoint($0) }
}
