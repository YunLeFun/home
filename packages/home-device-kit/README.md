# HomeDeviceKit

home 仓库内独立的 Swift 原生设备连接模块。当前实现 Home Assistant 空调，供 Yun Home 使用，后续可由 CuteAC 等独立原生应用复用。模块不依赖 HomeCore、SwiftUI、Nuxt、CloudBase 或 YunLe 登录。

根目录的 `Package.swift` 导出 `HomeDeviceKit` library；源码和测试位于本目录。这样其他仓库可以通过正常的远程 SwiftPM 依赖使用它，无需依赖 Home 的整个 App，也无需本机相邻仓库路径。当前版本需先提交并推送，再固定 commit 或发布 tag 供其他仓库拉取。

## 能力

- 手动填写 HA 地址，以及用户主动触发的 8 秒 Bonjour 服务发现（`_home-assistant._tcp.`）。同时探测本机 `127.0.0.1:8123` 的 HA WebSocket 握手（3 秒超时、不认证），以支持 Mac 虚拟机中的容器；不进行网段端口扫描。
- 官方 HA WebSocket 协议：认证、请求 ID、超时、`state_changed` 订阅、实体读取、心跳与连接恢复。
- `climate.*` 实体选择、可用性、摄氏温标、温度范围与步进、模式与温度控制能力识别。
- 显式操作才发指令；连续调温延迟 600 ms 合并，设备命令串行执行。
- 关机时修改温度或冷暖模式只保存本次连接的偏好，下次用户开机时应用。断线时取消这些偏好和所有未发送指令；重连只订阅、读取，不重放操作。
- 服务调用成功后继续等待 HA 状态确认；5 秒未确认则重新读取，仍不匹配时显示不确定结果。HA 回报不能独立证明物理硬件已经执行。
- 实体进入除湿、送风等其他模式时保留实际模式，调温不会自动切成制冷；界面暂只提供制冷 / 制热的模式切换。
- 令牌按规范化 HA 地址存入 Keychain。测试连接不保存令牌；保存绑定才写入钥匙串。解绑保留令牌，删除本机令牌会断开连接。
- HTTP 仅用于回环地址、私有 IPv4、IPv6 ULA/link-local、`.local` / `.home.arpa`；公网使用 HTTPS/WSS。证书照常验证，拒绝 WebSocket HTTP 重定向。

本版支持一个绑定空调、一个 HA 地址。未来多设备连接池、原生 OAuth 登录及其他设备种类可以扩展模块；Web 端继续使用现有 `home-assistant-js-websocket` 实现，Swift 和 TypeScript 不共用二进制代码。

## 使用

在 Home 仓库运行：

```bash
swift test
# 或 pnpm device-kit:test
```

连接与绑定由调用者显式触发：

```swift
import HomeDeviceKit

// 在 MainActor 上持有连接；UI 根据 state、snapshot、pending、error 更新。
let connection = HomeAssistantClimate(
  credentials: HAKeychainCredentials(service: "your.app.home-assistant")
)
try await connection.connect(to: HAEndpoint(address), token: tokenFromSecureField)
let binding = try connection.bind(entityID: selectedClimateEntityID)
// 仅持久化 binding（endpoint + entityID），不把 token 放入配置或云同步。

// 仅在用户明确操作时调用：
connection.request(.power(true))
connection.request(.temperature(25.5))
connection.request(.mode("heat"))

// 下次启动根据保存的 binding 和钥匙串恢复；不下发设备指令。
await connection.restore(binding)
```

不同 App 默认应使用各自的 Keychain service 和授权流程；引入同一个 Swift Package 不会自动共享钥匙串访问权限或登录凭据。

使用 Bonjour 的宿主 App 需要声明 `NSLocalNetworkUsageDescription` 与 `NSBonjourServices = ["_home-assistant._tcp"]`，并在用户请求查找时调用 `HADiscovery.start()`；界面消失时 `stop()`。局域网 HTTP 需要 `NSAppTransportSecurity.NSAllowsLocalNetworking = true`。这些已经配置在 Home 的打包脚本中。

## 测试

协议测试注入 `HAWebSocket` 和 `HACredentialStore`，覆盖认证失败、截止时间、设备能力、温度合并、状态确认、初始订阅竞态、实体移除及无令牌恢复。

另有两个实际 `URLSessionWebSocketTask` 测试，启动只监听 `127.0.0.1` 的 Python 标准库模拟 HA 服务，验证真实 WebSocket 握手、认证、订阅、服务调用与状态回报。这些测试不访问用户钥匙串，也不连接真实设备。需要开发机上的 `/usr/bin/python3`；CI 在 macOS 上运行。

手动界面联调可运行：

```bash
python3 packages/home-device-kit/Tests/fixtures/ha_server.py
# 终端输出随机端口；在 App 填 http://127.0.0.1:<端口>
# 仅供这个模拟服务使用的测试令牌：home-test-token
```

模拟联调不能替代真实小米型号、HA 集成、家庭网络和物理执行验收。Bonjour 能否发现取决于 HA 的 zeroconf、网络组播、权限和容器网络配置；找不到时仍可手动填写地址。

协议依据：[HA WebSocket API](https://developers.home-assistant.io/docs/api/websocket/)、[HA zeroconf](https://www.home-assistant.io/integrations/zeroconf/)。
