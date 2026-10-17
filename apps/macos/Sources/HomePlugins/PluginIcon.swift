import Foundation

/// A plugin's own app icon: the declarative vector format shared with the web
/// app (`devices/icon.ts`). Icons are data, not markup: the host draws a fixed
/// set of shapes and attributes on a 64 × 64 canvas, so an icon cannot carry
/// scripts, external references or styles, and motion is limited to the host's
/// own animations.
///
/// Decoding always runs `normalize(_:)`: unknown keys and invalid values are
/// dropped, and an icon without a background or any shape fails to decode, so
/// a manifest with an unusable icon is rejected rather than shown blank.
public struct PluginIcon: Codable, Equatable, Sendable {
  /// Two-stop tile gradient, top-left to bottom-right
  public var background: [String]
  /// Tile gradient in dark mode; defaults to `background` mixed toward navy
  public var backgroundDark: [String]?
  public var shapes: [Shape]

  public init(background: [String], backgroundDark: [String]? = nil, shapes: [Shape]) {
    self.background = background; self.backgroundDark = backgroundDark; self.shapes = shapes
  }

  public enum ShapeType: String, Codable, Sendable, CaseIterable {
    case group, path, circle, ellipse, rect, line, polyline, polygon
  }

  /// Host animations a shape may play while its device is running.
  public enum Motion: String, Codable, Sendable, CaseIterable {
    case spin, sway, pulse, float, blink, flow
  }

  public enum Visibility: String, Codable, Sendable {
    case active, idle
  }

  public struct Shape: Codable, Equatable, Sendable {
    public var type: ShapeType
    public var d: String?
    public var cx: Double?
    public var cy: Double?
    public var r: Double?
    public var rx: Double?
    public var ry: Double?
    public var x: Double?
    public var y: Double?
    public var width: Double?
    public var height: Double?
    public var x1: Double?
    public var y1: Double?
    public var x2: Double?
    public var y2: Double?
    public var points: String?
    /// Hex colour, `none`, or a host token: `tone`, `tone-soft`, `surface`, `ink`
    public var fill: String?
    public var stroke: String?
    public var strokeWidth: Double?
    public var opacity: Double?
    public var linecap: String?
    public var linejoin: String?
    /// `translate`, `rotate`, `scale`, `skewX` and `skewY` with numeric arguments
    public var transform: String?
    /// Animation played while the device runs
    public var motion: Motion?
    /// Pivot of `spin`, `sway` and `pulse` in canvas units; defaults to the centre
    public var origin: [Double]?
    /// Draw only while the device is running, or only while it is idle
    public var when: Visibility?
    /// Delay of the motion in seconds
    public var delay: Double?
    public var children: [Shape]?

    public init(type: ShapeType) { self.type = type }
  }

  /// Limits that keep icons cheap to render in long lists. Same as the web.
  public enum Limits {
    public static let shapes = 80
    public static let depth = 4
    public static let pathLength = 4000
    public static let transformLength = 200
    public static let magnitude = 1000.0
  }

  public init(from decoder: Decoder) throws {
    let result = Self.normalize(try JSONValue(from: decoder))
    guard let icon = result.icon else { throw PluginError.invalidManifest("应用图标无效：\(result.errors.joined(separator: "；"))") }
    self = icon
  }

  /// Whether the icon or any of its shapes animates while active.
  public var hasMotion: Bool {
    func walk(_ shapes: [Shape]) -> Bool { shapes.contains { $0.motion != nil || walk($0.children ?? []) } }
    return walk(shapes)
  }
}

// MARK: Validation

extension PluginIcon {
  static let paintTokens: Set<String> = ["none", "tone", "tone-soft", "surface", "ink"]
  private static let numberKeys: [(String, WritableKeyPath<Shape, Double?>)] = [
    ("cx", \.cx), ("cy", \.cy), ("r", \.r), ("rx", \.rx), ("ry", \.ry), ("x", \.x), ("y", \.y),
    ("width", \.width), ("height", \.height), ("x1", \.x1), ("y1", \.y1), ("x2", \.x2), ("y2", \.y2),
    ("strokeWidth", \.strokeWidth), ("opacity", \.opacity), ("delay", \.delay),
  ]
  private static let number = #"-?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:e-?[0-9]+)?"#
  private static let transformPattern = try! NSRegularExpression(
    pattern: #"\A(?:[ \t\n\r\f]*(?:translate|rotate|scale|skewX|skewY)\([ \t\n\r\f]*N(?:[ \t\n\r\f]*[, \t\n\r\f][ \t\n\r\f]*N){0,2}[ \t\n\r\f]*\)[ \t\n\r\f]*)+\z"#
      .replacingOccurrences(of: "N", with: number))

  /// `#rgb`, `#rrggbb` or `#rrggbbaa`.
  public static func isHex(_ value: String) -> Bool {
    let digits = value.utf8.dropFirst()
    return value.hasPrefix("#") && [3, 6, 8].contains(digits.count) && digits.allSatisfy(isHexDigit)
  }

  /// Whether a value is a colour the renderer accepts: hex or a host token.
  public static func isPaint(_ value: String) -> Bool { isHex(value) || paintTokens.contains(value) }

  private static func isHexDigit(_ byte: UInt8) -> Bool {
    (48...57).contains(byte) || (65...70).contains(byte) || (97...102).contains(byte)
  }

