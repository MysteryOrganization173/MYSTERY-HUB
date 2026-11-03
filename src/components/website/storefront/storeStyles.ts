/**
 * V7.1 Data Store styles: Horizon, Market and Studio (V7.2 adds Compact, Editorial and Signature). Scoped to `.reseller-storefront[data-store-style]`, so the
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

/* =========================== COMPACT (V7.2) =========================== */
/* Commerce first: a short hero with no photo, then one framed price list. The network tabs stay under the header. */
[data-store-style=compact] .cp{padding-top:14px;padding-bottom:0}
[data-store-style=compact] .sx-badge{display:none}
[data-store-style=compact] .sx-title{font-size:clamp(1.45rem,6.2vw,2.4rem);line-height:1.08;letter-spacing:-.025em}
[data-store-style=compact] .sx-text{margin-top:6px;font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
[data-store-style=compact] .sx-actions{margin-top:12px}
[data-store-style=compact] .sx-primary{min-height:46px!important;padding:0 18px;border-radius:12px}
[data-store-style=compact] .sx-facts{margin-top:12px;gap:6px}
[data-store-style=compact] .sx-facts li{border:1px solid var(--store-border);border-radius:999px;padding:3px 10px;font-size:12.5px}
@media (min-width:900px){[data-store-style=compact] .cp{padding-top:32px}
  [data-store-style=compact] .cp .sx-copy{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:40px;align-items:end}
  [data-store-style=compact] .cp .sx-copy>*{grid-column:1}
  [data-store-style=compact] .cp .sx-actions{grid-column:2;grid-row:1/span 3;margin:0;align-self:center}
  [data-store-style=compact] .cp .sx-facts{grid-column:1/-1}}
[data-store-style=compact] .store-picker-wrap{display:none}
[data-store-style=compact] #bundle-catalog.store-section{padding-top:16px}
[data-store-style=compact] .store-section-head{margin-bottom:8px}
[data-store-style=compact] .store-section-head h2{font-size:clamp(1.1rem,4vw,1.5rem)}
[data-store-style=compact] .store-network-tabs{position:sticky;top:69px;z-index:6;border-radius:14px;box-shadow:0 10px 22px -18px rgb(0 0 0 / .7)}
[data-store-style=compact] .store-network-tabs button{border-radius:10px}
[data-store-style=compact] .store-rows{gap:0;border:1px solid var(--store-border);border-radius:16px;overflow:hidden;background:var(--store-surface)}
[data-store-style=compact] .store-row{border:0!important;border-bottom:1px solid var(--store-border)!important;border-radius:0;min-height:58px;padding:8px 12px 8px 16px;background:transparent!important}
[data-store-style=compact] .store-row::before{width:3px}
[data-store-style=compact] .store-row:focus-visible{outline-offset:-3px}
[data-store-style=compact] .store-row[aria-pressed=true]{box-shadow:inset 0 0 0 2px var(--website-accent)}
[data-store-style=compact] .store-row-size{font-size:19px}
[data-store-style=compact] .store-row-price{font-size:15.5px}
[data-store-style=compact] .store-row-cta{padding:7px 12px;font-size:12.5px}
@media (min-width:720px){[data-store-style=compact] .store-rows{column-gap:0}[data-store-style=compact] .store-row:nth-child(odd){border-right:1px solid var(--store-border)!important}}
[data-store-style=compact] .store-section{padding-top:24px}
[data-store-style=compact] .store-card{border-radius:16px;padding:16px}
[data-store-style=compact] .store-steps{gap:10px}
[data-store-style=compact] .store-steps small{font-size:13px}

/* =========================== EDITORIAL (V7.2) =========================== */
/* A magazine spread: serif display type (a system face, so nothing extra downloads), a framed photo with a caption,
   numbered bundles on hairlines and calm spacing. */
.reseller-storefront[data-store-style=editorial] :is(h1,h2,h3,.site-display){font-family:Georgia,'Noto Serif','Times New Roman',serif;letter-spacing:-.01em}
[data-store-style=editorial] .store-header{border-bottom-width:3px!important;border-bottom-style:double!important}
[data-store-style=editorial] .ed{padding-top:18px;padding-bottom:6px}
[data-store-style=editorial] .ed-rule{display:flex;flex-wrap:wrap;gap:0 4px;margin:0 0 16px;padding:0 0 10px;border-bottom:1px solid;font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
[data-store-style=editorial] .ed-grid{display:grid;gap:22px}
[data-store-style=editorial] .sx-badge{background:transparent;border:0;padding:0;font-style:italic;font-weight:600;letter-spacing:0}
[data-store-style=editorial] .sx-title{font-size:clamp(2.1rem,9.5vw,4.6rem);line-height:1.03;font-weight:600}
[data-store-style=editorial] .sx-text{font-size:16px;line-height:1.6}
[data-store-style=editorial] .sx-primary{border-radius:999px}
[data-store-style=editorial] .sx-facts{border-top:1px solid var(--store-border);padding-top:12px;width:100%}
[data-store-style=editorial] .ed-figure{margin:0;border-top:1px solid;padding-top:10px}
[data-store-style=editorial] .ed-photo{aspect-ratio:16/9;overflow:hidden;border-radius:4px}
[data-store-style=editorial] .ed-photo>span{height:100%}
[data-store-style=editorial] .ed-figure figcaption{margin-top:8px;font:italic 13px/1.4 Georgia,'Noto Serif',serif;overflow-wrap:anywhere}
@media (min-width:900px){[data-store-style=editorial] .ed{padding-top:40px}
  [data-store-style=editorial] .ed-grid{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:56px;align-items:center}
  [data-store-style=editorial] .ed-photo{aspect-ratio:4/5}}
[data-store-style=editorial] .store-picker-card{border-radius:4px}
[data-store-style=editorial] .store-eyebrow{font:italic 600 14px/1.3 Georgia,'Noto Serif',serif;text-transform:none;letter-spacing:0}
[data-store-style=editorial] .store-network-tabs{background:transparent!important;border:0;border-radius:0;padding:0;gap:20px;border-bottom:1px solid var(--store-border)}
[data-store-style=editorial] .store-network-tabs button{background:transparent!important;color:var(--store-text)!important;border:0!important;border-bottom:2px solid transparent!important;border-radius:0;padding:0 2px;font-size:12.5px;letter-spacing:.1em;text-transform:uppercase}
[data-store-style=editorial] .store-network-tabs button[aria-pressed=true]{border-bottom-color:var(--store-text)!important}
[data-store-style=editorial] .store-network-tabs button[aria-pressed=true] .store-network-dot{background:var(--store-text)!important}
[data-store-style=editorial] .store-rows{counter-reset:ed;gap:0}
@media (min-width:720px){[data-store-style=editorial] .store-rows{column-gap:48px}}
[data-store-style=editorial] .store-row,[data-store-style=editorial] .store-row.has-action{counter-increment:ed;background:transparent!important;border:0!important;border-top:1px solid var(--store-border)!important;border-radius:0;padding:14px 0 14px 36px;min-height:72px}
[data-store-style=editorial] .store-row{grid-template-columns:76px minmax(0,1fr) auto}
[data-store-style=editorial] .store-row.has-action{grid-template-columns:70px minmax(0,1fr) auto auto}
[data-store-style=editorial] .store-row::before{content:counter(ed,decimal-leading-zero);top:50%;bottom:auto;left:0;width:auto;height:auto;transform:translateY(-50%);background:none;font:italic 600 13px/1 Georgia,'Noto Serif',serif;color:var(--store-muted)}
[data-store-style=editorial] .store-row-size{font-size:26px;font-weight:600}
[data-store-style=editorial] .store-row-size::after{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--store-network);margin-left:5px;vertical-align:4px}
[data-store-style=editorial] .store-row-price{font-family:Georgia,'Noto Serif',serif;font-size:18px}
[data-store-style=editorial] .store-row-cta{background:transparent!important;color:var(--store-text)!important;border:1px solid var(--store-border)}
[data-store-style=editorial] .store-row:hover .store-row-cta{border-color:var(--store-text)}
[data-store-style=editorial] .store-row[aria-pressed=true]{box-shadow:inset 0 -2px 0 var(--website-accent)}
/* Phones: the counter, size and price keep one line; the network dot moves to the counter (the tabs name the network). */
@media (max-width:479px){[data-store-style=editorial] .store-row,[data-store-style=editorial] .store-row.has-action{padding-left:28px;gap:8px}[data-store-style=editorial] .store-row.has-action{grid-template-columns:58px minmax(0,1fr) auto auto}[data-store-style=editorial] .store-row-size{font-size:21px;white-space:nowrap}[data-store-style=editorial] .store-row-size::after{display:none}[data-store-style=editorial] .store-row-price{font-size:16px}[data-store-style=editorial] .store-row-meta small{display:none}}
@media (max-width:359px){[data-store-style=editorial] .store-row.has-action{grid-template-columns:50px minmax(0,1fr) auto auto}[data-store-style=editorial] .store-row-size{font-size:19px}}
[data-store-style=editorial] .store-steps-card,[data-store-style=editorial] .store-help{background:transparent!important;border-left:0;border-right:0;border-radius:0;padding-left:0;padding-right:0}
[data-store-style=editorial] .store-step-number{background:transparent!important;color:var(--store-text)!important;font:italic 700 18px/1 Georgia,'Noto Serif',serif}
[data-store-style=editorial] .store-footer{border-top-width:3px!important;border-top-style:double!important}

/* =========================== SIGNATURE (V7.2) =========================== */
/* Brand first: a block in the owner's main colour carries the mark and the promise; the photo sits in an arch.
   Text inside the block uses the accent's own readable ink (black or white), so any colour stays legible. */
[data-store-style=signature] .sg{display:grid;padding-top:16px;padding-bottom:4px}
[data-store-style=signature] .sg-arch{position:relative;z-index:1;justify-self:center;width:min(46%,190px);aspect-ratio:10/9;border-radius:999px 999px 0 0;overflow:hidden;margin-bottom:-1px}
[data-store-style=signature] .sg-arch>span{height:100%}
[data-store-style=signature] .sg-panel{position:relative;isolation:isolate;border-radius:28px;padding:24px 20px 22px;overflow:hidden}
[data-store-style=signature] .sg-panel::after{content:"";position:absolute;z-index:-1;right:-64px;top:-64px;width:190px;height:190px;border-radius:50%;border:30px solid currentColor;opacity:.08;pointer-events:none}
[data-store-style=signature] .sg-mark{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;overflow:hidden;font-size:24px;font-weight:800;margin-bottom:16px}
[data-store-style=signature] .sg-panel :is(.sx-title,.sx-text,.sx-facts,.sx-facts strong,.sx-secondary,.sx-badge){color:inherit!important}
[data-store-style=signature] .sg-panel .sx-badge{background:transparent;border-color:currentColor}
[data-store-style=signature] .sg-panel .sx-badge-dots i{box-shadow:0 0 0 2px var(--website-accent)}
[data-store-style=signature] .sx-title{font-size:clamp(2rem,9vw,4.2rem);font-weight:800;letter-spacing:-.035em}
[data-store-style=signature] .sg-panel .sx-primary{background:var(--website-on-accent)!important;color:var(--website-accent)!important}
[data-store-style=signature] .sg-panel .sx-secondary{text-decoration-color:currentColor}
[data-store-style=signature] .sg-panel .sx-facts{border-top:1px solid currentColor;padding-top:12px;width:100%}
[data-store-style=signature] .sg-panel :focus-visible{outline-color:currentColor}
@media (min-width:900px){[data-store-style=signature] .sg{grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:24px;align-items:stretch;padding-top:36px}
  [data-store-style=signature] .sg-arch{order:2;width:100%;aspect-ratio:auto;min-height:420px;border-radius:999px 999px 36px 36px;margin:0}
  [data-store-style=signature] .sg-panel{border-radius:36px;padding:48px 44px}
  [data-store-style=signature] .sg-mark{width:84px;height:84px;font-size:30px;border-radius:26px}}
/* Bundles as tickets: a coloured network stub, notches on both sides and a perforated price stub. */
[data-store-style=signature] .store-row{border-radius:12px;padding-left:22px;min-height:70px;-webkit-mask:radial-gradient(circle 7px at 0 50%,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 7px at 100% 50%,#0000 97%,#000) right/51% 100% no-repeat;mask:radial-gradient(circle 7px at 0 50%,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 7px at 100% 50%,#0000 97%,#000) right/51% 100% no-repeat}
[data-store-style=signature] .store-row::before{width:7px}
[data-store-style=signature] .store-row:focus-visible{-webkit-mask:none;mask:none}
[data-store-style=signature] .store-row-price{align-self:stretch;display:flex;align-items:center;justify-content:flex-end;border-left:1.5px dashed var(--store-border);padding-left:12px}
[data-store-style=signature] .store-row-cta{border-radius:10px}
[data-store-style=signature] .store-network-tabs{border-radius:16px}
[data-store-style=signature] .store-network-tabs button{border-radius:12px}
[data-store-style=signature] .store-help{border:1.5px solid var(--website-accent)!important}
[data-store-style=signature] .store-step-number{background:var(--website-accent)!important;color:var(--website-on-accent)!important}

@media (prefers-reduced-motion:reduce){[data-store-style] .mk-art{transform:none!important}}
`;
