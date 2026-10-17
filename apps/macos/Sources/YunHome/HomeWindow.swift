import ReleaseCheck
import SwiftUI
import HomeCore

enum HomeDestination: Hashable {
  case overview, room(HomeRoom), device(DeviceKind), haDevice(String), plugin(String), market, settings
}

@MainActor
struct HomeWindow: View {
  @Bindable var store: HomeStore
  @Bindable var presentation: HomeWindowPresentation
  var showQuickControls: () -> Void = {}

  init(store: HomeStore, presentation: HomeWindowPresentation? = nil,
       showQuickControls: @escaping () -> Void = {}) {
    self.store = store
    self.presentation = presentation ?? HomeWindowPresentation()
    self.showQuickControls = showQuickControls
  }

  var body: some View {
    NavigationSplitView {
      List(selection: sidebarSelection) {
        Section {
          Label("我的家", systemImage: "house").tag(HomeDestination.overview)
        }
        Section("房间") {
          ForEach(store.rooms) { room in
            Label(room.name, systemImage: room.symbol)
              .badge(itemCount(in: room))
              .tag(HomeDestination.room(room))
          }
        }
        Section("设备") {
          ForEach(store.virtualDevices) { device in
            HStack {
              Label(device.name, systemImage: device.symbol)
              Spacer()
              if store.isActive(device) {
                Circle().fill(store.tone(for: device).fill).frame(width: 6, height: 6)
                  .accessibilityLabel("正在运行")
              }
            }.tag(HomeDestination.device(device))
          }
        }
        if !store.haDevices.isEmpty {
          Section("真实空调") {
            ForEach(store.haDevices) { device in
              Label(device.label, systemImage: "air.conditioner.horizontal")
                .tag(HomeDestination.haDevice(device.id))
            }
          }
        }
        Section("插件") {
          ForEach(store.snapshot.plugins) { instance in
            HStack {
              Label(instance.name, systemImage: store.symbol(for: instance))
              Spacer()
              if store.isActive(plugin: instance) {
                Circle().fill(PluginTone.color(store.pluginPresentations[instance.id]?.tone)).frame(width: 6, height: 6)
                  .transition(.scale.combined(with: .opacity))
                  .accessibilityLabel("正在运行")
              }
            }
            .tag(HomeDestination.plugin(instance.id))
            .transition(.move(edge: .leading).combined(with: .opacity))
          }
          Label("家电市场", systemImage: "puzzlepiece.extension").tag(HomeDestination.market)
        }
        Section {
          Label("设置", systemImage: "gearshape").tag(HomeDestination.settings)
        }
      }
      .listStyle(.sidebar)
      .animation(.spring(duration: 0.4, bounce: 0.25), value: store.snapshot.plugins.map(\.id))
      .animation(.smooth, value: store.pluginPresentations)
      .navigationTitle("云之彼端")
      .navigationSplitViewColumnWidth(min: 195, ideal: 215, max: 260)
      .safeAreaInset(edge: .bottom) {
        HStack(spacing: 8) {
          Image(systemName: store.haBinding == nil ? "internaldrive" : "network")
            .font(.system(size: 14)).foregroundStyle(.secondary)
          VStack(alignment: .leading, spacing: 3) {
            Text(store.haBinding == nil ? "本机家园" : "Home Assistant").font(.caption.weight(.medium))
            Text(store.haBinding == nil ? "自动保存到此 Mac" : store.homeAssistant.state.name)
              .font(.caption2).foregroundStyle(.secondary)
          }
          Spacer()
        }.padding(16)
      }
    } detail: {
      Group {
        switch presentation.selection ?? .overview {
        case .overview:
          HomeOverview(store: store, room: nil, select: { presentation.selection = .device($0) },
                       selectPlugin: { presentation.selection = .plugin($0) },
                       selectHA: { store.selectHADevice($0); presentation.selection = .haDevice($0) })
        case .room(let room):
          HomeOverview(store: store, room: room, select: { presentation.selection = .device($0) },
                       selectPlugin: { presentation.selection = .plugin($0) },
                       selectHA: { store.selectHADevice($0); presentation.selection = .haDevice($0) })
        case .device(let device): DeviceDetail(store: store, device: device)
        case .haDevice(let id):
          DeviceDetail(store: store, device: .airConditioner).id(id)
        case .plugin(let id):
          PluginDeviceDetail(store: store, instanceID: id, onRemoved: { presentation.selection = .market })
        case .market:
          PluginMarketView(store: store, open: { id in
            withAnimation(.spring(duration: 0.4, bounce: 0.25)) { presentation.selection = .plugin(id) }
          })
        case .settings: HomeSettings(store: store)
        }
      }
      .foregroundStyle(HomeTheme.text, HomeTheme.textSecondary, HomeTheme.textTertiary)
      .background(HomeTheme.paper)
    }
    .onChange(of: store.selectedHAID) { _, id in
      if case .haDevice = presentation.selection {
        presentation.selection = id.map(HomeDestination.haDevice) ?? .device(.airConditioner)
      }
    }
    .tint(HomeTheme.brand)
    .frame(minWidth: 880, minHeight: 620)
    .toolbar {
      ToolbarItemGroup(placement: .primaryAction) {
        Menu {
          Toggle("桌面空调", isOn: $store.showDesktopAC)
          Toggle("桌面遥控器", isOn: $store.showDesktopRemote)
          Divider()
          Toggle("配件始终置顶", isOn: $store.desktopAlwaysOnTop)
            .disabled(!store.showDesktopAC && !store.showDesktopRemote)
        } label: { Label("桌面配件", systemImage: "desktopcomputer") }
        .accessibilityLabel("桌面配件")
        .help("显示或隐藏桌面配件")
        Button(action: showQuickControls) { Label("快捷控制", systemImage: "slider.horizontal.3") }
          .help("快捷控制（⌘⇧K）")
        Button { presentation.selection = .settings } label: { Label("设置", systemImage: "gearshape") }
          .help("设置（⌘,）")
      }
    }
  }

