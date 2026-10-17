// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "YunHome",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "YunHome", targets: ["YunHome"]),
    // Runs third-party plugin scripts out of process; bundled next to the app executable.
    .executable(name: "YunHomePluginHost", targets: ["YunHomePluginHost"]),
  ],
  dependencies: [.package(name: "YunHomeConnectivity", path: "../..")],
  targets: [
    .target(name: "HomePlugins"),
    .executableTarget(name: "YunHomePluginHost", dependencies: ["HomePlugins"]),
    .target(name: "HomeCore", dependencies: ["HomePlugins", .product(name: "HomeDeviceKit", package: "YunHomeConnectivity")]),
    .executableTarget(
      name: "YunHome",
      dependencies: ["HomeCore", "HomePlugins", .product(name: "HomeDeviceKit", package: "YunHomeConnectivity")],
      resources: [.copy("Resources/CuteAC.usdz"), .copy("Resources/ACRemote.usdz"), .copy("Resources/digital-7-mono.ttf"),
                  .copy("Resources/AirConditioner-LICENSE.txt"), .copy("Resources/Plugins")]
    ),
    .testTarget(name: "HomePluginsTests", dependencies: ["HomePlugins", "YunHomePluginHost"], resources: [.copy("Fixtures")]),
    .testTarget(name: "HomeCoreTests", dependencies: ["HomeCore", "HomePlugins", "YunHomePluginHost",
                                                   .product(name: "HomeDeviceKit", package: "YunHomeConnectivity")],
                resources: [.copy("Fixtures")]),
    .testTarget(name: "YunHomeTests", dependencies: ["YunHome", "HomeCore"]),
  ],
  swiftLanguageModes: [.v5]
)
