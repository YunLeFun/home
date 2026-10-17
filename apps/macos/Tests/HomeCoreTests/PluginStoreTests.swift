import Foundation
import Testing
import HomePlugins
@testable import HomeCore

private let fixture = Bundle.module.url(forResource: "Fixtures/air-conditioner", withExtension: "yunplugin")!
private let hostExecutable: URL = {
  var directory = Bundle.module.bundleURL.deletingLastPathComponent()
  while directory.path != "/" {
    let candidate = directory.appendingPathComponent("YunHomePluginHost")
    if FileManager.default.isExecutableFile(atPath: candidate.path) { return candidate }
    directory.deleteLastPathComponent()
  }
  return Bundle.module.bundleURL.deletingLastPathComponent().appendingPathComponent("YunHomePluginHost")
}()

private func catalogEntry() throws -> PluginCatalogEntry {
  PluginCatalogEntry(id: "fun.yunle.air-conditioner", name: "云空调", description: "", author: "YunYouJun", category: "climate",
                     symbol: "air.conditioner.horizontal", version: "0.3.0", renderer: "cute-ac-3d",
                     package: fixture.lastPathComponent, sha256: try PluginPackage.sha256(of: fixture), verified: true)
}

/// The air conditioner fixture rebuilt with an older manifest, standing in
/// for what users installed before `sensor:thermal` existed.
private func olderAirConditioner(in directory: URL) throws -> URL {
  let staging = directory.appendingPathComponent("staging", isDirectory: true)
  try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
  try run("/usr/bin/unzip", ["-q", fixture.path, "-d", staging.path])
  let manifestURL = staging.appendingPathComponent("manifest.json")
  let manifest = try String(contentsOf: manifestURL, encoding: .utf8)
    .replacingOccurrences(of: #""sensor:thermal""#, with: "")
  try manifest.write(to: manifestURL, atomically: true, encoding: .utf8)
  let archive = directory.appendingPathComponent("old.yunplugin")
  try run("/usr/bin/zip", ["-q", "-j", archive.path] + ["manifest.json", "state.js", "controls.json"].map { staging.appendingPathComponent($0).path })
  return archive
}

private func run(_ executable: String, _ arguments: [String]) throws {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: executable)
  process.arguments = arguments
  try process.run()
  process.waitUntilExit()
}

@MainActor @Test func catalogUpdatesKeepDevicesAndAskForNewPermissions() async throws {
  let name = "fun.yunle.home.test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: name))
  let root = FileManager.default.temporaryDirectory.appendingPathComponent("plugins-\(UUID().uuidString)")
  let work = FileManager.default.temporaryDirectory.appendingPathComponent("catalog-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at: work, withIntermediateDirectories: true)
  defer {
    defaults.removePersistentDomain(forName: name)
    try? FileManager.default.removeItem(at: root)
    try? FileManager.default.removeItem(at: work)
  }
  let old = try olderAirConditioner(in: work)
  var oldEntry = try catalogEntry()
  oldEntry.package = old.lastPathComponent
  oldEntry.sha256 = try PluginPackage.sha256(of: old)

  let store = HomeStore(defaults: defaults, pluginRoot: root, pluginHostExecutable: hostExecutable)
  let instance = try await store.install(oldEntry, from: work)
  store.send(plugin: instance.id, action: .object(["type": .string("toggleStatus")]))
  await store.settle(plugin: instance.id)
  #expect(store.installedPlugin(for: instance)?.grants(PluginPermission.thermal) == false)

  // The current fixture adds sensor:thermal, so it waits for consent.
  let directory = fixture.deletingLastPathComponent()
  await store.checkPluginUpdates(catalog: [try catalogEntry()], directory: directory)
  #expect(store.pluginUpdates[instance.pluginId]?.addedPermissions == [PluginPermission.thermal])
  #expect(store.installedPlugin(for: instance)?.manifest.permissions.isEmpty == true)

  try await store.applyPluginUpdate(instance.pluginId, from: directory)
  #expect(store.pluginUpdates.isEmpty)
  #expect(store.installedPlugin(for: instance)?.grants(PluginPermission.thermal) == true)
  // The device and its state survive the update.
  #expect(store.snapshot.plugins.map(\.id) == [instance.id])
  #expect(store.snapshot.plugin(instance.id)?.state["status"] == .bool(true))

  // Up to date now: nothing more to offer.
  await store.checkPluginUpdates(catalog: [try catalogEntry()], directory: directory)
  #expect(store.pluginUpdates.isEmpty)
}

@MainActor @Test func versionOneArchivesGainAnEmptyPluginList() throws {
  var legacy = try JSONSerialization.jsonObject(with: JSONEncoder().encode(HomeSnapshot())) as! [String: Any]
  legacy["version"] = 1
  legacy.removeValue(forKey: "plugins")
  let decoded = try JSONDecoder().decode(HomeSnapshot.self, from: JSONSerialization.data(withJSONObject: legacy))
  #expect(decoded.version == 1 && decoded.plugins.isEmpty)

  let name = "fun.yunle.home.test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: name))
  defer { defaults.removePersistentDomain(forName: name) }
  defaults.set(try JSONSerialization.data(withJSONObject: legacy), forKey: "yun-home:native:v1")
  let store = HomeStore(defaults: defaults, pluginRoot: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString),
                        pluginHostExecutable: hostExecutable)
  #expect(store.storageMessage == nil && store.snapshot.version == HomeSnapshot.currentVersion)
}