  private var sidebarSelection: Binding<HomeDestination?> {
    Binding(get: { presentation.selection }, set: { destination in
      // Switching between two AC rows can reuse the detail view without a new
      // onAppear. Select the command target as part of the navigation itself.
      if case .haDevice(let id) = destination { store.selectHADevice(id) }
      presentation.selection = destination
    })
  }

  private func itemCount(in room: HomeRoom) -> Int {
    let devices = store.virtualDevices.filter { store.snapshot.room(for: $0) == room }.count
    let plugins = store.snapshot.plugins.filter { $0.room == room }.count
    return devices + plugins + store.haDevices.filter { $0.room == room }.count
  }
}

struct HomeOverview: View {
  @Bindable var store: HomeStore
  let room: HomeRoom?
  let select: (DeviceKind) -> Void
  var selectPlugin: (String) -> Void = { _ in }
  var selectHA: (String) -> Void = { _ in }
  private var devices: [DeviceKind] {
    store.virtualDevices.filter { room == nil || store.snapshot.room(for: $0) == room }
  }
  private var plugins: [PluginInstance] { store.snapshot.plugins.filter { room == nil || $0.room == room } }
  private var realDevices: [HADeviceBinding] { store.haDevices.filter { room == nil || $0.room == room } }
  private var deviceCount: Int { devices.count + plugins.count + realDevices.count }
  private var runningCount: Int { devices.filter { store.isActive($0) }.count + plugins.filter { store.isActive(plugin: $0) }.count + realDevices.filter { store.isHAActive($0.id) }.count }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 7) {
            Text(room?.name ?? "我的家")
              .font(.system(size: 30, weight: .bold))
            Text(room == nil ? "所有房间与设备，尽在掌握。" : "查看和管理这个房间里的设备。")
              .font(.callout).foregroundStyle(.secondary)
          }
          Spacer()
          HomeStatusBadge(title: store.haBinding == nil ? "本机家园" : store.homeAssistant.state.name,
                          symbol: store.haBinding == nil ? "internaldrive" : "network")
        }

        HomeCard {
          HStack(spacing: 22) {
            Image(systemName: room?.symbol ?? "house.fill")
              .font(.system(size: 30, weight: .light)).symbolRenderingMode(.hierarchical)
              .foregroundStyle(HomeTheme.brand)
              .frame(width: 62, height: 62)
              .background(HomeTheme.brandSoft, in: RoundedRectangle(cornerRadius: 16))
              .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
              Text(runningCount == 0 ? "\(room?.name ?? "家里")，一切安静" : "\(runningCount) 台设备正在运行")
                .font(.title3.weight(.semibold))
              Text(room == nil ? "\(store.rooms.count) 个房间 · \(deviceCount) 台设备" : "房间内共 \(deviceCount) 台设备")
                .font(.callout).foregroundStyle(.secondary)
            }
            Spacer(minLength: 12)
            Button(room == nil ? "全部关闭" : "关闭全屋", systemImage: "power") { store.send(.allOff) }
              .disabled(store.activeCount == 0).controlSize(.regular)
          }.padding(2)
        }

        HomeSectionHeading(title: room == nil ? "所有设备" : "房间设备", detail: "\(deviceCount) 台设备")
        if deviceCount == 0 {
          ContentUnavailableView("房间还很安静", systemImage: "sofa", description: Text("在设备详情中选择这个房间，就能把设备移到这里。"))
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 240), spacing: 16)], spacing: 16) {
          ForEach(devices) { device in
            DeviceTile(store: store, device: device, select: { select(device) })
          }
          ForEach(realDevices) { device in
            HADeviceTile(store: store, device: device, select: { selectHA(device.id) })
          }
          ForEach(plugins) { instance in
            PluginDeviceTile(store: store, instance: instance, select: { selectPlugin(instance.id) })
              .transition(.scale(scale: 0.92).combined(with: .opacity))
          }
        }
        .animation(.spring(duration: 0.4, bounce: 0.25), value: plugins.map(\.id))
        Label(store.haBinding == nil ? "设备在本机模拟，可在空调详情中连接真实设备。" : "空调通过 Home Assistant 连接，其余设备在本机模拟。", systemImage: "info.circle")
          .font(.caption).foregroundStyle(.secondary)
        if let message = store.storageMessage {
          Label(message, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange)
        }
      }.padding(HomeTheme.contentPadding)
        .frame(maxWidth: 1100).frame(maxWidth: .infinity)
    }
    .navigationTitle(room?.name ?? "我的家")
  }
}

