import Foundation
import Testing
@testable import HomeCore

@MainActor @Test func menuBarPreferenceDefaultsVisibleAndRestoresIndependently() throws {
  let name = "fun.yunle.home.display-test.\(UUID().uuidString)"
  let defaults = try #require(UserDefaults(suiteName: name))
  defer { defaults.removePersistentDomain(forName: name) }
  let store = HomeStore(defaults: defaults)
  #expect(store.showMenuBarIcon)
  let snapshot = store.snapshot
  store.showMenuBarIcon = false
  store.showDesktopAC = true
  store.showDesktopRemote = true
  store.desktopAlwaysOnTop = true
  let restored = HomeStore(defaults: defaults)
  #expect(!restored.showMenuBarIcon)
  #expect(restored.showDesktopAC && restored.showDesktopRemote && restored.desktopAlwaysOnTop)
  #expect(restored.snapshot == snapshot)
  restored.showMenuBarIcon = true
  #expect(HomeStore(defaults: defaults).showMenuBarIcon)
}
