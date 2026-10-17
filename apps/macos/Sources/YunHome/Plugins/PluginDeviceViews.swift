import SwiftUI
import HomeCore
import HomePlugins

// MARK: Appearance

extension Color {
  /// `#RRGGBB` from a plugin manifest; nil when malformed.
  init?(pluginHex hex: String?) {
    guard let hex, hex.count == 7, hex.hasPrefix("#"), let value = UInt32(hex.dropFirst(), radix: 16) else { return nil }
    self.init(red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255)
  }
}

enum PluginTone {
  /// The Home tone for a plugin's `tone`; nil while idle or unknown.
  static func tone(_ tone: String?) -> HomeTone? {
    switch tone {
    case "cool": .cool
    case "heat": .heat
    case "warm": .warm
    case "active": .running
    default: nil
    }
  }
  static func color(_ tone: String?) -> Color { self.tone(tone)?.fill ?? HomeTheme.textTertiary }
}

struct PluginBadge: View {
  let symbol: String
  let tint: Color
  var size: CGFloat = 42
  var body: some View {
    Image(systemName: symbol)
      .font(.system(size: size * 0.43, weight: .medium))
      .symbolRenderingMode(.hierarchical)
      .foregroundStyle(tint)
      .frame(width: size, height: size)
      .background(tint.opacity(0.11), in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
      .accessibilityHidden(true)
  }
}

extension HomeStore {
  func tint(for instance: PluginInstance) -> Color {
    Color(pluginHex: installedPlugin(for: instance)?.manifest.tint) ?? HomeTheme.brand
  }
  func symbol(for instance: PluginInstance) -> String {
    installedPlugin(for: instance)?.manifest.symbol ?? "puzzlepiece.extension"
  }
  /// The plugin's own icon; a market plugin whose package has none uses the reviewed catalog's.
  func appIcon(for instance: PluginInstance) -> PluginIcon? {
    guard let plugin = installedPlugin(for: instance) else { return nil }
    if let icon = plugin.manifest.appIcon { return icon }
    return plugin.verified ? BundledPluginCatalog.entries.first { $0.id == plugin.id }?.appIcon : nil
  }
}

/// An installed plugin device's icon, running while the device is on.
struct PluginInstanceIcon: View {
  let store: HomeStore
  let instance: PluginInstance
  var size: CGFloat = 42
  var body: some View {
    PluginAppIcon(icon: store.appIcon(for: instance), symbol: store.symbol(for: instance), tint: store.tint(for: instance),
                  active: store.isActive(plugin: instance), tone: store.pluginPresentations[instance.id]?.tone, size: size,
                  speed: store.pluginPresentations[instance.id]?.motionSpeed ?? 1)
  }
}

// MARK: Tile

struct PluginDeviceTile: View {
  let store: HomeStore
  let instance: PluginInstance
  let select: () -> Void
  @State private var hovered = false
  private var presentation: PluginPresentation? { store.pluginPresentations[instance.id] }
  private var active: Bool { store.isActive(plugin: instance) }
  private var power: PluginControl? { store.installedPlugin(for: instance)?.package.controls.power }