struct DeviceTile: View {
  let store: HomeStore
  let device: DeviceKind
  let select: () -> Void
  @State private var hovered = false
  private var active: Bool { store.isActive(device) }

  var body: some View {
    HomeCard {
      VStack(alignment: .leading, spacing: 17) {
        HStack {
          Button(action: select) { DeviceBadge(device: device, size: 44) }
            .buttonStyle(.plain).accessibilityLabel("查看\(device.name)")
          Spacer()
          Button { store.toggle(device) } label: {
            Image(systemName: device == .robotVacuum ? (active ? "pause.fill" : "play.fill") : "power")
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(active ? store.tone(for: device).on : HomeTheme.textSecondary)
              .frame(width: 30, height: 30)
              .background(active ? store.tone(for: device).fill : HomeTheme.surfaceInset, in: Circle())
          }.buttonStyle(.plain)
            .disabled(device == .airConditioner && !store.acCanControl)
            .help(active ? "关闭或暂停设备" : "开启设备")
            .accessibilityLabel("\(active ? "关闭或暂停" : "开启")\(device.name)")
        }
        Button(action: select) {
          VStack(alignment: .leading, spacing: 7) {
            Text(device.name).font(.headline).foregroundStyle(.primary)
            Text(store.status(for: device)).font(.subheadline).foregroundStyle(.secondary)
              .lineLimit(1)
            HStack {
              Label(store.snapshot.room(for: device).name, systemImage: store.snapshot.room(for: device).symbol)
              Spacer()
              Image(systemName: "chevron.right").font(.system(size: 10, weight: .semibold))
            }.font(.caption).foregroundStyle(.tertiary).padding(.top, 7)
          }.frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
        }.buttonStyle(.plain)
      }
    }
    .overlay(RoundedRectangle(cornerRadius: HomeTheme.cornerRadius)
      .strokeBorder(HomeTheme.brand.opacity(hovered ? 0.32 : 0), lineWidth: 1))
    .onHover { hovered = $0 }
    .animation(.easeOut(duration: 0.15), value: hovered)
  }
}

