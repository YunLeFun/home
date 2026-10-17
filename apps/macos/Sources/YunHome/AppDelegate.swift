import AppKit
import Combine
import CuteACKit
import Observation
import ReleaseCheck
import SwiftUI
import HomeCore
import HomeDeviceKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, NSPopoverDelegate {
  let store: HomeStore
  private var homeWindow: NSWindow?
  private var statusItem: NSStatusItem?
  private let popover = NSPopover()
  private let presentation = HomeWindowPresentation()
  private var desktopPanel: DesktopACPanel?
  private var remotePanel: DesktopRemotePanel?
  private var timer: Timer?
  private let captureDirectory: URL?
  /// Reads the Mac's temperature and fans (CuteACKit) for the AC's LCD and for
  /// official plugins; sampled only while a window, the panel or the desktop
  /// air conditioner is on screen.
  private let thermal = ThermalMonitor()
  private var thermalReading: AnyCancellable?

  override init() {
    let arguments = CommandLine.arguments
    if let index = arguments.firstIndex(of: "--capture"), index + 1 < arguments.count {
      captureDirectory = URL(fileURLWithPath: arguments[index + 1])
    } else { captureDirectory = nil }
    if captureDirectory != nil || arguments.contains("--demo") {
      let defaults = UserDefaults(suiteName: "fun.yunle.home.demo.\(ProcessInfo.processInfo.processIdentifier)")!
      store = HomeStore(defaults: defaults)
      store.send(.ac(.toggle))
      store.send(.fan(.speed(1)))
    } else { store = HomeStore(sharedBindings: HAFileBindingCatalog()) }
    super.init()
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    let arguments = CommandLine.arguments
    if let index = arguments.firstIndex(of: "--appearance"), index + 1 < arguments.count {
      switch arguments[index + 1] {
      case "light": NSApp.appearance = NSAppearance(named: .aqua)
      case "dark": NSApp.appearance = NSAppearance(named: .darkAqua)
      default: break
      }
    }
    NSApp.setActivationPolicy(.regular)
    setUpMenu()
    setUpPopover()
    showHome()
    setUpStatusItem()
    observeStore()
    updateCompanions()
    if captureDirectory != nil { thermal.pin(.demo) }
    thermalReading = thermal.$reading.sink { [weak self] reading in self?.store.updateRoom(reading) }
    observeThermalActivity()
    // The catalog ships with the app, so a new app version may carry newer
    // plugin packages; silent ones apply now, the rest show in plugin details.
    if let directory = BundledPluginCatalog.directory {
      Task { await store.checkPluginUpdates(catalog: BundledPluginCatalog.entries, directory: directory) }
    }
    // App releases: at most once a day; demo and capture runs stay offline.
    if captureDirectory == nil && !CommandLine.arguments.contains("--demo") {
      Task { await HomeUpdates.monitor.checkIfDue() }
    }
    NotificationCenter.default.addObserver(self, selector: #selector(didWake), name: NSApplication.didBecomeActiveNotification, object: nil)
    NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(didWake), name: NSWorkspace.didWakeNotification, object: nil)
    if let captureDirectory {
      Task { @MainActor in
        try? await Task.sleep(for: .seconds(2))
        do {
          try FileManager.default.createDirectory(at: captureDirectory, withIntermediateDirectories: true)
          try captureHome(to: captureDirectory.appendingPathComponent("home.png"))
          presentation.selection = .market
          try? await Task.sleep(for: .seconds(1))
          try captureHome(to: captureDirectory.appendingPathComponent("market.png"))
          print("Captured \(captureDirectory.path)")
        } catch {
          fputs("Capture failed: \(error)\n", stderr)
        }
        NSApp.terminate(nil)
      }
    }
  }

  @objc func showHome() {
    popover.performClose(nil)
    if homeWindow == nil {
      let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 780),
                            styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
      window.title = "云之彼端 · Yun Home"
      window.toolbarStyle = .unifiedCompact
      window.titlebarAppearsTransparent = true
      window.backgroundColor = .windowBackgroundColor
      window.minSize = NSSize(width: 900, height: 660)
      window.contentViewController = NSHostingController(rootView: HomeWindow(
        store: store, presentation: presentation, showQuickControls: { [weak self] in self?.showQuickControls() }))
      window.setContentSize(NSSize(width: 1120, height: 780))
      window.isReleasedWhenClosed = false
      window.delegate = self
      window.center()
      if captureDirectory == nil { window.setFrameAutosaveName("YunHome.Main") }
      homeWindow = window
    }
    if homeWindow?.isMiniaturized == true { homeWindow?.deminiaturize(nil) }
    homeWindow?.makeKeyAndOrderFront(nil)
    presentation.isMainWindowVisible = true
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    showHome()
    return true
  }
  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
  func applicationDidHide(_ notification: Notification) { presentation.isMainWindowVisible = false }
  func applicationDidUnhide(_ notification: Notification) {
    presentation.isMainWindowVisible = homeWindow?.isVisible == true && homeWindow?.isMiniaturized == false
  }
  func windowWillClose(_ notification: Notification) {
    presentation.isMainWindowVisible = false
    if store.snapshot.television.playing { store.send(.tv(.pause)) }
  }
  func windowDidMiniaturize(_ notification: Notification) { presentation.isMainWindowVisible = false }
  func windowDidDeminiaturize(_ notification: Notification) { presentation.isMainWindowVisible = true }
  func windowDidBecomeKey(_ notification: Notification) { presentation.isMainWindowVisible = true }

  private func setMainWindowVisible(_ visible: Bool) {
    if visible { showHome() }
    else { homeWindow?.performClose(nil) }
  }

  @objc private func showSettings() {
    presentation.selection = .settings
    showHome()
  }

  private func showDevice(_ device: DeviceKind) {
    presentation.selection = .device(device)
    showHome()
  }

  private func showPlugin(_ id: String) {
    presentation.selection = .plugin(id)
    showHome()
  }
  func applicationWillTerminate(_ notification: Notification) {
    timer?.invalidate()
    // Playback belongs to the visible native player and never resumes at startup.
    if store.snapshot.television.playing { store.send(.tv(.pause)) }
    store.homeAssistant.disconnect()
  }

  private func setUpStatusItem() {
    guard store.showMenuBarIcon, statusItem == nil else { return }
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    item.button?.target = self
    item.button?.action = #selector(togglePopover(_:))
    item.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
    item.button?.setAccessibilityLabel("云之彼端快捷控制")
    item.button?.toolTip = "云之彼端 · 家园快捷控制"
    statusItem = item
  }

  private func setUpPopover() {
    popover.behavior = .transient
    popover.delegate = self
    popover.appearance = NSApp.appearance
    popover.contentViewController = NSHostingController(rootView: QuickControls(
      store: store, presentation: presentation,
      setMainWindowVisible: { [weak self] in self?.setMainWindowVisible($0) },
      openHome: { [weak self] in self?.showHome() },
      openDevice: { [weak self] in self?.showDevice($0) },
      openPlugin: { [weak self] in self?.showPlugin($0) },
      openSettings: { [weak self] in self?.showSettings() }))
  }

  @objc private func togglePopover(_ sender: NSStatusBarButton) {
    if NSApp.currentEvent?.type == .rightMouseUp {
      popover.performClose(nil)
      let y = sender.isFlipped ? sender.bounds.maxY + 4 : sender.bounds.minY - 4
      statusMenu().popUp(positioning: nil, at: NSPoint(x: 0, y: y), in: sender)
      return
    }
    if popover.isShown { popover.performClose(sender) }
    else {
      popover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
      popover.contentViewController?.view.window?.makeKey()
    }
  }

  @objc private func showQuickControls() {
    if let button = statusItem?.button { togglePopover(button) }
    else {
      // Keep the shortcut useful even when the menu-bar icon is hidden.
      showHome()
      guard let view = homeWindow?.contentView else { return }
      let y = view.isFlipped ? view.bounds.minY : view.bounds.maxY
      popover.show(relativeTo: NSRect(x: view.bounds.maxX - 36, y: y, width: 1, height: 1), of: view, preferredEdge: .minY)
      popover.contentViewController?.view.window?.makeKey()
    }
  }

  private func statusMenu() -> NSMenu {
    let menu = NSMenu()
    menu.autoenablesItems = false
    func item(_ title: String, _ action: Selector, checked: Bool? = nil, key: String = "") {
      let entry = menu.addItem(withTitle: title, action: action, keyEquivalent: key)
      entry.target = self
      if let checked { entry.state = checked ? .on : .off }
    }
    item("打开家园", #selector(showHome), key: "0")
    item("显示主窗口", #selector(toggleMainWindow), checked: presentation.isMainWindowVisible)
    menu.addItem(.separator())
    item("桌面空调", #selector(toggleDesktopAC), checked: store.showDesktopAC)
    item("桌面遥控器", #selector(toggleDesktopRemote), checked: store.showDesktopRemote)
    item("配件始终置顶", #selector(toggleDesktopLevel), checked: store.desktopAlwaysOnTop)
    menu.addItem(.separator())
    if let release = HomeUpdates.monitor.available {
      item("下载新版本 v\(release.version)…", #selector(downloadUpdate))
    }
    item("设置…", #selector(showSettings), key: ",")
    item("退出云之彼端", #selector(quit), key: "q")
    return menu
  }

  @objc private func checkForUpdates() { HomeUpdates.checkAndReport() }
  @objc private func downloadUpdate() {
    if let release = HomeUpdates.monitor.available { HomeUpdates.open(release) }
  }

  @objc private func toggleMainWindow() { setMainWindowVisible(!presentation.isMainWindowVisible) }
  @objc private func toggleDesktopAC() { store.showDesktopAC.toggle() }
  @objc private func toggleDesktopRemote() { store.showDesktopRemote.toggle() }
  @objc private func toggleDesktopLevel() { store.desktopAlwaysOnTop.toggle() }
  @objc private func quit() { NSApp.terminate(nil) }

  private func observeStore() {
    withObservationTracking {
      _ = store.snapshot
      _ = store.activeCount
      _ = store.haBinding
      _ = store.showDesktopAC
      _ = store.showDesktopRemote
      _ = store.desktopAlwaysOnTop
      _ = store.showMenuBarIcon
    } onChange: { [weak self] in
      Task { @MainActor in
        self?.updateCompanions()
        self?.observeStore()
      }
    }
  }

  private func observeThermalActivity() {
    withObservationTracking {
      updateThermalActivity()
    } onChange: { [weak self] in
      Task { @MainActor in self?.observeThermalActivity() }
    }
  }

  private func updateThermalActivity() {
    thermal.setActive(presentation.isMainWindowVisible || store.showDesktopAC || popover.isShown)
  }

  func popoverDidShow(_ notification: Notification) { updateThermalActivity() }
  func popoverDidClose(_ notification: Notification) { updateThermalActivity() }

  private func updateCompanions() {
    if store.showMenuBarIcon { setUpStatusItem() }
    else if let statusItem {
      popover.performClose(nil)
      NSStatusBar.system.removeStatusItem(statusItem)
      self.statusItem = nil
    }
    let image = NSImage(systemSymbolName: store.activeCount > 0 ? "house.fill" : "house", accessibilityDescription: "云之彼端")
    image?.isTemplate = true
    statusItem?.button?.image = image
    if store.showDesktopAC {
      if desktopPanel == nil { desktopPanel = DesktopACPanel(store: store) }
      desktopPanel?.updateLevel()
      desktopPanel?.orderFrontRegardless()
    } else {
      desktopPanel?.orderOut(nil)
      desktopPanel = nil
    }
    if store.showDesktopRemote {
      if remotePanel == nil { remotePanel = DesktopRemotePanel(store: store) }
      remotePanel?.updateLevel()
      remotePanel?.orderFrontRegardless()
    } else {
      remotePanel?.orderOut(nil)
      remotePanel = nil
    }
    timer?.invalidate()
    if let deadline = store.snapshot.nextAutoOff {
      timer = Timer.scheduledTimer(withTimeInterval: max(0.01, deadline.timeIntervalSinceNow), repeats: false) { [weak self] _ in
        Task { @MainActor in self?.store.expireTimers() }
      }
    }
  }

  @objc private func didWake() { store.expireTimers() }

  private func setUpMenu() {
    let menu = NSMenu()
    let applicationItem = NSMenuItem()
    let applicationMenu = NSMenu()
    applicationMenu.addItem(withTitle: "关于云之彼端", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "").target = NSApp
    applicationMenu.addItem(withTitle: "检查更新…", action: #selector(checkForUpdates), keyEquivalent: "").target = self
    applicationMenu.addItem(.separator())
    applicationMenu.addItem(withTitle: "打开云之彼端", action: #selector(showHome), keyEquivalent: "0").target = self
    applicationMenu.addItem(withTitle: "设置…", action: #selector(showSettings), keyEquivalent: ",").target = self
    let quick = applicationMenu.addItem(withTitle: "家园快捷控制", action: #selector(showQuickControls), keyEquivalent: "k")
    quick.target = self
    quick.keyEquivalentModifierMask = [.command, .shift]
    applicationMenu.addItem(.separator())
    applicationMenu.addItem(withTitle: "隐藏云之彼端", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    applicationMenu.addItem(withTitle: "退出云之彼端", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    applicationItem.submenu = applicationMenu
    menu.addItem(applicationItem)
    let editItem = NSMenuItem()
    let edit = NSMenu(title: "编辑")
    edit.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
    edit.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    edit.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    edit.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    edit.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = edit
    menu.addItem(editItem)
    let windowItem = NSMenuItem()
    let windows = NSMenu(title: "窗口")
    windows.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    windows.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    windowItem.submenu = windows
    menu.addItem(windowItem)
    NSApp.windowsMenu = windows
    NSApp.mainMenu = menu
  }

  private func captureHome(to url: URL) throws {
    guard let view = homeWindow?.contentView,
          let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else {
      throw CocoaError(.fileWriteUnknown)
    }
    view.cacheDisplay(in: view.bounds, to: bitmap)
    guard let data = bitmap.representation(using: .png, properties: [:]) else { throw CocoaError(.fileWriteUnknown) }
    try data.write(to: url)
  }
}
