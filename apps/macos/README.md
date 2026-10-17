# 云之彼端 · Yun Home for macOS

原生 Home App，把云空调的桌面体验扩展为整个家园。需要 macOS 14+、Swift 6 / Xcode。

```bash
# 在 home 仓库根目录运行
pnpm macos:dev
pnpm macos:test
pnpm macos:build
open apps/macos/build/YunHome.app
```

也可直接运行 `swift run --package-path apps/macos YunHome`、`swift test --package-path apps/macos` 和 `bash apps/macos/scripts/bundle.sh`，不需要安装 Node 依赖。

## 当前功能

- 统一主窗口：系统侧栏、紧凑工具栏、设备卡片、分组设置和自适应深浅色外观；全家概览、房间和设备详情共享导航，设备可以重新分配房间。
- 五类本机虚拟设备：空调冷暖与 16–31°C 调温；风扇风速、摇头、定时；扫地机器人清扫 / 暂停 / 回充状态模拟；暖手宝三档与定时；电视通过 AVPlayer 播放 HTTPS 视频、调节音量和静音。
- 菜单栏托盘：左键打开五类设备快捷控制，支持切换主窗口、桌面空调、桌面遥控器和配件置顶；点击设备进入详情。右键打开带勾选状态的原生菜单。在设置中可关闭或恢复菜单栏图标，偏好会自动保存。
- 快捷键：`⌘⇧K` 打开快捷控制、`⌘0` 恢复主窗口、`⌘,` 打开设置、`⌘W` 关闭窗口。隐藏菜单栏图标后，快捷控制会从主窗口打开；关闭主窗口后仍可从 Dock 恢复应用。通过菜单或快捷控制中的“退出”结束应用。
- 桌面空调：复用 CuteAC 的 3D 模型、导风板、温度显示和冷暖出风效果；拖动移动，双击开关，右键隐藏或切换置顶。
- 三维遥控器：原创圆角白色 USDZ 模型，LCD 同步显示温度、模式和连接状态；电源、升温、降温、冷暖切换四个按钮支持按压反馈，拖出按钮会取消操作。空调详情页可直接操作，也可独立显示在桌面，拖动机身移动，右键置顶或隐藏。
- 所有原生入口共享一个 `HomeStore`，状态和房间分配自动保存在本机 UserDefaults；桌面挂件的位置与显示偏好也会保存。
- 定时器按绝对时间运行，只在最近的截止时间唤醒一次；应用启动、唤醒、重新激活时也会检查到期时间。应用退出时无法执行定时操作，再次启动时补齐本机状态。
- 电视离开详情页或退出应用会暂停。菜单栏的电视开关只控制电源；播放在电视详情页进行。清扫进度、电量与回充均为虚拟体验，不能当作真实设备数据。

空调支持绑定 Home Assistant：在空调详情或设置中填写 HA 地址与长期访问令牌，测试连接、选择 `climate.*` 实体并保存。可主动查找局域网中的 HA；令牌存 Keychain，绑定记录只保存地址和实体 ID。真实设备的温度范围和步进以 HA 回报为准，支持 0.5°C 等小数步进。

绑定后，主窗口、菜单栏和桌面空调控制同一个实体。断线时取消待发操作并禁用控制，重连只读取状态；不会回退为虚拟空调。解除绑定保留令牌，“删除此 HA 的本机令牌”会删除凭据并断开连接。HA 服务调用成功后仍需状态确认，超时会重新读取并显示不确定结果。

本版不包含原生账号登录、CloudBase 同步、完整房屋布局编辑或 WidgetKit。原生存档与浏览器存档独立。当前真实设备适配只支持一个 HA 地址下的一台空调；实际型号与家庭网络仍需验收。

构建结果为本机临时签名应用，尚未进行 Developer ID 签名、公证或发布。

## 设备插件

原生客户端可以安装第三方设备插件，空调插件 `fun.yunle.air-conditioner` 是第一个。侧栏“家电市场”列出经审核的精选插件，也可以“从文件安装” `.yunplugin` 包（标记为未认证并在安装前提示）。