struct HomeSettings: View {
  @Bindable var store: HomeStore
  var body: some View {
    Form {
      Section("Home Assistant") { HAConnectionSummary(store: store) }
      Section("菜单栏") {
        Toggle("在菜单栏显示图标", isOn: $store.showMenuBarIcon)
        Text("点击图标打开快捷控制，右键切换显示。隐藏图标后，仍可从 Dock 重新打开家园。")
          .font(.caption).foregroundStyle(.secondary)
      }
      Section("桌面配件") {
        DesktopCompanionControls(store: store)
        Text("空调双击开关；遥控器点击按键。拖动机身移动，右键打开菜单。位置会自动记住。")
          .font(.caption).foregroundStyle(.secondary)
      }
      Section("家园数据") {
        LabeledContent("保存位置", value: "此 Mac · 自动保存")
        LabeledContent("设备连接", value: store.haBinding == nil ? "本机虚拟设备" : "Home Assistant 真实空调")
        Text("原生版的存档与网页版独立。账号登录和云端同步请使用网页版。")
          .font(.callout).foregroundStyle(.secondary)
        Link("打开 Home 网页版", destination: URL(string: "https://home.yunle.fun")!)
      }
      Section("软件更新") { UpdateSettings(updates: HomeUpdates.monitor) }
      Section("关于") {
        LabeledContent("云之彼端 · Yun Home", value: AppVersion.current ?? "开发版本")
        Text("从一台小空调，到一个随时可以回来的家。")
        Link("空调模型与原生实现来源", destination: URL(string: "https://github.com/YunYouJun/air-conditioner/tree/main/apps/macos")!)
      }
    }.formStyle(.grouped).navigationTitle("设置")
  }
}

/// Automatic daily check, a manual check and the download link when newer.
struct UpdateSettings: View {
  @ObservedObject var updates: UpdateMonitor
  var body: some View {
    Toggle("自动检查更新", isOn: Binding(get: { updates.automaticChecks }, set: { updates.automaticChecks = $0 }))
    HStack {
      Text(statusText).foregroundStyle(.secondary)
      Spacer()
      if let release = updates.available {
        Button("下载 v\(release.version)") { HomeUpdates.open(release) }.homeProminent()
      } else {
        Button("检查更新") { Task { await updates.check() } }.disabled(updates.status == .checking)
      }
    }
    Text("每天最多查询一次 GitHub Releases，只读取公开的版本信息。下载后解压并替换旧的 YunHome.app，家园存档不受影响。")
      .font(.caption).foregroundStyle(.secondary)
  }

  private var statusText: String {
    switch updates.status {
    case .checking: "正在检查…"
    case .upToDate: "已是最新版本"
    case .available(let release): "有新版本 v\(release.version)"
    case .failed(let reason): reason
    case .idle: "当前版本 v\(AppVersion.current ?? "开发版本")"
    }
  }
}

#Preview("我的家") {
  HomeWindow(store: HomeStore(defaults: UserDefaults(suiteName: "fun.yunle.home.preview")!))
}
