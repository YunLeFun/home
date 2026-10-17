# Home Assistant v1 validation

Validated locally on 2026-10-16.

- CloudBase `yunlefun-8g7ybcxc7345c490`: `home_device_bindings` exists, permission is `PRIVATE`, and `owner_device_unique` enforces `_openid + deviceId` uniqueness.
- Lint and TypeScript checks pass. The 48 unit/integration tests pass, including the official HA client's authentication and reconnection, shared sockets, account isolation, binding tombstones, state-sync opt-out, debounce, superseded operations, partial failures, and confirmation timeouts.
- The production Cloudflare build passes on Nuxt 4.6.1 / Vue 3.5.44. The renderer's font is resolved from its installed package and emitted as a bundled build asset.
- Primary dependencies are updated to Vue Router 5.4.0, Pinia 4.1.0, VueUse 15.0.0, CloudBase Web SDK 3.10.2, and YunLeFun SSO 0.6.2. Node 24, TypeScript 6, and Vitest 4 remain the supported toolchain; frozen-lockfile installation and peer-dependency checks pass.
- After the dependency upgrade, a fresh browser smoke check passes for the home page, quick-control power and temperature adjustments, state preservation when navigating to the full AC panel, and the binding form. No page exceptions are reported.
- Browser smoke checks use a local simulated HA instance and synthetic credentials with CloudBase disabled: entity discovery, actual dry-mode labels, neither heating/cooling button selected in dry mode, 0.5-degree optimistic adjustments, shared pending state from quick controls to the detail page, confirmation timeout/readback, invalid-token feedback, and removal of a local token. At a 390px viewport, the page has no horizontal overflow. A fresh browser session reports no page exceptions.
- Actual HA integration/model support, real air-conditioner execution, and authenticated CloudBase binding round trips still require acceptance testing against the household instance and a signed-in browser. Automated cloud tests use an in-memory repository.

## Remaining dependency-audit blockers

`pnpm check` completes lint, type checking, tests, and the production build, then exits unsuccessfully at `pnpm audit:prod` because two existing transitive packages have unresolved high-severity advisories:

| Package | Dependency path | Advisory | npm availability checked |
| --- | --- | --- | --- |
| `node-forge@1.4.0` | Nuxt CLI/Nitro → listhen → node-forge | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | `1.4.1` is not published |
| `braces@3.0.3` | Nitro → globby/micromatch → braces | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `3.0.4` is not published |

Available security updates reduced the audit report from 45 advisories to these two. Neither path includes `home-assistant-js-websocket`. Audit thresholds and checks remain unchanged. Revisit these dependencies when fixes are published. Production deployment and real-device acceptance were not performed during local validation.


## Native multi-device integration — 2026-10-18

- Shared HomeDeviceKit: 27 tests pass, including missing entity temperature units, explicit-unit precedence, unknown/Fahrenheit rejection, configuration-change reconnect, area inheritance, and the real URLSession WebSocket fixture using legacy HA payloads.
- Native app: 52 tests pass (18 HomeCore, 24 HomePlugins, 10 UI/model tests). New coverage verifies independent device commands during selection changes, persisted rooms/selection, duplicate binding updates, all-device power-off targeting, and endpoint-wide credential deletion. Physical commands run only against fixtures.
- The packaged debug app connects to the actual local HA, lists the household entities, accepts three Xiaomi air conditioners, imports their HA areas, and saves the token to Keychain. No real-device service calls are part of this verification.
- After the user granted Keychain access, the rebuilt app restored all three connections and their living-room, primary-bedroom, and secondary-bedroom mappings. Native UI checks verified HA sensor readings of 26.5°C, 25.2°C, and 30.3°C respectively at the time of verification.
- UI verification exposed a stale control target when moving directly between two AC sidebar rows. Sidebar navigation now selects the command target synchronously instead of relying on detail-view appearance. The final build passed the 10 UI/model tests again; native UI checks confirmed that the device name, room, state, sensor temperature, and remote target all follow each of the three sidebar selections.
- Local callback DNS publishes both loopback address families through LocalOnly DNS-SD. Ordinary HTTP requests return 200; the registration process is supervised and resolver health is checked with a deadline.
- Existing Web validation above is historical; this change does not claim a fresh Web or CloudBase acceptance run.