- **包格式**：`.yunplugin` 是只含 `manifest.json`、`state.js`、`controls.json` 三个文件的 zip，清单与 Web 家电市场共用。`state.js` 导出 `globalThis.plugin = { create, normalize, isAction, reduce, present }`，全部为 JSON 进、JSON 出的纯函数。
- **进程外沙箱**：插件脚本运行在随 App 打包的 `YunHomePluginHost` 进程里，每个插件独占一个 JavaScriptCore 虚拟机，没有定时器、网络、文件、模块或 `console`。每次调用 250 ms 超时，超时即结束宿主进程并在下次调用时自动重启；同一插件连续出错 3 次后停用，重新安装可恢复。插件无法拖慢或拖垮主 App。
- **原生渲染**：插件不提供界面代码，只用 `controls.json` 描述电源、表盘、步进、分段、滑杆等控件，App 用 SwiftUI 原生组件绘制。渲染只读取缓存的状态与展示信息，只有用户操作时才调用一次插件。同一设备的操作按顺序执行，快速连点不会互相覆盖。
- **宿主能力**：插件可在清单中请求宿主渲染器，例如 `renderer: "cute-ac-3d"` 复用现有 RealityKit 空调模型。权限白名单与 Web 一致，安装前逐条以中文说明。
- **安装与存档**：精选插件随 App 打包在 `Resources/Plugins`，安装时校验 `catalog.json` 中的 SHA-256；安装目录为 `~/Library/Application Support/YunHome/Plugins/<id>/`。插件设备保存在家园存档 `version: 2` 的 `plugins` 字段，v1 存档自动迁移。
- **应用图标**：清单和 `catalog.json` 可带 `appIcon`，格式与 Web 的 `devices/icon.ts` 相同（64×64 画布、双色背景、有限的形状 / 颜色令牌 / 变换 / 动效）。`PluginIcon` 解码时按 Web 的 `normalizePluginIcon` 校验并丢弃不支持的值，`PluginIconView` 用 `Canvas` 绘制，动效只在设备运行时播放并遵守“减弱动态效果”。没有图标时回退到 `symbol` + `tint`；精选插件的包里没有图标时使用 `catalog.json` 中审核过的图标。
- **云端风扇**：`cn.elpsy.electric-fan` 的沙箱包源码在 `PluginSources/electric-fan/`，用 `bash apps/macos/scripts/pack-plugin.sh apps/macos/PluginSources/electric-fan apps/macos/Sources/YunHome/Resources/Plugins/electric-fan.yunplugin` 可复现打包，并把输出的 SHA-256 写入 `catalog.json`。
- **更新精选插件**：在 air-conditioner 仓库运行 `pnpm -C packages/home-plugin build`（构建可复现），把 `dist/air-conditioner.yunplugin` 复制到 `Sources/YunHome/Resources/Plugins/` 与两个测试的 `Fixtures/`，并更新 `catalog.json` 的版本和 SHA-256。

## 结构与共享约定

```text
Sources/
  HomePlugins/           # 插件清单与控件校验、安装器、宿主协议与客户端
  YunHomePluginHost/     # 运行插件脚本的沙箱进程（JavaScriptCore）
  HomeCore/              # Codable 状态、动作规则、房间、本机存档、插件设备
  YunHome/
    AirConditioner/      # RealityKit 渲染 CuteAC USDZ 模型与原生出风效果
    HomeWindow.swift     # 全家、房间、设置
    DeviceDetail.swift   # 五类原生设备控制
    QuickControls.swift  # 菜单栏快捷控制
    DesktopAC.swift      # 桌面挂件
    DesktopRemote.swift  # 独立遥控器窗口
    Plugins/             # 家电市场、插件设备卡片与声明式控件渲染
Tests/HomePluginsTests/  # 清单、安装校验、沙箱、超时看门狗与空调插件契约测试
Tests/HomeCoreTests/     # 状态契约、持久化、定时、异常存档与插件设备测试
Tests/YunHomeTests/      # USDZ 部件、显示材质、导风板动画终态与相机交互测试
```

