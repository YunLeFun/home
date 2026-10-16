# 空调插件拆分设计

把空调能力按“通用产品能力”与“Home 平台集成”拆到两个仓库：`air-conditioner` 负责空调本身，Home 只保留把它接进家园的适配层。目标是消除重复的状态逻辑，让独立站与 Home 共享同一套控件与“电脑降温”能力，同时把账号、HA 令牌与真实设备自动化留在 Home。

## 现状与问题

| 问题 | 位置 |
| --- | --- |
| 状态逻辑重复：Home 的 `devices/air-conditioner/state.ts` 重写了 core 的 `acReducer` / `normalizeAcState`，唯一差异是支持 HA 上报的温度范围与步长 | Home |
| 温度表盘、空调图形只在 Home 中，独立站无法复用 | Home |
| core 的温度范围写死为 16–31℃、步长 1，无法表达真实设备能力 | air-conditioner |
| 没有发热感知能力，“电脑降温”无处落地 | 两边 |

## 拆分原则

1. **依赖单向**：Home → air-conditioner，反向不允许。包内不得引用 Home 的类型、composable、Nuxt 自动导入或品牌变量。
2. **包内只放可公开的东西**：任何账号、令牌、云端存储、真实设备指令都不进公共 npm 包。
3. **core 无框架、无副作用**：模块初始化不访问 DOM / 浏览器 API，浏览器能力在调用时探测。
4. **控件是受控组件**：状态由 props 传入，变化通过事件抛出；包内不持有设备实例。
5. **主题走 CSS 变量契约**：包提供默认值，宿主覆盖，不硬编码宿主品牌色。
6. **变更只增不破**：新参数一律可选并保持旧默认值，按 semver 发 minor 版本。

## 目标结构

```text
air-conditioner (YunYouJun/air-conditioner)
├── packages/core           @yunlefun-home/air-conditioner-core
│   ├── reducer.ts          acReducer / normalizeAcState / clampTemperature + 可选 AcLimits
│   ├── tone.ts             acTone(state) → idle | cool | heat
│   └── thermal/            发热等级、发热源接口、Compute Pressure 源、降温规划（从包根导出，可摇树）
├── packages/vue            @yunlefun-home/air-conditioner
│   ├── 既有渲染器          AirConditioner / RemoteControl / Widget（不变）
│   └── controls/           子路径 ./controls + ./controls.css：AcTemperatureDial、AcGlyph、useHeatSource
└── packages/react 站点     ac.yunyoujun.cn 新增“电脑降温”模式

home (YunLeFun/home)
└── devices/air-conditioner/   适配层
    ├── index.ts           defineDevicePlugin：把包导出接到注册表
    ├── manifest.ts        Home 专属：路由、场景尺寸、可摆放面、集成声明
    ├── state.ts           薄封装：HA 能力 → AcLimits，调用 core
    ├── AcGlyph.vue        包组件，映射 Home 色调
    ├── AcQuickControl.vue 包表盘 + useDeviceState + HA 连接状态
    ├── AcDevicePanel.vue  渲染器 + 包表盘 + 集成卡片 + 绑定表单
    ├── AcDeviceBinding.vue  HA 绑定（留在 Home）
    ├── ha-heat-source.ts  HA sensor 发热源，实现 core 的 HeatSource 接口
    └── cooling-automation.ts  真实空调联动策略（默认关闭）
```

## 职责划分

| 能力 | 归属 | 理由 |
| --- | --- | --- |
| 状态类型、reducer、温度范围与步长 | core | 唯一状态来源；HA 范围只是 `AcLimits` 的一种取值 |
| 运行色调 `acTone` | core | 独立站、Widget、Home 共用 |
| 发热等级、`HeatSource` 接口、迟滞与降温规划 | core | 纯逻辑，跨框架、跨平台语义一致 |
| Compute Pressure 发热源 | core | 只依赖浏览器标准 API，调用时探测 |
| 温度表盘、空调图形、`useHeatSource` | vue `./controls` | 受控展示组件，独立站也需要 |
| 场景尺寸、可摆放面、路由、集成声明 | Home manifest | 只对 Home 的场景与路由有意义 |
| HA 绑定、令牌、共享连接、确认流程 | Home | 与 YunLe 账号、CloudBase 和本机存储绑定 |
| HA sensor 发热源 | Home | 依赖 Home 的 HA 连接 |
| 真实空调自动联动 | Home | 涉及真实设备指令与用户授权 |
| 品牌色、玻璃卡片外壳 | Home | 通过 CSS 变量映射到包组件 |

