import SwiftUI
import AVKit
import HomeCore
import HomeDeviceKit

struct DeviceDetail: View {
  @Bindable var store: HomeStore
  let device: DeviceKind
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        HStack(spacing: 14) {
          DeviceBadge(device: device, size: 48)
          VStack(alignment: .leading, spacing: 6) {
            Text(device.name).font(.title2.weight(.semibold))
            Text(store.status(for: device)).foregroundStyle(.secondary)
          }
          Spacer()
          Picker("所在房间", selection: Binding(
            get: { store.snapshot.room(for: device) },
            set: { store.send(.move(device, $0)) }
          )) {
            ForEach(HomeRoom.allCases) { Text($0.name).tag($0) }
          }.frame(width: 160)
        }
        Group {
          switch device {
          case .airConditioner: ACControls(store: store)
          case .fan: FanControls(store: store)
          case .robotVacuum: RobotControls(store: store)
          case .handWarmer: WarmerControls(store: store)
          case .television: TelevisionControls(store: store)
          }
        }
        Label(device == .airConditioner && store.haBinding != nil ? "真实设备 · Home Assistant 状态回报" : "本机虚拟设备 · 更改自动保存", systemImage: "internaldrive")
          .font(.caption).foregroundStyle(.secondary)
      }.padding(HomeTheme.contentPadding).frame(maxWidth: 1050)
        .frame(maxWidth: .infinity)
    }.navigationTitle(device.name)
  }
}

struct ACControls: View {
  @Bindable var store: HomeStore
  private var state: ACState { store.acState }
  private var mode: String { store.haBinding == nil ? (state.mode == .cold ? "cool" : "heat") : store.homeAssistant.displayMode }
  private var temperatureEnabled: Bool { store.haBinding == nil || store.homeAssistant.snapshot?.supportsTemperature == true }
  private var stageStatus: String {
    guard state.status else { return "待机" }
    switch mode {
    case "cool": return "制冷中"
    case "heat": return "制热中"
    default: return haModeName(mode)
    }
  }
  private func supports(_ mode: String) -> Bool { store.haBinding == nil || store.homeAssistant.snapshot?.modes.contains(mode) == true }
  var body: some View {
    VStack(spacing: 18) {
      modelStage
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 16) {
          controlCard.frame(minWidth: 330)
          companionCard.frame(width: 250)
        }
        VStack(spacing: 16) { controlCard; companionCard }
      }
      HomeCard { HAConnectionSummary(store: store) }
    }
  }

  private var modelStage: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("空调与遥控器").font(.caption.weight(.medium)).foregroundStyle(.secondary)
        Spacer()
        HomeStatusBadge(title: stageStatus,
                        symbol: state.status ? (state.mode == .cold ? "snowflake" : "sun.max.fill") : "power",
                        tint: state.status ? (state.mode == .cold ? .cyan : HomeTheme.gold) : .secondary)
      }
      HStack(spacing: 12) {
        ACPreview(state: state)
          .frame(maxWidth: .infinity).frame(height: 220)
        ACRemotePreview(store: store).frame(width: 138, height: 250)
      }
      HStack {
        Label("拖动空调旋转视角", systemImage: "hand.draw")
        Spacer()
        Text("点击遥控器按钮操作")
      }.font(.caption2).foregroundStyle(.secondary)
    }
    .padding(16)
    .background(HomeTheme.modelBackground, in: RoundedRectangle(cornerRadius: HomeTheme.cornerRadius, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: HomeTheme.cornerRadius).strokeBorder(HomeTheme.separator.opacity(0.3), lineWidth: 0.5))
  }

  private var controlCard: some View {
    HomeCard {
      VStack(alignment: .leading, spacing: 18) {
        HStack(alignment: .center) {
          VStack(alignment: .leading, spacing: 4) {
            Text("设定温度").font(.caption).foregroundStyle(.secondary)
            Text("\(state.temperatureLabel)°C")
              .font(.system(size: 44, weight: .medium, design: .rounded)).monospacedDigit()
              .contentTransition(.numericText())
          }
          Spacer(minLength: 16)
          Button { store.send(.ac(.toggle)) } label: {
            Label(state.status ? "关闭" : "开启", systemImage: "power")
          }.buttonStyle(.borderedProminent).controlSize(.large).disabled(!store.acCanControl)
            .accessibilityLabel(state.status ? "关闭空调" : "开启空调")
        }
        HStack(spacing: 12) {
          Picker("模式", selection: Binding(get: { mode }, set: { store.send(.ac(.mode($0 == "heat" ? .hot : .cold))) })) {
            Label("制冷", systemImage: "snowflake").tag("cool").disabled(!supports("cool"))
            Label("制热", systemImage: "sun.max").tag("heat").disabled(!supports("heat"))
            if !["cool", "heat"].contains(mode) { Text(haModeName(mode)).tag(mode).disabled(true) }
          }.pickerStyle(.segmented).labelsHidden().frame(maxWidth: 210)
          Spacer(minLength: 0)
          ControlGroup {
            Button { store.send(.ac(.temperature(state.temperature - store.acStep))) } label: { Image(systemName: "minus") }
              .disabled(state.temperature <= store.acMinimum || !temperatureEnabled)
              .accessibilityLabel("降低温度").help("降低温度")
            Button { store.send(.ac(.temperature(state.temperature + store.acStep))) } label: { Image(systemName: "plus") }
              .disabled(state.temperature >= store.acMaximum || !temperatureEnabled)
              .accessibilityLabel("升高温度").help("升高温度")
          }.fixedSize()
        }.disabled(!store.acCanControl)
        if store.haBinding != nil && store.homeAssistant.pending {
          HStack { ProgressView().controlSize(.small); Text("等待设备确认…").font(.caption).foregroundStyle(.secondary) }
        }
      }
    }
  }

  private var companionCard: some View {
    HomeCard {
      VStack(alignment: .leading, spacing: 13) {
        Label("桌面配件", systemImage: "desktopcomputer").font(.headline)
        DesktopCompanionControls(store: store)
          .font(.callout).toggleStyle(.switch).controlSize(.small)
      }
    }
  }
}

