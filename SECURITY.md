# Security Policy

安全问题请私下报告，不要开公开 Issue。 Please report security issues privately, not in a public issue.

## Reporting a vulnerability

- Preferred: [report a vulnerability](https://github.com/YunLeFun/home/security/advisories/new) through GitHub private vulnerability reporting.
- Or email me@yunyoujun.cn with "Yun Home security" in the subject.

Include what is affected (web, macOS app, a plugin or HomeDeviceKit), the version or commit, steps to reproduce, and the impact you expect. You will get an acknowledgement within 3 days and an assessment within 7 days. Please give us a reasonable chance to release a fix before disclosing publicly; we credit reporters unless you prefer otherwise.

## Supported versions

| Component | Supported |
| --- | --- |
| Web app at https://home.yunle.fun | The current deployment |
| macOS app (`macos-v*` releases) | The latest release |
| HomeDeviceKit Swift package | The `main` branch |
| Bundled device plugins | The versions in the latest macOS release |

Older releases do not receive fixes; update to the latest version.

## What we consider in scope

- **Home Assistant credentials.** The web app keeps long-lived access tokens in the browser's local storage and the macOS app keeps them in the Keychain. Anything that lets another origin, a plugin or another device read them is in scope.
- **The plugin sandbox.** On macOS, plugin logic runs in a separate JavaScriptCore process with no timers, network or files, and its controls are rendered natively by the host. Plugin icons are declarative data rendered from an allowlist on both web and macOS. Escaping either of these, or reaching tokens or other plugins' data from a plugin, is in scope. The web app currently ships only first-party plugins built with Home.
- **Sign-in and sync.** YunLe SSO, CloudBase sessions and cloud-synced device state and layouts.
- **Device control.** Commands reaching a Home Assistant entity the user did not bind, or bypassing confirmation.

Out of scope: denial of service through volume, social engineering, issues needing a compromised device or browser, and missing hardening headers without a concrete impact.

## Dependency advisories

`pnpm audit:prod` runs in CI. Two advisories without a patched release are ignored in `pnpm-workspace.yaml` because they only reach build tooling (`nuxt` → `nitropack`). Neither is part of the deployed bundle in `.output`:

- [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), node-forge: used by `listhen` to create self-signed development certificates
- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), braces: used by `globby` to match files during the build

Each entry is removed once a fixed version is released.
