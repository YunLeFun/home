import Foundation
import Testing
@testable import HomeDeviceKit

private final class LoopbackFixture {
  let process = Process()
  let port: Int
  init() throws {
    let script = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("fixtures/ha_server.py")
    let output = Pipe()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
    process.arguments = [script.path]
    process.standardOutput = output
    process.standardError = Pipe()
    try process.run()
    var line = Data()
    while let byte = try output.fileHandleForReading.read(upToCount: 1), !byte.isEmpty {
      if byte == Data([10]) { break }
      line.append(byte)
    }
    guard let port = Int(String(decoding: line, as: UTF8.self)) else {
      process.terminate()
      throw HAError.disconnected
    }
    self.port = port
  }
  deinit { if process.isRunning { process.terminate(); process.waitUntilExit() } }
}

@MainActor @Test func realURLSessionAuthenticatesSubscribesAndConfirmsCommands() async throws {
  let fixture = try LoopbackFixture()
  let controller = HomeAssistantClimate(client: HomeAssistantClient(timeout: .seconds(2)), credentials: MemoryCredentials(), confirmationTimeout: .seconds(1))
  defer { controller.disconnect(); withExtendedLifetime(fixture) {} }
  try await controller.connect(to: HAEndpoint("http://127.0.0.1:\(fixture.port)"), token: "home-test-token")
  #expect(controller.entities.first?.id == "climate.fixture_ac")
  _ = try controller.bind(entityID: "climate.fixture_ac")
  controller.request(.mode("heat"))
  controller.request(.temperature(29.5))
  controller.request(.power(true))
  #expect(await waitUntil { !controller.pending })
  #expect(controller.error == nil)
  #expect(controller.snapshot?.mode == "heat" && controller.snapshot?.targetTemperature == 29.5)
}

@MainActor @Test func realURLSessionRejectsInvalidToken() async throws {
  let fixture = try LoopbackFixture()
  let client = HomeAssistantClient(timeout: .seconds(2))
  defer { client.disconnect(); withExtendedLifetime(fixture) {} }
  await #expect(throws: HAError.invalidToken) {
    try await client.connect(to: HAEndpoint("http://127.0.0.1:\(fixture.port)"), token: "invalid-fixture-token")
  }
}

@MainActor @Test func discoveryRecognizesRealHandshakeWithoutAuthentication() async throws {
  let fixture = try LoopbackFixture()
  defer { withExtendedLifetime(fixture) {} }
  let endpoint = try HAEndpoint("http://127.0.0.1:\(fixture.port)")
  #expect(await probeHomeAssistant(endpoint: endpoint))
}

@MainActor @Test func discoveryTimesOutAndRejectsUnrelatedResponses() async throws {
  let server = MockHAServer()
  server.silent = true
  let endpoint = try HAEndpoint("http://localhost:8123")
  let socket = server.socket(endpoint.webSocketURL) as! MockSocket
  socket.push(.object(["type": .string("hello"), "ha_version": .string("unrelated")]))
  #expect(await !probeHomeAssistant(endpoint: endpoint, factory: { _ in socket }))
  #expect(socket.closed)

  let silent = server.socket(endpoint.webSocketURL) as! MockSocket
  #expect(await !probeHomeAssistant(endpoint: endpoint, timeout: .milliseconds(20), factory: { _ in silent }))
  #expect(silent.closed)
}

@MainActor @Test func cancellingDiscoveryClosesSocket() async throws {
  let server = MockHAServer()
  server.silent = true
  let endpoint = try HAEndpoint("http://localhost:8123")
  let socket = server.socket(endpoint.webSocketURL) as! MockSocket
  let probe = Task { await probeHomeAssistant(endpoint: endpoint, factory: { _ in socket }) }
  await Task.yield()
  probe.cancel()
  #expect(await !probe.value)
  #expect(socket.closed)
}