## 接口契约

### core：温度范围

```ts
export interface AcLimits {
  min: number
  max: number
  step: number
}

export const defaultAcLimits: AcLimits // { min: 16, max: 31, step: 1 }

export function clampTemperature(temperature: number, limits?: AcLimits): number
export function normalizeAcState(state: Partial<AcState> | undefined, limits?: AcLimits): AcState
export function acReducer(state: AcState, action: AcAction, limits?: AcLimits): AcState
export function acTone(state: AcState): 'idle' | 'cool' | 'heat'
```

`limits` 省略时行为与 0.2.x 完全一致。Home 的 `AcCapabilities` 在适配层转换为 `AcLimits`，`AirConditionerState` 改为 `AcState` 的别名。

### core：发热感知

等级沿用浏览器 Compute Pressure 与 macOS `ProcessInfo.ThermalState` 共同的四档，Web 与原生 App 语义一致。

```ts
export type HeatLevel = 'nominal' | 'fair' | 'serious' | 'critical'

export interface HeatReading {
  level: HeatLevel
  /** 来源能提供真实温度时才有 */
  celsius?: number
  source: string
  at: number
}

export interface HeatSource {
  id: string
  isSupported: () => boolean
  /** 返回取消订阅函数 */
  start: (listener: (reading: HeatReading) => void) => () => void
}

/** 浏览器 CPU 压力；不支持时 isSupported() 为 false */
export function createComputePressureSource(options?: { sampleIntervalMs?: number }): HeatSource

/** 摄氏度转等级，带回差，避免在阈值附近抖动 */
export function celsiusToHeatLevel(celsius: number, thresholds: [fair: number, serious: number, critical: number], previous?: HeatLevel, hysteresis?: number): HeatLevel

/** 等级上升立即生效，下降需持续 dwellMs */
export function createHeatGovernor(options?: { dwellMs?: number }): (reading: HeatReading) => HeatLevel

export interface CoolingPlan {
  status: boolean
  mode: 'cold'
  temperature: number
  /** 0–1，驱动风量动画 */
  airflow: number
}

export function planCooling(level: HeatLevel, limits?: AcLimits): CoolingPlan
```

建议映射：`nominal` 不接管；`fair` 制冷 26℃、风量 0.4；`serious` 24℃、0.7；`critical` 22℃、1.0。温度源阈值默认 60 / 75 / 90℃，回差 5℃，降档驻留 30 秒。

### vue `./controls`：受控组件

```ts
// AcTemperatureDial
props: { value: number | null, limits: AcLimits, tone: AcTone, caption?: string, disabled?: boolean, size?: 'compact' | 'large' }
emits: { change: [delta: -1 | 1] }

// AcGlyph
props: { active: boolean, tone: AcTone, airflow?: number, title?: string }

// useHeatSource(source: HeatSource, options?) → { supported, reading, level }
```

主题变量（包内给默认值，宿主覆盖）：

| 变量 | 含义 | Home 映射 |
| --- | --- | --- |
| `--acw-tone-cool` / `--acw-tone-heat` / `--acw-tone-mid` | 制冷、制热、中间色 | `var(--tone-cool)` / `var(--tone-heat)` / `var(--brand-secondary)` |
| `--acw-ink` / `--acw-muted` / `--acw-faint` | 文字 | `var(--brand-ink)` / `var(--brand-muted)` / `var(--brand-faint)` |
| `--acw-surface` / `--acw-sunken` | 表面 | `var(--brand-glass-strong)` / `var(--brand-glass-sunken)` |
| `--acw-line` / `--acw-line-strong` / `--acw-highlight` | 描边与高光 | 对应 `--brand-*` |
| `--acw-ease-spring` / `--acw-ease-out` | 缓动 | `var(--ease-spring)` / `var(--ease-out)` |

