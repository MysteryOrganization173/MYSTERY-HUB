import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { DataBundle } from '../../types';
import { GHANA_NETWORKS } from '../../data/bundles';
import { formatGhs } from '../../../shared/money';
import { dataValidityLabel } from '../../utils/dataPurchasePresentation';
import { campaignPriceForBundle, welcomePriceForBundle, type WelcomeOffer } from '../../utils/welcomeOfferPresentation';
import { Money } from '../purchase/Money';
import { useTapFeedback } from '../../hooks/useTapFeedback';

/** The network's own colour, carried by the tile's edge so a mixed list stays easy to scan. */
export const TILE_NETWORK_COLOR: Record<DataBundle['network'], string> = { mtn: '#ffcc00', airteltigo: '#2f7fd8', telecel: '#e60000' };
const SHORT_NAME: Record<DataBundle['network'], string> = { mtn: 'MTN', airteltigo: 'AT', telecel: 'Telecel' };

/** "10GB" → ["10", "GB"], so the size can be set large with a quieter unit. Anything else is shown as written. */
export function splitDataAmount(amount: string): [string, string] {
  const match = /^\s*([\d.,]+)\s*([A-Za-z]+)\s*$/.exec(amount);
  return match ? [match[1], match[2]] : [amount, ''];
}

interface DataBundleTileProps {
  bundle: DataBundle;
  onBuy: (bundle: DataBundle) => void;
  directWelcomeOffer?: WelcomeOffer | null;
  /** Position in the list, used only to stagger the one entrance. */
  index?: number;
}

/**
 * The Data page's catalogue tile (Mystery Hub 3.6). It is the Data page's own presentation of a bundle: the homepage
 * keeps CompactBundleRow and reseller storefronts keep BundleCard. Prices come from the same helpers as those
 * components (the server catalogue, its campaign fields and the confirmed Welcome Offer), so this file decides how a
 * price looks, never what it is. The whole tile opens checkout, where the number and the server total are confirmed.
 */
export const DataBundleTile: React.FC<DataBundleTileProps> = ({ bundle, onBuy, directWelcomeOffer, index = 0 }) => {
  const welcomePrice = welcomePriceForBundle(bundle, directWelcomeOffer);
  // One price per tile: the eligible first-order price, else a server campaign price, else the bundle price.
  const campaignPrice = welcomePrice ? null : campaignPriceForBundle(bundle);
  const network = GHANA_NETWORKS[bundle.network];
  const [tapped, confirmTap] = useTapFeedback();
  const buy = () => { confirmTap(); onBuy(bundle); };
  const [size, unit] = splitDataAmount(bundle.dataAmount);
  const validity = dataValidityLabel(bundle.validity);
  // A comparison figure from the price on the tile itself (never the one-time Welcome Price): cedis per gigabyte.
  const gigabytes = bundle.dataBytesValue > 0 ? bundle.dataBytesValue / 1024 : 0;
  const perGb = !welcomePrice && gigabytes >= 1 && unit.toUpperCase() === 'GB' ? `GH₵${(bundle.priceGhc / gigabytes).toFixed(2)} per GB` : '';
  const flag = welcomePrice || campaignPrice ? null : bundle.isBestValue ? 'Best value' : bundle.isPopular ? 'Popular' : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buy(); }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={buy}
      onKeyDown={handleKeyDown}
      data-tapped={tapped}
      data-net={bundle.network}
      data-offer={welcomePrice ? 'welcome' : campaignPrice ? 'campaign' : undefined}
      data-flag={flag ? (bundle.isBestValue ? 'value' : 'popular') : undefined}
      style={{ '--net': TILE_NETWORK_COLOR[bundle.network], '--i': Math.min(index, 11) } as React.CSSProperties}
      aria-label={`Buy ${bundle.dataAmount} ${network.name} data${welcomePrice ? '. ' + welcomePrice.description : campaignPrice ? '. ' + campaignPrice.description : ` for GH₵${bundle.priceGhc.toFixed(2)}`}`}
      className="mh-ds-tile group"
    >
      <span className="mh-ds-tile-band" aria-hidden="true" />
      <span className="mh-ds-tile-light" aria-hidden="true" />
      <span className="mh-ds-tile-top">
        <span className="mh-ds-tile-net"><span className="mh-ds-tile-dot" aria-hidden="true" />{SHORT_NAME[bundle.network]}</span>
        {flag === 'Best value' ? <span className="mh-ds-tile-flag" aria-label="Best value"><span className="mh-ds-flag-long">Best </span>value</span>
          : flag ? <span className="mh-ds-tile-flag">{flag}</span> : null}
      </span>

      <span className="mh-ds-tile-size">{size}{unit && <span className="mh-ds-tile-unit">{unit}</span>}</span>
      {/* An offer names itself in full here (the label is the server's own words); otherwise validity or per GB. */}
      {welcomePrice ? <span className="mh-ds-tile-meta is-offer">Welcome Price</span>
        : campaignPrice ? <span className="mh-ds-tile-meta is-campaign">{campaignPrice.label}</span>
        : <span className="mh-ds-tile-meta">{validity || perGb || network.name}</span>}

      <span className="mh-ds-tile-foot">
        <span className="mh-ds-tile-price">
          {welcomePrice ? <>
            <del>{formatGhs(welcomePrice.regularMinor)}</del>
            <strong className="is-offer">{formatGhs(welcomePrice.totalMinor)}</strong>
            <small className="is-offer">You save {formatGhs(welcomePrice.savingMinor)}</small>
          </> : campaignPrice ? <>
            <del>{formatGhs(campaignPrice.standardMinor)}</del>
            <strong>{formatGhs(campaignPrice.priceMinor)}</strong>
            <small className="is-campaign">You save {formatGhs(campaignPrice.savingMinor)}</small>
          </> : <Money ghc={bundle.priceGhc} text="text-[1.05rem] min-[360px]:text-[1.2rem] sm:text-[1.3rem]" />}
        </span>
        <span aria-hidden="true" className="mh-buy mh-ds-tile-buy">
          <span className="mh-ds-tile-buy-word">Buy</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </span>
      </span>
    </div>
  );
};