  private static func isPathData(_ value: String) -> Bool {
    !value.isEmpty && value.utf8.allSatisfy { byte in
      isNumberByte(byte) || "MLHVCSQTAZmlhvcsqtaz".utf8.contains(byte)
    }
  }

  private static func isPoints(_ value: String) -> Bool { !value.isEmpty && value.utf8.allSatisfy(isNumberByte) }

  /// Digits, whitespace, `.`, `,`, `e`, `E`, `+`, `-`.
  private static func isNumberByte(_ byte: UInt8) -> Bool {
    (48...57).contains(byte) || " \t\n\r\u{0B}\u{0C}.,eE+-".utf8.contains(byte)
  }

  static func isTransform(_ value: String) -> Bool {
    transformPattern.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) != nil
  }

  private struct Context {
    var count = 0
    var errors: [String] = []
  }

  /// Validate an icon from an untrusted manifest and keep only what the
  /// renderer supports. Mirrors `normalizePluginIcon` on the web.
  ///
  /// - Returns: The sanitized icon (nil when unusable) and the problems found.
  public static func normalize(_ value: JSONValue) -> (icon: PluginIcon?, errors: [String]) {
    var context = Context()
    guard case .object(let object) = value, case .array(let rawShapes) = object["shapes"] else {
      return (nil, ["icon: expected { background, shapes }"])
    }
    func gradient(_ input: JSONValue?, _ name: String) -> [String]? {
      guard let input else { return nil }
      if case .array(let items) = input, items.count == 2 {
        let colours = items.compactMap(\.stringValue).filter(isHex)
        if colours.count == 2 { return colours }
      }
      context.errors.append("icon.\(name): expected two hex colours")
      return nil
    }
    let background = gradient(object["background"], "background")
    let backgroundDark = gradient(object["backgroundDark"], "backgroundDark")
    let shapes = rawShapes.enumerated().compactMap { index, shape in
      normalizeShape(shape, depth: 1, path: "icon.shapes[\(index)]", context: &context)
    }
    guard let background, !shapes.isEmpty else {
      return (nil, context.errors + ["icon: needs a background and at least one shape"])
    }
    return (PluginIcon(background: background, backgroundDark: backgroundDark, shapes: shapes), context.errors)
  }

  private static func normalizeShape(_ value: JSONValue, depth: Int, path: String, context: inout Context) -> Shape? {
    guard case .object(let object) = value, let type = object["type"]?.stringValue.flatMap(ShapeType.init) else {
      context.errors.append("\(path): unknown shape")
      return nil
    }
    context.count += 1
    if context.count > Limits.shapes {
      context.errors.append("\(path): more than \(Limits.shapes) shapes")
      return nil
    }
    var shape = Shape(type: type)
    for (key, keyPath) in numberKeys {
      guard let raw = object[key] else { continue }
      if let number = raw.numberValue, number.isFinite, abs(number) <= Limits.magnitude {
        shape[keyPath: keyPath] = number
      } else {
        context.errors.append("\(path).\(key): not a number")
      }
    }
    if let d = object["d"]?.stringValue {
      if d.utf16.count <= Limits.pathLength, isPathData(d) { shape.d = d }
      else { context.errors.append("\(path).d: invalid path data") }
    }
    if let points = object["points"]?.stringValue {
      if points.utf16.count <= Limits.pathLength, isPoints(points) { shape.points = points }
      else { context.errors.append("\(path).points: invalid points") }
    }
    for (key, keyPath) in [("fill", \Shape.fill), ("stroke", \Shape.stroke)] {
      guard let raw = object[key] else { continue }
      if let paint = raw.stringValue, isPaint(paint) { shape[keyPath: keyPath] = paint }
      else { context.errors.append("\(path).\(key): unsupported colour") }
    }
    if let linecap = object["linecap"]?.stringValue, ["butt", "round", "square"].contains(linecap) { shape.linecap = linecap }
    if let linejoin = object["linejoin"]?.stringValue, ["miter", "round", "bevel"].contains(linejoin) { shape.linejoin = linejoin }
    if let transform = object["transform"]?.stringValue {
      if transform.utf16.count <= Limits.transformLength, isTransform(transform) {
        shape.transform = transform.trimmingCharacters(in: .whitespacesAndNewlines)
      } else {
        context.errors.append("\(path).transform: unsupported transform")
      }
    }
    if let raw = object["motion"] {
      if let motion = raw.stringValue.flatMap(Motion.init) { shape.motion = motion }
      else { context.errors.append("\(path).motion: unknown motion") }
    }
    if case .array(let origin) = object["origin"], origin.count == 2 {
      let numbers = origin.compactMap(\.numberValue).filter(\.isFinite)
      if numbers.count == 2 { shape.origin = numbers }
    }
    if let when = object["when"]?.stringValue.flatMap(Visibility.init) { shape.when = when }
    if case .array(let children) = object["children"] {
      if depth >= Limits.depth {
        context.errors.append("\(path): nested too deeply")
      } else {
        shape.children = children.enumerated().compactMap { index, child in
          normalizeShape(child, depth: depth + 1, path: "\(path).children[\(index)]", context: &context)
        }
      }
    }
    return shape
  }
}
