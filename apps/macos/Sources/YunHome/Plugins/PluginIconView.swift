import SwiftUI
import HomePlugins

/// A plugin's own app icon, drawn the way the web's `PluginIcon.vue` draws it:
/// a rounded tile with a two-stop gradient and a soft highlight, and the
/// icon's shapes on a 64 × 64 canvas. Motions play only while `active`, and
/// not at all with Reduce Motion.
struct PluginIconView: View {
  let icon: PluginIcon
  var active = false
  /// The device's tone (`cool`, `heat`, `warm`, `active`); idle grey otherwise
  var tone: String?
  var size: CGFloat = 48
  /// Motion speed multiplier, e.g. a fan's speed level
  var speed: Double = 1
  /// Accessible name; the icon is decorative when nil
  var label: String?

  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var activeSince = Date()

  private var dark: Bool { colorScheme == .dark }
  private var toneColor: Color { PluginTone.tone(tone)?.fill ?? PluginIconPaint.idle }
  private var animating: Bool { active && !reduceMotion && icon.hasMotion }

  var body: some View {
    let corner = RoundedRectangle(cornerRadius: size * 0.27, style: .continuous)
    TimelineView(.animation(paused: !animating)) { timeline in
      PluginIconCanvas(icon: icon, progress: active ? 1 : 0,
                       elapsed: animating ? timeline.date.timeIntervalSince(activeSince) : nil,
                       speed: max(0.25, speed), tone: toneColor, dark: dark)
    }
    .frame(width: size, height: size)
    .background { tile }
    .clipShape(corner)
    .overlay { corner.strokeBorder(rim, lineWidth: 1) }
    .overlay { corner.strokeBorder(toneColor.opacity(active ? 0.55 : 0), lineWidth: 1.5) }
    .shadow(color: shadowColor.opacity(dark ? 0 : 0.08), radius: 1, y: 1)
    .shadow(color: active ? toneColor.opacity(0.45) : shadowColor.opacity(dark ? 0.45 : 0.2),
            radius: active ? 7 : 5, y: active ? 6 : 4)
    .animation(.easeInOut(duration: 0.36), value: active)
    .onChange(of: active) { _, now in if now { activeSince = .now } }
    .accessibilityElement()
    .accessibilityHidden(label == nil)
    .accessibilityLabel(label ?? "")
    .accessibilityAddTraits(.isImage)
  }

  private var shadowColor: Color { dark ? .black : Color(red: 15 / 255, green: 30 / 255, blue: 60 / 255) }

  /// Inset highlight on the top edge and a faint shade on the bottom.
  private var rim: LinearGradient {
    LinearGradient(stops: [.init(color: .white.opacity(dark ? 0.14 : 0.7), location: 0),
                           .init(color: .white.opacity(0), location: 0.12),
                           .init(color: .clear, location: 0.88),
                           .init(color: Color(red: 15 / 255, green: 30 / 255, blue: 60 / 255).opacity(dark ? 0 : 0.08), location: 1)],
                   startPoint: .top, endPoint: .bottom)
  }

  private var tile: some View {
    let stops = PluginIconPaint.tileColors(icon, dark: dark)
    return Canvas { context, canvasSize in
      let rect = CGRect(origin: .zero, size: canvasSize)
      // CSS `linear-gradient(145deg, …)` over a square tile.
      context.fill(Path(rect), with: .linearGradient(
        Gradient(colors: stops),
        startPoint: CGPoint(x: canvasSize.width * 0.1, y: -canvasSize.height * 0.07),
        endPoint: CGPoint(x: canvasSize.width * 0.9, y: canvasSize.height * 1.07)))
      // `radial-gradient(120% 90% at 25% 0%, white, transparent 55%)`
      var highlight = context
      highlight.translateBy(x: canvasSize.width * 0.25, y: 0)
      highlight.scaleBy(x: 1, y: 0.75 * canvasSize.height / canvasSize.width)
      let radius = canvasSize.width * 1.2 * 0.55
      highlight.fill(Path(ellipseIn: CGRect(x: -radius, y: -radius, width: radius * 2, height: radius * 2)),
                     with: .radialGradient(Gradient(colors: [.white.opacity(dark ? 0.14 : 0.55), .white.opacity(0)]),
                                           center: .zero, startRadius: 0, endRadius: radius))
    }
  }
}

