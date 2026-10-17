import CoreGraphics
import Foundation

/// One absolute path command. The parser resolves relative coordinates and
/// the shorthand forms (`H`, `V`, `S`, `T`) so renderers only see these.
public enum PluginIconPathCommand: Equatable, Sendable {
  case move(CGPoint)
  case line(CGPoint)
  case cubic(CGPoint, CGPoint, CGPoint)
  case quad(CGPoint, CGPoint)
  case arc(radii: CGSize, rotation: Double, largeArc: Bool, sweep: Bool, to: CGPoint)
  case close
}

/// The subset of SVG geometry that plugin icons use: path data, point lists
/// and transform lists. Malformed input stops at the first bad token, like
/// browsers do, and never throws.
public enum PluginIconGeometry {
  // MARK: Path data

  /// Parse SVG path data (`M L H V C S Q T A Z`, absolute and relative).
  public static func parsePath(_ data: String) -> [PluginIconPathCommand] {
    var scanner = NumberScanner(data)
    var commands: [PluginIconPathCommand] = []
    var current = CGPoint.zero
    var start = CGPoint.zero
    // Reflection points for the smooth forms; nil when the previous command doesn't match.
    var lastCubicControl: CGPoint?
    var lastQuadControl: CGPoint?
    var command: Character?

    while true {
      scanner.skipSeparators()
      if let letter = scanner.commandLetter() {
        command = letter
      } else if scanner.isAtEnd || command == nil {
        break
      } else if command == "M" {
        command = "L"
      } else if command == "m" {
        command = "l"
      } else if command == "Z" || command == "z" {
        break // numbers after Z without a new command are an error
      }
      guard let letter = command else { break }
      let relative = letter.isLowercase
      let origin = relative ? current : .zero
      func point(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: origin.x + x, y: origin.y + y) }
      var cubicControl: CGPoint?
      var quadControl: CGPoint?

      switch letter.uppercased() {
      case "Z":
        commands.append(.close)
        current = start
      case "M":
        guard let x = scanner.number(), let y = scanner.number() else { return commands }
        current = point(x, y); start = current
        commands.append(.move(current))
      case "L":
        guard let x = scanner.number(), let y = scanner.number() else { return commands }
        current = point(x, y)
        commands.append(.line(current))
      case "H":
        guard let x = scanner.number() else { return commands }
        current = CGPoint(x: relative ? current.x + x : x, y: current.y)
        commands.append(.line(current))
      case "V":
        guard let y = scanner.number() else { return commands }
        current = CGPoint(x: current.x, y: relative ? current.y + y : y)
        commands.append(.line(current))
      case "C":
        guard let values = scanner.numbers(6) else { return commands }
        let c1 = point(values[0], values[1]), c2 = point(values[2], values[3]), end = point(values[4], values[5])
        commands.append(.cubic(c1, c2, end))
        cubicControl = c2; current = end
      case "S":
        guard let values = scanner.numbers(4) else { return commands }
        let c1 = lastCubicControl.map { reflect($0, about: current) } ?? current
        let c2 = point(values[0], values[1]), end = point(values[2], values[3])
        commands.append(.cubic(c1, c2, end))
        cubicControl = c2; current = end
      case "Q":
        guard let values = scanner.numbers(4) else { return commands }
        let control = point(values[0], values[1]), end = point(values[2], values[3])
        commands.append(.quad(control, end))
        quadControl = control; current = end
      case "T":
        guard let values = scanner.numbers(2) else { return commands }
        let control = lastQuadControl.map { reflect($0, about: current) } ?? current
        let end = point(values[0], values[1])
        commands.append(.quad(control, end))
        quadControl = control; current = end
      case "A":
        guard let rx = scanner.number(), let ry = scanner.number(), let rotation = scanner.number(),
              let largeArc = scanner.flag(), let sweep = scanner.flag(),
              let x = scanner.number(), let y = scanner.number() else { return commands }
        let end = point(x, y)
        commands.append(.arc(radii: CGSize(width: abs(rx), height: abs(ry)), rotation: rotation,
                             largeArc: largeArc, sweep: sweep, to: end))
        current = end
      default:
        return commands
      }
      lastCubicControl = cubicControl
      lastQuadControl = quadControl
    }
    return commands
  }

  private static func reflect(_ point: CGPoint, about center: CGPoint) -> CGPoint {
    CGPoint(x: 2 * center.x - point.x, y: 2 * center.y - point.y)
  }

  /// Absolute path data for parsed commands, e.g. to compare two parses.
  public static func pathData(_ commands: [PluginIconPathCommand]) -> String {
    func n(_ value: CGFloat) -> String {
      let rounded = (Double(value) * 10_000).rounded() / 10_000
      return rounded == rounded.rounded() ? String(Int(rounded)) : String(rounded)
    }
    func p(_ point: CGPoint) -> String { "\(n(point.x)) \(n(point.y))" }
    return commands.map { command in
      switch command {
      case .move(let to): "M\(p(to))"
      case .line(let to): "L\(p(to))"
      case .cubic(let c1, let c2, let to): "C\(p(c1)) \(p(c2)) \(p(to))"
      case .quad(let control, let to): "Q\(p(control)) \(p(to))"
      case .arc(let radii, let rotation, let largeArc, let sweep, let to):
        "A\(n(radii.width)) \(n(radii.height)) \(n(rotation)) \(largeArc ? 1 : 0) \(sweep ? 1 : 0) \(p(to))"
      case .close: "Z"
      }
    }.joined(separator: " ")
  }

  /// Build a Core Graphics path; arcs become cubic segments.
  public static func cgPath(_ commands: [PluginIconPathCommand]) -> CGPath {
    let path = CGMutablePath()
    var started = false
    for command in commands {
      switch command {
      case .move(let to): path.move(to: to); started = true
      case _ where !started: continue // SVG requires a moveto first
      case .line(let to): path.addLine(to: to)
      case .cubic(let c1, let c2, let to): path.addCurve(to: to, control1: c1, control2: c2)
      case .quad(let control, let to): path.addQuadCurve(to: to, control: control)
      case .arc(let radii, let rotation, let largeArc, let sweep, let to):
        addArc(to: path, from: path.currentPoint, radii: radii, rotation: rotation, largeArc: largeArc, sweep: sweep, end: to)
      case .close: path.closeSubpath()
      }
    }
    return path
  }

  /// SVG endpoint arc (implementation notes F.6) as cubic Béziers.
  private static func addArc(to path: CGMutablePath, from start: CGPoint, radii: CGSize, rotation: Double,
                             largeArc: Bool, sweep: Bool, end: CGPoint) {
    var rx = Double(radii.width), ry = Double(radii.height)
    guard start != end else { return }
    guard rx > 0, ry > 0 else { path.addLine(to: end); return }
    let phi = rotation * .pi / 180
    let cosPhi = cos(phi), sinPhi = sin(phi)
    let dx = (Double(start.x) - Double(end.x)) / 2, dy = (Double(start.y) - Double(end.y)) / 2
    let x1p = cosPhi * dx + sinPhi * dy
    let y1p = -sinPhi * dx + cosPhi * dy
    let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lambda > 1 { rx *= lambda.squareRoot(); ry *= lambda.squareRoot() }
    let numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    let denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    var factor = (max(0, numerator) / denominator).squareRoot()
    if largeArc == sweep { factor = -factor }
    let cxp = factor * rx * y1p / ry
    let cyp = -factor * ry * x1p / rx
    let cx = cosPhi * cxp - sinPhi * cyp + (Double(start.x) + Double(end.x)) / 2
    let cy = sinPhi * cxp + cosPhi * cyp + (Double(start.y) + Double(end.y)) / 2
    func angle(_ ux: Double, _ uy: Double, _ vx: Double, _ vy: Double) -> Double {
      atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    }
    let theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    var delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if !sweep && delta > 0 { delta -= 2 * .pi } else if sweep && delta < 0 { delta += 2 * .pi }

    let segments = max(1, Int((abs(delta) / (.pi / 2)).rounded(.up)))
    let step = delta / Double(segments)
    let k = 4.0 / 3.0 * tan(step / 4)
    func onEllipse(_ t: Double) -> (point: CGPoint, derivative: (Double, Double)) {
      let x = rx * cos(t), y = ry * sin(t)
      let point = CGPoint(x: cx + cosPhi * x - sinPhi * y, y: cy + sinPhi * x + cosPhi * y)
      let ddx = -rx * sin(t), ddy = ry * cos(t)
      return (point, (cosPhi * ddx - sinPhi * ddy, sinPhi * ddx + cosPhi * ddy))
    }
    var t = theta1
    var from = onEllipse(t)
    for index in 0..<segments {
      let next = onEllipse(t + step)
      let c1 = CGPoint(x: from.point.x + k * from.derivative.0, y: from.point.y + k * from.derivative.1)
      let c2 = CGPoint(x: next.point.x - k * next.derivative.0, y: next.point.y - k * next.derivative.1)
      path.addCurve(to: index == segments - 1 ? end : next.point, control1: c1, control2: c2)
      t += step; from = next
    }
  }

  // MARK: Points and transforms

  /// `points` of a polyline or polygon. An odd trailing coordinate is ignored.
  public static func parsePoints(_ text: String) -> [CGPoint] {
    var scanner = NumberScanner(text)
    var points: [CGPoint] = []
    while let x = scanner.number(), let y = scanner.number() { points.append(CGPoint(x: x, y: y)) }
    return points
  }

  /// A transform list as one matrix. Functions apply right to left, as in SVG.
  public static func parseTransform(_ text: String) -> CGAffineTransform {
    var result = CGAffineTransform.identity
    var rest = Substring(text)
    while let open = rest.firstIndex(of: "("), let close = rest[open...].firstIndex(of: ")") {
      let name = rest[..<open].trimmingCharacters(in: .whitespacesAndNewlines.union(.init(charactersIn: ",")))
      var scanner = NumberScanner(String(rest[rest.index(after: open)..<close]))
      var arguments: [Double] = []
      while let value = scanner.number() { arguments.append(value) }
      rest = rest[rest.index(after: close)...]
      guard let first = arguments.first else { continue }
      let matrix: CGAffineTransform
      switch name {
      case "translate":
        matrix = CGAffineTransform(translationX: first, y: arguments.count > 1 ? arguments[1] : 0)
      case "scale":
        matrix = CGAffineTransform(scaleX: first, y: arguments.count > 1 ? arguments[1] : first)
      case "rotate":
        let rotation = CGAffineTransform(rotationAngle: first * .pi / 180)
        if arguments.count == 3 {
          let (cx, cy) = (arguments[1], arguments[2])
          matrix = CGAffineTransform(translationX: -cx, y: -cy).concatenating(rotation)
            .concatenating(CGAffineTransform(translationX: cx, y: cy))
        } else {
          matrix = rotation
        }
      case "skewX":
        matrix = CGAffineTransform(a: 1, b: 0, c: tan(first * .pi / 180), d: 1, tx: 0, ty: 0)
      case "skewY":
        matrix = CGAffineTransform(a: 1, b: tan(first * .pi / 180), c: 0, d: 1, tx: 0, ty: 0)
      default:
        continue
      }
      // `A B` maps a point through B first, then A.
      result = matrix.concatenating(result)
    }
    return result
  }
}

