import React, { useState } from 'react';
import { Crosshair, ExternalLink, RotateCcw } from 'lucide-react';
import { DEFAULT_FRAMING, FRAMING_ZOOM_MAX, formatImageFraming, framingRegion, isDefaultFraming, parseImageFraming, type ImageFraming } from '../../../../shared/marketplaceImageFraming';
import { ProductPhoto } from '../../marketplace/MarketplaceMedia';
import { marketplaceSocialImage } from '../../../utils/socialMetadata';
import { getCloudinaryUrl } from '../../../utils/cloudinary';

interface Props {
  imageUrl: string;
  name: string;
  /** null = automatic framing. */
  framing: ImageFraming | null;
  onChange: (framing: ImageFraming | null) => void;
}

const SOCIAL_RATIO = 1200 / 630;
const normalise = (f: ImageFraming) => parseImageFraming(formatImageFraming(f) || '');

/**
 * Shows the main photo the way customers meet it: a Marketplace card, the product page and a
 * WhatsApp/social link preview. Optional framing (subject point + zoom) is saved with the
 * product and applied at delivery time; the uploaded photo itself is never edited.
 */
export const MarketplacePhotoFraming: React.FC<Props> = ({ imageUrl, name, framing, onChange }) => {
  const [open, setOpen] = useState(Boolean(framing));
  const [natural, setNatural] = useState<{ src: string; width: number; height: number } | null>(null);
  const size = natural?.src === imageUrl ? natural : null;
  const current = framing || DEFAULT_FRAMING;
  const update = (patch: Partial<ImageFraming>) => onChange(normalise({ ...current, ...patch }));
  const social = marketplaceSocialImage(imageUrl, framing);
  const exactSharing = social.imageWidth === 1200; // a Cloudinary original: the link renders the real 1200x630 image

  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    const img = event.currentTarget.querySelector('img');
    const rect = (img || event.currentTarget).getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)));
    update({ x, y, zoom: current.zoom === 1 ? 1.2 : current.zoom });
  };
  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 5;
    const moves: Record<string, Partial<ImageFraming>> = {
      ArrowLeft: { x: current.x - step }, ArrowRight: { x: current.x + step }, ArrowUp: { y: current.y - step }, ArrowDown: { y: current.y + step },
    };
    if (moves[event.key]) { event.preventDefault(); update(moves[event.key]); }
  };

  return (
    <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0b1116] p-3 sm:p-4 space-y-3" data-mh-photo-framing>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-white">How customers see the main photo</h4>
          <p className="text-xs text-slate-400">{framing ? 'Custom framing. ' : 'Automatic framing. '}The product page always shows the whole photo.</p>
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:border-[#00c365]/60">
          <Crosshair className="h-4 w-4 text-[#00c365]" aria-hidden="true" />{open ? 'Done adjusting' : 'Adjust framing'}
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-3 sm:grid-cols-[110px_150px_minmax(0,1fr)] items-start">
        <figure className="space-y-1">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-slate-800" data-mh-preview="card">
            <ProductPhoto src={imageUrl} alt="" iconKey="laptop" framing={framing || undefined} widths={[240, 360]} sizes="110px" />
          </div>
          <figcaption className="text-[11px] text-slate-400">Marketplace card</figcaption>
        </figure>
        <figure className="space-y-1">
          <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-800" data-mh-preview="detail">
            <ProductPhoto src={imageUrl} alt="" iconKey="laptop" fit="contain" widths={[320, 480]} sizes="150px" />
          </div>
          <figcaption className="text-[11px] text-slate-400">Product page (whole photo)</figcaption>
        </figure>
        <figure className="space-y-1 col-span-2 sm:col-span-1">
          <SocialPreview imageUrl={imageUrl} framing={framing} size={size} onSize={setNatural} />
          <figcaption className="flex flex-wrap items-center justify-between gap-x-3 text-[11px] text-slate-400">
            <span>WhatsApp / social link preview (1200 × 630)</span>
            {exactSharing && <a href={social.image} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#7dffbf] hover:underline">Open exact image<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>}
          </figcaption>
        </figure>
      </div>
      {!exactSharing && <p className="text-xs text-amber-300">This photo is not stored on Mystery Hub's Cloudinary, so link previews use it exactly as uploaded. Upload the photo here for the framed sharing image.</p>}

      {open && (
        <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] border-t border-slate-800 pt-3">
          <div
            role="slider"
            tabIndex={0}
            aria-label={`Subject position in the photo of ${name || 'this product'}`}
            aria-valuetext={`${current.x}% across, ${current.y}% down`}
            aria-valuenow={current.x}
            onPointerDown={pick}
            onKeyDown={nudge}
            className="relative mx-auto w-full max-w-[180px] cursor-crosshair touch-none select-none rounded-xl border border-slate-700 bg-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c365]"
          >
            <div className="relative">
              <img src={getCloudinaryUrl(imageUrl, { width: 360 })} alt="" draggable={false} className="block w-full h-auto rounded-xl" />
              <span className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#00e575] bg-[#00c365]/25 shadow-[0_0_0_2px_rgba(0,0,0,0.6)]" style={{ left: `${current.x}%`, top: `${current.y}%` }} aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-3 text-xs text-slate-300">
            <p>Tap the product in the photo to centre the framing on it, then enlarge it if the photo has a lot of empty space. Arrow keys move the point.</p>
            <label className="block space-y-1">
              <span className="flex justify-between"><span className="font-semibold text-white">Enlarge</span><span className="tabular-nums text-slate-400">{Math.round(current.zoom * 100)}%</span></span>
              <input type="range" min={1} max={FRAMING_ZOOM_MAX} step={0.05} value={current.zoom} onChange={e => update({ zoom: Number(e.target.value) })} className="w-full accent-[#00c365]" />
            </label>
            <p className="text-slate-500">Applies to cards, department and brand tiles, and link previews. Software cannot restore parts of a product that were cut off in the original photo.</p>
            <button type="button" disabled={!framing} onClick={() => onChange(null)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-700 px-3 font-semibold text-slate-200 disabled:opacity-40">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Back to automatic
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Live stand-in for the Cloudinary sharing image (blurred fill + whole photo, fitted), so the
 * slider never creates a new Cloudinary rendition per step. "Open exact image" shows the real one.
 */
const SocialPreview: React.FC<{ imageUrl: string; framing: ImageFraming | null; size: { width: number; height: number } | null; onSize: (s: { src: string; width: number; height: number }) => void }> = ({ imageUrl, framing, size, onSize }) => {
  const src = getCloudinaryUrl(imageUrl, { width: 640 });
  const region = framing && !isDefaultFraming(framing) ? framingRegion(framing) : { x: 0, y: 0, w: 1, h: 1 };
  const ratio = size ? size.width / size.height : 1;
  // The crop keeps the photo's proportions, so the fitted foreground box has the photo's own ratio.
  const box = ratio < SOCIAL_RATIO ? { height: '100%', width: `${(ratio / SOCIAL_RATIO) * 100}%` } : { width: '100%', height: `${(SOCIAL_RATIO / ratio) * 100}%` };
  const crop: React.CSSProperties = { position: 'absolute', width: `${100 / region.w}%`, height: `${100 / region.h}%`, left: `${(-region.x / region.w) * 100}%`, top: `${(-region.y / region.h) * 100}%`, maxWidth: 'none' };
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-[#0b0f12]" style={{ aspectRatio: '1200 / 630' }} data-mh-preview="social">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover scale-110 blur-xl brightness-[.62]" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden" style={box}>
        <img src={src} alt="" style={crop} onLoad={e => onSize({ src: imageUrl, width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} />
      </div>
    </div>
  );
};
