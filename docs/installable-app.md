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

## Deferred: Web Push delivery

Not built, because it needs decisions and backend pieces that do not exist yet:

1. A service worker (scope `/`) that only handles `push` and `notificationclick`. It must not cache API
   responses, orders, Wallet or payment state.
2. A VAPID key pair. The public key is served to the browser; the private key stays on the server.
3. An authenticated API to store and delete each device's `PushSubscription` against its account.
4. A sender that turns order events into messages, with per-user opt-out and expired-subscription cleanup.

When those exist, a `src/pwa/push.ts` module can subscribe after `requestNotificationPermission()` returns
`granted`. `NotificationOptIn` keeps its UI; only its granted state changes from "Nothing is sent yet" to a
confirmation that alerts are on.
