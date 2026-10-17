import CryptoKit
import Foundation

/// A validated plugin on disk: manifest, controls and the sandboxed state script.
public struct PluginPackage: Equatable, Sendable {
  public static let maxStateBytes = 256 * 1024
  public static let maxJSONBytes = 64 * 1024

  public var manifest: PluginManifest
  public var controls: PluginControls
  public var stateSource: String
  public var directory: URL

  /// Load and validate an extracted package directory.
  public static func load(from directory: URL) throws -> PluginPackage {
    func read(_ name: String, limit: Int) throws -> Data {
      let url = directory.appendingPathComponent(name)
      let values = try? url.resourceValues(forKeys: [.isSymbolicLinkKey, .isRegularFileKey, .fileSizeKey])
      guard values?.isSymbolicLink != true, values?.isRegularFile == true else { throw PluginError.invalidPackage("缺少 \(name)") }
      guard (values?.fileSize ?? .max) <= limit else { throw PluginError.invalidPackage("\(name) 超过 \(limit / 1024) KB") }
      return try Data(contentsOf: url)
    }
    let manifest: PluginManifest
    do { manifest = try JSONDecoder().decode(PluginManifest.self, from: read("manifest.json", limit: maxJSONBytes)) }
    catch let error as PluginError { throw error }
    catch { throw PluginError.invalidManifest("无法解析 manifest.json") }
    try manifest.validate()
    let controls: PluginControls
    do { controls = try JSONDecoder().decode(PluginControls.self, from: read(manifest.entry.controls, limit: maxJSONBytes)) }
    catch let error as PluginError { throw error }
    catch { throw PluginError.invalidControls("无法解析 \(manifest.entry.controls)") }
    try controls.validate()
    guard let source = String(data: try read(manifest.entry.state, limit: maxStateBytes), encoding: .utf8) else {
      throw PluginError.invalidPackage("\(manifest.entry.state) 不是 UTF-8 文本")
    }
    return PluginPackage(manifest: manifest, controls: controls, stateSource: source, directory: directory)
  }

  public static func sha256(of url: URL) throws -> String {
    SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined()
  }
}

/// Where an installed plugin came from.
public enum PluginSource: String, Codable, Sendable {
  /// From the curated catalog, integrity checked
  case market
  /// Picked from disk by the user; not reviewed
  case file
}

public struct InstalledPlugin: Equatable, Sendable, Identifiable {
  public var package: PluginPackage
  public var source: PluginSource
  public var id: String { package.manifest.id }
  public var manifest: PluginManifest { package.manifest }
  public var verified: Bool { source == .market }

  /// Published by YunLe: installed from the bundled catalog with a matching
  /// checksum, under the `fun.yunle.` namespace. The namespace alone proves
  /// nothing (a sideloaded file can claim any id); the checksum does.
  public var isOfficial: Bool { verified && id.hasPrefix(Self.officialNamespace) }
  public static let officialNamespace = "fun.yunle."

  /// Whether the host actually grants `permission`: the manifest must ask for
  /// it, and official-only permissions also need an official plugin.
  public func grants(_ permission: String) -> Bool {
    guard manifest.permissions.contains(permission) else { return false }
    return !PluginPermission.officialOnly.contains(permission) || isOfficial
  }
}

/// Installs `.yunplugin` archives into Application Support and lists them.
public struct PluginInstaller: Sendable {
  public static let allowedFiles: Set<String> = ["manifest.json", "state.js", "controls.json"]
  public let root: URL

  public init(root: URL) { self.root = root }

  public static func defaultRoot() -> URL {
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return support.appendingPathComponent("YunHome/Plugins", isDirectory: true)
  }