/// The icon's shapes. `progress` animates between idle (0) and active (1) so
/// `when` shapes cross-fade; `elapsed` is the time since the device started,
/// or nil when nothing should move.
private struct PluginIconCanvas: View, Animatable {
  let icon: PluginIcon
  var progress: Double
  let elapsed: TimeInterval?
  let speed: Double
  let tone: Color
  let dark: Bool

  var animatableData: Double {
    get { progress }
    set { progress = newValue }
  }

  var body: some View {
    Canvas { context, size in
      context.scaleBy(x: size.width / 64, y: size.height / 64)
      let style = PaintStyle()
      for shape in icon.shapes { draw(shape, in: context, style: style) }
    }
  }

  private struct PaintStyle {
    var fill = "#000"
    var stroke = "none"
    var strokeWidth = 1.0
    var linecap = "butt"
    var linejoin = "miter"
  }

  private func draw(_ shape: PluginIcon.Shape, in parent: GraphicsContext, style inherited: PaintStyle) {
    var opacity = shape.opacity.map { min(1, max(0, $0)) } ?? 1
    switch shape.when {
    case .active: opacity *= progress
    case .idle: opacity *= 1 - progress
    case nil: break
    }
    guard opacity > 0.001 else { return }

    var context = parent
    if let motion = shape.motion, let elapsed {
      let time = elapsed - (shape.delay ?? 0)
      if time >= 0 {
        let pose = PluginIconMotion.pose(motion, time: time, speed: speed)
        let origin = shape.origin.map { CGPoint(x: $0[0], y: $0[1]) } ?? CGPoint(x: 32, y: 32)
        context.translateBy(x: origin.x, y: origin.y)
        context.concatenate(pose.transform)
        context.translateBy(x: -origin.x, y: -origin.y)
        opacity *= pose.opacity
      }
    }
    if let transform = shape.transform { context.concatenate(PluginIconCache.shared.transform(transform)) }

    var style = inherited
    if let fill = shape.fill { style.fill = fill }
    if let stroke = shape.stroke { style.stroke = stroke }
    if let width = shape.strokeWidth { style.strokeWidth = width }
    if let linecap = shape.linecap { style.linecap = linecap }
    if let linejoin = shape.linejoin { style.linejoin = linejoin }

    if shape.type == .group {
      let children = shape.children ?? []
      if opacity < 1 {
        // Group opacity applies to the composite, as in SVG.
        context.opacity *= opacity
        context.drawLayer { layer in for child in children { draw(child, in: layer, style: style) } }
      } else {
        for child in children { draw(child, in: context, style: style) }
      }
      return
    }
    guard let path = Self.path(for: shape) else { return }
    context.opacity *= opacity
    if shape.type != .line, let fill = color(style.fill) { context.fill(path, with: .color(fill)) }
    if let stroke = color(style.stroke), style.strokeWidth > 0 {
      context.stroke(path, with: .color(stroke), style: StrokeStyle(
        lineWidth: style.strokeWidth,
        lineCap: style.linecap == "round" ? .round : style.linecap == "square" ? .square : .butt,
        lineJoin: style.linejoin == "round" ? .round : style.linejoin == "bevel" ? .bevel : .miter))
    }
  }

  private func color(_ paint: String) -> Color? {
    switch paint {
    case "none": nil
    case "tone": tone
    case "tone-soft": tone.opacity(0.3)
    case "surface": dark ? PluginIconPaint.color(0xE9EEF5) : .white
    case "ink": dark ? PluginIconPaint.color(0x1F2836) : PluginIconPaint.color(0x3B4658)
    default: PluginIconPaint.hex(paint)
    }
  }

