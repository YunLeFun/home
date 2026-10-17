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
  @State private var selected = Set<String>()
  @State private var rooms: [String: HomeRoom] = [:]
  @State private var busy = false
  @State private var tested = false
  @State private var adopted = false
  @State private var searched = false
  @State private var errorMessage: String?
  @State private var connectionTask: Task<Void, Never>?

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        Image(systemName: "house.and.flag").font(.title).foregroundStyle(HomeTheme.brand)
        VStack(alignment: .leading, spacing: 4) {
          Text("连接真实空调").font(.title2.weight(.semibold))
          Text("选择一台或多台空调，并确认它们所在的房间。")
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
        if store.haDevices.contains(where: { $0.binding.endpoint.baseURL.absoluteString == address }) {
          Button("使用已保存令牌") {
            do {
              token = try HAKeychainCredentials().load(for: HAEndpoint(address)) ?? ""
              // Token changes invalidate an earlier test; the next click starts a fresh one.
            } catch { errorMessage = HAError.credentialStore.localizedDescription }
          }.disabled(busy)
        }
        if busy { ProgressView().controlSize(.small); Text("正在读取设备…").font(.caption) }
        if tested { Label("连接成功", systemImage: "checkmark.circle").foregroundStyle(HomeTone.running.text) }
      }
      if tested {
        if candidate.roomLookupFailed { Text("未能读取 HA 分区，可手动选择房间。").font(.caption).foregroundStyle(.secondary) }
        if candidate.entities.isEmpty {
          Text("HA 中还没有 climate 空调实体。请先安装小米等设备集成，并确认 HA 可以控制空调。")
            .font(.callout).foregroundStyle(.secondary)
        } else {
          ScrollView {
            VStack(alignment: .leading, spacing: 14) {
              ForEach(candidate.entities) { entity in
                VStack(alignment: .leading, spacing: 6) {
                  Toggle(entity.name, isOn: Binding(
                    get: { selected.contains(entity.id) },
                    set: { if $0 { selected.insert(entity.id) } else { selected.remove(entity.id) } }
                  )).toggleStyle(.checkbox).disabled(entity.unsupportedReason != nil)
                  HStack {
                    Text(entity.unsupportedReason ?? "\(haModeName(entity.mode)) · \(entity.minimum.formatted())–\(entity.maximum.formatted())°C · 步进 \(entity.step.formatted())°C")
                      .font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    HARoomPicker(room: rooms[entity.id] ?? .unassigned, options: store.rooms + rooms.values.sorted { $0.name < $1.name }) {
                      rooms[entity.id] = $0
                    }
                  }
                  Text(entity.id).font(.caption2).foregroundStyle(.tertiary).textSelection(.enabled)
                }
                Divider()
              }
            }
          }.frame(maxHeight: 250)
          Text("已选择 \(selected.count) 台；保存会添加或更新所选设备，保留其余绑定。").font(.caption).foregroundStyle(.secondary)
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
            try store.bindHomeAssistants(candidate, selections: candidate.entities.filter { selected.contains($0.id) }.map {
              HADeviceSelection(entityID: $0.id, room: rooms[$0.id] ?? .unassigned)
            })
            adopted = true
            token = ""
            dismiss()
          } catch { errorMessage = (error as? HAError ?? .credentialStore).localizedDescription }
        }.homeProminent().keyboardShortcut(.defaultAction)
          .disabled(!tested || selected.isEmpty || busy || candidate.state != .online)
      }
    }
    .padding(26).frame(width: 660).tint(HomeTheme.brand)
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
    selected = []
    rooms = [:]
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
        await candidate.loadRooms()
        guard !Task.isCancelled else { return }
        rooms = Dictionary(uniqueKeysWithValues: candidate.entities.map { entity in
          let existing = store.haDevices.first { $0.binding.endpoint == candidate.endpoint && $0.binding.entityID == entity.id }
          return (entity.id, existing?.room ?? HomeRoom(name: candidate.entityRooms[entity.id] ?? ""))
        })
        tested = true
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
    VStack(alignment: .leading, spacing: 14) {
      HStack {
        Label("真实空调", systemImage: "network").font(.headline)
        Spacer()
        Text("\(store.haDevices.count) 台已绑定").font(.caption).foregroundStyle(.secondary)
        Button(store.haDevices.isEmpty ? "绑定真实设备" : "添加空调或更新令牌", systemImage: "link") { editing = true }
      }
      if store.haDevices.isEmpty {
        Text("连接 Home Assistant 中的空调，支持开关、冷暖模式和温度控制。")
          .font(.callout).foregroundStyle(.secondary)
      }
      ForEach(store.haDevices) { device in
        VStack(alignment: .leading, spacing: 7) {
          HStack {
            Button(device.name) { store.selectHADevice(device.id) }.buttonStyle(.plain).font(.callout.weight(.medium))
            Spacer()
            Text(store.haStatus(device.id)).font(.caption).foregroundStyle(.secondary)
          }
          Text("\(device.binding.endpoint.baseURL.absoluteString) · \(device.binding.entityID)")
            .font(.caption2).foregroundStyle(.secondary).textSelection(.enabled)
          if let reason = store.haConnections[device.id]?.snapshot?.unsupportedReason { Text(reason).font(.caption).foregroundStyle(.orange) }
          if let error = store.haConnections[device.id]?.error { Text(error).font(.caption).foregroundStyle(.orange) }
          HStack {
            HARoomPicker(room: device.room, options: store.rooms) { store.moveHADevice(device.id, to: $0) }
            Spacer()
            Button("重新连接") { store.reconnectHADevices(at: device.binding.endpoint) }
            Button("解除绑定") { store.removeHADevice(device.id) }
            Menu("更多") {
              Button("删除此 HA 的令牌并断开所有设备", role: .destructive) {
                do { try store.forgetHACredential(at: device.binding.endpoint) }
                catch { message = HAError.credentialStore.localizedDescription }
              }
            }.fixedSize()
          }
        }
        Divider()
      }
      Text("房间映射保存在本机，不会改动米家或 HA 的分区。").font(.caption).foregroundStyle(.secondary)
      if let message { Text(message).font(.caption).foregroundStyle(.orange) }
    }.sheet(isPresented: $editing) { HABindingEditor(store: store) }
  }
}

