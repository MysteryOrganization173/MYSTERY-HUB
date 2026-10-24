# App Sharing V1: /app and its WhatsApp preview

## What ships

- `/app` (`src/components/app/AppLandingPage.tsx`, lazy-loaded): the install landing page for people arriving from WhatsApp. It reuses `useAppInstall` (the existing `beforeinstallprompt` capture, installed-app detection and dismissal records) and picks one next step per browser in `src/pwa/installGuidance.ts`: install button (Chromium prompt), Add to Home Screen steps (iPhone/iPad), "open in your browser" steps (WhatsApp, Facebook, Instagram and other in-app browsers), browser-menu steps (Android without a prompt), "get it on your phone" (desktop without a prompt), or **Open Mystery Hub** inside the installed app. It fetches no account data.
- **Share Mystery Hub** (`src/components/app/ShareAppButton.tsx`): the phone menu, the account menu and the bottom of `/app`. It uses the Web Share API where available and copies `https://mysterybundlehub.com/app` otherwise. The shared text never includes a referral code or account detail. Mystery Earn referral sharing is unchanged.

## Share preview (first HTML response)

`publicPageHead('app')` in `src/utils/socialMetadata.ts` is the single definition:

| Tag | Value |
| --- | --- |
| title / og:title / twitter:title | Install Mystery Hub \| Everything Digital. One Trusted Place. |
| description | Buy data, top up airtime, track orders and create your own free business website. Get Mystery Hub on your phone. |
| og:url / canonical | https://mysterybundlehub.com/app |
| og:image / twitter:image | https://res.cloudinary.com/da6oeat7m/image/upload/v1792879753/mystery-hub/app-share/mystery-hub-app-preview-v1.jpg (1200 × 630 JPEG, about 105 KB) |

It reaches the first response in both deployments:

- **Render Static Site:** `vite build` writes `dist/app/index.html` (plugin `appSharePage` in `vite.config.ts`), and `render.yaml` rewrites `/app` and `/app/` to it ahead of the `/*` catch-all. `public/_redirects` has the same rules for Netlify previews.
- **Express Web Service:** `server/routes/publicHtml.ts` already injects `pageIndexingHead(path)`, which now resolves `/app` to the same head. No database read happens for `/app`.

**For Codex (Render routing):** if the Static Site's Redirects/Rewrites are managed in the Dashboard rather than synced from `render.yaml`, add `Rewrite /app → /app/index.html` (and `/app/`) above the existing `/* → /index.html` rule. Without it, the page still works, but the static site sends WhatsApp the generic homepage preview. No change is needed on the Express service.

## The preview image

- `og-composition.html` is the 1200 × 630 layout. The phone is the real `/app` phone presentation, captured at 2× from the production build with its logo slot left empty. The result is `og-base-v1.jpg`, uploaded as the Cloudinary original `mystery-hub/app-share/og-base-v1`.
- Cloudinary then lays the approved logo (`30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc`, untouched) into the brand tile and the phone's top bar. That rendition was stored as its own original, `mystery-hub/app-share/mystery-hub-app-preview-v1`, so crawlers get a plain file with nothing to render:

```
l_30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc/e_trim/c_fit,h_58,w_58/fl_layer_apply,g_north_west,x_81,y_82/
l_30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc/c_scale,w_24/fl_layer_apply,g_north_west,x_853,y_110/
f_jpg/q_88/v1792879717/mystery-hub/app-share/og-base-v1.jpg
```

To change the image, upload a new `-v2` and update `APP_SHARE_IMAGE`. Never overwrite `-v1`, because WhatsApp caches previews per URL.
