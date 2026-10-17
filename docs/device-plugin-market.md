# 设备插件市场设计

Home 支持安装设备插件，并提供插件市场展示。插件分两类：

- **一方插件**：YunLe 维护，随 Home 构建发布，在 Home 页面内直接运行。
- **第三方插件**：外部开发者提交，经审核后上架，在隔离沙箱中运行，只能通过受控接口与 Home 通信。

本文承接 [空调插件拆分设计](air-conditioner-plugin-split.md)。

## 安全前提

Home 页面同源内保存着 HA 长期访问令牌（localStorage）和 CloudBase 登录会话。任何在 Home 源内执行的代码都能读取它们。因此：

1. 只有一方插件可以在 Home 源内执行，且必须随构建发布、经过代码评审。**Home 永不在运行时从网络加载并执行插件代码。**
2. 第三方插件代码只在不同源、无同源权限的 `sandbox` iframe 中执行。
3. 第三方插件拿不到任何令牌；需要真实设备能力时，由 Home 代为调用，并限定在用户明确授权的实体上。

## 信任等级

| 等级 | 来源 | 运行方式 | 市场标识 |
| --- | --- | --- | --- |
| 官方 | YunLe 仓库，构建期打包 | Home 源内，按需加载的独立 chunk | 官方 |
| 认证第三方 | 第三方提交，人工审核，CI 构建 | 沙箱 iframe | 已认证 |
| 开发者模式 | 开发者本机 `http://localhost:*` | 沙箱 iframe，仅本浏览器，需手动开启 | 开发中 |

未审核的第三方插件不会出现在市场中。开发者模式只对开启它的用户本人生效，不写入云端。

## 包与仓库

| 包 / 服务 | 位置 | 作用 |
| --- | --- | --- |
| `@yunlefun-home/device-sdk` | Home 仓库 `packages/device-sdk`，发布到 npm | 清单类型与校验、`defineDevicePlugin`、宿主上下文 `useDeviceHost()`、沙箱客户端 `connectHost()`、协议类型 |
| `@yunlefun-home/air-conditioner-home` | air-conditioner 仓库新包 | 空调一方插件，只依赖 SDK、core、controls |
| `create-home-plugin` | 模板仓库 | 第三方插件脚手架：Vite + SDK 沙箱客户端 + 本地预览 |
| `home-plugins` 注册仓库 | GitHub | 第三方插件以 PR 提交清单与源码地址，CI 校验与构建 |
| 插件托管域 `plugins.yunle.fun` | Cloudflare Workers Assets | 只托管审核通过的第三方构建产物，按版本不可变 |
| 插件目录 `home_plugin_catalog` | CloudBase，管理员写入 | 市场展示数据；Home 内置快照作为离线兜底 |
| 安装记录 `home_installed_plugins` | CloudBase，`PRIVATE`，`_openid + pluginId` 唯一 | 用户安装状态，LWW 同步；游客存本地 |

`device-sdk` 是宿主与插件之间唯一的契约，解决“插件需要 Home 类型、Home 又依赖插件”的循环依赖。

## 插件清单

一方与第三方共用一份清单格式，`runtime` 区分运行方式。

```ts
interface DevicePluginManifest {
  /** 反向域名，全局唯一，如 fun.yunle.air-conditioner、com.example.dehumidifier */
  id: string
  version: string
  /** 兼容的 SDK 版本范围 */
  sdk: string
  runtime: 'bundled' | 'sandbox'
  name: string
  description: string
  author: { name: string, url?: string }
  category: 'climate' | 'cleaning' | 'media' | 'comfort' | 'sensor' | 'fun'
  /** 插件自行设计的应用图标，见下文“插件图标” */
  appIcon: DevicePluginIcon
  screenshots: string[]
  /** 场景尺寸（SVG 世界坐标）与可摆放面 */
  size: { width: number, height: number }
  surfaces: ('wall' | 'floor' | 'tabletop')[]
  /** 申请的权限，安装时展示并由用户确认 */
  permissions: PluginPermission[]
  /** 第三方插件：托管地址与产物哈希，仅由审核流水线写入 */
  entry?: { url: string, integrity: string }
}

type PluginPermission =
  | 'storage' // 每个实例 16 KB 状态，随账号同步
  | 'notify' // 在 Home 内弹出提示
  | 'sensor:compute-pressure' // 读取浏览器 CPU 压力
  | `network:${string}` // 访问指定 HTTPS 源
  | `home-assistant:${string}` // 代理调用用户为该实例绑定的某类 HA 实体，如 home-assistant:climate
```

