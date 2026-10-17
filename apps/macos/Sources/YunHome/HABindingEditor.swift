import SwiftUI
import HomeCore
import HomeDeviceKit

struct HABindingEditor: View {
  let store: HomeStore
  @Environment(\.dismiss) private var dismiss
  @State private var candidate = HomeAssistantClimate()
  @State private var discovery = HADiscovery()
  @State private var address = "http://homeassistant.local:8123"
  @State private var token = ""
  @State private var selected = ""
  @State private var busy = false
  @State private var tested = false
  @State private var adopted = false
  @State private var searched = false
  @State private var errorMessage: String?
  @State private var connectionTask: Task<Void, Never>?

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        Image(systemName: "house.and.flag").font(.title).foregroundStyle(HomeTheme.moss)
        VStack(alignment: .leading, spacing: 4) {
          Text("连接真实空调").font(.title2.weight(.semibold))
          Text("先在 Home Assistant 中接入空调，再选择对应实体。")
            .font(.callout).foregroundStyle(.secondary)
        }
      }
      Divider()
      VStack(alignment: .leading, spacing: 8) {
        Text("Home Assistant 地址").font(.headline)
        TextField("http://homeassistant.local:8123", text: $address).textFieldStyle(.roundedBorder)
          .accessibilityLabel("Home Assistant 地址")
        HStack {
          Button(discovery.searching ? "正在查找…" : "查找 Home Assistant", systemImage: "network") {
            searched = true
            discovery.start()
          }.disabled(discovery.searching || busy)
          if discovery.searching { ProgressView().controlSize(.small) }
        }
        Text("查找本机及局域网中的 HA；发现后仍需访问令牌。")
          .font(.caption).foregroundStyle(.secondary)
        ForEach(discovery.servers) { server in
          Button {
            address = server.endpoint.baseURL.absoluteString
          } label: {
            HStack {
              Label(server.name, systemImage: "house")
              Spacer()
              Text(server.endpoint.baseURL.absoluteString).font(.caption).foregroundStyle(.secondary)
            }
          }.buttonStyle(.bordered)
        }
        if let error = discovery.error { Text(error).font(.caption).foregroundStyle(.secondary) }
        else if searched && !discovery.searching && discovery.servers.isEmpty {
          Text("未发现服务。请确认 HA 已运行；局域网发现需处于同一网络并启用 zeroconf。也可以手动填写地址。")
            .font(.caption).foregroundStyle(.secondary)
        }
      }
      VStack(alignment: .leading, spacing: 8) {
        Text("长期访问令牌").font(.headline)
        SecureField("在 Home Assistant 个人资料中创建", text: $token).textFieldStyle(.roundedBorder)
          .accessibilityLabel("Home Assistant 长期访问令牌")
        Text("测试连接只读取设备。保存绑定时，令牌才会存入此 Mac 的钥匙串。")
          .font(.caption).foregroundStyle(.secondary)
      }
      HStack {
        Button("测试连接", systemImage: "bolt.horizontal.circle") { testConnection() }
          .disabled(busy || token.isEmpty || address.isEmpty)
        if busy { ProgressView().controlSize(.small); Text("正在读取设备…").font(.caption) }
        if tested { Label("连接成功", systemImage: "checkmark.circle").foregroundStyle(HomeTheme.moss) }
      }
      if tested {
        if candidate.entities.isEmpty {
          Text("HA 中还没有 climate 空调实体。请先安装小米等设备集成，并确认 HA 可以控制空调。")
            .font(.callout).foregroundStyle(.secondary)
        } else {
          Picker("空调实体", selection: $selected) {
            Text("请选择空调").tag("")
            ForEach(candidate.entities) { entity in
              Text("\(entity.name) · \(entity.id)\(entity.unsupportedReason == nil ? "" : " · 暂不支持")")
                .tag(entity.id).disabled(entity.unsupportedReason != nil)
            }
          }
          if let entity = candidate.entities.first(where: { $0.id == selected }) {
            Text(entity.unsupportedReason ?? "\(haModeName(entity.mode)) · \(entity.minimum.formatted())–\(entity.maximum.formatted())°C · 步进 \(entity.step.formatted())°C")
              .font(.caption).foregroundStyle(.secondary)
          }
        }
      }
      if let errorMessage {
        Label(errorMessage, systemImage: "exclamationmark.triangle").font(.callout).foregroundStyle(.orange)
      }
      HStack(spacing: 20) {
        Link("安装 Home Assistant", destination: URL(string: "https://www.home-assistant.io/installation/")!)
        Link("小米官方集成", destination: URL(string: "https://github.com/XiaoMi/ha_xiaomi_home")!)
      }.font(.caption)
      Divider()
      HStack {
        Button("取消", role: .cancel) { dismiss() }.keyboardShortcut(.cancelAction)
        Spacer()
        Button("保存绑定") {
          do {
            try store.bindHomeAssistant(candidate, entityID: selected)
            adopted = true
            token = ""
            dismiss()
          } catch { errorMessage = (error as? HAError ?? .credentialStore).localizedDescription }
        }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
          .disabled(!tested || selected.isEmpty || busy || candidate.state != .online)
      }
    }
    .padding(26).frame(width: 580).tint(HomeTheme.moss)
    .onAppear { if let binding = store.haBinding { address = binding.endpoint.baseURL.absoluteString } }
    .onChange(of: address) { _, _ in invalidateTest() }
    .onChange(of: token) { _, _ in invalidateTest() }
    .onDisappear {
      connectionTask?.cancel()
      discovery.stop()
      if !adopted { candidate.disconnect() }
    }
  }

  private func invalidateTest() {
    guard !adopted else { return }
    connectionTask?.cancel()
    candidate.disconnect()
    tested = false
    busy = false
    selected = ""
    errorMessage = nil
  }
  private func testConnection() {
    connectionTask?.cancel()
    busy = true
    tested = false
    errorMessage = nil
    connectionTask = Task { @MainActor in
      do {
        try await candidate.connect(to: HAEndpoint(address), token: token)
        guard !Task.isCancelled else { return }
        tested = true
        if candidate.entities.count == 1, let entity = candidate.entities.first, entity.unsupportedReason == nil { selected = entity.id }
      } catch {
        guard !Task.isCancelled else { return }
        errorMessage = (error as? HAError ?? .disconnected).localizedDescription
      }
      busy = false
    }
  }
}

