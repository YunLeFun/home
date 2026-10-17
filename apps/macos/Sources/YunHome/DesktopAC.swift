import AppKit
import SwiftUI
import HomeCore

@MainActor
final class DesktopACPanel: NSPanel {
  private let store: HomeStore
  private var dragOffset: NSPoint?
  private static let desktopLevel = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)

  init(store: HomeStore) {
    self.store = store
    super.init(contentRect: NSRect(x: 0, y: 0, width: 300, height: 190),
               styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    isOpaque = false
    backgroundColor = .clear
    hasShadow = false
    hidesOnDeactivate = false
    isReleasedWhenClosed = false
    collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]
    contentView = NSHostingView(rootView: DesktopACView(store: store))
    updateLevel()
    if !setFrameUsingName("YunHome.DesktopAC"), let screen = NSScreen.main?.visibleFrame {
      setFrameOrigin(NSPoint(x: screen.maxX - 340, y: screen.maxY - 230))
    }
    setFrameAutosaveName("YunHome.DesktopAC")
  }

  func updateLevel() { level = store.desktopAlwaysOnTop ? .floating : Self.desktopLevel }
  override var canBecomeKey: Bool { false }
  override func sendEvent(_ event: NSEvent) {
    switch event.type {
    case .leftMouseDown:
      if event.clickCount == 2 && store.acCanControl { store.send(.ac(.toggle)) }
      dragOffset = event.locationInWindow
    case .leftMouseDragged:
      if let dragOffset {
        let point = NSEvent.mouseLocation
        setFrameOrigin(NSPoint(x: point.x - dragOffset.x, y: point.y - dragOffset.y))
      }
    case .leftMouseUp:
      dragOffset = nil
      saveFrame(usingName: "YunHome.DesktopAC")
    case .rightMouseDown:
      if let contentView { NSMenu.popUpContextMenu(contextMenu(), with: event, for: contentView) }
    default: super.sendEvent(event)
    }
  }
  private func contextMenu() -> NSMenu {
    let menu = NSMenu()
    menu.autoenablesItems = false
    for (title, action) in [("开关空调", #selector(togglePower)), ("显示桌面遥控器", #selector(toggleRemote)), ("始终置顶", #selector(toggleLevel)), ("隐藏桌面空调", #selector(hideAC))] {
      let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
      item.target = self
      if action == #selector(togglePower) { item.isEnabled = store.acCanControl }
      if action == #selector(toggleLevel) { item.state = store.desktopAlwaysOnTop ? .on : .off }
      if action == #selector(toggleRemote) { item.state = store.showDesktopRemote ? .on : .off }
      menu.addItem(item)
    }
    return menu
  }
  @objc private func togglePower() { store.send(.ac(.toggle)) }
  @objc private func toggleLevel() { store.desktopAlwaysOnTop.toggle(); updateLevel() }
  @objc private func hideAC() { store.showDesktopAC = false }
  @objc private func toggleRemote() { store.showDesktopRemote.toggle() }
}

struct DesktopACView: View {
  let store: HomeStore
  var body: some View {
    ACPreview(state: store.acState, interactive: false).frame(width: 300, height: 190)
  }
}
