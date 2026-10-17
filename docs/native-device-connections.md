# 原生真实设备接入

Yun Home 的空调详情与设置中均提供“绑定真实设备”：填写 HA 地址和长期访问令牌，测试连接，选择空调实体并保存。主窗口、菜单栏与桌面空调通过 HomeStore 路由到同一个连接；绑定设备断线后禁用控制，不回退为虚拟开关。

## 仓库职责

| 位置 | 职责 |
| --- | --- |
| `air-conditioner` | 独立空调体验、模型、动画、通用状态与遥控界面 |
| `home/packages/home-device-kit` | 不依赖 App 的 Swift 连接、设备能力、状态订阅、指令确认、Keychain、Bonjour 发现 |
| `home/apps/macos/Sources/HomeCore` | 原生设备实例、本机绑定记录、虚拟 / 真实操作路由 |
| `home/apps/macos/Sources/YunHome` | 连接表单、设备选择和原生控制界面 |
| HA 内的小米官方集成 | 小米授权、具体设备协议与型号适配 |

home 根目录提供 Swift Package manifest；后续 CuteAC 可通过固定 commit / tag 的远程依赖导入 `HomeDeviceKit`。本次没有修改 air-conditioner 仓库，也未发布公共版本。

## 推荐接入路线

优先使用 `原生 App → HA climate 实体 → 小米官方 Xiaomi Home 集成 → 小米空调`。先确认在 HA 中能读取并控制真实空调，再在 Home 中绑定。无需 YunLe 登录，也无需把 HA 令牌交给云端服务。

| 方案 | 适用性 |
| --- | --- |
| HA + 小米官方集成 | 当前实现路线；通过 HA 统一设备差异和状态回报 |
| Bonjour / mDNS 及本机探测找到 HA | 已实现的辅助发现；本机 8123 端口验证 HA 握手，局域网浏览 Bonjour；仍需要授权和选择实体 |
| 小米设备 IP / MIoT 直接连接 | 需确认具体型号、固件、协议和设备授权；扫描出 IP 并不等于可以控制 |
| Matter | 如果具体设备提供 Matter 支持及配对码，可评估经 HA Matter 接入；不能假定现有小米空调支持 |
| 红外网关 / 空调伴侣 | 可供传统红外空调评估，但应区分“网关已发指令”与真实空调状态反馈 |

小米官方集成也不保证全程本地控制。官方说明：通常使用小米云；本地模式依赖支持的中枢及固件，另有受限的 LAN 控制功能，官方提示可能异常。是否适合家中设备需要按具体型号确认。[小米官方集成](https://github.com/XiaoMi/ha_xiaomi_home#faq)

参考：[HA Matter](https://www.home-assistant.io/integrations/matter/)、[米家空调伴侣](https://www.mi.com/ac-controller)。

## 验证状态

已用协议模拟和真实的本机 WebSocket 服务验证认证、实体读取、指令与回报流程；原生界面已用模拟 HA 验证绑定、Keychain 保存、设备范围与 0.5°C 调温。此 Mac 也已运行官方 HA Container 2026.10.1，并验证本机扫描。启动、数据位置和网络范围见[本机 HA 指南](../infra/home-assistant/README.md)。真实小米空调与家庭局域网发现仍需后续验收。

模块接口、复用方式与测试命令见 [HomeDeviceKit](../packages/home-device-kit/README.md)。