struct HAConnectionSummary: View {
  let store: HomeStore
  @State private var editing = false
  @State private var message: String?
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Label("真实空调", systemImage: "network").font(.headline)
        Spacer()
        if store.haBinding != nil { Text(store.homeAssistant.state.name).font(.caption).foregroundStyle(.secondary) }
      }
      if let binding = store.haBinding {
        Text(store.homeAssistant.snapshot?.name ?? binding.entityID).font(.callout.weight(.medium))
        Text("\(binding.endpoint.baseURL.absoluteString) · \(binding.entityID)").font(.caption).foregroundStyle(.secondary)
        if let reason = store.homeAssistant.snapshot?.unsupportedReason { Text(reason).font(.caption).foregroundStyle(.orange) }
        if let error = store.homeAssistant.error { Text(error).font(.caption).foregroundStyle(.orange) }
        HStack {
          Button("重新连接或更换设备") { editing = true }
          Button("解除绑定") { store.unbindHomeAssistant() }
          Menu("更多") {
            Button("删除此 HA 的本机令牌", role: .destructive) {
              do { try store.homeAssistant.forgetCredential() }
              catch { message = HAError.credentialStore.localizedDescription }
            }
          }.fixedSize()
        }
      } else {
        Text("绑定 Home Assistant 中的空调，支持开关、冷暖模式和温度控制。")
          .font(.callout).foregroundStyle(.secondary)
        Button("绑定真实设备", systemImage: "link") { editing = true }
      }
      if let message { Text(message).font(.caption).foregroundStyle(.orange) }
    }.sheet(isPresented: $editing) { HABindingEditor(store: store) }
  }
}
