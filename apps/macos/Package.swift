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
  dependencies: [
    .package(name: "YunHomeConnectivity", path: "../.."),
    // The air conditioner's state, Mac thermal readings, LCD, airflow and model,
    // shared with the standalone CuteAC menu bar app.
    .package(url: "https://github.com/YunYouJun/air-conditioner.git", revision: "f79cc1895131cbf24e146776bdee7f4e1f52bd13"),
  ],
  targets: [
    .target(name: "HomePlugins"),
    .executableTarget(name: "YunHomePluginHost", dependencies: ["HomePlugins"]),
    .target(name: "HomeCore", dependencies: [
      "HomePlugins",
      .product(name: "HomeDeviceKit", package: "YunHomeConnectivity"),
      .product(name: "CuteACCore", package: "air-conditioner"),
    ]),
    .executableTarget(
      name: "YunHome",
      dependencies: ["HomeCore", "HomePlugins", .product(name: "HomeDeviceKit", package: "YunHomeConnectivity"),
                     .product(name: "CuteACKit", package: "air-conditioner"),
                     .product(name: "ReleaseCheck", package: "air-conditioner")],
      resources: [.copy("Resources/ACRemote.usdz"), .copy("Resources/AirConditioner-LICENSE.txt"), .copy("Resources/Plugins")]
    ),
    .testTarget(name: "HomePluginsTests", dependencies: ["HomePlugins", "YunHomePluginHost"], resources: [.copy("Fixtures")]),
    .testTarget(name: "HomeCoreTests", dependencies: ["HomeCore", "HomePlugins", "YunHomePluginHost",
                                                   .product(name: "HomeDeviceKit", package: "YunHomeConnectivity")],
                resources: [.copy("Fixtures")]),
    .testTarget(name: "YunHomeTests", dependencies: ["YunHome", "HomeCore", .product(name: "CuteACKit", package: "air-conditioner")]),
  ],
  swiftLanguageModes: [.v5]
)
