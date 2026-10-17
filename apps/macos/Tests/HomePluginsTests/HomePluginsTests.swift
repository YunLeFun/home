import Foundation
import Testing
@testable import HomePlugins

private let fixture = Bundle.module.url(forResource: "Fixtures/air-conditioner", withExtension: "yunplugin")!
private let hostExecutable: URL = {
  // The test bundle may live inside the .xctest wrapper; walk up to the products directory.
  var directory = Bundle.module.bundleURL.deletingLastPathComponent()
  while directory.path != "/" {
    let candidate = directory.appendingPathComponent("YunHomePluginHost")
    if FileManager.default.isExecutableFile(atPath: candidate.path) { return candidate }
    directory.deleteLastPathComponent()
  }
  return Bundle.module.bundleURL.deletingLastPathComponent().appendingPathComponent("YunHomePluginHost")
}()

private func temporaryDirectory() throws -> URL {
  let url = FileManager.default.temporaryDirectory.appendingPathComponent("home-plugins-\(UUID().uuidString)", isDirectory: true)
  try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
  return url
}

private func makeArchive(_ files: [String: String], in directory: URL) throws -> URL {
  let source = directory.appendingPathComponent("source", isDirectory: true)
  try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
  for (name, text) in files {
    let url = source.appendingPathComponent(name)
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try text.write(to: url, atomically: true, encoding: .utf8)
  }
  let archive = directory.appendingPathComponent("test.yunplugin")
  let zip = Process()
  zip.executableURL = URL(fileURLWithPath: "/usr/bin/zip")
  zip.currentDirectoryURL = source
  zip.arguments = ["-q", "-r", archive.path] + files.keys.sorted()
  try zip.run()
  zip.waitUntilExit()
  return archive
}

private let validManifest = """
{"id":"com.example.lamp","version":"1.0.0","sdk":1,"runtime":"sandbox","name":"台灯","description":"",
 "author":{"name":"Example"},"category":"comfort","symbol":"lamp.desk","permissions":[],
 "entry":{"state":"state.js","controls":"controls.json"}}
"""
private let validControls = """
{"schema":1,"controls":[{"type":"power","bind":"on","label":"电源","action":{"type":"toggle"}}]}
"""
private func lampSource(reduce body: String = "return { on: !state.on }") -> String {
  """
  globalThis.plugin = {
    create: () => ({ on: false }),
    normalize: (value) => ({ on: Boolean(value && value.on) }),
    isAction: (action) => Boolean(action) && action.type === 'toggle',
    reduce: (state, action) => { \(body) },
    present: (state) => ({ active: state.on, tone: state.on ? 'warm' : 'idle', summary: state.on ? '已开灯' : '已关灯' }),
  }
  """
}

// MARK: Manifest and controls

@Test func manifestValidationRejectsUnsafeOrUnknownFields() throws {
  var manifest = try JSONDecoder().decode(PluginManifest.self, from: Data(validManifest.utf8))
  try manifest.validate()
  for mutate in [
    { (m: inout PluginManifest) in m.id = "lamp" },
    { $0.version = "1" },
    { $0.sdk = 2 },
    { $0.runtime = "bundled" },
    { $0.permissions = ["camera"] },
    { $0.permissions = ["network:http://example.com"] },
    { $0.renderer = "unknown-3d" },
    { $0.entry.state = "../state.js" },
    { $0.tint = "blue" },
  ] {
    var copy = manifest
    mutate(&copy)
    #expect(throws: PluginError.self) { try copy.validate() }
  }
  manifest.permissions = ["network:https://api.example.com", "home-assistant:climate"]
  try manifest.validate()
}

@Test func controlsValidationRejectsIncompleteControls() throws {
  let decode = { (json: String) in try JSONDecoder().decode(PluginControls.self, from: Data(json.utf8)) }
  try decode(validControls).validate()
  #expect(throws: PluginError.self) {
    try decode(#"{"schema":1,"controls":[{"type":"dial","bind":"t","label":"温度","min":30,"max":16,"step":1}]}"#).validate()
  }
  #expect(throws: PluginError.self) {
    try decode(#"{"schema":2,"controls":[{"type":"power","bind":"on","label":"电源","action":{}}]}"#).validate()
  }
  #expect(throws: (any Error).self) { try decode(#"{"schema":1,"controls":[{"type":"webview","bind":"x","label":""}]}"#) }
}

