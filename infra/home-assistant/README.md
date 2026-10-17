# 本机 Home Assistant

此 Mac 使用现有 Colima 的 `colima` Docker context 运行官方 Home Assistant Container **2026.10.1**。Compose 同时固定版本及已验证的镜像 digest。连接地址为 <http://127.0.0.1:8123>，时区为 `Asia/Shanghai`。

## 启动与维护

```sh
# Mac 重启、Colima 未运行时先执行；不切换全局 Docker context
colima start --activate=false

pnpm ha:up
pnpm ha:status
pnpm ha:logs
pnpm ha:stop

# 不依赖 Node / pnpm 的等价命令
bash scripts/home-assistant.sh up
bash scripts/home-assistant.sh restart
```

脚本兼容 Docker Compose 插件和 Homebrew 的独立 `docker-compose`。需要换运行环境时设置 `YUN_HOME_HA_CONTEXT`；数据目录可通过绝对路径 `YUN_HOME_HA_DATA` 指定。`restart: unless-stopped` 负责容器在 Docker 恢复后启动；当前没有额外安装 Mac 开机登录启动项，Colima 本身需要运行。Mac 关机或休眠期间不能保证控制可用。

默认持久化目录为 `~/.local/share/yun-home/home-assistant`，首次创建权限为 `700`。账户、令牌、集成配置、SQLite 数据库均留在这个仓库外的目录。停止 / 重建容器保留数据；备份整个目录前先 `pnpm ha:stop`，完成后再 `pnpm ha:up`。不要提交 `.storage`、数据库或访问令牌。

## 首次设置及空调联调