/// Reads SVG numbers: `-1.5e2`, `.5.5` (two numbers), `1-2` (two numbers).
struct NumberScanner {
  private let bytes: [UInt8]
  private var index = 0

  init(_ text: String) { bytes = Array(text.utf8) }

  var isAtEnd: Bool { index >= bytes.count }

  mutating func skipSeparators() {
    while index < bytes.count, [32, 9, 10, 13, 11, 12, 44].contains(bytes[index]) { index += 1 }
  }

  mutating func commandLetter() -> Character? {
    guard index < bytes.count else { return nil }
    let character = Character(UnicodeScalar(bytes[index]))
    guard "MLHVCSQTAZmlhvcsqtaz".contains(character) else { return nil }
    index += 1
    return character
  }

  /// An arc flag: a single `0` or `1`, which may be followed directly by the next number.
  mutating func flag() -> Bool? {
    skipSeparators()
    guard index < bytes.count, bytes[index] == 48 || bytes[index] == 49 else { return nil }
    defer { index += 1 }
    return bytes[index] == 49
  }

  mutating func numbers(_ count: Int) -> [Double]? {
    var values: [Double] = []
    for _ in 0..<count {
      guard let value = number() else { return nil }
      values.append(value)
    }
    return values
  }

  mutating func number() -> Double? {
    skipSeparators()
    let begin = index
    func isDigit(_ i: Int) -> Bool { i < bytes.count && (48...57).contains(bytes[i]) }
    if index < bytes.count, bytes[index] == 43 || bytes[index] == 45 { index += 1 }
    var digits = false
    while isDigit(index) { index += 1; digits = true }
    if index < bytes.count, bytes[index] == 46 {
      index += 1
      while isDigit(index) { index += 1; digits = true }
    }
    guard digits else { index = begin; return nil }
    if index < bytes.count, bytes[index] == 101 || bytes[index] == 69 {
      var exponent = index + 1
      if exponent < bytes.count, bytes[exponent] == 43 || bytes[exponent] == 45 { exponent += 1 }
      if isDigit(exponent) {
        index = exponent
        while isDigit(index) { index += 1 }
      }
    }
    return Double(String(decoding: bytes[begin..<index], as: UTF8.self))
  }
}
