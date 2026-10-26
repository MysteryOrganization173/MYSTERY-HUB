# Installable app (P0-C)

Mystery Hub installs as a web app from `public/manifest.json` (id `/`, standalone, portrait). There is no
service worker and no offline cache. Chrome no longer needs one to offer installation.

## What exists

| Piece | File | Notes |
| --- | --- | --- |
| Install prompt capture | `src/pwa/installPrompt.ts` | Imported by `main.tsx` before any surface loads. Never active on `/sites/*` or template previews. |
| Browser abilities | `src/pwa/appEnvironment.ts` | Installed detection (`display-mode`, `navigator.standalone`), Chromium prompt support, iPhone/iPad Add to Home Screen. |
| When to suggest things | `src/pwa/launchPolicy.ts` | Pure rules + per-device dismissal memory (localStorage). |
| Install card | `src/components/pwa/InstallAppPromo.tsx` | Guest homepage. `variant="compact"` fits Homepage V3's member-home `promotion` slot. |
| Installed-app launch | `src/components/pwa/AppLaunchLayer.tsx` | Welcome sheet (signed out, start page only) then notification card (signed in, Home only). Renders nothing in a browser tab. |
| Notification permission | `src/pwa/notifications.ts`, `src/components/pwa/NotificationOptIn.tsx` | Permission only, requested from a tap. `PUSH_DELIVERY_ENABLED = false`. |

## Storage keys (this device only)

`mh_install_promo`, `mh_notification_optin` (`{count, lastAt}`), `mh_app_welcome_guest_at`,
`mh_app_installed_at` in localStorage; `mh_app_welcome_shown` in sessionStorage (one app launch).

## Web Push integration

The P0 notification slice implements a push-only worker, encrypted session-bound subscriptions, preferences, durable order-event delivery and Admin templates/history. Production clients use the reviewed HTTP contracts, not waiting placeholders. See `docs/backend-p0-v1.md`, `docs/notifications-b3.md` and `docs/p0-notifications-integration.md`.

Permission remains distinct from subscription and provider acceptance. Registration happens only from an explicit account-screen action, after enabled configuration is checked. Marketing consent is separate and defaults off. Generated customer websites/iframes cannot request subscriptions through the app helper. There is no fetch interception or offline cache. Notification links require authenticated ownership lookup.

New deployments initialize sending paused. VAPID, subscription encryption, the enable flag and an explicitly consenting founder-device test must be verified before delivery is resumed. Backend and UI availability do not prove native-device acceptance or live Gemini access. No bulk send or production transaction is part of release verification.