1. 此 Mac 已按使用者要求创建 `yunhome-test` 本机测试账号，显示名为“Yun Home 测试”。它是首次设置的管理员 / owner；随机密码保存在 `~/.local/share/yun-home/credentials/home-assistant-test.json`（目录 `700`、文件 `600`，仓库外）。已验证用户名密码登录、浏览器登录、HTTP API 和 WebSocket 认证。初始化使用测试坐标 `0,0`、公制、`Asia/Shanghai`；实际家庭地点由使用者后续设置。
2. [小米官方 Xiaomi Home 集成](https://github.com/XiaoMi/ha_xiaomi_home) **v0.5.0** 已安装，配置流程已验证可加载。进入 `设置 → 设备与服务 → 添加集成 → Xiaomi Home`，自行阅读确认风险告知，登录米家并选择家庭。2026-10-18 已完成米家授权和设备导入，三台真实小米空调已绑定到 Home 原生 App。
3. 确认真实空调在 HA 中出现为 `climate.*`，并能在 HA 自身界面控制。
4. 在 HA 个人资料的安全页面创建供 App 使用的长期访问令牌。在 Home 的“绑定真实设备”中查找 HA、填写令牌、测试连接并勾选一台或多台空调，确认房间后保存。原生 App 的令牌保存到 macOS 钥匙串。

米家账号与 App 令牌无需发到聊天中。后续可为 App 创建单独的非管理员 HA 用户。

### 小米集成安装与回调地址

```sh
pnpm ha:xiaomi:install
bash scripts/home-assistant.sh restart
```

安装脚本从 `XiaoMi/ha_xiaomi_home` 获取官方 tag `v0.5.0`，校验 commit `75b3acb6325a3a8d295688b13904737d6738a6a5`，将未修改的 `custom_components/xiaomi_home` 放入持久化 HA 配置。重复执行会核对文件；如遇到不同的已有安装则停止，保留已有文件。官方源码位于 `~/.local/share/yun-home/integrations/ha_xiaomi_home-v0.5.0`，不复制到 Home App 或共享连接模块中。更新时应先备份，并重新选定、验证官方版本。

小米 OAuth 服务的注册回调固定为 `http://homeassistant.local:8123`，单用 `127.0.0.1` 不足以保证米家登录回跳成功，见[官方说明](https://github.com/XiaoMi/ha_xiaomi_home/wiki/OAuth-2.0-login-when-Home-Assistant-URL-is-not-homeassistant.local:8123)。本机通过 `scripts/home-assistant-local-dns.py` 调用 macOS DNS-SD API，在 `LocalOnly` 接口同时注册 A `127.0.0.1`、AAAA `::1` 和一个 Bonjour 服务。只注册 IPv4 时，某些双栈查询会等待 AAAA 超时；现在普通双栈 HTTP 请求已验证返回 200。HA 仍监听 IPv4 回环，客户端按系统连接回退使用它；Bonjour 的 `internal_url` 明确指向 `127.0.0.1`。这些记录只供此 Mac 解析，不向局域网广播、不修改 hosts、不开放额外端口。

安装小米集成后，`ha:up` / 脚本 `restart` 自动启动名称映射，`ha:stop` 同时停止它。映射进程由当前图形登录会话的 launchd 管理，DNS-SD 连接断开或每 30 秒的解析健康检查失败会退出并重新注册；`start` / `status` 也检查真实解析结果。helper 和 plist 位于 `~/.local/share/yun-home/runtime`，不在自动加载的 `Library/LaunchAgents` 中，因此 Mac 重启 / 退出登录后需重新运行 `ha:up`。独立管理命令为 `bash scripts/home-assistant-local-dns.sh {start|stop|status}`。如果后续改用家中另一台 HA，先停止此本机映射，避免同名地址仍指向本机。

Home App 本次使用单独命名的 `Yun Home Mac` 访问令牌（有效期 365 天），只存于钥匙串；绑定时的临时令牌文件已删除。无需重新登录米家。

## 扫描及网络范围

Home 原生连接界面的“查找 Home Assistant”同时执行：

- 在局域网浏览 `_home-assistant._tcp.` Bonjour 服务，最长 8 秒；
- 检查本机 `127.0.0.1:8123` 的 `/api/websocket`，最长 3 秒。只有收到包含版本号的 `auth_required` 握手才识别为 HA，不发送令牌或控制命令。

本机探测用于识别 Mac 虚拟机中的容器服务。Bonjour 浏览受本地网络权限和组播可达性影响；找不到时仍可手动填写地址。扫描定位服务，授权及设备绑定仍需单独完成，不会绕过小米设备认证。

当前端口仅发布到 Mac 回环地址，供本机 App 联调；手机和其他电脑不能用这个地址访问。Colima 的 Linux 虚拟机没有桥接到家庭局域网，HA 对家庭设备的 mDNS / SSDP / 广播自动发现、Matter / HomeKit、蓝牙或 USB 直通均未验收。将来可先通过小米账号接入，再按设备型号和家庭网络验证本地控制；如果需要长期稳定的局域网自动发现，优先将 HA OS 部署到桥接网络的虚拟机或常开设备。不要把这里的 `network_mode` 简单改成 `host` 就认定已经桥接到 Mac 的物理网络。

## 本次验证

2026-10-18：小米集成已加载，三台小米空调可用。Home App 批量绑定成功，读取 HA 分区并映射到客厅、主卧、次卧；使用者完成 macOS 钥匙串授权后，已验证重启恢复三台连接，绑定和房间记录保留。温标缺失已按系统摄氏温标兼容，主卧等房间过滤正确。已修复侧栏在两台空调之间切换时控制目标未同步的问题，并逐台核对名称、状态、传感器室温和遥控器目标。双栈域名解析、普通 HTTP 200、重复启动、名称注册进程退出后的自动恢复均已验证。随后按使用者授权完成 Home 和 CuteAC 的次卧开关、调温及跨 App 同步联调，并恢复原设置；详见[联调记录](../../docs/home-assistant-validation.md)。

历史记录：

2026-10-16：官方 arm64 镜像成功启动，Docker 端口发布及仓库外数据挂载已核对。Home 原生 App 已通过扫描识别此真实 HA 服务。测试账号完成首次设置与浏览器 / API / WebSocket 登录验证；Xiaomi Home v0.5.0 的官方文件及配置表单验证通过，`homeassistant.local` 回调主机可达。尚无 `climate.*` 实体，小米账号授权和物理空调操作仍待后续联调。

参考：[官方 Container 安装](https://www.home-assistant.io/installation/alternative/#install-home-assistant-container)、[官方 macOS / HA OS 安装](https://www.home-assistant.io/installation/macos/)、[Colima FAQ](https://github.com/abiosoft/colima/blob/main/docs/FAQ.md)。