## 插件图标

每个插件自己设计应用图标，市场、设备托盘、快捷控制都用它展示。图标是声明式矢量数据（`devices/icon.ts`），不是 SVG 文本：

```ts
export const fanIcon = definePluginIcon({
  background: ['#e0f7ec', '#a7dfc3'], // 底板渐变，可另给 backgroundDark
  shapes: [
    { type: 'circle', cx: 32, cy: 25, r: 17, fill: 'surface' },
    { type: 'group', motion: 'spin', origin: [32, 25], children: [/* 扇叶 */] },
    { type: 'path', d: 'M21 40q-2 3.5 0 7', stroke: 'tone', when: 'active', motion: 'flow' },
  ],
})
```

- 画布 64 × 64；图形只有 `group`、`path`、`circle`、`ellipse`、`rect`、`line`、`polyline`、`polygon`，属性白名单固定。
- 颜色只接受十六进制与宿主色板：`tone`、`tone-soft` 跟随设备状态（制冷、制热、暖光…），`surface`、`ink` 跟随深浅色。
- `when: 'active' | 'idle'` 按运行状态显隐；`motion` 只能选宿主动效 `spin`、`sway`、`pulse`、`float`、`blink`、`flow`，设备运行时播放，并遵循“减少动态效果”。
- `normalizePluginIcon()` 校验并清洗第三方图标：丢弃未知图形与属性、`url()`、脚本、事件与外部引用，限制图形数量（80）、嵌套（4 层）与路径长度。因为宿主只用固定元素渲染数据，第三方图标无法注入标记。
- 原生客户端可按同一份数据用 SwiftUI `Path` 绘制，与 Web 一致。

清单由 SDK 的 `validateManifest()` 校验：一方插件在构建与测试时校验，第三方插件在注册仓库 CI 与 Home 加载目录时各校验一次。

## 一方插件：构建期安装

- Home 通过配置列出一方插件：`devicePlugins: ['@yunlefun-home/air-conditioner-home', ...]`，构建时生成注册模块。
- 插件 UI 槽位均为懒加载 chunk；未安装的插件不会下载。
- 插件组件通过 `useDeviceHost()` 获取状态、分发动作、读取设备能力与连接状态，不导入 Home 内部模块。
- “安装”只是为用户启用该插件，并在待安置收件箱中新增一台设备实例。

## 第三方插件：沙箱运行

### 隔离

```html
<iframe
  src="https://plugins.yunle.fun/com.example.dehumidifier/1.2.0/index.html"
  sandbox="allow-scripts"
  allow="compute-pressure"
  referrerpolicy="no-referrer"
  loading="lazy"
></iframe>
```

- 不加 `allow-same-origin`：iframe 为不透明源，没有 Cookie、localStorage、IndexedDB，也无法访问 Home 的 DOM。
- 不加 `allow-top-navigation`、`allow-popups`、`allow-forms`。
- `allow` 只包含用户已授权的浏览器能力，例如 `sensor:compute-pressure` 才附带 `compute-pressure`。不透明源 iframe 的权限策略委托需在目标浏览器实测，必要时写成 `compute-pressure *`；若仍不可用，改由宿主读取后通过消息转发等级。
- 托管域为每个版本下发 CSP：`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src <清单 network 权限的源>`。插件因此只能访问清单声明并经用户授权的网络地址。
- 产物路径按版本不可变；目录中的 `integrity` 用于托管域上线校验与审计。