@MainActor @Test func installsAndControlsTheAirConditionerPlugin() async throws {
  let name = "fun.yunle.home.test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: name))
  let root = FileManager.default.temporaryDirectory.appendingPathComponent("plugins-\(UUID().uuidString)")
  defer {
    defaults.removePersistentDomain(forName: name)
    try? FileManager.default.removeItem(at: root)
  }
  let store = HomeStore(defaults: defaults, pluginRoot: root, pluginHostExecutable: hostExecutable)
  let instance = try await store.install(try catalogEntry(), from: fixture.deletingLastPathComponent())
  #expect(store.installedPlugin(for: instance)?.verified == true)
  #expect(store.status(for: instance) == "待机 · 26°C" && store.activeCount == 0)

  // Rapid taps are applied in order against the latest state.
  store.send(plugin: instance.id, action: .object(["type": .string("toggleStatus")]))
  for _ in 0..<3 { store.send(plugin: instance.id, action: .object(["type": .string("increment")])) }
  await store.settle(plugin: instance.id)
  #expect(store.snapshot.plugin(instance.id)?.state["temperature"] == .number(29))
  #expect(store.isActive(plugin: instance) && store.activeCount == 1)
  #expect(store.status(for: instance) == "制冷 · 29°C")

  // As an official plugin it receives the Mac's room reading and re-presents.
  store.updateRoom(RoomReading(celsius: 53, thermalState: .nominal, fanRPM: 1500, windLevel: 1))
  #expect(store.pluginContext(for: instance.pluginId)?["room"]?["celsius"] == .number(53))
  for _ in 0..<50 where store.status(for: instance) != "制冷 · 29°C · 室温 53°C" { try await Task.sleep(for: .milliseconds(20)) }
  #expect(store.status(for: instance) == "制冷 · 29°C · 室温 53°C")

  store.move(plugin: instance.id, to: .bedroom)

  // A fresh store restores the device from disk and the archive.
  let reopened = HomeStore(defaults: defaults, pluginRoot: root, pluginHostExecutable: hostExecutable)
  #expect(reopened.snapshot.plugin(instance.id)?.room == .bedroom)
  #expect(reopened.installedPlugin(for: instance) != nil)
  for _ in 0..<50 where reopened.pluginPresentations[instance.id] == nil { try await Task.sleep(for: .milliseconds(20)) }
  #expect(reopened.status(for: instance) == "制冷 · 29°C")

  reopened.send(.allOff)
  await reopened.settle(plugin: instance.id)
  #expect(!reopened.isActive(plugin: instance))

  await reopened.uninstall(plugin: instance.pluginId)
  #expect(reopened.snapshot.plugins.isEmpty && reopened.installedPlugins.isEmpty)
  #expect(PluginInstaller(root: root).installed().isEmpty)
}
