import AppKit
import ReleaseCheck

/// GitHub Releases update check for the native app. Releases are tagged
/// `macos-v<version>` in YunLeFun/home and carry `YunHome-<version>.zip`.
@MainActor
enum HomeUpdates {
  static let monitor = UpdateMonitor(
    checker: ReleaseChecker(repository: "YunLeFun/home", tagPrefix: "macos-v", assetPrefix: "YunHome-"),
    keyPrefix: "yun-home"
  )

  static func open(_ release: AppRelease) {
    NSWorkspace.shared.open(release.downloadURL ?? release.pageURL)
  }

  /// Manual check from a menu: always reports the outcome.
  static func checkAndReport() {
    Task {
      await monitor.check()
      let alert = NSAlert()
      switch monitor.status {
      case .available(let release):
        alert.messageText = "云之彼端 v\(release.version) 可以下载了"
        alert.informativeText = "当前版本 v\(AppVersion.current ?? "?")。下载后解压，用新的 YunHome.app 替换旧版即可，家园存档不受影响。"
        alert.addButton(withTitle: "下载")
        alert.addButton(withTitle: "稍后")
        if alert.runModal() == .alertFirstButtonReturn { open(release) }
        return
      case .upToDate:
        alert.messageText = "已是最新版本"
        alert.informativeText = "云之彼端 v\(AppVersion.current ?? "?") 是目前的最新版本。"
      case .failed(let reason):
        alert.messageText = "检查更新失败"
        alert.informativeText = reason
      case .idle, .checking:
        return
      }
      alert.runModal()
    }
  }
}
