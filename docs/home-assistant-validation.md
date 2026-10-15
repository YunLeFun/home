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
