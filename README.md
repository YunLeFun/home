# YunLeFun Home

> 云之彼端的家园

Production domain: `https://home.yunle.fun`

## Development

The project follows the current long-term toolchain: Node.js 24 LTS, pnpm 11, Nuxt 4, Vue 3.5, and TypeScript 6.

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Run the complete local release gate with:

```bash
pnpm check
```

## Device Architecture

The application owns device instances, runtime state, room placement, authentication, and cloud synchronization. Television, air-conditioner, fan, robot-vacuum, and hand-warmer reducers are framework-independent utilities under `utils/device.ts`; Vue components only render state and dispatch typed actions. The television is a movable wall device with independent power, playback, volume, mute, and HTTPS MP4/WebM source controls.

The production build has no sibling-repository `link:` dependencies and no runtime font/image proxy. The air-conditioner detail uses the public `@yunlefun-home/air-conditioner` renderer while Home continues to own the device instance and state. Its canvas thumbnail stays consistent with the other home devices, and the detail page links to the standalone experience at `https://ac.yunyoujun.cn/`.

The browser uses `@cloudbase/js-sdk` v3 for authentication and document persistence. Device and layout records are written directly to user-private CloudBase collections; the Worker never receives a CloudBase administrator key or proxies business-data writes.

## Cloud Home Architecture

The home page uses a renderer-independent 2D/2.5D scene model:

- Room templates and device placements are stored in SVG world coordinates and surface-local `u`/`v` coordinates, never screen pixels.
- Semantic Vue SVG components own the room shell, furniture, vector device glyphs, placement surfaces, snap hints, obstacles, and robot routes. Every visible scene element remains editable in source.
- HTML/CSS owns pointer and keyboard interactions, room tabs, device-first quick controls, auth, and sync status.
- Desktop starts with a full-home overview and can focus a room; mobile restores the most recently used room. The device tray follows the active room and shows connected-device counts.
- Unplaced devices stay in a compact inbox. Edit mode expands the inbox and current-room groups, supports desktop drag or mobile select-then-place, and provides an explicit room selector for reassignment.
- Layout and device snapshots carry an ISO `changedAt` timestamp. Login, reconnect, focus, and online events compare local and cloud timestamps; the newer snapshot wins and is synchronized back using last-write-wins semantics.

The first release includes `cloud-apartment`, `studio`, and `comfort-suite`. A future WebGL renderer can consume the same home and device state without migrating stored placements.

## YunLe / CloudBase Auth

CloudBase Web SDK sessions are origin-scoped and are never shared through `localStorage` or a host app. Home uses Web SSO v3:

- Login happens on `www.yunle.fun` with CloudBase Web Auth.
- `home-web` is registered to the exact `https://home.yunle.fun/` redirect and `identity:bootstrap` scope.
- Login is a top-level Authorization Code + S256 PKCE redirect; the callback validates issuer and nonce.
- Home atomically exchanges the one-time code and passes the transient custom ticket only inside `signInWithCustomTicket`.
- No iframe, popup, session forwarding, native host bridge, access token forwarding, or refresh token forwarding is supported.
- Auth guards must use CloudBase `auth.getSession()`, not deprecated `getLoginState()`.

Useful environment variables:

```bash
NUXT_PUBLIC_SITE_ORIGIN=https://home.yunle.fun
NUXT_PUBLIC_SSO_CLIENT_ID=home-web
NUXT_PUBLIC_SSO_ORIGIN=https://www.yunle.fun
NUXT_PUBLIC_SSO_EXCHANGE_URL=https://api.yunle.fun/sso-ticket
NUXT_PUBLIC_SSO_REDIRECT_URI=https://home.yunle.fun/
NUXT_PUBLIC_CLOUDBASE_ENV_ID=your-full-env-id
NUXT_PUBLIC_CLOUDBASE_REGION=ap-shanghai
NUXT_PUBLIC_CLOUDBASE_ACCESS_KEY=your-publishable-key
NUXT_PUBLIC_CLOUDBASE_DEVICE_STATES_COLLECTION=home_device_states
NUXT_PUBLIC_CLOUDBASE_DEVICE_BINDINGS_COLLECTION=home_device_bindings
NUXT_PUBLIC_CLOUDBASE_HOME_LAYOUTS_COLLECTION=home_layouts
NUXT_PUBLIC_DEVICE_SYNC_ENABLED=true
NUXT_PUBLIC_HOME_SYNC_ENABLED=true
```

CloudBase provider setup must enable the required login methods and expose a Publishable Key through `NUXT_PUBLIC_CLOUDBASE_ACCESS_KEY`. A Publishable Key identifies the browser application; collection rules enforce data access. Do not add an administrator API Key to Home.