struct FanControls: View {
  let store: HomeStore
  private var state: FanState { store.snapshot.fan }
  var body: some View {
    HomeCard {
      VStack(spacing: 24) {
        DeviceIllustration(symbol: "fan", color: HomeTheme.moss, active: state.power,
                           title: state.power ? "微风相伴" : "等一阵风")
        PowerRow(active: state.power, title: "风扇电源") { store.send(.fan(.toggle)) }
        Picker("风速", selection: Binding(get: { state.speed }, set: { store.send(.fan(.speed($0))) })) {
          Text("一档 · 轻柔").tag(1); Text("二档 · 舒适").tag(2); Text("三档 · 清爽").tag(3)
        }.pickerStyle(.segmented)
        Toggle("左右摇头", isOn: Binding(get: { state.oscillating }, set: { _ in store.send(.fan(.oscillation)) }))
          .toggleStyle(.switch)
        TimerControls(deadline: state.autoOffAt) { store.send(.fan(.timer($0))) }
      }
    }
  }
}

struct WarmerControls: View {
  let store: HomeStore
  private var state: WarmerState { store.snapshot.handWarmer }
  var body: some View {
    HomeCard {
      VStack(spacing: 24) {
        DeviceIllustration(symbol: "sun.max", color: HomeTheme.gold, active: state.power,
                           title: state.power ? "\(state.temperature)°C，掌心的温暖" : "把温暖捧在手心")
        PowerRow(active: state.power, title: "暖手宝电源") { store.send(.warmer(.toggle)) }
        Picker("温度档位", selection: Binding(get: { state.level }, set: { store.send(.warmer(.level($0))) })) {
          ForEach(WarmerLevel.allCases, id: \.self) { Text("\($0.name) · \($0.temperature)°C").tag($0) }
        }.pickerStyle(.segmented)
        TimerControls(deadline: state.autoOffAt) { store.send(.warmer(.timer($0))) }
      }
    }
  }
}

struct RobotControls: View {
  let store: HomeStore
  private var state: RobotState { store.snapshot.robotVacuum }
  var body: some View {
    HomeCard {
      VStack(spacing: 24) {
        DeviceIllustration(symbol: "circle.dotted.circle", color: .indigo,
                           active: state.status == .cleaning, title: store.status(for: .robotVacuum))
        HStack {
          Label("虚拟电量 \(state.battery)%", systemImage: "battery.75percent")
          Spacer()
          Text("本机清扫模拟").foregroundStyle(.secondary)
        }.font(.callout)
        Picker("清扫模式", selection: Binding(get: { state.mode }, set: { store.send(.robot(.mode($0))) })) {
          ForEach(RobotMode.allCases, id: \.self) { Text($0.name).tag($0) }
        }.pickerStyle(.segmented)
        HStack {
          Button(state.status == .cleaning ? "暂停清扫" : "开始清扫", systemImage: state.status == .cleaning ? "pause" : "play") {
            store.send(.robot(state.status == .cleaning ? .pause : .start))
          }.buttonStyle(.borderedProminent)
          Button("返回充电", systemImage: "house") { store.send(.robot(.return)) }
            .disabled(state.status == .docked || state.status == .charging || state.status == .returning)
          if state.status == .returning {
            Button("模拟到达充电座") { store.send(.robot(.dock)) }
          }
        }.controlSize(.large)
      }
    }
  }
}

struct DeviceIllustration: View {
  let symbol: String
  let color: Color
  let active: Bool
  let title: String
  var body: some View {
    VStack(spacing: 20) {
      Image(systemName: symbol).font(.system(size: 100, weight: .ultraLight))
        .foregroundStyle(active ? color : .secondary.opacity(0.5)).accessibilityHidden(true)
      Text(title).font(.title3.weight(.medium))
    }.frame(maxWidth: .infinity).frame(height: 230)
      .background(color.opacity(active ? 0.08 : 0.03), in: RoundedRectangle(cornerRadius: 16))
  }
}

