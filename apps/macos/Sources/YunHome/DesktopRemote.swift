import AppKit
import SwiftUI
import HomeCore

@MainActor
final class DesktopRemotePanel: NSPanel, NSWindowDelegate {
  private let store: HomeStore
  private static let desktopLevel = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)

  init(store: HomeStore) {
    self.store = store
    super.init(contentRect: NSRect(x: 0, y: 0, width: 160, height: 300),
               styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    isOpaque = false
    backgroundColor = .clear
    hasShadow = false
    hidesOnDeactivate = false
    isReleasedWhenClosed = false
    collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]
    contentView = NSHostingView(rootView: ACRemotePreview(store: store, draggable: true).frame(width: 160, height: 300))
    updateLevel()
    if !setFrameUsingName("YunHome.DesktopRemote"), let screen = NSScreen.main?.visibleFrame {
      setFrameOrigin(NSPoint(x: screen.maxX - 205, y: screen.maxY - 545))
    }
    setFrameAutosaveName("YunHome.DesktopRemote")
    delegate = self
  }

  override var canBecomeKey: Bool { false }
  func updateLevel() { level = store.desktopAlwaysOnTop ? .floating : Self.desktopLevel }
  func windowDidMove(_ notification: Notification) { saveFrame(usingName: "YunHome.DesktopRemote") }

  override func sendEvent(_ event: NSEvent) {
    if event.type == .rightMouseDown, let contentView {
      NSMenu.popUpContextMenu(contextMenu(), with: event, for: contentView)
    } else { super.sendEvent(event) }
  }

  private func contextMenu() -> NSMenu {
    let menu = NSMenu()
    let level = menu.addItem(withTitle: "始终置顶", action: #selector(toggleLevel), keyEquivalent: "")
    level.target = self
    level.state = store.desktopAlwaysOnTop ? .on : .off
    menu.addItem(withTitle: "隐藏桌面遥控器", action: #selector(hideRemote), keyEquivalent: "").target = self
    return menu
  }
  @objc private func toggleLevel() { store.desktopAlwaysOnTop.toggle() }
  @objc private func hideRemote() { store.showDesktopRemote = false }
}