@Test func jsonValueSubstitutesSliderValues() throws {
  let template = try JSONValue.parse(#"{"type":"set","value":"$value","nested":["$value"]}"#)
  #expect(template.substituting(.number(42)) == .object(["type": .string("set"), "value": .number(42), "nested": .array([.number(42)])]))
  #expect(try JSONValue.parse("true") == .bool(true))
  #expect(try JSONValue.parse("1") == .number(1))
}

// MARK: Installer

@Test func installsTheAirConditionerPackageFromTheMarket() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let installer = PluginInstaller(root: root)
  let sha = try PluginPackage.sha256(of: fixture)
  let plugin = try installer.install(archive: fixture, expectedSHA256: sha)
  #expect(plugin.id == "fun.yunle.air-conditioner" && plugin.verified)
  #expect(plugin.manifest.renderer == "cute-ac-3d")
  #expect(plugin.package.controls.power?.bind == "status")
  #expect(installer.installed().map(\.id) == ["fun.yunle.air-conditioner"])
  #expect(installer.installed().first?.verified == true)
  try installer.uninstall(id: plugin.id)
  #expect(installer.installed().isEmpty)
}

@Test func rejectsTamperedOrMalformedPackages() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let installer = PluginInstaller(root: root)
  #expect(throws: PluginError.integrityMismatch) { try installer.install(archive: fixture, expectedSHA256: String(repeating: "0", count: 64)) }

  let nested = try makeArchive(["manifest.json": validManifest, "controls.json": validControls, "nested/state.js": lampSource()], in: root)
  #expect(throws: PluginError.self) { try installer.install(archive: nested) }

  let extra = try makeArchive(["manifest.json": validManifest, "controls.json": validControls, "state.js": lampSource(), "run.sh": "echo"],
                              in: try temporaryDirectory())
  #expect(throws: PluginError.self) { try installer.install(archive: extra) }
  #expect(installer.installed().isEmpty)
}

@Test func thermalIsOnlyGrantedToOfficialPlugins() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  #expect(PluginPermission.isKnown(PluginPermission.thermal))

  // The YunLe air conditioner from the market is official and gets the room reading.
  let official = try PluginInstaller(root: root.appendingPathComponent("market"))
    .install(archive: fixture, expectedSHA256: try PluginPackage.sha256(of: fixture))
  #expect(official.manifest.permissions.contains(PluginPermission.thermal))
  #expect(official.isOfficial && official.grants(PluginPermission.thermal))

  // The same package picked from disk is not: its id alone proves nothing.
  let sideloaded = try PluginInstaller(root: root.appendingPathComponent("file")).install(archive: fixture)
  #expect(!sideloaded.isOfficial && !sideloaded.grants(PluginPermission.thermal))

  // Nor is a reviewed third-party plugin, although its other permissions apply.
  let manifest = validManifest.replacingOccurrences(of: #""permissions":[]"#, with: #""permissions":["sensor:thermal","storage"]"#)
  let archive = try makeArchive(["manifest.json": manifest, "controls.json": validControls, "state.js": lampSource()],
                                in: try temporaryDirectory())
  let thirdParty = try PluginInstaller(root: root.appendingPathComponent("third-party"))
    .install(archive: archive, expectedSHA256: try PluginPackage.sha256(of: archive))
  #expect(thirdParty.verified && !thirdParty.isOfficial)
  #expect(!thirdParty.grants(PluginPermission.thermal) && thirdParty.grants("storage"))
}

@Test func comparesPluginVersions() {
  #expect(PluginVersion.compare("0.3.0", "0.3.1") == .orderedAscending)
  #expect(PluginVersion.compare("0.10.0", "0.9.9") == .orderedDescending)
  #expect(PluginVersion.compare("1.0", "1.0.0") == .orderedSame)
  #expect(PluginVersion.compare("0.4.0-beta.1", "0.4.0") == .orderedAscending)
}

