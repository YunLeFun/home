import CuteACKit
import SwiftUI
import HomeCore

/// 晴空暖居: YunLeFun Design's sky-blue foundation with warm interior accents,
/// matching the web app's `styles/css-vars.css`. Every token resolves for the
/// current light or dark appearance.
enum HomeTheme {
  // Brand: 晴空蓝 for selection and primary actions only.
  static let brand = Color(light: 0x2563EB, dark: 0x60A5FA)
  static let brandSoft = Color(light: 0xEFF6FF, dark: 0x15264A)
  // Text
  static let text = Color(light: 0x0F172A, dark: 0xE7EEF8)
  static let textSecondary = Color(light: 0x475569, dark: 0xB9C6D9)
  static let textTertiary = Color(light: 0x5C6B80, dark: 0x8D9DB4)
  // Surfaces
  static let surface = Color(light: 0xFFFFFF, dark: 0x141D2B)
  static let surfaceInset = Color(light: 0xEDF2F8, dark: 0x080D16)
  static let edge = Color(light: 0x1E4073, dark: 0x02060F, lightAlpha: 0.12, darkAlpha: 0.55)
  static let highlight = Color(light: 0xFFFFFF, dark: 0xFFFFFF, lightAlpha: 0.9, darkAlpha: 0.06)
  static let card = surface
  static let separator = Color(nsColor: .separatorColor)
  static let cornerRadius: CGFloat = 16
  static let contentPadding: CGFloat = 24
  /// Sky above, warm home below; a moonlit night in dark mode.
  static var paper: LinearGradient {
    LinearGradient(stops: [.init(color: Color(light: 0xEEF5FF, dark: 0x0B1424), location: 0),
                           .init(color: Color(light: 0xF6F8FB, dark: 0x0B111C), location: 0.46),
                           .init(color: Color(light: 0xFAF7F1, dark: 0x10141C), location: 1)],
                   startPoint: .top, endPoint: .bottom)
  }
  static var modelBackground: LinearGradient {
    LinearGradient(colors: [Color(light: 0xF6F9FF, dark: 0x1B2638), surfaceInset],
                   startPoint: .top, endPoint: .bottom)
  }
}

/// A device or status colour with the design system's companions: `on` for
/// glyphs and labels on a filled `fill`, `text` for coloured text on neutral
/// surfaces, and `soft` for tinted backgrounds.
struct HomeTone: Equatable {
  let fill: Color
  let on: Color
  let text: Color
  let soft: Color

  static let brand = HomeTone(fill: HomeTheme.brand, on: Color(light: 0xFFFFFF, dark: 0x0F172A),
                              text: HomeTheme.brand, soft: HomeTheme.brandSoft)
  /// Cooling: --ylf-accent-cyan.
  static let cool = HomeTone(fill: Color(light: 0x06B6D4, dark: 0x06B6D4), on: Color(light: 0x083E4F, dark: 0x083E4F),
                             text: Color(light: 0x155E75, dark: 0x67E8F9), soft: Color(light: 0xCFFAFE, dark: 0x10313D))
  /// Heating: --ylf-accent-coral.
  static let heat = HomeTone(fill: Color(light: 0xFF6B4A, dark: 0xFF6B4A), on: Color(light: 0x551B0A, dark: 0x551B0A),
                             text: Color(light: 0x9A3412, dark: 0xFDA48C), soft: Color(light: 0xFFEDE6, dark: 0x39231F))
  /// Warmth: Home's sunlit amber, on the --ylf-accent-sun companions.
  static let warm = HomeTone(fill: Color(light: 0xF2A93B, dark: 0xF7B955), on: Color(light: 0x64380E, dark: 0x64380E),
                             text: Color(light: 0x854D0E, dark: 0xF7B955), soft: Color(light: 0xFEF9C3, dark: 0x30290F))
  /// Running: --ylf-accent-green.
  static let running = HomeTone(fill: Color(light: 0x22C55E, dark: 0x22C55E), on: Color(light: 0x124324, dark: 0x124324),
                                text: Color(light: 0x166534, dark: 0x86EFAC), soft: Color(light: 0xDCFCE7, dark: 0x142E26))
}

extension Color {
  /// A colour that follows the window's light or dark appearance.
  init(light: UInt32, dark: UInt32, lightAlpha: CGFloat = 1, darkAlpha: CGFloat = 1) {
    self.init(nsColor: NSColor(name: nil) { appearance in
      appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        ? NSColor(hex: dark, alpha: darkAlpha) : NSColor(hex: light, alpha: lightAlpha)
    })
  }
}

private extension NSColor {
  convenience init(hex: UInt32, alpha: CGFloat) {
    self.init(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
              blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
  }
}

/// The filled primary button. `.borderedProminent` always labels its fill in
/// white, which fails contrast on cyan, amber and green, so the label uses the
/// tone's paired `on` foreground instead.
struct HomeFilledButtonStyle: ButtonStyle {
  let tone: HomeTone
  @Environment(\.controlSize) private var controlSize
  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    let large = controlSize == .large || controlSize == .extraLarge
    configuration.label
      .font(large ? .body.weight(.medium) : .callout.weight(.medium))
      .foregroundStyle(tone.on)
      .padding(.horizontal, large ? 14 : 10).padding(.vertical, large ? 7 : 4)
      .background(tone.fill, in: RoundedRectangle(cornerRadius: large ? 9 : 7, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: large ? 9 : 7, style: .continuous)
        .fill(.black.opacity(configuration.isPressed ? 0.12 : 0)))
      .opacity(isEnabled ? 1 : 0.45)
      .contentShape(Rectangle())
      .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
  }
}