  private static func path(for shape: PluginIcon.Shape) -> Path? {
    switch shape.type {
    case .group:
      return nil
    case .path:
      return shape.d.map { Path(PluginIconCache.shared.path($0)) }
    case .circle:
      guard let r = shape.r, r > 0 else { return nil }
      let cx = shape.cx ?? 0, cy = shape.cy ?? 0
      return Path(ellipseIn: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
    case .ellipse:
      guard let rx = shape.rx ?? shape.ry, let ry = shape.ry ?? shape.rx, rx > 0, ry > 0 else { return nil }
      let cx = shape.cx ?? 0, cy = shape.cy ?? 0
      return Path(ellipseIn: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2))
    case .rect:
      guard let width = shape.width, let height = shape.height, width > 0, height > 0 else { return nil }
      let rect = CGRect(x: shape.x ?? 0, y: shape.y ?? 0, width: width, height: height)
      let rx = min(max(0, shape.rx ?? shape.ry ?? 0), width / 2)
      let ry = min(max(0, shape.ry ?? shape.rx ?? 0), height / 2)
      return rx > 0 && ry > 0
        ? Path(roundedRect: rect, cornerSize: CGSize(width: rx, height: ry), style: .circular)
        : Path(rect)
    case .line:
      var path = Path()
      path.move(to: CGPoint(x: shape.x1 ?? 0, y: shape.y1 ?? 0))
      path.addLine(to: CGPoint(x: shape.x2 ?? 0, y: shape.y2 ?? 0))
      return path
    case .polyline, .polygon:
      let points = PluginIconGeometry.parsePoints(shape.points ?? "")
      guard points.count > 1 else { return nil }
      var path = Path()
      path.addLines(points)
      if shape.type == .polygon { path.closeSubpath() }
      return path
    }
  }
}

/// The host's six motions, matching the web keyframes.
enum PluginIconMotion {
  struct Pose {
    var transform = CGAffineTransform.identity
    var opacity = 1.0
  }

  static func pose(_ motion: PluginIcon.Motion, time: TimeInterval, speed: Double) -> Pose {
    // One cycle eased in and out: 0 → 1 → 0.
    func wave(_ duration: Double) -> Double { (1 - cos(2 * .pi * time / duration)) / 2 }
    switch motion {
    case .spin:
      let turn = (time * speed / 1.1).truncatingRemainder(dividingBy: 1)
      return Pose(transform: CGAffineTransform(rotationAngle: turn * 2 * .pi))
    case .sway:
      return Pose(transform: CGAffineTransform(rotationAngle: (-14 + 28 * wave(3.2)) * .pi / 180))
    case .pulse:
      let scale = 1 + 0.12 * wave(2.2)
      return Pose(transform: CGAffineTransform(scaleX: scale, y: scale))
    case .float:
      return Pose(transform: CGAffineTransform(translationX: 0, y: -2.5 * wave(2.6)))
    case .blink:
      return Pose(opacity: 1 - 0.45 * wave(2.8))
    case .flow:
      // Fade in over the first 30%, drift down and fade out, eased in.
      let t = (time / 1.8).truncatingRemainder(dividingBy: 1)
      let opacity = t < 0.3 ? easeIn(t / 0.3) : 1 - easeIn((t - 0.3) / 0.7)
      return Pose(transform: CGAffineTransform(translationX: 0, y: -3 + 9 * easeIn(t)), opacity: opacity)
    }
  }

  /// CSS `ease-in`, cubic-bezier(0.42, 0, 1, 1).
  static func easeIn(_ x: Double) -> Double {
    var t = x
    for _ in 0..<6 {
      let bx = 3 * (1 - t) * (1 - t) * t * 0.42 + 3 * (1 - t) * t * t + t * t * t
      let dx = 3 * (1 - t) * (1 - t) * 0.42 + 6 * (1 - t) * t * (1 - 0.42) + 3 * t * t * (1 - 1)
      guard dx > 1e-6 else { break }
      t = min(1, max(0, t - (bx - x) / dx))
    }
    return 3 * (1 - t) * t * t + t * t * t
  }
}

/// Parsed path data and transforms, shared by every icon on screen.
final class PluginIconCache: @unchecked Sendable {
  static let shared = PluginIconCache()
  private let lock = NSLock()
  private var paths: [String: CGPath] = [:]
  private var transforms: [String: CGAffineTransform] = [:]

  func path(_ data: String) -> CGPath {
    lock.withLock {
      if let path = paths[data] { return path }
      let path = PluginIconGeometry.cgPath(PluginIconGeometry.parsePath(data))
      paths[data] = path
      return path
    }
  }

  func transform(_ text: String) -> CGAffineTransform {
    lock.withLock {
      if let transform = transforms[text] { return transform }
      let transform = PluginIconGeometry.parseTransform(text)
      transforms[text] = transform
      return transform
    }
  }
}