组件内部通过 `var(--acw-*, 默认值)` 解析为私有 `--_*` 变量，宿主在任意祖先上设置即可生效；Home 的映射在 `styles/controls.scss`。

`./controls` 作为独立子路径与独立样式文件 `./controls.css` 发布，Home 的场景与快捷控制只加载控件，不加载完整渲染器。`useId` 需要 Vue 3.5，peer 依赖相应提升为 `>=3.5`。

## 电脑降温

- **独立站**：可选“电脑降温”模式，使用 Compute Pressure 源驱动虚拟空调与风量动画。仅 Chromium 支持，其他浏览器隐藏入口。
- **Home 虚拟设备**：发热源可选 Compute Pressure 或 HA `sensor.*` 温度实体。只改虚拟设备的显示状态，不写云端。
- **Home 真实设备联动**（`cooling-automation.ts`）：
  - 单独开关“联动真实空调”，默认关闭，必须由用户在绑定后主动开启。
  - 使用 `planCooling` 的结果，经现有 HA 确认 / 待定流程下发。
  - 两次指令至少间隔 10 分钟；只在等级变化时下发。
  - 任何手动操作暂停联动 30 分钟；设备离线、解绑、切换账号时立即停止。
  - 浏览器读不到真实 CPU 温度，Compute Pressure 只是负载等级，界面文案需如实说明。
- **原生 App**（后续）：`ProcessInfo.thermalState` 直接映射到同一 `HeatLevel`，CuteAC 与 YunHome 复用相同规划规则。不使用私有 IOKit 温度接口，不控制风扇。

## 发布与依赖

- air-conditioner 两个包同步发布 `0.3.0`（只增不破）。
- Home 升级到 `^0.3.0`，并在 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 中更新对应版本。
- 本地联调用 `pnpm link` 指向本地 air-conditioner 包，不提交 `link:` 依赖（生产构建禁止兄弟仓库依赖）。
- 契约测试：core 测试 `limits` 与步长、迟滞与驻留；Home 保留 `tests/home-assistant.test.ts` 对 HA 能力的覆盖，并新增适配层测试，确保 HA 范围经 `AcLimits` 后行为不变。

## 实施顺序

1. **air-conditioner**：core 增加 `AcLimits`、`acTone`、`./thermal`；vue 增加 `./controls`（从 Home 迁入表盘与图形并改为 CSS 变量主题）；独立站加“电脑降温”；发布 0.3.0。
2. **Home 适配层**：先合并“其余设备插件化”分支，再升级依赖；`state.ts` 改为调用 core；表盘与图形改用包组件；删除重复实现；全量测试与浏览器验证。
3. **Home 发热源与联动**：实现 HA sensor 发热源与“电脑降温”卡片；按上节策略实现真实空调联动。
4. **原生 App**：接入 `thermalState`，与 Web 共用等级语义。

第 1 步完成前，Home 现有实现保持不变，可正常发布。

## 当前进度

- 第 1、2 步已完成。air-conditioner 0.3.0 由仓库的 Release 工作流通过 npm 可信发布（OIDC）发布，附带来源证明；两个包的可信发布者为 `YunYouJun/air-conditioner` · `release.yml`，允许直接发布。
- Home 已从 npm 安装 0.3.0：适配层使用 core reducer 与包内表盘、图形，存储结构保持 `{ status, mode, temperature }` 不变。
- core 0.3.0 的 `AcState` 新增必填的 `sound`，Home 不支持声音模式，适配层在调用 core 时补默认值、返回时去掉该字段。
- 第 3、4 步与插件市场见 [设备插件市场设计](device-plugin-market.md)。