extension View {
  /// The filled primary button in a Home tone.
  func homeProminent(_ tone: HomeTone = .brand) -> some View {
    buttonStyle(HomeFilledButtonStyle(tone: tone))
  }
}

extension DeviceKind {
  /// Identity colour for the device's badge.
  var tone: HomeTone {
    switch self {
    case .airConditioner: .cool
    case .fan: .running
    case .robotVacuum: .brand
    case .handWarmer: .warm
    case .television: .brand
    }
  }
  var tint: Color { tone.fill }
}

extension HomeStore {
  /// What a running device glows with, as on the web: cooling or heating for
  /// the air conditioner, warmth for the hand warmer, running for the rest.
  func tone(for device: DeviceKind) -> HomeTone {
    switch device {
    case .airConditioner: acState.mode == .hot ? .heat : .cool
    case .handWarmer: .warm
    default: .running
    }
  }
}

struct HomeCard<Content: View>: View {
  @ViewBuilder var content: Content
  var body: some View {
    content.padding(18)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(HomeTheme.card, in: RoundedRectangle(cornerRadius: HomeTheme.cornerRadius, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: HomeTheme.cornerRadius, style: .continuous)
        .strokeBorder(HomeTheme.edge, lineWidth: 1))
      .shadow(color: Color(light: 0x0F172A, dark: 0x02060F, lightAlpha: 0.06, darkAlpha: 0.35), radius: 8, x: 0, y: 3)
  }
}

struct DeviceBadge: View {
  let device: DeviceKind
  var size: CGFloat = 42
  var body: some View {
    Image(systemName: device.symbol)
      .font(.system(size: size * 0.43, weight: .medium))
      .symbolRenderingMode(.hierarchical)
      .foregroundStyle(device.tone.text)
      .frame(width: size, height: size)
      .background(device.tone.soft, in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
      .accessibilityHidden(true)
  }
}

struct HomeStatusBadge: View {
  let title: String
  let symbol: String
  /// Nil shows a neutral, idle badge.
  var tone: HomeTone? = .brand
  var body: some View {
    Label(title, systemImage: symbol)
      .font(.caption.weight(.medium))
      .foregroundStyle(tone?.text ?? HomeTheme.textSecondary)
      .padding(.horizontal, 10).padding(.vertical, 6)
      .background(tone?.soft ?? HomeTheme.surfaceInset, in: Capsule())
      .accessibilityElement(children: .combine)
  }
}

struct HomeSectionHeading: View {
  let title: String
  var detail: String? = nil
  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      Text(title).font(.headline)
      Spacer()
      if let detail { Text(detail).font(.caption).foregroundStyle(.secondary) }
    }
  }
}

struct ACPreview: View {
  let state: ACState
  /// The Mac's temperature and fans for the LCD and airflow; nil hides them.
  var room: RoomReading?
  var interactive = true
  @State private var controller: ACSceneController?
  @State private var modelError: String?
  var body: some View {
    Group {
      if let controller {
        ACSceneView(controller: controller, state: state, room: room, isActive: true, interactive: interactive)
      } else if let modelError {
        Label(modelError, systemImage: "exclamationmark.triangle")
          .font(.caption).foregroundStyle(.secondary)
      } else {
        ProgressView().controlSize(.small)
      }
    }
    .task {
      guard controller == nil else { return }
      do {
        controller = try await ACSceneController.load()
        modelError = nil
      } catch is CancellationError {
        // Leaving a detail page cancels loading; the next appearance retries.
      } catch {
        modelError = error.localizedDescription
      }
    }
    .accessibilityLabel("三维云空调，\(state.status ? "已开启" : "待机")，\(state.temperature)摄氏度")
  }
}

/// The Mac seen as the room: CPU/SoC temperature, fastest fan and how macOS
/// rates the heat. Same wording as the CuteAC menu bar app.
struct RoomSummary: View {
  let room: RoomReading
  var body: some View {
    let warning = ACPalette.warning(for: room.thermalState).map { Color(nsColor: $0) }
    HStack(spacing: 12) {
      if let celsius = room.celsius {
        Label("室温 \(celsius)°C", systemImage: "thermometer.medium").help("这台 Mac 的 CPU 温度")
      }
      if let rpm = room.fanRPM {
        Label("\(rpm) RPM", systemImage: "fan").help("风扇转速")
      }
      Spacer(minLength: 0)
      Text(room.thermalState.label)
        .font(.caption2.weight(.semibold))
        .padding(.horizontal, 7).padding(.vertical, 2)
        .foregroundStyle(warning ?? Color.secondary)
        .background(Capsule().fill((warning ?? Color.primary).opacity(0.12)))
        .help("macOS 的散热状态")
    }
    .font(.caption.monospacedDigit())
    .foregroundStyle(.secondary)
  }
}