/// Colours of the icon format.
enum PluginIconPaint {
  static let idle = color(0x9AA6B8)

  static func color(_ rgb: UInt32, alpha: Double = 1) -> Color {
    Color(.sRGB, red: Double((rgb >> 16) & 0xFF) / 255, green: Double((rgb >> 8) & 0xFF) / 255,
          blue: Double(rgb & 0xFF) / 255, opacity: alpha)
  }

  /// `#rgb`, `#rrggbb` or `#rrggbbaa` as sRGB components.
  static func rgba(_ hex: String) -> (r: Double, g: Double, b: Double, a: Double)? {
    guard PluginIcon.isHex(hex) else { return nil }
    var digits = String(hex.dropFirst())
    if digits.count == 3 { digits = digits.map { "\($0)\($0)" }.joined() }
    if digits.count == 6 { digits += "ff" }
    guard let value = UInt32(digits, radix: 16) else { return nil }
    return (Double((value >> 24) & 0xFF) / 255, Double((value >> 16) & 0xFF) / 255,
            Double((value >> 8) & 0xFF) / 255, Double(value & 0xFF) / 255)
  }

  static func hex(_ hex: String) -> Color? {
    rgba(hex).map { Color(.sRGB, red: $0.r, green: $0.g, blue: $0.b, opacity: $0.a) }
  }

  /// The tile gradient. In dark mode without `backgroundDark`, each stop is
  /// mixed toward navy in Oklab like the web's `color-mix()`.
  static func tileColors(_ icon: PluginIcon, dark: Bool) -> [Color] {
    if dark, let colours = icon.backgroundDark { return colours.compactMap(hex) }
    guard dark else { return icon.background.compactMap(hex) }
    let navies: [UInt32] = [0x14233A, 0x0E1828]
    let weights = [0.62, 0.58]
    return icon.background.enumerated().compactMap { index, colour in
      guard let rgba = rgba(colour), index < 2 else { return nil }
      let navy = navies[index]
      let mixed = mixOklab((rgba.r, rgba.g, rgba.b),
                           (Double((navy >> 16) & 0xFF) / 255, Double((navy >> 8) & 0xFF) / 255, Double(navy & 0xFF) / 255),
                           weight: weights[index])
      return Color(.sRGB, red: mixed.0, green: mixed.1, blue: mixed.2, opacity: 1)
    }
  }

  /// `color-mix(in oklab, a weight, b)`.
  static func mixOklab(_ a: (Double, Double, Double), _ b: (Double, Double, Double), weight: Double) -> (Double, Double, Double) {
    let la = oklab(a), lb = oklab(b)
    return srgb((la.0 * weight + lb.0 * (1 - weight), la.1 * weight + lb.1 * (1 - weight), la.2 * weight + lb.2 * (1 - weight)))
  }

  private static func oklab(_ c: (Double, Double, Double)) -> (Double, Double, Double) {
    func linear(_ v: Double) -> Double { v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
    let r = linear(c.0), g = linear(c.1), b = linear(c.2)
    let l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    let m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    let s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)
  }

  private static func srgb(_ lab: (Double, Double, Double)) -> (Double, Double, Double) {
    let l = pow(lab.0 + 0.3963377774 * lab.1 + 0.2158037573 * lab.2, 3)
    let m = pow(lab.0 - 0.1055613458 * lab.1 - 0.0638541728 * lab.2, 3)
    let s = pow(lab.0 - 0.0894841775 * lab.1 - 1.2914855480 * lab.2, 3)
    func gamma(_ v: Double) -> Double {
      let clamped = min(1, max(0, v))
      return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * pow(clamped, 1 / 2.4) - 0.055
    }
    return (gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
            gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
            gamma(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s))
  }
}

/// A plugin's app icon when it has one, otherwise its SF Symbol badge.
struct PluginAppIcon: View {
  let icon: PluginIcon?
  let symbol: String
  let tint: Color
  var active = false
  var tone: String?
  var size: CGFloat = 42
  var label: String?

  var body: some View {
    if let icon {
      PluginIconView(icon: icon, active: active, tone: tone, size: size, label: label)
    } else {
      PluginBadge(symbol: symbol, tint: tint, size: size)
    }
  }
}