  var body: some View {
    HomeCard {
      VStack(alignment: .leading, spacing: 17) {
        HStack {
          Button(action: select) { PluginInstanceIcon(store: store, instance: instance, size: 44) }
            .buttonStyle(.plain).accessibilityLabel("查看\(instance.name)")
          Spacer()
          if let power, let action = power.action {
            Button { store.send(plugin: instance.id, action: action) } label: {
              Image(systemName: "power")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(active ? (PluginTone.tone(presentation?.tone) ?? .running).on : HomeTheme.textSecondary)
                .frame(width: 30, height: 30)
                .background(active ? (PluginTone.tone(presentation?.tone) ?? .running).fill : HomeTheme.surfaceInset, in: Circle())
                .symbolEffect(.bounce, value: active)
            }.buttonStyle(.plain)
              .help(active ? "关闭设备" : "开启设备")
              .accessibilityLabel("\(active ? "关闭" : "开启")\(instance.name)")
          }
        }
        Button(action: select) {
          VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 6) {
              Text(instance.name).font(.headline).foregroundStyle(.primary)
              Image(systemName: "puzzlepiece.extension.fill").font(.caption2).foregroundStyle(.tertiary)
                .help("第三方插件")
            }
            Text(store.status(for: instance)).font(.subheadline).foregroundStyle(.secondary)
              .lineLimit(1).contentTransition(.numericText())
            HStack {
              Label(instance.room.name, systemImage: instance.room.symbol)
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
    .animation(.smooth, value: presentation)
  }
}

// MARK: Detail

struct PluginDeviceDetail: View {
  @Bindable var store: HomeStore
  let instanceID: String
  var onRemoved: () -> Void = {}
  @State private var confirmingRemoval = false
  @State private var updating = false
  @State private var updateError: String?

  /// A catalog update that asks for new permissions waits here for consent.
  private func updateCard(_ update: PluginUpdate) -> some View {
    HomeCard {
      VStack(alignment: .leading, spacing: 10) {
        Label("有新版本 v\(update.version)", systemImage: "arrow.down.circle").font(.headline)
        Text("新版本需要额外的权限：").font(.callout).foregroundStyle(.secondary)
        ForEach(update.addedPermissions, id: \.self) { permission in
          Label(PluginPermission.describe(permission), systemImage: "key").font(.callout)
        }
        if let updateError {
          Label(updateError, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange)
        }
        HStack {
          Spacer()
          Button {
            Task {
              updating = true
              defer { updating = false }
              guard let directory = BundledPluginCatalog.directory else { return }
              do {
                try await store.applyPluginUpdate(update.id, from: directory)
                updateError = nil
              } catch {
                updateError = error.localizedDescription
              }
            }
          } label: {
            if updating { ProgressView().controlSize(.small) } else { Text("允许并更新") }
          }
          .homeProminent()
          .disabled(updating)
        }
      }
    }
  }

  var body: some View {
    if let instance = store.snapshot.plugin(instanceID) {
      content(instance)
    } else {
      ContentUnavailableView("设备已移除", systemImage: "puzzlepiece.extension", description: Text("这个插件设备已被卸载。"))
    }
  }

  private func content(_ instance: PluginInstance) -> some View {
    let plugin = store.installedPlugin(for: instance)
    let presentation = store.pluginPresentations[instance.id]
    return ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        HStack(spacing: 14) {
          PluginInstanceIcon(store: store, instance: instance, size: 52)
          VStack(alignment: .leading, spacing: 6) {
            Text(instance.name).font(.title2.weight(.semibold))
            Text(store.status(for: instance)).foregroundStyle(.secondary).contentTransition(.numericText())
          }
          Spacer()
          Picker("所在房间", selection: Binding(get: { instance.room }, set: { store.move(plugin: instance.id, to: $0) })) {
            ForEach(HomeRoom.allCases) { Text($0.name).tag($0) }
          }.frame(width: 160)
        }

        if let plugin {
          if plugin.manifest.renderer == "cute-ac-3d" {
            PluginACStage(state: instance.state, tone: presentation?.tone,
                          room: plugin.grants(PluginPermission.thermal) ? store.room : nil)
          }
          HomeCard {
            PluginControlsView(controls: plugin.package.controls, state: instance.state, tone: presentation?.tone) { action in
              store.send(plugin: instance.id, action: action)
            }
          }
          if let error = store.pluginErrors[instance.id] {
            Label(error, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange)
          }
          if let update = store.pluginUpdates[plugin.id] { updateCard(update) }
          PluginProvenance(plugin: plugin)
          Button("卸载插件…", systemImage: "trash", role: .destructive) { confirmingRemoval = true }
            .controlSize(.small)
            .confirmationDialog("卸载“\(plugin.manifest.name)”？", isPresented: $confirmingRemoval) {
              Button("卸载", role: .destructive) {
                Task { await store.uninstall(plugin: plugin.id); onRemoved() }
              }
            } message: { Text("插件文件和它的设备状态都会被删除。") }
        } else {
          ContentUnavailableView("插件未安装", systemImage: "puzzlepiece.extension",
                                 description: Text("在家电市场重新安装后即可恢复控制。"))
        }
      }.padding(HomeTheme.contentPadding).frame(maxWidth: 1050)
        .frame(maxWidth: .infinity)
        .animation(.smooth, value: presentation)
    }.navigationTitle(instance.name)
  }
}

/// Where a plugin came from and what it may do.
struct PluginProvenance: View {
  let plugin: InstalledPlugin