### 通信协议

Home 为每个 iframe 创建 `MessageChannel`，握手后所有消息只走该端口，不使用 `window.postMessage('*')`。

1. iframe `load` 后，Home 校验 `event.source === iframe.contentWindow`，发送 `host.hello`，附带端口、`sdk` 版本、`pluginId`、`instanceId`、已授权权限和主题变量。
2. 插件 5 秒内回复 `plugin.ready`，否则判定加载失败并卸载。
3. 之后使用 JSON-RPC 风格的请求 / 响应与事件。

| 方向 | 消息 | 说明 | 所需权限 |
| --- | --- | --- | --- |
| 插件 → Home | `device.getState` / `device.setState` | 读写本实例状态，JSON ≤ 16 KB | `storage` |
| 插件 → Home | `device.setPresentation` | 上报 `{ active, tone, summary }`，驱动场景图形与设备托盘 | 无 |
| 插件 → Home | `ui.resize` | 请求面板高度，宿主限制在上下限内 | 无 |
| 插件 → Home | `notify.show` | 在 Home 内展示提示，限频 | `notify` |
| 插件 → Home | `ha.call` | 对已绑定实体调用允许的服务，走现有确认 / 待定流程 | `home-assistant:<domain>` |
| 插件 → Home | `ha.subscribe` | 订阅已绑定实体状态 | `home-assistant:<domain>` |
| Home → 插件 | `host.theme` | 主题变量变化（含深色模式） | — |
| Home → 插件 | `host.visibility` | 面板显示 / 隐藏，用于暂停动画与轮询 | — |
| Home → 插件 | `device.stateChanged` | 其他设备或云端同步带来的状态变化 | — |

宿主侧规则：

- 每条请求先校验权限与参数结构，未授权直接拒绝。
- 每个实例限速，`ha.call` 默认每分钟 10 次，`notify.show` 每分钟 3 次。
- HA 令牌、实体绑定信息和其他插件数据永不进入 iframe；`ha.call` 只接受该实例已绑定的实体。
- 插件被吊销、卸载或面板关闭时，宿主关闭端口并移除 iframe。

### 场景表现

场景和托盘里会同时出现很多设备，不能给每台都开 iframe。第三方插件在托盘、市场与快捷控制中使用清单里的 `appIcon`：

- 图标经 `normalizePluginIcon()` 清洗后由宿主渲染，不执行插件代码。
- `device.setPresentation` 上报的 `active` 与 `tone` 决定图标的显隐分支、色调与宿主动效，与一方插件的动效语言一致。
- 只有打开快捷控制或详情页时才创建 iframe，关闭即销毁。

## 安装与设备实例

安装后需要能放置多台、不同种类的设备，因此设备类型从固定联合类型改为开放的实例模型：

```ts
interface DeviceInstance {
  instanceId: string
  pluginId: string
  name: string
  createdAt: string
}
```

- 摆放记录以 `instanceId` 为键；房间表面按清单的 `surfaces` 接收设备，不再写死设备种类。
- 布局记录升级到 `version: 2`。旧记录的 `deviceId`（即设备种类）一一映射为内置插件实例，迁移附带测试。
- 卸载移除实例与摆放，并写入带时间戳的墓碑，防止旧浏览器把它同步回来；插件状态在用户确认后删除。
- 插件不再可用（吊销、SDK 不兼容）时，实例保留但显示为“不可用”，不执行任何代码。

## 插件市场

界面上称为“家电市场”，入口在顶栏，路由 `/market`。

