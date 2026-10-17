import CoreGraphics
import Foundation
import Testing
@testable import HomePlugins

private let pluginsDirectory = URL(fileURLWithPath: #filePath)
  .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
  .appendingPathComponent("Sources/YunHome/Resources/Plugins", isDirectory: true)

private func normalize(_ json: String) throws -> (icon: PluginIcon?, errors: [String]) {
  PluginIcon.normalize(try JSONValue.parse(json))
}

private func shapes(_ shapes: String) -> String { ##"{"background":["#e2f0ff","#b3d5f7"],"shapes":[\##(shapes)]}"## }

private func pathData(_ data: String) -> String { PluginIconGeometry.pathData(PluginIconGeometry.parsePath(data)) }

// MARK: Validator

@Test func validatorAcceptsEveryBundledIcon() throws {
  let catalog = try PluginCatalog.load(from: pluginsDirectory.appendingPathComponent("catalog.json"))
  #expect(catalog.plugins.map(\.id) == ["fun.yunle.air-conditioner", "cn.elpsy.electric-fan"])
  for entry in catalog.plugins {
    let icon = try #require(entry.appIcon, "\(entry.id) has no icon")
    // Re-validating the decoded icon is lossless: nothing was dropped on the way in.
    let raw = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(icon))
    let result = PluginIcon.normalize(raw)
    #expect(result.errors.isEmpty, "\(entry.id): \(result.errors)")
    #expect(result.icon == icon)
  }
}

@Test func bundledPackagesMatchTheCatalog() throws {
  let catalog = try PluginCatalog.load(from: pluginsDirectory.appendingPathComponent("catalog.json"))
  let root = FileManager.default.temporaryDirectory.appendingPathComponent("plugin-icons-\(UUID().uuidString)", isDirectory: true)
  defer { try? FileManager.default.removeItem(at: root) }
  let installer = PluginInstaller(root: root)
  for entry in catalog.plugins {
    let plugin = try installer.install(archive: pluginsDirectory.appendingPathComponent(entry.package), expectedSHA256: entry.sha256)
    #expect(plugin.id == entry.id && plugin.manifest.version == entry.version && plugin.manifest.symbol == entry.symbol)
    // A package that ships its own icon must agree with the reviewed listing.
    if let icon = plugin.manifest.appIcon { #expect(icon == entry.appIcon) }
  }
}

@Test func validatorDropsHostileValues() throws {
  let result = try normalize(shapes(#"""
    {"type":"path","d":"M0 0L10 10","fill":"url(#steal)","stroke":"red","onclick":"alert(1)","href":"https://evil.example"},
    {"type":"rect","x":"3","y":1e9,"width":true,"height":10,"transform":"matrix(1 0 0 1 0 0)"},
    {"type":"circle","r":4,"fill":"#fff\n","transform":"rotate(45 32 32) translate(1,2)"},
    {"type":"path","d":"M0 0 <script>alert(1)</script>"},
    {"type":"path","d":"M0 0 url(javascript:alert(1))"},
    {"type":"circle","r":2,"motion":"explode","when":"always","linecap":"evil","origin":[1,"x"]},
    {"type":"image","href":"https://evil.example/x.png"},
    {"type":"foreignObject"},
    "path"
  """#))
  let icon = try #require(result.icon)
  #expect(icon.shapes.map(\.type) == [.path, .rect, .circle, .path, .path, .circle])
  #expect(icon.shapes[0].fill == nil && icon.shapes[0].stroke == nil && icon.shapes[0].d == "M0 0L10 10")
  #expect(icon.shapes[1].x == nil && icon.shapes[1].y == nil && icon.shapes[1].width == nil && icon.shapes[1].height == 10)
  #expect(icon.shapes[1].transform == nil)
  #expect(icon.shapes[2].fill == nil && icon.shapes[2].transform == "rotate(45 32 32) translate(1,2)")
  #expect(icon.shapes[3].d == nil && icon.shapes[4].d == nil)
  #expect(icon.shapes[5].motion == nil && icon.shapes[5].when == nil && icon.shapes[5].linecap == nil && icon.shapes[5].origin == nil)
  #expect(result.errors.contains("icon.shapes[0].fill: unsupported colour"))
  #expect(result.errors.contains("icon.shapes[1].transform: unsupported transform"))
  #expect(result.errors.contains("icon.shapes[5].motion: unknown motion"))
  #expect(result.errors.contains("icon.shapes[6]: unknown shape"))
  #expect(result.errors.contains("icon.shapes[8]: unknown shape"))
  // Unknown keys never survive a round trip.
  let encoded = String(decoding: try JSONEncoder().encode(icon), as: UTF8.self)
  #expect(!encoded.contains("onclick") && !encoded.contains("href") && !encoded.contains("evil"))
}

@Test func validatorEnforcesSizeLimits() throws {
  let many = Array(repeating: #"{"type":"circle","r":1}"#, count: 81).joined(separator: ",")
  let crowded = try normalize(shapes(many))
  #expect(crowded.icon?.shapes.count == PluginIcon.Limits.shapes)
  #expect(crowded.errors == ["icon.shapes[80]: more than 80 shapes"])

  var nested = #"{"type":"circle","r":1}"#
  for _ in 0..<4 { nested = #"{"type":"group","children":[\#(nested)]}"# }
  let deep = try normalize(shapes(nested))
  #expect(deep.errors == ["icon.shapes[0].children[0].children[0].children[0]: nested too deeply"])
  #expect(deep.icon?.shapes[0].children?[0].children?[0].children?[0].children == nil)

  let long = "M0 0" + String(repeating: "L1 1", count: 1000)
  #expect(try normalize(shapes(#"{"type":"path","d":"\#(long)"}"#)).icon?.shapes[0].d == nil)
  let longTransform = String(repeating: "scale(1) ", count: 30)
  #expect(try normalize(shapes(#"{"type":"circle","r":1,"transform":"\#(longTransform)"}"#)).icon?.shapes[0].transform == nil)
}

@Test func validatorRejectsUnusableIcons() throws {
  #expect(try normalize(#"{"background":"red","shapes":[{"type":"circle","r":1}]}"#).icon == nil)
  #expect(try normalize(##"{"background":["#fff","blue"],"shapes":[{"type":"circle","r":1}]}"##).icon == nil)
  #expect(try normalize(##"{"background":["#fff","#000"],"shapes":[]}"##).icon == nil)
  #expect(try normalize(##"{"background":["#fff","#000"],"shapes":[{"type":"script"}]}"##).icon == nil)
  #expect(try normalize(##"["#fff"]"##).icon == nil)
  let dark = try normalize(##"{"background":["#fff","#000"],"backgroundDark":["#000"],"shapes":[{"type":"circle","r":1}]}"##)
  #expect(dark.icon?.backgroundDark == nil && dark.errors == ["icon.backgroundDark: expected two hex colours"])
  #expect(PluginIcon.isPaint("#0f2a4a80") && PluginIcon.isPaint("tone-soft") && !PluginIcon.isPaint("#12345") && !PluginIcon.isPaint("currentColor"))
}

@Test func manifestsRejectAnUnusableIconButKeepASanitizedOne() throws {
  func manifest(icon: String) -> Data {
    Data("""
    {"id":"com.example.lamp","version":"1.0.0","sdk":1,"runtime":"sandbox","name":"台灯","description":"",
     "author":{"name":"Example"},"category":"comfort","symbol":"lamp.desk","permissions":[],"appIcon":\(icon),
     "entry":{"state":"state.js","controls":"controls.json"}}
    """.utf8)
  }
  let decoded = try JSONDecoder().decode(PluginManifest.self, from: manifest(icon: shapes(#"{"type":"circle","r":4,"fill":"url(#x)"}"#)))
  #expect(decoded.appIcon?.shapes.first?.fill == nil)
  #expect(throws: PluginError.self) {
    try JSONDecoder().decode(PluginManifest.self, from: manifest(icon: ##"{"background":["#fff","#000"],"shapes":[]}"##))
  }
}

// MARK: Geometry

@Test func pathParserRoundTripsTheFanPetal() {
  let petal = "M0 -10C16 -10 29 -23 29 -39C29 -67.2 16 -90 0 -90C-16 -90 -29 -67.2 -29 -39C-29 -23 -16 -10 0 -10Z"
  let commands = PluginIconGeometry.parsePath(petal)
  #expect(commands.count == 6)
  #expect(commands.first == .move(CGPoint(x: 0, y: -10)) && commands.last == .close)
  #expect(commands[2] == .cubic(CGPoint(x: 29, y: -67.2), CGPoint(x: 16, y: -90), CGPoint(x: 0, y: -90)))
  let absolute = PluginIconGeometry.pathData(commands)
  #expect(absolute == "M0 -10 C16 -10 29 -23 29 -39 C29 -67.2 16 -90 0 -90 C-16 -90 -29 -67.2 -29 -39 C-29 -23 -16 -10 0 -10 Z")
  #expect(PluginIconGeometry.parsePath(absolute) == commands)
  let bounds = PluginIconGeometry.cgPath(commands).boundingBoxOfPath
  #expect(abs(bounds.minX + 29) < 0.01 && abs(bounds.maxX - 29) < 0.01 && abs(bounds.minY + 90) < 0.01 && abs(bounds.maxY + 10) < 0.01)
}

@Test func pathParserResolvesRelativeSmoothQuadratics() {
  // The air conditioner's airflow: `t` reflects the previous `q` control point.
  for (x, expected) in [(21, "M21 40 Q19 43.5 21 47 Q23 50.5 21 54"), (32, "M32 40 Q30 43.5 32 47 Q34 50.5 32 54"),
                        (43, "M43 40 Q41 43.5 43 47 Q45 50.5 43 54")] {
    let source = "M\(x) 40q-2 3.5 0 7t0 7"
    #expect(pathData(source) == expected)
    #expect(PluginIconGeometry.parsePath(expected) == PluginIconGeometry.parsePath(source))
  }
  #expect(pathData("M14 31h36l-2.4 4.2H16.4Z") == "M14 31 L50 31 L47.6 35.2 L16.4 35.2 Z")
  // Without a previous quadratic, `T` uses the current point as its control.
  #expect(pathData("M0 0T10 0") == "M0 0 Q0 0 10 0")
  #expect(pathData("M0 0s5 5 10 0") == "M0 0 C0 0 5 5 10 0")
}

@Test func pathParserHandlesCompactAndMalformedData() {
  #expect(pathData("M1.5.5L-1-2v3") == "M1.5 0.5 L-1 -2 L-1 1")
  #expect(pathData("m1 1 2 2 3 3") == "M1 1 L3 3 L6 6")
  #expect(pathData("M0 0a5 5 0 1010 0") == "M0 0 A5 5 0 1 0 10 0")
  #expect(pathData("M1e1 2E-1") == "M10 0.2")
  #expect(pathData("M0 0L5") == "M0 0")
  #expect(pathData("M0 0Z 5 5") == "M0 0 Z")
  #expect(pathData("L5 5") == "L5 5")
  #expect(PluginIconGeometry.cgPath(PluginIconGeometry.parsePath("L5 5")).isEmpty)

  let arc = PluginIconGeometry.cgPath(PluginIconGeometry.parsePath("M0 0A5 5 0 0 1 10 0")).boundingBoxOfPath
  #expect(abs(arc.minX) < 0.01 && abs(arc.maxX - 10) < 0.01 && abs(arc.minY + 5) < 0.05 && abs(arc.maxY) < 0.01)
}

@Test func transformsApplyRightToLeft() {
  func apply(_ text: String, _ point: CGPoint) -> CGPoint { point.applying(PluginIconGeometry.parseTransform(text)) }
  func close(_ a: CGPoint, _ b: CGPoint) -> Bool { abs(a.x - b.x) < 1e-9 && abs(a.y - b.y) < 1e-9 }
  #expect(close(apply("translate(32 25) rotate(90) scale(0.5)", CGPoint(x: 2, y: 0)), CGPoint(x: 32, y: 26)))
  #expect(close(apply("rotate(90 10 10)", CGPoint(x: 20, y: 10)), CGPoint(x: 10, y: 20)))
  #expect(close(apply("skewX(45)", CGPoint(x: 0, y: 1)), CGPoint(x: 1, y: 1)))
  #expect(close(apply("scale(2,3) translate(1)", CGPoint(x: 0, y: 1)), CGPoint(x: 2, y: 3)))
  #expect(PluginIconGeometry.parsePoints("0,0 10 5, 3") == [CGPoint(x: 0, y: 0), CGPoint(x: 10, y: 5)])
}
