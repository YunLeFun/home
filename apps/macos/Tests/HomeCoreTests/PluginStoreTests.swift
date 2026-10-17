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
