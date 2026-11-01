/**
 * V7.1 Data Store styles: Horizon, Market and Studio. Scoped to `.reseller-storefront[data-store-style]`, so the
 * Classic look (no attribute) renders exactly as before. Same markup, same checkout and same tap targets in every
 * style; only composition, surfaces, type and image handling change. Inline like RESELLER_STORE_CSS so the public
 * page, the editor iframe and server rendering all carry it.
 *
 * Colour always comes from the owner: --store-bg(-rgb), --website-accent, --store-surface, --store-text.
 * Effects stay cheap for low-end phones: two blurred layers at most (header, desktop network cards), no
 * animation beyond short transitions, none at all with reduced motion.
 */
export const STORE_STYLE_CSS = `
[data-store-style]{--sx-radius:18px}
[data-store-style] .site-display{letter-spacing:-.02em}

/* ---------- Shared hero copy ---------- */
[data-store-style] .sx-copy{display:flex;flex-direction:column;align-items:flex-start;position:relative}
[data-store-style] .sx-badge{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;padding:5px 12px 5px 8px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.01em;color:var(--store-text);background:rgb(var(--store-bg-rgb) / .55);border:1px solid var(--store-border)}
[data-store-style] .sx-badge-dots{display:inline-flex}
[data-store-style] .sx-badge-dots i{width:10px;height:10px;border-radius:50%;box-shadow:0 0 0 2px rgb(var(--store-bg-rgb));margin-right:-3px}
[data-store-style] .sx-badge-dots i:last-child{margin-right:2px}
[data-store-style] .sx-title{margin:0;font-weight:800;line-height:1.02;overflow-wrap:anywhere;text-wrap:balance}
[data-store-style] .sx-text{margin:10px 0 0;font-size:15px;line-height:1.55;max-width:34rem}
[data-store-style] .sx-actions{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:18px}
[data-store-style] .sx-primary{min-height:50px!important;padding:0 22px;border-radius:14px}
[data-store-style] .sx-secondary{display:inline-flex;align-items:center;gap:8px;padding:0 6px;font-weight:700;font-size:14.5px;background:none;border:0;text-decoration:underline;text-decoration-color:var(--store-border);text-underline-offset:5px;text-decoration-thickness:2px}
[data-store-style] .sx-secondary:hover{text-decoration-color:currentColor}
[data-store-style] .sx-facts{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;line-height:1.4}
[data-store-style] .sx-facts strong{font-weight:800}
[data-store-style] .sx-trust{display:inline-flex;align-items:center;gap:6px}
@media (max-width:639px){[data-store-style] .sx-trust:last-child{display:none}}

/* ---------- Catalogue rhythm shared by the new styles ---------- */
[data-store-style] #bundle-catalog.store-section{padding-top:22px}
[data-store-style] .store-section-head{margin-bottom:12px}
[data-store-style] .store-section-head h2{font-size:clamp(1.3rem,4.6vw,2rem)}
[data-store-style] .store-section-head .store-eyebrow{margin-bottom:4px}
@media (max-width:639px){[data-store-style] .store-head-note,[data-store-style] .store-section-head .store-eyebrow{display:none}}
/* Small phones (320–379px): the networks show in the tabs right below, so the hero drops its badge and tightens. */
@media (max-width:379px){[data-store-style] .store-network-tabs button{padding:0 11px;gap:6px}[data-store-style] .store-network-count{display:none}}
@media (max-width:379px){[data-store-style] .sx-badge{display:none}[data-store-style] .sx-primary{min-height:46px!important;padding:0 18px}[data-store-style] .sx-text{font-size:14.5px}}
[data-store-style] .store-section{padding-top:32px}
[data-store-style] .store-network-tabs{border-radius:999px;padding:5px}
[data-store-style] .store-network-tabs button{border-radius:999px;min-height:46px}
[data-store-style] .store-row{border-width:1px;border-radius:16px;min-height:66px}
[data-store-style] .store-row-size{font-size:24px}
[data-store-style] .store-row-price{font-size:17px}
[data-store-style=market] .store-skeleton{grid-template-columns:repeat(2,minmax(0,1fr))}
[data-store-style=market] .store-skeleton-row{height:178px;border-radius:18px}

/* =========================== HORIZON =========================== */
/* The banner runs under the translucent header and fades into the page, so image, name and bundles read as one piece. */
[data-store-style=horizon] .store-header.is-overlay{border-bottom-color:transparent!important;-webkit-backdrop-filter:saturate(1.3) blur(14px);backdrop-filter:saturate(1.3) blur(14px)}
[data-store-style=horizon] .hz{position:relative;isolation:isolate;margin-top:-69px;padding-top:69px;overflow:hidden}
[data-store-style=horizon] .hz-media{position:absolute;left:0;right:0;top:0;height:min(330px,56vh);z-index:-2;background:radial-gradient(120% 90% at 78% 30%,rgb(var(--store-accent-rgb) / .55),transparent 60%),radial-gradient(80% 70% at 10% 0%,rgb(var(--store-accent-rgb) / .25),transparent 70%),rgb(var(--store-bg-rgb))}
[data-store-style=horizon] .hz-media>span{height:100%}
[data-store-style=horizon] .hz-scrim{position:absolute;left:0;right:0;top:0;height:min(331px,calc(56vh + 1px));z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgb(var(--store-bg-rgb) / .35) 0,rgb(var(--store-bg-rgb) / 0) 26%,rgb(var(--store-bg-rgb) / .5) 55%,rgb(var(--store-bg-rgb) / .94) 82%,rgb(var(--store-bg-rgb)) 100%)}
[data-store-style=horizon] .hz-inner{padding-top:clamp(84px,24vw,128px);padding-bottom:4px}
[data-store-style=horizon] .sx-title{font-size:clamp(2rem,9vw,4.4rem);text-shadow:0 2px 24px rgb(var(--store-bg-rgb) / .55)}
[data-store-style=horizon] .sx-text{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
@media (max-width:379px){[data-store-style=horizon] .hz-inner{padding-top:56px}[data-store-style=horizon] .sx-title{font-size:2rem}[data-store-style=horizon] .sx-actions{margin-top:14px}[data-store-style=horizon] .sx-facts{margin-top:12px}}
@media (max-height:680px) and (max-width:639px){[data-store-style=horizon] .hz-media{height:270px}[data-store-style=horizon] .hz-scrim{height:271px}[data-store-style=horizon] .hz-inner{padding-top:64px}}
@media (min-width:640px){[data-store-style=horizon] .hz-media,[data-store-style=horizon] .hz-scrim{height:100%}
  [data-store-style=horizon] .hz-scrim{background:linear-gradient(90deg,rgb(var(--store-bg-rgb) / .96) 0,rgb(var(--store-bg-rgb) / .82) 34%,rgb(var(--store-bg-rgb) / .2) 68%,rgb(var(--store-bg-rgb) / .05) 100%),linear-gradient(180deg,rgb(var(--store-bg-rgb) / .45) 0,transparent 22%,transparent 70%,rgb(var(--store-bg-rgb)) 100%)}
  [data-store-style=horizon] .hz-inner{padding-top:72px;padding-bottom:88px;min-height:440px;display:flex;align-items:center}
  [data-store-style=horizon] .sx-copy{max-width:36rem}
  [data-store-style=horizon] .sx-text{-webkit-line-clamp:3;font-size:16.5px}}
@media (min-width:1024px){[data-store-style=horizon] .hz-inner{min-height:460px;padding-bottom:100px}}
/* Desktop network cards float over the banner's lower edge. Phones use the tabs in the catalogue. */
[data-store-style=horizon] .store-picker-wrap{position:relative;z-index:2;padding-top:0}
@media (min-width:640px){[data-store-style=horizon] .store-picker-wrap{margin-top:-68px}
  [data-store-style=horizon] .store-picker>.store-eyebrow{color:var(--store-text)!important}
  [data-store-style=horizon] .store-picker-card{background:rgb(var(--store-bg-rgb) / .72)!important;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-radius:18px;padding:14px 16px;box-shadow:0 18px 40px -28px rgb(0 0 0 / .8)}}
[data-store-style=horizon] .store-row{background-image:linear-gradient(180deg,rgb(255 255 255 / .035),transparent 60%)}
[data-store-style=horizon][data-store-tone=light] .store-row{background-image:none;box-shadow:0 1px 0 rgb(15 23 42 / .04),0 8px 20px -18px rgb(15 23 42 / .35)}
[data-store-style=horizon] .store-row-cta{padding:9px 16px}
[data-store-style=horizon] .store-network-tabs{box-shadow:inset 0 1px 0 rgb(255 255 255 / .04)}

/* =========================== MARKET =========================== */
/* Bright and shop-like: a short banner strip, a compact headline, then bundles as price tags in a grid. */
[data-store-style=market] .mk{display:grid;gap:16px;padding-top:14px;padding-bottom:4px}
[data-store-style=market] .mk-art{border:1px solid;border-radius:20px;overflow:hidden;aspect-ratio:16/6;background:linear-gradient(135deg,rgb(var(--store-accent-rgb) / .35),rgb(var(--store-accent-rgb) / .08))}
[data-store-style=market] .mk-art>span{height:100%}
[data-store-style=market] .sx-title{font-size:clamp(1.75rem,7.4vw,3.6rem);font-weight:800}
[data-store-style=market] .sx-title::after{content:"";display:block;width:56px;height:5px;border-radius:5px;background:var(--website-accent);margin-top:12px}
[data-store-style=market] .sx-text{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
[data-store-style=market] .sx-badge{background:transparent}
@media (min-width:900px){[data-store-style=market] .mk{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);align-items:center;gap:56px;padding-top:44px}
  [data-store-style=market] .mk-art{order:2;aspect-ratio:4/3;border-radius:28px;transform:rotate(1.2deg);box-shadow:0 30px 60px -40px rgb(15 23 42 / .55)}}
[data-store-style=market] .store-network-tabs{border-radius:16px;padding:4px;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;width:100%}
[data-store-style=market] .store-network-tabs button{border-radius:12px;padding:0 10px}
@media (min-width:640px){[data-store-style=market] .store-network-tabs{width:min(100%,34rem)}}
[data-store-style=market] .store-rows{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:720px){[data-store-style=market] .store-rows{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (min-width:1024px){[data-store-style=market] .store-rows{grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}}
[data-store-style=market] .store-row,[data-store-style=market] .store-row.has-action{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"size size" "meta meta" "price price" "cta cta";align-items:end;gap:4px 8px;padding:16px 12px 12px;border-radius:18px;min-height:0}
[data-store-style=market] .store-row::before{left:0;right:0;top:0;bottom:auto;width:auto;height:4px}
[data-store-style=market] .store-row-size{grid-area:size;font-size:clamp(26px,8vw,32px)}
[data-store-style=market] .store-row-meta{grid-area:meta;margin-bottom:6px}
[data-store-style=market] .store-row-meta small{display:block}
[data-store-style=market] .store-row-price{grid-area:price;text-align:left;font-size:18px;color:var(--website-accent);filter:saturate(1.1)}
[data-store-style=market][data-store-tone=light] .store-row-price{color:inherit}
[data-store-style=market] .store-row-cta{grid-area:cta;padding:9px 14px;text-align:center;margin-top:8px}
[data-store-style=market] .store-row-flag{display:table;margin:4px 0 0}
[data-store-style=market] .store-setup-price{grid-area:price;justify-self:start}
@media (max-width:359px){[data-store-style=market] .store-rows{grid-template-columns:1fr}}
[data-store-style=market] .store-steps li{border:1px solid var(--store-border);border-radius:16px;padding:14px;background:rgb(var(--store-bg-rgb) / .4)}

/* =========================== STUDIO =========================== */
/* Typography and the owner's mark. No banner photo is downloaded at all. */
[data-store-style=studio] .st{display:grid;gap:14px;padding-top:20px;padding-bottom:4px}
[data-store-style=studio] .st-mark{width:60px;height:60px;border-radius:18px;border:1px solid;display:grid;place-items:center;overflow:hidden;font-size:22px;font-weight:800}
[data-store-style=studio] .st-mark img{object-fit:contain}
[data-store-style=studio] .sx-badge{background:transparent;border:0;padding-left:0}
[data-store-style=studio] .sx-title{font-size:clamp(2.4rem,12vw,6rem);font-weight:800;letter-spacing:-.045em;line-height:.95}
[data-store-style=studio] .sx-text{font-size:16px}
[data-store-style=studio] .sx-facts{border-top:1px solid var(--store-border);border-bottom:1px solid var(--store-border);padding:12px 0;width:100%}
@media (min-width:900px){[data-store-style=studio] .st{grid-template-columns:auto minmax(0,1fr);gap:40px;align-items:start;padding-top:72px}
  [data-store-style=studio] .st-mark{width:120px;height:120px;border-radius:32px;font-size:44px;margin-top:10px}}
[data-store-style=studio] .store-header{border-bottom-color:transparent!important}
[data-store-style=studio] .store-header .store-mark{display:none}
[data-store-style=studio] .store-network-tabs{background:transparent!important;border:0;border-bottom:1px solid var(--store-border);border-radius:0;padding:0;gap:4px}
[data-store-style=studio] .store-network-tabs button{background:transparent!important;color:var(--store-text)!important;border:0!important;border-bottom:3px solid transparent!important;border-radius:0;padding:0 14px}
[data-store-style=studio] .store-network-tabs button[aria-pressed=true]{border-bottom-color:var(--website-accent)!important}
[data-store-style=studio] .store-network-tabs button[aria-pressed=true] .store-network-dot{background:var(--store-text)!important}
[data-store-style=studio] .store-rows{gap:0}
@media (min-width:720px){[data-store-style=studio] .store-rows{column-gap:40px}}
[data-store-style=studio] .store-row{background:transparent!important;border:0!important;border-bottom:1px solid var(--store-border)!important;border-radius:0;padding-left:2px;min-height:72px}
[data-store-style=studio] .store-row::before{display:none}
[data-store-style=studio] .store-row-size{font-variant-numeric:tabular-nums;font-size:26px}
[data-store-style=studio] .store-row[aria-pressed=true]{box-shadow:inset 3px 0 0 var(--website-accent)}
[data-store-style=studio] .store-row-cta{background:transparent!important;color:var(--store-text)!important;border:1.5px solid var(--store-text)}
[data-store-style=studio] .store-row:hover .store-row-cta{background:var(--website-accent)!important;color:var(--website-on-accent)!important;border-color:var(--website-accent)}
[data-store-style=studio] .store-steps-card,[data-store-style=studio] .store-help{background:transparent!important;border-left:0;border-right:0;border-radius:0;padding-left:0;padding-right:0}
[data-store-style=studio] .store-step-number{background:transparent!important;color:var(--store-text)!important;border:1.5px solid var(--store-border);font-variant-numeric:tabular-nums}
[data-store-style=studio] .store-footer{background:transparent!important}

@media (prefers-reduced-motion:reduce){[data-store-style] .mk-art{transform:none!important}}
`;