  /// Official-only permissions a third-party plugin asked for are listed as refused.
  private var permissionSummary: String {
    let permissions = plugin.manifest.permissions
    if permissions.isEmpty { return "未申请任何权限" }
    let labels = permissions.map { plugin.grants($0) || !PluginPermission.officialOnly.contains($0) ? $0 : "\($0)（仅官方插件，未授予）" }
    return "权限：\(labels.joined(separator: "、"))"
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Label(plugin.isOfficial ? "官方插件 · 在沙箱中运行"
              : plugin.verified ? "已认证插件 · 在沙箱中运行" : "未认证插件 · 在沙箱中运行，请确认来源可信",
            systemImage: plugin.verified ? "checkmark.seal" : "exclamationmark.shield")
        .foregroundStyle(plugin.verified ? AnyShapeStyle(.secondary) : AnyShapeStyle(.orange))
      Text("\(plugin.manifest.author.name) · v\(plugin.manifest.version) · \(permissionSummary)")
        .foregroundStyle(.tertiary)
    }.font(.caption)
  }
}

/// The host's 3D air conditioner, driven by a plugin's state.
struct PluginACStage: View {
  let state: JSONValue
  let tone: String?
  /// Only set for plugins granted `sensor:thermal`.
  var room: RoomReading?
  private var acState: ACState {
    ACState(status: state["status"]?.boolValue ?? false,
            mode: state["mode"]?.stringValue == "hot" ? .hot : .cold,
            temperature: state["temperature"]?.numberValue ?? 26,
            fan: state["fan"]?.stringValue.flatMap(ACFanSpeed.init(rawValue:)) ?? .auto)
  }
  var body: some View {
    ACPreview(state: acState, room: room)
      .frame(maxWidth: .infinity).frame(height: 220)
      .padding(16)
      .background(HomeTheme.modelBackground, in: RoundedRectangle(cornerRadius: HomeTheme.cornerRadius, style: .continuous))
      .overlay(alignment: .topTrailing) {
        HomeStatusBadge(title: acState.status ? (acState.mode == .cold ? "制冷中" : "制热中") : "待机",
                        symbol: acState.status ? (acState.mode == .cold ? "snowflake" : "sun.max.fill") : "power",
                        tone: acState.status ? PluginTone.tone(tone) : nil)
          .padding(12)
      }
      .overlay(RoundedRectangle(cornerRadius: HomeTheme.cornerRadius).strokeBorder(HomeTheme.edge, lineWidth: 1))
  }
}

// MARK: Declarative controls

/// Renders `controls.json` with native controls. Every interaction becomes one
/// action sent to the plugin; nothing here runs plugin code.
struct PluginControlsView: View {
  let controls: PluginControls
  let state: JSONValue
  let tone: String?
  let send: (JSONValue) -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      ForEach(Array(controls.controls.enumerated()), id: \.offset) { index, control in
        if index > 0 { Divider() }
        row(control)
      }
    }
  }

  @ViewBuilder private func row(_ control: PluginControl) -> some View {
    switch control.type {
    case .power:
      let on = state[control.bind]?.boolValue ?? false
      HStack {
        Label(control.label, systemImage: "power").font(.headline)
        Spacer()
        Button { control.action.map(send) } label: {
          Label(on ? "关闭" : "开启", systemImage: "power").symbolEffect(.bounce, value: on)
        }
        .homeProminent(on ? PluginTone.tone(tone) ?? .running : .brand).controlSize(.large)
        .accessibilityLabel(on ? "关闭\(control.label)" : "开启\(control.label)")
      }
    case .dial:
      PluginDial(control: control, value: state[control.bind]?.numberValue, tone: tone, send: send)
    case .stepper:
      let value = state[control.bind]?.numberValue
      HStack {
        Text(control.label)
        Spacer()
        Text(value.map { "\(format($0))\(control.unit ?? "")" } ?? "—").monospacedDigit().contentTransition(.numericText())
        ControlGroup {
          Button { control.decrement.map(send) } label: { Image(systemName: "minus") }
            .disabled(value.map { $0 <= (control.min ?? -.infinity) } ?? true).accessibilityLabel("减少\(control.label)")
          Button { control.increment.map(send) } label: { Image(systemName: "plus") }
            .disabled(value.map { $0 >= (control.max ?? .infinity) } ?? true).accessibilityLabel("增加\(control.label)")
        }.fixedSize()
      }
    case .segmented:
      HStack {
        Text(control.label)
        Spacer(minLength: 16)
        Picker(control.label, selection: Binding(
          get: { state[control.bind] ?? .null },
          set: { value in
            if let action = control.options?.first(where: { $0.value == value })?.action { send(action) }
          }
        )) {
          ForEach(control.options ?? []) { option in
            if let symbol = option.symbol { Label(option.label, systemImage: symbol).tag(option.value) }
            else { Text(option.label).tag(option.value) }
          }
        }.pickerStyle(.segmented).labelsHidden().frame(maxWidth: 320)
      }
    case .slider:
      PluginSlider(control: control, value: state[control.bind]?.numberValue, send: send)
    }
  }
}

