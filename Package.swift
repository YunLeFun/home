// swift-tools-version: 6.0
import PackageDescription

// The root manifest lets other repositories consume this library with a normal
// remote SwiftPM dependency. The native app remains a separate package.
let package = Package(
  name: "YunHomeConnectivity",
  platforms: [.macOS(.v14), .iOS(.v17)],
  products: [.library(name: "HomeDeviceKit", targets: ["HomeDeviceKit"])],
  targets: [
    .target(name: "HomeDeviceKit", path: "packages/home-device-kit/Sources/HomeDeviceKit"),
    .testTarget(name: "HomeDeviceKitTests", dependencies: ["HomeDeviceKit"],
                path: "packages/home-device-kit/Tests/HomeDeviceKitTests"),
  ],
  swiftLanguageModes: [.v5]
)