  /// Install from a `.yunplugin` zip. When `expectedSHA256` is given the archive
  /// must match it exactly; otherwise the plugin is recorded as unverified.
  @discardableResult
  public func install(archive: URL, expectedSHA256: String? = nil) throws -> InstalledPlugin {
    if let expectedSHA256, try PluginPackage.sha256(of: archive) != expectedSHA256.lowercased() {
      throw PluginError.integrityMismatch
    }
    return try withExtracted(archive) { staging, package in
      try commit(package, from: staging, source: expectedSHA256 == nil ? .file : .market)
    }
  }

  /// Validate an archive without installing it, to show its manifest first.
  public func inspect(archive: URL) throws -> PluginPackage {
    try withExtracted(archive) { _, package in package }
  }

  private func withExtracted<T>(_ archive: URL, _ body: (URL, PluginPackage) throws -> T) throws -> T {
    let entries = try Self.listEntries(of: archive)
    // A package is three flat files; rejecting anything else means no entry can escape the staging directory.
    guard Set(entries) == Self.allowedFiles, entries.count == Self.allowedFiles.count else {
      throw PluginError.invalidPackage("只能包含 manifest.json、state.js 和 controls.json")
    }
    let staging = FileManager.default.temporaryDirectory.appendingPathComponent("yunplugin-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: staging) }
    try Self.run("/usr/bin/unzip", ["-q", "-o", archive.path, "-d", staging.path])
    return try body(staging, try PluginPackage.load(from: staging))
  }

  public func uninstall(id: String) throws {
    let directory = root.appendingPathComponent(id, isDirectory: true)
    if FileManager.default.fileExists(atPath: directory.path) { try FileManager.default.removeItem(at: directory) }
  }

  /// Every valid installed plugin; broken folders are skipped.
  public func installed() -> [InstalledPlugin] {
    guard let ids = try? FileManager.default.contentsOfDirectory(atPath: root.path) else { return [] }
    return ids.sorted().compactMap { id in
      let directory = root.appendingPathComponent(id, isDirectory: true)
      guard let package = try? PluginPackage.load(from: directory.appendingPathComponent("package", isDirectory: true)),
            package.manifest.id == id else { return nil }
      let source = (try? String(contentsOf: directory.appendingPathComponent("source"), encoding: .utf8))
        .flatMap { PluginSource(rawValue: $0.trimmingCharacters(in: .whitespacesAndNewlines)) } ?? .file
      return InstalledPlugin(package: package, source: source)
    }
  }

  private func commit(_ package: PluginPackage, from staging: URL, source: PluginSource) throws -> InstalledPlugin {
    let fileManager = FileManager.default
    let directory = root.appendingPathComponent(package.manifest.id, isDirectory: true)
    let destination = directory.appendingPathComponent("package", isDirectory: true)
    try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    // Replace atomically enough for a single-user app: copy beside, then swap.
    let incoming = directory.appendingPathComponent("incoming-\(UUID().uuidString)", isDirectory: true)
    try fileManager.createDirectory(at: incoming, withIntermediateDirectories: true)
    for name in Self.allowedFiles {
      try fileManager.copyItem(at: staging.appendingPathComponent(name), to: incoming.appendingPathComponent(name))
    }
    if fileManager.fileExists(atPath: destination.path) { try fileManager.removeItem(at: destination) }
    try fileManager.moveItem(at: incoming, to: destination)
    try source.rawValue.write(to: directory.appendingPathComponent("source"), atomically: true, encoding: .utf8)
    return InstalledPlugin(package: try PluginPackage.load(from: destination), source: source)
  }

  static func listEntries(of archive: URL) throws -> [String] {
    let output = try run("/usr/bin/unzip", ["-Z1", archive.path])
    return output.split(whereSeparator: \.isNewline).map(String.init)
  }

  @discardableResult
  static func run(_ executable: String, _ arguments: [String]) throws -> String {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    let output = Pipe()
    process.standardOutput = output
    process.standardError = Pipe()
    try process.run()
    let data = output.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else { throw PluginError.invalidPackage("无法读取压缩包") }
    return String(decoding: data, as: UTF8.self)
  }
}
