import SwiftUI
import HomeCore
import HomePlugins

struct DesktopCompanionControls: View {
  @Bindable var store: HomeStore
  var body: some View {
    HomeVisibilityToggle(title: "桌面空调", symbol: "air.conditioner.horizontal", isOn: $store.showDesktopAC)
    HomeVisibilityToggle(title: "桌面遥控器", symbol: "appletvremote.gen4", isOn: $store.showDesktopRemote)
    HomeVisibilityToggle(title: "配件始终置顶", symbol: "pin", isOn: $store.desktopAlwaysOnTop)
      .disabled(!store.showDesktopAC && !store.showDesktopRemote)
  }
}

struct HomeVisibilityToggle: View {
  let title: String
  let symbol: String
  @Binding var isOn: Bool
  var body: some View {
    HStack(spacing: 10) {
      Label(title, systemImage: symbol)
      Spacer(minLength: 8)
      Toggle(title, isOn: $isOn).labelsHidden().accessibilityLabel(title)
    }
  }
}

struct QuickControls: View {
  @Bindable var store: HomeStore
  @Bindable var presentation: HomeWindowPresentation
  let setMainWindowVisible: (Bool) -> Void
  let openHome: () -> Void
  let openDevice: (DeviceKind) -> Void
  var openPlugin: (String) -> Void = { _ in }
  let openSettings: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack(spacing: 10) {
        Image(systemName: "house.fill")
          .font(.system(size: 20, weight: .medium)).foregroundStyle(HomeTheme.moss)
          .frame(width: 38, height: 38)
          .background(HomeTheme.moss.opacity(0.1), in: RoundedRectangle(cornerRadius: 11))
        VStack(alignment: .leading, spacing: 3) {
          Text("云之彼端").font(.headline)
          Text("\(store.activeCount) 台设备运行中").font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        Button(action: openSettings) { Image(systemName: "gearshape") }
          .buttonStyle(.borderless).help("设置…").accessibilityLabel("打开设置")
      }
      Divider()
      VStack(spacing: 13) {
        ForEach(DeviceKind.allCases) { device in
          QuickDeviceRow(store: store, device: device, open: { openDevice(device) })
        }
        ForEach(store.snapshot.plugins) { instance in
          QuickPluginRow(store: store, instance: instance, open: { openPlugin(instance.id) })
        }
      }
      Divider()
      VStack(alignment: .leading, spacing: 11) {
        Text("显示").font(.caption.weight(.medium)).foregroundStyle(.secondary)
        HomeVisibilityToggle(title: "显示主窗口", symbol: "macwindow",
                             isOn: Binding(get: { presentation.isMainWindowVisible }, set: setMainWindowVisible))
        DesktopCompanionControls(store: store)
      }
      .toggleStyle(.switch).controlSize(.small).font(.callout)
      Divider()
      HStack {
        Button("打开家园", systemImage: "arrow.up.right.square", action: openHome)
          .buttonStyle(.borderless)
        Spacer()
        Button("退出") { NSApp.terminate(nil) }
          .buttonStyle(.borderless).foregroundStyle(.secondary)
      }.font(.callout)
    }
    .padding(18).frame(width: 336)
  }
}

private struct QuickDeviceRow: View {
  let store: HomeStore
  let device: DeviceKind
  let open: () -> Void
  var body: some View {
    HStack(spacing: 12) {
      Button(action: open) {
        HStack(spacing: 10) {
          DeviceBadge(device: device, size: 34)
          VStack(alignment: .leading, spacing: 3) {
            Text(device.name).font(.callout.weight(.medium)).foregroundStyle(.primary)
            Text(store.status(for: device)).font(.caption).foregroundStyle(.secondary)
              .lineLimit(1).truncationMode(.tail)
          }
          Spacer(minLength: 0)
        }.contentShape(Rectangle())
      }.buttonStyle(.plain).accessibilityLabel("打开\(device.name)详情")
      Toggle(device.name, isOn: Binding(
        get: { store.isActive(device) }, set: { _ in store.toggle(device) }
      )).labelsHidden().toggleStyle(.switch).controlSize(.small)
        .disabled(device == .airConditioner && !store.acCanControl)
        .accessibilityLabel("\(device.name)电源")
    }
  }
}

private struct QuickPluginRow: View {
  let store: HomeStore
  let instance: PluginInstance
  let open: () -> Void
  private var power: JSONValue? { store.installedPlugin(for: instance)?.package.controls.power?.action }
  var body: some View {
    HStack(spacing: 12) {
      Button(action: open) {
        HStack(spacing: 10) {
          PluginBadge(symbol: store.symbol(for: instance), tint: store.tint(for: instance), size: 34)
          VStack(alignment: .leading, spacing: 3) {
            Text(instance.name).font(.callout.weight(.medium)).foregroundStyle(.primary)
            Text(store.status(for: instance)).font(.caption).foregroundStyle(.secondary)
              .lineLimit(1).truncationMode(.tail).contentTransition(.numericText())
          }
          Spacer(minLength: 0)
        }.contentShape(Rectangle())
      }.buttonStyle(.plain).accessibilityLabel("打开\(instance.name)详情")
      Toggle(instance.name, isOn: Binding(
        get: { store.isActive(plugin: instance) },
        set: { _ in if let power { store.send(plugin: instance.id, action: power) } }
      )).labelsHidden().toggleStyle(.switch).controlSize(.small)
        .disabled(power == nil)
        .accessibilityLabel("\(instance.name)电源")
    }
  }
}
