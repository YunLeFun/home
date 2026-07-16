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

The application owns device instances, runtime state, room placement, authentication, and cloud synchronization. Air-conditioner, fan, robot-vacuum, and hand-warmer reducers are framework-independent utilities under `utils/device.ts`; Vue components only render state and dispatch typed actions.

The production build has no sibling-repository `link:` dependencies and no runtime font/image proxy. The browser uses the maintained `@cloudbase/js-sdk` v3 for authentication. The server uses CloudBase's official NoSQL HTTP API with native `fetch`, so the Worker does not load Node-only websocket, JWT, or form-data adapters. A future published device UI package can be integrated as an optional renderer without moving the home or cloud state model out of this application.

## Virtual Home Architecture

The home page uses a renderer-independent 2D/2.5D scene model:

- Room templates and device placements are stored in SVG world coordinates and surface-local `u`/`v` coordinates, never screen pixels.
- Semantic Vue SVG components own the room shell, furniture, vector device glyphs, placement surfaces, snap hints, obstacles, and robot routes. Every visible scene element remains editable in source.
- HTML/CSS owns pointer and keyboard interactions, room tabs, device-first quick controls, auth, and sync status.
- Desktop starts with a full-home overview and can focus a room; mobile restores the most recently used room. The device tray follows the active room and shows connected-device counts.
- Unplaced devices stay in a compact inbox. Edit mode expands the inbox and current-room groups, supports desktop drag or mobile select-then-place, and provides an explicit room selector for reassignment.
- `GET /api/home/state` and `PUT /api/home/state` persist the versioned layout with optimistic `revision` conflict handling.

The first release includes `cloud-apartment`, `studio`, and `comfort-suite`. A future WebGL renderer can consume the same home and device state without migrating stored placements.

## YunLe / CloudBase Auth

For `www.yunle.fun`, `apps.yunle.fun`, and `home.yunle.fun`, CloudBase Web SDK sessions are origin-scoped. Do not share them through `localStorage`. The app uses the YunLeFun SSO bridge instead:

- Login happens on `www.yunle.fun` with CloudBase Web Auth.
- `home.yunle.fun` loads `www.yunle.fun/auth/sso` in a hidden iframe with `targetOrigin` and `nonce`.
- `www.yunle.fun/auth/sso` only responds to origins listed in `NUXT_PUBLIC_SSO_ALLOWED_TARGET_ORIGINS`.
- `home.yunle.fun` receives the session and calls CloudBase `auth.setSession()` to establish its own origin-local session.
- Auth guards must use CloudBase `auth.getSession()`, not deprecated `getLoginState()`.

Useful environment variables:

```bash
NUXT_PUBLIC_SITE_ORIGIN=https://home.yunle.fun
NUXT_PUBLIC_YUNLE_AUTH_ORIGIN=https://www.yunle.fun
NUXT_PUBLIC_YUNLE_APPS_ORIGIN=https://apps.yunle.fun
NUXT_PUBLIC_CLOUDBASE_ENV_ID=your-full-env-id
NUXT_PUBLIC_CLOUDBASE_REGION=ap-shanghai
NUXT_PUBLIC_CLOUDBASE_ACCESS_KEY=your-publishable-key
NUXT_PUBLIC_CLOUDBASE_SESSION_BRIDGE_ORIGIN=https://www.yunle.fun
NUXT_PUBLIC_CLOUDBASE_SESSION_BRIDGE_PATH=/auth/sso
NUXT_PUBLIC_DEVICE_SYNC_ENABLED=false
NUXT_PUBLIC_HOME_SYNC_ENABLED=false

# Required when cloud synchronization is enabled in production.
NUXT_CLOUDBASE_API_KEY=your-server-only-api-key
NUXT_CLOUDBASE_DEVICE_STATES_COLLECTION=home_device_states
NUXT_CLOUDBASE_HOME_LAYOUTS_COLLECTION=home_layouts
```

CloudBase provider setup still needs to be configured in the CloudBase console: enable the required login methods, use a Publishable Key for `NUXT_PUBLIC_CLOUDBASE_ACCESS_KEY`, and create a separate administrator API Key for the server-only `NUXT_CLOUDBASE_API_KEY`. Never expose the administrator API Key through a `NUXT_PUBLIC_*` variable.

Create a unique `ownerId` index for `home_layouts` and a unique compound `ownerId + deviceId` index for `home_device_states`. Cloud writes run in transactions. Production returns `503` when server-side persistence is missing; the in-memory fallback is development-only.

## Cloudflare Workers Deployment

The production target is Cloudflare Workers with Workers Assets. Nuxt uses the ESM `cloudflare-module` Nitro preset; `wrangler.jsonc` points to the generated module entry and static asset directory.

Configure public variables in the Cloudflare dashboard and store server credentials as encrypted secrets:

```bash
pnpm wrangler secret put NUXT_CLOUDBASE_API_KEY
```

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