## Authorized live AC control — 2026-10-18

The user authorized testing the secondary-bedroom Xiaomi AC and restoring its original settings. A separate authenticated HA WebSocket observer recorded state changes while controls were exercised through the native App. The initial state was off, target 25°C, automatic fan, and swing off.

| Action | Native App result | HA integration result |
| --- | --- | --- |
| Turn on from App | Cooling, 25°C | `cool`, target 25°C |
| Raise target one step from App | Cooling, 25.5°C | `cool`, target 25.5°C |
| Restore target to 25°C through HA | Updated automatically to 25°C | `cool`, target 25°C |
| Turn off from App | Standby, 25°C | `off`, target 25°C |

The final independent state read matched the baseline for power/mode, target temperature, target humidity, fan, swing, and preset on all three bound ACs. Only the secondary-bedroom AC received test commands. This verifies native control, Xiaomi integration acknowledgements/state reports, and HA-to-App updates; there was no direct visual inspection of the physical AC display. Temporary observer authentication was revoked after the check.

## CuteAC shared bindings — 2026-10-18

- HomeDeviceKit now provides an atomic metadata catalog and a per-device connection collection. Home publishes existing bindings and room changes; CuteAC reads the catalog and uses the same Keychain service. Each app keeps its own selected device.
- Local checks passed: 29 HomeDeviceKit tests, 53 Home native tests, and 3 CuteAC connectivity tests. Coverage includes catalog permissions and version validation, deletion/room propagation, rapid temperature changes followed by target switching, independent command queues, restart restoration, external state events, unavailable devices, corrupt metadata, missing credentials, and capture-mode isolation.
- Both debug app bundles build and launch, with strict signature verification passing. The Home catalog contains the three existing room mappings with mode 0600. After macOS Keychain authorization took effect, native UI checks verified all three CuteAC selections: secondary bedroom off/25°C with sensor 30.3°C, primary bedroom cooling/25°C with sensor 24.7°C, and living room cooling/25°C with sensor 25.5°C. The final build restored the selected living-room device and its connection after restart. Home and CuteAC retained different current selections, confirming independent targets. No additional real AC control commands were sent during this integration work.
- Cross-repository CI configuration pins the Home dependency to shared-module commit `9e71679dd0ef0f0e5329413e910e46c17d945a4c`. Remote CI and releases have not been run; publish that Home commit before pushing or releasing the CuteAC integration so its CI can fetch the dependency.

## Authorized CuteAC → Home live control — 2026-10-18

The user authorized a second secondary-bedroom AC test, this time issuing every command through CuteAC and checking automatic updates in the Home native App. A separate HA WebSocket observer recorded the Xiaomi integration state reports. Before testing, the AC was off at 25°C, with automatic fan and swing off.

| Time (Asia/Shanghai) | CuteAC action and confirmed state | Home App automatic update | HA state report |
| --- | --- | --- | --- |
| 02:57:41 | Turn on: cooling, 25°C | Cooling, 25°C | `cool`, 25°C |
| 02:58:01 | Increase one step: 25.5°C | Cooling, 25.5°C | `cool`, 25.5°C |
| 02:58:32 | Decrease one step: 25°C | Cooling, 25°C | `cool`, 25°C |
| 02:58:47 | Turn off: standby, 25°C | Standby, 25°C | `off`, 25°C |

CuteAC returned to its connected state after each device confirmation. Home required no manual refresh or control input. An independent final read matched the initial power/mode, target temperature, target humidity, fan, swing, and preset on all three ACs; living-room and primary-bedroom settings were unchanged. The physical AC display was not visually inspected. Temporary observer authentication was revoked after the check.

For this cross-app check, CuteAC used the explicit `--show-popover --keep-popover-open` debugging arguments so its controls remained visible while inspecting Home. Normal launches retain the existing transient popover behavior.

Home's `CFBundleName` now matches its existing Chinese `CFBundleDisplayName`, “云之彼端”. A fresh debug build, strict signature check, and the running macOS application menu verified the name. The bundle identifier, executable, `YunHome.app` artifact path, saved preferences, and Keychain binding remain compatible.
