## 云之彼端 Home 0.2.2

减少 Home Assistant 多台空调切换和升级后的重复钥匙串授权，保留现有 HA 绑定、令牌和房间映射。

- 同一 HA 地址的多台空调复用本次 App 会话已授权读取的令牌；切换设备和网络自动重连不再逐台读取钥匙串。
- 取消或拒绝授权后暂停重复询问，点击“重新连接”再重试。保存、删除令牌或认证失效时刷新缓存；令牌仍只持久保存在钥匙串中。
- 发布包使用固定 Developer ID Application 身份（团队 `QT792GAY4C`），与 CuteAC 共用同一证书；发布 CI 严格验证签名和独立启动，证书缺失时停止发布。
- 保留 Home Assistant 接入、多台空调切换、房间映射和 Home ↔ CuteAC 状态同步，无需重新登录米家或重新绑定设备。

下载 `YunHome-0.2.2.zip`，解压后替换“应用程序”中的 `YunHome.app`。建议搭配 [CuteAC 0.4.2](https://github.com/YunYouJun/air-conditioner/releases/tag/v0.4.2)。从旧 ad-hoc 包首次升级时，macOS 仍可能要求分别允许两款 App 访问原有 HA 令牌；确认应用和项目后选择“始终允许”。

需要 macOS 14 或更高版本。已使用 Developer ID 签名，尚未进行 Apple 公证。
