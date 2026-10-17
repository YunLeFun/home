import AppKit
import SwiftUI
import HomeCore

@MainActor
final class DesktopRemotePanel: NSPanel, NSWindowDelegate {
  private let store: HomeStore
  private static let desktopLevel = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)

  init(store: HomeStore) {
    self.store = store
    super.init(contentRect: NSRect(x: 0, y: 0, width: 190, height: 330),
               styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    isOpaque = false
    backgroundColor = .clear
    hasShadow = false
    hidesOnDeactivate = false
    isReleasedWhenClosed = false
    collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]
    contentView = NSHostingView(rootView: DesktopRemoteContent(store: store))
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

private struct DesktopRemoteContent: View {
  let store: HomeStore
  var body: some View {
    VStack(spacing: 0) {
      if let device = store.selectedHADevice {
        Menu {
          ForEach(store.haDevices) { item in Button(item.label) { store.selectHADevice(item.id) } }
        } label: {
          Text(device.label).font(.caption).lineLimit(1)
        }.frame(width: 180).help("当前控制：\(device.label)")
      }
      ACRemotePreview(store: store, draggable: true).frame(width: 160, height: 300)
    }.frame(width: 190, height: 330)
  }
}