Create `home_layouts` and `home_device_states` with `PRIVATE` permissions. Add unique compound indexes `_openid + slot` and `_openid + deviceId`, respectively. The Web SDK automatically associates client-created documents with the authenticated user via `_openid`; anonymous sessions are ignored.

## Home Assistant Air Conditioners

The air-conditioner panel can bind a virtual device to a Home Assistant `climate.*` entity. Home Assistant must already expose and control the actual air conditioner; verify its integration and model support in HA first. Home uses the official `home-assistant-js-websocket` client, with one shared connection per HA address in each page. The Worker does not proxy device commands, states, or HA credentials.

Create `home_device_bindings` with `PRIVATE` permissions and a unique compound index on `_openid + deviceId`. The configured collection name is `NUXT_PUBLIC_CLOUDBASE_DEVICE_BINDINGS_COLLECTION`. This collection and index have been provisioned in the existing `yunlefun-8g7ybcxc7345c490` environment. Binding records contain `state: { binding: { provider, baseUrl, entityId } }`; unbinding writes a timestamped `state: { binding: null }` tombstone. Cached bindings are only pulled from the cloud, so an old browser cannot upload its cache to resurrect a removed binding.

To connect, sign in to YunLe, open **空调控制 → 绑定真实设备**, enter the HA base address and a long-lived access token, test the connection, select an entity, and save. Use a dedicated non-administrator HA account. HTTPS Home pages require an HTTPS HA base URL with a valid certificate and reachable WSS endpoint. HTTP local development can use `http://localhost:8123`. A publicly reachable HA endpoint also enables control outside the home while this page is running. Proxy or tunnel authentication must allow the WebSocket handshake.

HA tokens are stored only in this browser's localStorage, isolated by YunLe user ID and normalized HA origin. They are never included in CloudBase records, Nuxt state/payloads, Worker requests, or logs. A different browser loads the binding and prompts for its own token. LocalStorage remains accessible to scripts on the same origin. Unbinding retains the host token for other devices; **删除此 HA 的本机令牌** removes it and disconnects all devices using that host on this browser. Revoking a token in HA requires entering a new token.

Only explicit user actions issue device commands. Temperature changes are debounced for 600 ms; commands are serialized per device. Off-state mode and temperature preferences stay local until the next user power-on, which applies both settings. The interface shows optimistic values until HA reports the requested fields. After a five-second confirmation deadline, or a service failure, Home rereads HA; it reports uncertainty if the desired state is still unconfirmed. A HA report confirms HA's state and does not independently verify physical hardware execution.

Bound devices publish only confirmed, available HA snapshots to `home_device_states`, with `homeAssistant.bindingKey` and `homeAssistant.reportedAt` metadata. Cloud snapshot versions advance independently of HA's timestamp; cloud LWW data never overrides an online device or triggers commands. Disconnecting, switching accounts, or unbinding cancels pending work. Reconnection restores subscriptions and reads HA's current state without replaying offline commands.

Version 1 supports Celsius climate entities with an `off` mode and `cool` or `heat`, using each entity's temperature range and step. Other active modes, such as dry and fan-only, retain their actual labels and are not implicitly changed to cooling. Unavailable/unknown entities disable controls. Background control, native widgets, shared household permissions, and a persistent bridge are outside this version.

Run `pnpm check` before shipping. Automated tests exercise the official client's authentication, shared connections, subscription recovery, command planning, pending-state reconciliation, token isolation, and cloud tombstones through simulated HA sockets. Real-device acceptance still requires testing with the household HA instance and air conditioner.

Local validation evidence and the two remaining upstream dependency-audit blockers are recorded in [Home Assistant v1 validation](docs/home-assistant-validation.md).

## Cloudflare Workers Deployment

The production target is Cloudflare Workers with Workers Assets. Nuxt uses the ESM `cloudflare-module` Nitro preset; `wrangler.jsonc` points to the generated module entry and static asset directory.

Configure the `NUXT_PUBLIC_*` values in the Cloudflare dashboard. Cloud synchronization does not require a Worker secret.

Create a preview deployment and complete the authentication/cloud-sync smoke tests before running the production command:

```bash
pnpm build
pnpm wrangler dev
pnpm deploy
```

`apps.yunle.fun` includes `Yun Home` as a first-party fallback app. To make it the CloudBase catalog source of truth, run the admin seeding flow after deploying:

```bash
cd ../admin
pnpm seed:apps
pnpm gen:apps-snapshot
```
