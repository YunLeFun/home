# Yun Home Design QA

## Source of truth

- Product constraint: remove the generated room and device images and replace them with source-editable SVG while preserving the established virtual-home composition and interaction model.
- Composition reference: `/Users/yunyou/.codex/visualizations/2026/07/15/019f6577-0340-7783-bcc5-2708ae6d7076/yun-home-desktop-1440-accepted.png`
- Final desktop implementation: `/Users/yunyou/.codex/visualizations/2026/07/15/019f6577-0340-7783-bcc5-2708ae6d7076/yun-home-vector-desktop-1440-final.png`
- Final mobile implementation: `/Users/yunyou/.codex/visualizations/2026/07/15/019f6577-0340-7783-bcc5-2708ae6d7076/yun-home-vector-mobile-390.png`
- Device-first room-tabs desktop implementation: `/Users/yunyou/.codex/visualizations/2026/07/15/019f6577-0340-7783-bcc5-2708ae6d7076/yun-home-room-tabs-desktop-1440.png`
- Device-first room-tabs mobile implementation: `/Users/yunyou/.codex/visualizations/2026/07/15/019f6577-0340-7783-bcc5-2708ae6d7076/yun-home-room-tabs-mobile-390.png`
- Full-view comparison: `/Users/yunyou/.codex/visualizations/2026/07/15/019f6577-0340-7783-bcc5-2708ae6d7076/ai-background-vs-editable-vector-final.jpg`
- Focused scene comparison: `/Users/yunyou/.codex/visualizations/2026/07/15/019f6577-0340-7783-bcc5-2708ae6d7076/ai-background-vs-vector-scene-focus.jpg`

## Viewports and states

- 1440 × 1024, `cloud-apartment`, living room, hand-warmer selected, quick control open.
- 390 × 844, `cloud-apartment`, living room, no quick control obscuring the room.
- 1280 × 720 low-height resilience check: `/Users/yunyou/.codex/visualizations/2026/07/15/019f6577-0340-7783-bcc5-2708ae6d7076/yun-home-vector-desktop-1280x720.png`.
- 1440 × 1024 device-first state: full-home overview selected, room tabs show connected-device counts, and the tray presents all four devices without opening a quick control.
- 390 × 844 device-first state: the recent bedroom is restored, the full-home tab is hidden, and only the bedroom fan appears in the device tray.

## Comparison findings

- No actionable P0/P1/P2 findings remain.
- Fonts and typography: the existing application type scale, weights, wrapping, and compact control labels are unchanged. SVG room labels use a restrained uppercase technical style and remain clear at desktop and mobile crops.
- Spacing and layout: the three-room proportions, room switcher, floating control, canvas radius, and device tray hierarchy remain aligned with the earlier composition. The 390 px layout keeps a single-room crop and horizontal device tray.
- Colors and tokens: the soft blue/lilac palette, white glass surfaces, green running state, and warm hand-warmer accent remain consistent. Vector fills and strokes replace photographic texture intentionally.
- Image and vector quality: all seven generated raster assets were removed. Room shells, furniture, appliances, route geometry, and device status animation now render as sharp semantic SVG with stable `data-layer`, `data-room-id`, `data-furniture-id`, and `data-vector-device` hooks.
- Copy and content: template names, device names, placement guidance, sync labels, and quick-control copy are unchanged and coherent.
- Icons and affordances: existing Carbon interface icons remain in use; editable vector appliance glyphs preserve clear device recognition in the scene, tray, quick controls, drag ghost, and detail pages.
- Accessibility: device SVGs expose titles when informative and are hidden when decorative; pointer, keyboard, focus, reduced-motion, and mobile tap behaviors remain wired.
- Device-first hierarchy: quick control is the default action, while placement controls only expand in edit mode. Room reassignment uses a labeled native select and unplaced devices remain recoverable from a dedicated inbox.

## Functional evidence

- In-app browser: edit mode, keyboard ArrowRight movement, undo, completion of placement, quick-control power toggle, room switching, and mobile bottom-sheet opening were exercised.
- The keyboard check changed the air-conditioner surface-local position and undo restored it.
- The quick-control check changed the air-conditioner status from `待机` to `制冷运行中`.
- Mobile bedroom switching kept the `BEDROOM` scene label inside the viewport and the fan control opened successfully.
- Console error check returned no errors after the final dev-server restart.
- Room-tab checks confirmed full-home and per-room counts, bedroom-only filtering, recent-room restoration, and no default quick-control obstruction.
- Placement recovery check selected the fan in edit mode, moved it to the unplaced inbox with Delete, then restored it to the bedroom through the labeled room selector.
- Automated verification after the Nuxt 4 migration: 18 Vitest tests, typecheck, lint, dependency audit, and the Cloudflare Worker production build passed. CloudBase HTTP adapter coverage includes EJSON decoding, authenticated queries, immutable-field filtering, transaction commit, rollback, conflict retry, and network failure mapping.
- A local workerd smoke test returned 200 for the home page, device detail page, and PWA manifest. Unconfigured cloud APIs failed closed with 503, `Cache-Control: no-store`, and security headers; Wrangler's deployment dry-run completed successfully.
- The previous desktop and mobile browser evidence remains the visual baseline. A fresh post-migration screenshot pass is still required because local browser automation was blocked from accessing `127.0.0.1` in the current environment.

## Comparison history

- P2, desktop room-label collision: the cloud-apartment `BEDROOM` label initially intersected the centered room switcher. The label moved from world x=652 to x=950. Final browser geometry confirmed no overlap, and the 1440 × 1024 screenshot shows the full label.
- P2, low-height desktop overflow: at 1280 × 720 the 2:1 scene could extend behind the topbar and tray. A low-height width constraint now preserves the scene aspect ratio within the available stage. Final browser geometry measured `sceneTop = topbarBottom = 76` and `sceneBottom = 575 < trayTop = 589`.
- Post-fix full and focused comparisons preserve hierarchy and operation while intentionally replacing photographic depth with editable vector geometry.

## Final result

passed with post-migration screenshot recheck pending