struct PowerRow: View {
  let active: Bool
  let title: String
  let action: () -> Void
  var body: some View {
    HStack {
      Text(title).font(.headline)
      Spacer()
      Button(active ? "关闭" : "开启", systemImage: "power", action: action)
        .buttonStyle(.borderedProminent).controlSize(.large)
    }
  }
}

struct TimerControls: View {
  let deadline: Date?
  let set: (Int?) -> Void
  var body: some View {
    HStack {
      VStack(alignment: .leading, spacing: 4) {
        Label("定时关闭", systemImage: "timer")
        if let deadline { Text(deadline, style: .time).font(.caption).foregroundStyle(.secondary) }
      }
      Spacer()
      Menu {
        Button("不设定时") { set(nil) }
        ForEach([15, 30, 60, 120], id: \.self) { minutes in
          Button("\(minutes) 分钟后") { set(minutes) }
        }
      } label: {
        Text(deadline == nil ? "选择时间" : "更改定时")
      }.fixedSize()
    }
  }
}

struct TelevisionControls: View {
  let store: HomeStore
  @State private var player = AVPlayer()
  @State private var source = ""
  @State private var playbackError: String?
  private var state: TelevisionState { store.snapshot.television }
  var body: some View {
    HomeCard {
      VStack(alignment: .leading, spacing: 20) {
        ZStack {
          RoundedRectangle(cornerRadius: 16).fill(.black)
          if state.power {
            NativeVideoPlayer(player: player).clipShape(RoundedRectangle(cornerRadius: 16))
          } else {
            Image(systemName: "tv").font(.system(size: 64, weight: .ultraLight)).foregroundStyle(.white.opacity(0.3))
          }
        }.frame(height: 260)
        PowerRow(active: state.power, title: "电视电源") { store.send(.tv(.toggle)) }
        HStack {
          Button(state.playing ? "暂停" : "播放", systemImage: state.playing ? "pause" : "play") {
            playbackError = nil
            store.send(.tv(state.playing ? .pause : .play))
          }
          Button { store.send(.tv(.mute)) } label: {
            Image(systemName: state.muted ? "speaker.slash" : "speaker.wave.2")
          }.accessibilityLabel(state.muted ? "取消静音" : "静音")
          Slider(value: Binding(get: { Double(state.volume) }, set: { store.send(.tv(.volume(Int($0.rounded())))) }), in: 0...100)
            .accessibilityLabel("电视音量")
          Text("\(state.volume)%").monospacedDigit().frame(width: 40)
        }
        Divider()
        Text("播放地址").font(.headline)
        HStack {
          TextField("HTTPS 视频地址", text: $source).textFieldStyle(.roundedBorder)
          Button("载入") {
            playbackError = nil
            store.send(.tv(.source(source)))
          }.disabled(!TelevisionState.isValidSource(source))
        }
        Text("支持系统可播放的 HTTPS 视频，默认片源为 Sintel 预告片。离开电视页面会暂停播放。")
          .font(.caption).foregroundStyle(.secondary)
        if let playbackError {
          Label(playbackError, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange)
        }
      }
    }
    .onAppear { source = state.sourceUrl; loadSource(); updatePlayback() }
    .onChange(of: state.sourceUrl) { _, _ in loadSource(); updatePlayback() }
    .onChange(of: state.playing) { _, _ in updatePlayback() }
    .onChange(of: state.power) { _, _ in updatePlayback() }
    .onChange(of: state.volume) { _, _ in updatePlayback() }
    .onChange(of: state.muted) { _, _ in updatePlayback() }
    .onDisappear {
      player.pause()
      player.replaceCurrentItem(with: nil)
      if state.playing { store.send(.tv(.pause)) }
    }
    .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)) { notification in
      guard let item = notification.object as? AVPlayerItem, item === player.currentItem else { return }
      store.send(.tv(.pause))
      player.seek(to: .zero)
    }
    .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemNewErrorLogEntry)) { notification in
      guard let item = notification.object as? AVPlayerItem, item === player.currentItem else { return }
      playbackError = "视频暂时无法播放，请检查网络或更换地址。"
      store.send(.tv(.pause))
    }
  }
  private func loadSource() {
    guard let url = URL(string: state.sourceUrl) else { return }
    player.replaceCurrentItem(with: AVPlayerItem(url: url))
  }
  private func updatePlayback() {
    player.volume = Float(state.volume) / 100
    player.isMuted = state.muted
    if state.power && state.playing { player.play() } else { player.pause() }
  }
}

struct NativeVideoPlayer: NSViewRepresentable {
  let player: AVPlayer
  func makeNSView(context: Context) -> AVPlayerView {
    let view = AVPlayerView()
    view.player = player
    view.controlsStyle = .none
    return view
  }
  func updateNSView(_ view: AVPlayerView, context: Context) { view.player = player }
}
