import Foundation

/// A reviewed package in the bundled catalog that differs from what is
/// installed. Updates that ask for no new permission are applied silently;
/// the others wait until the user accepts the added permissions.
public struct PluginUpdate: Equatable, Sendable, Identifiable {
  public var entry: PluginCatalogEntry
  /// The incoming package, already validated.
  public var package: PluginPackage
  /// Permissions the new version requests that the installed one did not.
  public var addedPermissions: [String]

  public var id: String { entry.id }
  public var version: String { package.manifest.version }
  public var needsConsent: Bool { !addedPermissions.isEmpty }
}

/// Dotted numeric versions ("0.3.0", "1.2"). A prerelease suffix
/// ("0.4.0-beta.1") sorts before its release; anything unparsable compares
/// as equal so it never blocks an update.
public enum PluginVersion {
  public static func compare(_ lhs: String, _ rhs: String) -> ComparisonResult {
    func split(_ version: String) -> (numbers: [Int], prerelease: Bool) {
      let parts = version.split(separator: "-", maxSplits: 1)
      let numbers = (parts.first ?? "").split(separator: ".").map { Int($0) ?? 0 }
      return (numbers, parts.count > 1)
    }
    let (a, aPre) = split(lhs)
    let (b, bPre) = split(rhs)
    for index in 0..<max(a.count, b.count) {
      let x = index < a.count ? a[index] : 0
      let y = index < b.count ? b[index] : 0
      if x != y { return x < y ? .orderedAscending : .orderedDescending }
    }
    if aPre != bPre { return aPre ? .orderedAscending : .orderedDescending }
    return .orderedSame
  }
}

extension PluginInstaller {
  /// The catalog's package for an installed market plugin when its contents
  /// differ and it is not an older version. Contents, not the version string,
  /// decide: a rebuilt package under the same version is still an update.
  /// Plugins installed from a file are never replaced by market packages.
  public func availableUpdate(for installed: InstalledPlugin, entry: PluginCatalogEntry, archive: URL) throws -> PluginUpdate? {
    guard installed.source == .market, entry.id == installed.id else { return nil }
    guard try PluginPackage.sha256(of: archive) == entry.sha256.lowercased() else { throw PluginError.integrityMismatch }
    let incoming = try inspect(archive: archive)
    let current = installed.package
    guard incoming.manifest.id == installed.id else { return nil }
    guard incoming.manifest != current.manifest || incoming.controls != current.controls
      || incoming.stateSource != current.stateSource else { return nil }
    guard PluginVersion.compare(incoming.manifest.version, current.manifest.version) != .orderedAscending else { return nil }
    let added = incoming.manifest.permissions.filter { !current.manifest.permissions.contains($0) }
    return PluginUpdate(entry: entry, package: incoming, addedPermissions: added)
  }
}