private func format(_ value: Double) -> String { value.formatted(.number.precision(.fractionLength(0...2))) }

/// Arc gauge with step buttons; the knob and number animate on each change.
struct PluginDial: View {
  let control: PluginControl
  let value: Double?
  let tone: String?
  let send: (JSONValue) -> Void
  private var minimum: Double { control.min ?? 0 }
  private var maximum: Double { control.max ?? 1 }
  private var ratio: Double {
    guard let value, maximum > minimum else { return 0 }
    return min(1, max(0, (value - minimum) / (maximum - minimum)))
  }

  var body: some View {
    HStack(spacing: 28) {
      ZStack {
        Circle().trim(from: 0, to: 0.75)
          .stroke(HomeTheme.surfaceInset, style: StrokeStyle(lineWidth: 12, lineCap: .round))
          .rotationEffect(.degrees(135))
        Circle().trim(from: 0, to: 0.75 * ratio)
          .stroke(AngularGradient(colors: [HomeTone.cool.fill, HomeTone.warm.fill, HomeTone.heat.fill], center: .center,
                                  startAngle: .degrees(0), endAngle: .degrees(270)),
                  style: StrokeStyle(lineWidth: 12, lineCap: .round))
          .rotationEffect(.degrees(135))
          .opacity(tone == nil || tone == "idle" ? 0.45 : 1)
        VStack(spacing: 2) {
          HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text(value.map(format) ?? "—")
              .font(.system(size: 40, weight: .medium, design: .rounded)).monospacedDigit()
              .contentTransition(.numericText(value: value ?? 0))
            Text(control.unit ?? "").font(.callout).foregroundStyle(.secondary)
          }
          Text(control.label).font(.caption).foregroundStyle(.secondary)
        }
      }
      .frame(width: 168, height: 168)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(control.label)
      .accessibilityValue(value.map { "\(format($0))\(control.unit ?? "")" } ?? "未知")
      .accessibilityAdjustableAction { direction in
        switch direction {
        case .increment: control.increment.map(send)
        case .decrement: control.decrement.map(send)
        @unknown default: break
        }
      }

      VStack(alignment: .leading, spacing: 10) {
        Text("\(format(minimum))–\(format(maximum))\(control.unit ?? "") · 步长 \(format(control.step ?? 1))")
          .font(.caption).foregroundStyle(.secondary)
        ControlGroup {
          Button { control.decrement.map(send) } label: { Image(systemName: "minus") }
            .disabled((value ?? minimum) <= minimum).accessibilityLabel("降低\(control.label)").help("降低")
          Button { control.increment.map(send) } label: { Image(systemName: "plus") }
            .disabled((value ?? maximum) >= maximum).accessibilityLabel("升高\(control.label)").help("升高")
        }.controlSize(.large).fixedSize()
      }
      Spacer(minLength: 0)
    }
    .animation(.spring(duration: 0.45, bounce: 0.3), value: ratio)
  }
}

/// Slider that sends one action when dragging ends, not on every frame.
struct PluginSlider: View {
  let control: PluginControl
  let value: Double?
  let send: (JSONValue) -> Void
  @State private var draft: Double?

  var body: some View {
    let minimum = control.min ?? 0, maximum = control.max ?? 1
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text(control.label)
        Spacer()
        Text("\(format(draft ?? value ?? minimum))\(control.unit ?? "")").monospacedDigit().foregroundStyle(.secondary)
      }
      Slider(value: Binding(get: { draft ?? value ?? minimum }, set: { draft = $0 }), in: minimum...maximum) { editing in
        guard !editing, let draft, let template = control.action else { return }
        send(template.substituting(.number(draft)))
        self.draft = nil
      }
    }
  }
}