@Test func offersCatalogUpdatesOnlyForChangedMarketPackages() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  func archive(version: String, permissions: String = "[]", summary: String = "已开灯") throws -> URL {
    let manifest = validManifest
      .replacingOccurrences(of: #""version":"1.0.0""#, with: #""version":"\#(version)""#)
      .replacingOccurrences(of: #""permissions":[]"#, with: #""permissions":\#(permissions)"#)
    return try makeArchive(["manifest.json": manifest, "controls.json": validControls,
                            "state.js": lampSource().replacingOccurrences(of: "已开灯", with: summary)],
                           in: try temporaryDirectory())
  }
  func entry(for archive: URL, version: String) throws -> PluginCatalogEntry {
    PluginCatalogEntry(id: "com.example.lamp", name: "台灯", description: "", author: "Example", category: "comfort",
                       symbol: "lamp.desk", version: version, package: archive.lastPathComponent,
                       sha256: try PluginPackage.sha256(of: archive), verified: true)
  }
  let installer = PluginInstaller(root: root)
  let v1 = try archive(version: "1.0.0")
  let installed = try installer.install(archive: v1, expectedSHA256: try PluginPackage.sha256(of: v1))

  // The same package is not an update.
  #expect(try installer.availableUpdate(for: installed, entry: entry(for: v1, version: "1.0.0"), archive: v1) == nil)

  // A rebuilt package is, even under the same version; no new permission means no consent.
  let rebuilt = try archive(version: "1.0.0", summary: "灯亮了")
  let silent = try #require(try installer.availableUpdate(for: installed, entry: entry(for: rebuilt, version: "1.0.0"), archive: rebuilt))
  #expect(!silent.needsConsent && silent.package.stateSource.contains("灯亮了"))

  // New permissions need consent.
  let wider = try archive(version: "1.1.0", permissions: #"["storage"]"#)
  let consent = try #require(try installer.availableUpdate(for: installed, entry: entry(for: wider, version: "1.1.0"), archive: wider))
  #expect(consent.needsConsent && consent.addedPermissions == ["storage"] && consent.version == "1.1.0")

  // Older packages, tampered archives and file installs are never offered.
  let older = try archive(version: "0.9.0", summary: "旧版")
  #expect(try installer.availableUpdate(for: installed, entry: entry(for: older, version: "0.9.0"), archive: older) == nil)
  var tampered = try entry(for: wider, version: "1.1.0")
  tampered.sha256 = String(repeating: "0", count: 64)
  #expect(throws: PluginError.integrityMismatch) { try installer.availableUpdate(for: installed, entry: tampered, archive: wider) }
  let sideloaded = try PluginInstaller(root: root.appendingPathComponent("file")).install(archive: v1)
  #expect(try installer.availableUpdate(for: sideloaded, entry: entry(for: wider, version: "1.1.0"), archive: wider) == nil)
}

@Test func fileInstallsAreMarkedUnverified() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let archive = try makeArchive(["manifest.json": validManifest, "controls.json": validControls, "state.js": lampSource()], in: root)
  let plugin = try PluginInstaller(root: root.appendingPathComponent("plugins")).install(archive: archive)
  #expect(plugin.source == .file && !plugin.verified)
}

// MARK: Sandboxed host

@Test func runsTheAirConditionerScriptOutOfProcess() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let plugin = try PluginInstaller(root: root).install(archive: fixture)
  let client = PluginHostClient(executable: hostExecutable)
  defer { Task { await client.shutdown() } }
  await client.register(plugin: plugin.id, source: plugin.package.stateSource)

  let created = try await client.create(plugin: plugin.id)
  #expect(created.state == .object(["status": .bool(false), "mode": .string("cold"), "temperature": .number(26),
                                    "sound": .string("normal"), "swing": .bool(false)]))
  #expect(created.presentation == PluginPresentation(active: false, tone: "idle", summary: "待机 · 26°C"))

  var state = created.state
  for action in [#"{"type":"toggleStatus"}"#, #"{"type":"mode","mode":"hot"}"#, #"{"type":"increment"}"#] {
    state = try await client.dispatch(plugin: plugin.id, state: state, action: try JSONValue.parse(action)).state
  }
  let halfStep = try await client.dispatch(plugin: plugin.id, state: state, action: try JSONValue.parse(#"{"type":"increment"}"#),
                                           context: try JSONValue.parse(#"{"limits":{"min":17,"max":30,"step":0.5}}"#))
  #expect(state["temperature"] == .number(27) && halfStep.state["temperature"] == .number(27.5))
  #expect(halfStep.presentation == PluginPresentation(active: true, tone: "heat", summary: "制热 · 27.5°C"))

  await #expect(throws: PluginError.self) {
    try await client.dispatch(plugin: plugin.id, state: state, action: try JSONValue.parse(#"{"type":"update","payload":{}}"#))
  }
  let normalized = try await client.present(plugin: plugin.id, state: try JSONValue.parse(#"{"temperature":99,"mode":"dry"}"#))
  #expect(normalized.state["temperature"] == .number(31) && normalized.state["mode"] == .string("cold"))

  // `present` receives the host context, e.g. the room reading for official plugins.
  let room = try JSONValue.parse(#"{"room":{"celsius":53,"thermalState":"nominal","fanRPM":1500,"windLevel":1}}"#)
  let withRoom = try await client.present(plugin: plugin.id, state: halfStep.state, context: room)
  #expect(withRoom.presentation.summary == "制热 · 27.5°C · 室温 53°C")
}

@Test func runsTheBundledFanScriptOutOfProcess() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let archive = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("Sources/YunHome/Resources/Plugins/electric-fan.yunplugin")
  let plugin = try PluginInstaller(root: root).install(archive: archive)
  #expect(plugin.manifest.appIcon?.hasMotion == true)
  let client = PluginHostClient(executable: hostExecutable)
  defer { Task { await client.shutdown() } }
  await client.register(plugin: plugin.id, source: plugin.package.stateSource)

  let created = try await client.create(plugin: plugin.id)
  #expect(created.presentation == PluginPresentation(active: false, tone: "idle", summary: "待机 · 1 档", motionSpeed: 1))
  let fast = try await client.dispatch(plugin: plugin.id, state: created.state, action: try JSONValue.parse(#"{"type":"set-speed","speed":3}"#))
  let swaying = try await client.dispatch(plugin: plugin.id, state: fast.state,
                                          action: try JSONValue.parse(#"{"type":"set-oscillation","oscillating":true}"#))
  #expect(swaying.state == .object(["power": .bool(true), "speed": .number(3), "oscillating": .bool(true)]))
  #expect(swaying.presentation == PluginPresentation(active: true, tone: "active", summary: "3 档 · 摇头", motionSpeed: 2.2))
  await #expect(throws: PluginError.self) {
    try await client.dispatch(plugin: plugin.id, state: fast.state, action: try JSONValue.parse(#"{"type":"set-speed","speed":4}"#))
  }
}

@Test func sandboxExposesNoHostCapabilities() async throws {
  let probe = """
  globalThis.plugin = {
    create: () => ({ globals: [typeof fetch, typeof setTimeout, typeof require, typeof process, typeof XMLHttpRequest, typeof WebAssembly, typeof console].join(',') }),
    normalize: (value) => value, isAction: () => true, reduce: (state) => state,
    present: (state) => ({ active: false, tone: 'idle', summary: state.globals }),
  }
  """
  let client = PluginHostClient(executable: hostExecutable)
  defer { Task { await client.shutdown() } }
  await client.register(plugin: "com.example.probe", source: probe)
  let result = try await client.create(plugin: "com.example.probe")
  #expect(result.presentation.summary == Array(repeating: "undefined", count: 7).joined(separator: ","))
}

@Test func watchdogStopsHungPluginsWithoutAffectingOthers() async throws {
  let client = PluginHostClient(executable: hostExecutable, timeout: .milliseconds(300))
  defer { Task { await client.shutdown() } }
  await client.register(plugin: "com.example.lamp", source: lampSource())
  await client.register(plugin: "com.example.hang", source: lampSource(reduce: "while (true) {}"))

  let lamp = try await client.create(plugin: "com.example.lamp")
  let hung = try await client.create(plugin: "com.example.hang")
  let started = ContinuousClock.now
  await #expect(throws: PluginError.timeout) {
    try await client.dispatch(plugin: "com.example.hang", state: hung.state, action: .object(["type": .string("toggle")]))
  }
  #expect(ContinuousClock.now - started < .seconds(2))

  // The host restarts transparently and reloads the healthy plugin.
  let toggled = try await client.dispatch(plugin: "com.example.lamp", state: lamp.state, action: .object(["type": .string("toggle")]))
  #expect(toggled.presentation.summary == "已开灯")

  for _ in 1..<PluginHostClient.maxFaults {
    _ = try? await client.dispatch(plugin: "com.example.hang", state: hung.state, action: .object(["type": .string("toggle")]))
  }
  #expect(await client.isDisabled("com.example.hang"))
  #expect(await !client.isDisabled("com.example.lamp"))
}

@Test func reportsScriptErrorsAsPluginErrors() async throws {
  let client = PluginHostClient(executable: hostExecutable)
  defer { Task { await client.shutdown() } }
  await client.register(plugin: "com.example.broken", source: "globalThis.plugin = { create() { throw new Error('boom') } }")
  await #expect(throws: PluginError.self) { try await client.create(plugin: "com.example.broken") }
  await client.register(plugin: "com.example.throws", source: lampSource(reduce: "throw new Error('nope')"))
  let created = try await client.create(plugin: "com.example.throws")
  await #expect(throws: PluginError.self) {
    try await client.dispatch(plugin: "com.example.throws", state: created.state, action: .object(["type": .string("toggle")]))
  }
}