**已实现（一方插件）**：云家电套装（空调、风扇、电视、扫地机器人、暖手宝）默认已安装；可单独卸载与重新安装，卸载只让设备离开家园，状态与摆放保留，重新安装回到原位。安装记录目前保存在本机浏览器，接入 `home_installed_plugins` 后随账号同步。详情页可切换待机与运行（制冷、制热）预览图标动效。空调来自 YunYouJun/air-conditioner，风扇来自 ElpsyCN/electric-fan，清单 `id` 与原生目录一致（`fun.yunle.air-conditioner`、`cn.elpsy.electric-fan`）。

- **列表**：分类筛选与搜索；卡片展示插件图形（一方插件加载其 glyph，第三方插件渲染清洗后的 SVG）、名称、作者、信任标识与“已安装”状态。
- **详情抽屉**：截图、说明、版本与更新记录、集成能力、申请的权限（用通俗中文逐条说明）、开发者信息和举报入口。
- **安装**：先展示权限确认；确认后设备图形以弹性动画飞入设备托盘的待安置收件箱。
- **不可用状态**：SDK 不兼容时置灰并说明原因；被吊销的插件从列表移除，已安装实例标记为不可用。
- **开发者模式**：设置中开启后，可输入本机地址加载开发中的插件，仅本浏览器可见。

## 原生客户端

macOS 原生客户端（`apps/macos`）与 Web 共用清单和权限模型，运行方式按平台取舍：

- 插件逻辑运行在随 App 打包的 `YunHomePluginHost` 进程中，每个插件一个 JavaScriptCore 虚拟机，无定时器、网络、文件与模块；主进程为每次调用设置 250 ms 超时，超时即结束并重启宿主，连续出错的插件被停用。
- 插件界面使用 `controls.json` 声明，由 SwiftUI 原生组件渲染，不使用 WebView；场景与列表只读取缓存的展示信息。
- 宿主能力渲染器（如 `cute-ac-3d`）让插件复用原生三维模型，而插件本身不包含原生代码。
- 原生代码插件（Apple ExtensionKit，`.appex` 加远程 SwiftUI 视图）需要 Xcode 工程与独立签名分发，且无法与 Web 共享，作为后续可选路线。

`.yunplugin` 由 air-conditioner 仓库的 `packages/home-plugin` 构建：`state.js` 直接打包 core 的 `acReducer`，因此 Web、Widget 与原生端的空调行为一致。

## 第三方上架流程

1. 开发者用 `create-home-plugin` 开发，并在开发者模式中联调。
2. 向 `home-plugins` 注册仓库提交 PR：清单、源码仓库地址、提交哈希与许可证。
3. CI：校验清单与权限、锁定依赖后从源码构建、限制产物体积、计算 `integrity`、扫描禁止的 API 与外部脚本。
4. 维护者人工审核代码与权限合理性后合并。
5. 合并后 CI 把产物上传到 `plugins.yunle.fun/<id>/<version>/`，并通过管理端脚本写入 `home_plugin_catalog`。
6. 吊销：目录项标记 `revoked`，Home 下次读取目录时立即停用；托管域同时下线该版本。

## 实施阶段

1. **基础**：发布 air-conditioner 0.3.0；本地 Home 改动变基到 `origin/main`（`4c1b5b9`），移除本地 `link:` 覆盖后提交。
2. **SDK**：抽出 `device-sdk` 与 `useDeviceHost()`；空调迁出为 `air-conditioner-home`；Home 通过配置注册一方插件。
3. **设备实例**：开放设备类型、实例模型与布局 `version: 2` 迁移。
4. **市场与安装**：插件目录、安装记录、`/market` 页面与安装动效（先只上架一方插件）。
5. **第三方运行时**：沙箱宿主组件、消息协议、权限确认、SVG 清洗、托管域与 CSP、开发者模式。
6. **第三方生态**：`create-home-plugin` 模板、注册仓库 CI、审核与吊销流程、文档站。

每个阶段独立可发布：第 4 步完成即可上线一方插件市场，第三方能力在第 5、6 步后开放。