`HomeCore` 的设备标识、字段和动作语义对齐仓库根目录的 `types/device.ts` / `utils/device.ts`。目前 Swift 与 TypeScript 各自实现，通过契约测试维护一致性；没有将 JavaScript runtime 嵌入原生进程。原生全家存档封装和日期编码是本机格式，不能直接上传成 Web 的云记录。

三维空调使用 RealityKit，直接加载原始 `CuteAC.usdz`，保留导风板枢轴、Digital-7 温度贴图、冷暖指示灯、开机弹跳、拖动旋转与滚轮缩放。通过 `NSViewRepresentable` 包装 `ARView`，继续支持 macOS 14；模型异步加载，加载错误会显示在预览区域。冷暖出风继续由 Core Animation 绘制，设备状态仍由 `HomeCore` 管理。

状态、视角或尺寸变化时才创建 RealityKit 视图；动画结束后截取透明快照并释放渲染视图，静止时显示快照，避免隐藏 `ARView` 后仍持续渲染。窗口不可见或离开详情页时结束三维动画并移除出风动画，再次显示时按最新状态恢复。模型测试需要 Metal 设备，在没有 Metal 的 CI 主机上会跳过。

空调与遥控器共用按需渲染队列，同一时刻仅保留一个活动的 `ARView`，避免多个 macOS RealityKit 视图的相机和快照互相干扰。按钮命中区域由实际模型和相机投影计算，静止时无须恢复渲染循环。遥控器命令通过 `HomeStore` 执行，遵守虚拟空调温度范围，以及 Home Assistant 的能力、温度步长和连接状态；不可用的按钮会变暗并禁用。四个按钮也向辅助功能暴露标准按键操作。

遥控器的原创建模脚本在 `Model/build_ac_remote.py`，仅需 Python 3 和 macOS 的 `usdcat` / `usdzip`，可重新生成约 14 KB 的 `Resources/ACRemote.usdz`：

```bash
python3 apps/macos/Model/build_ac_remote.py
```

模型保留独立按钮枢轴和屏幕 UV，无额外纹理下载或三维运行时依赖；LCD 和品牌文字在应用中生成。

HA 连接实现位于仓库的独立 [HomeDeviceKit](../../packages/home-device-kit/README.md)，通过根目录 Swift Package 导出，不依赖 HomeCore 或 Home 界面。后续 air-conditioner 原生 App 可以导入同一模块。路线比较见 [原生设备接入](../../docs/native-device-connections.md)。

下一阶段接入云端时，需要为原生客户端单独注册 OAuth / PKCE 回调和登录会话；Web 端的 `home-web` 重定向注册与 CloudBase 浏览器会话不能直接复用。HA 令牌仅保存在 Keychain，并继续保持“云端快照不自动发设备指令”的规则。

## 来源

空调原生渲染、USDZ 模型与 Digital-7 字体参考并移植自 [YunYouJun/air-conditioner](https://github.com/YunYouJun/air-conditioner/tree/983960fd642a1edde3baf0278f8255326d6b3aee/apps/macos)。代码采用 MIT 授权，原始许可随资源一起打包在 `Resources/AirConditioner-LICENSE.txt`；新增 App 的状态和窗口由本仓库维护，构建不依赖相邻仓库。

Digital-7 字体沿用上游资源，上游注明仅限个人免费使用，公开商业分发前需确认字体授权。

实现参考：[Apple NavigationSplitView](https://developer.apple.com/documentation/swiftui/navigationsplitview)、[Apple RealityKit](https://developer.apple.com/documentation/realitykit)、[Apple ARView](https://developer.apple.com/documentation/realitykit/arview)。

## 验证与截图

```bash
swift test
swift test --package-path apps/macos
bash apps/macos/scripts/bundle.sh
apps/macos/build/YunHome.app/Contents/MacOS/YunHome --capture /tmp/yun-home-preview
```

`--demo` 和 `--capture <目录>` 使用单独的演示存档，不更改常用家园；添加 `--appearance light` 或 `--appearance dark` 可单独检查应用外观，不更改系统外观设置。截图模式打开主窗口并导出 `home.png` 后退出；演示模式供手动检查房间切换、设备控制、菜单栏和桌面挂件。