struct HARoomPicker: View {
  let room: HomeRoom
  let options: [HomeRoom]
  let set: (HomeRoom) -> Void
  @State private var adding = false
  @State private var name = ""
  private var choices: [HomeRoom] {
    var seen = Set<HomeRoom>()
    return (options + [room, .unassigned]).filter { seen.insert($0).inserted }
  }
  var body: some View {
    Menu {
      ForEach(choices) { choice in Button(choice.name) { set(choice) } }
      Divider()
      Button("新建房间…") { name = ""; adding = true }
    } label: { Label(room.name, systemImage: room.symbol) }
      .fixedSize().accessibilityLabel("所在房间：\(room.name)")
      .popover(isPresented: $adding) {
        VStack(alignment: .leading, spacing: 12) {
          Text("房间名称").font(.headline)
          TextField("例如：书房", text: $name).textFieldStyle(.roundedBorder)
          Button("保存房间") { set(HomeRoom(name: name)); adding = false }
            .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }.padding(18).frame(width: 240)
      }
  }
}

struct HADeviceSelector: View {
  let store: HomeStore
  var body: some View {
    if !store.haDevices.isEmpty {
      Picker("当前空调", selection: Binding(get: { store.selectedHAID ?? "" }, set: { store.selectHADevice($0) })) {
        ForEach(store.haDevices) { device in Text(device.label).tag(device.id) }
      }
      .accessibilityLabel("当前控制的空调")
    }
  }
}
