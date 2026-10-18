# HomeDeviceKit

home 仓库内独立的 Swift 原生设备连接模块。当前实现 Home Assistant 空调，由 Yun Home 和 CuteAC 原生 App 共用。模块不依赖 HomeCore、SwiftUI、Nuxt、CloudBase 或 YunLe 登录。

根目录的 `Package.swift` 导出 `HomeDeviceKit` library；源码和测试位于本目录。这样其他仓库可以通过正常的远程 SwiftPM 依赖使用它，无需依赖 Home 的整个 App，也无需本机相邻仓库路径。当前版本需先提交并推送，再固定 commit 或发布 tag 供其他仓库拉取。

## 能力

- 手动填写 HA 地址，以及用户主动触发的 8 秒 Bonjour 服务发现（`_home-assistant._tcp.`）。同时探测本机 `127.0.0.1:8123` 的 HA WebSocket 握手（3 秒超时、不认证），以支持 Mac 虚拟机中的容器；不进行网段端口扫描。
- 官方 HA WebSocket 协议：认证、请求 ID、超时、`state_changed` 订阅、实体读取、心跳与连接恢复。
- `climate.*` 实体选择、可用性、摄氏温标、温度范围与步进、模式与温度控制能力识别。优先使用实体的 `temperature_unit`；旧版 HA 缺少该字段时读取 `get_config.unit_system.temperature`。温标未知或为华氏度时禁止绑定和控制，系统单位变更会断开并重新读取。
- `loadRooms()` 可读取 HA 的实体、设备、分区注册表，实体分区优先于设备分区。没有权限时保留手动分配房间的能力。
- 显式操作才发指令；连续调温延迟 600 ms 合并，设备命令串行执行。
- 关机时修改温度或冷暖模式只保存本次连接的偏好，下次用户开机时应用。断线时取消这些偏好和所有未发送指令；重连只订阅、读取，不重放操作。
- 服务调用成功后继续等待 HA 状态确认；5 秒未确认则重新读取，仍不匹配时显示不确定结果。HA 回报不能独立证明物理硬件已经执行。
- 实体进入除湿、送风等其他模式时保留实际模式，调温不会自动切成制冷；界面暂只提供制冷 / 制热的模式切换。
- 令牌按规范化 HA 地址存入 Keychain。测试连接不保存令牌；保存绑定才写入钥匙串。解绑保留令牌，删除本机令牌会断开连接。
- HTTP 仅用于回环地址、私有 IPv4、IPv6 ULA/link-local、`.local` / `.home.arpa`；公网使用 HTTPS/WSS。证书照常验证，拒绝 WebSocket HTTP 重定向。

每个 `HomeAssistantClimate` 实例管理一台空调。待发指令、确认、离线状态相互独立。`HADeviceCollection` 为伴随 App 管理多设备连接，按需恢复选中的设备；切换目标不重定向已排队的命令，移除当前绑定会回到虚拟模式。Web 端继续使用现有 `home-assistant-js-websocket` 实现，Swift 和 TypeScript 不共用二进制代码。

## Home 与 CuteAC 共用绑定

Home 启动和更新绑定时，通过 `HAFileBindingCatalog` 原子写入 `~/Library/Application Support/YunHome/ha-bindings.json`（文件权限 600）。`HASharedDevice` 只包含 HA 地址、实体、设备名称、房间 ID 和名称；文件不包含令牌或当前选中的设备。Home 是目录的写入方，CuteAC 每 3 秒及打开弹窗时读取变化；删掉绑定会断开对应连接，目录损坏则清空可用目标。

这两个 App 明确共用钥匙串 service `fun.yunle.home.home-assistant`，按 HA 地址读取已有令牌。macOS 仍可能要求使用者手动允许 CuteAC 访问钥匙串项目；代码不绕过授权、不把令牌复制到配置文件。当前机制面向同一用户下的非沙箱 macOS App；沙箱/App Store 版本需另行配置 App Group 和 Keychain Access Group。

默认连接使用进程内共享的 `HASessionCredentials.shared`：同一 HA 地址的多台设备只读取一次钥匙串，切换设备、网络自动重连沿用本次会话的令牌。拒绝/取消授权也暂存读取结果，避免其他设备紧接着再次弹窗；点击“重新连接”才清除该地址的缓存并重试。保存、删除令牌或 HA 拒绝认证时会刷新/清除缓存。另一个 App 更新令牌后，在当前 App 点击“重新连接”读取新值。自定义 service 时应让所有连接共用一个 `HASessionCredentials(store: HAKeychainCredentials(service: ...))`。缓存仅在内存中，不改变现有 Keychain service/account、绑定格式或访问控制。

升级授权还取决于应用签名：ad-hoc 签名的身份与代码哈希绑定，每次构建可能需要重新授权。正式版本应持续使用相同的 Developer ID 签名身份和 Bundle ID；打包脚本支持 `CODE_SIGN_IDENTITY`。从旧 ad-hoc 包首次切换到固定签名时，系统仍可能要求用户对两款 App 分别选择“始终允许”。不要通过允许所有应用访问、删除令牌或把令牌写入共享 JSON 来消除提示。详见 [Apple 关于代码身份和 Keychain 的说明](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements)。

选择状态分别保存在各 App 的 UserDefaults 中。Home 改变当前目标不会切换 CuteAC 的目标；设备状态则由各自的 HA 订阅同步。连接、切换、重启恢复和刷新绑定都不下发控制指令。

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
  credentials: HASessionCredentials(store: HAKeychainCredentials(service: "your.app.home-assistant"))
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

其他 App 可指定自己的 Keychain service；引入同一个 Swift Package 不会自动共享钥匙串访问权限。复用 Home 绑定时使用上述约定及系统授权。

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
