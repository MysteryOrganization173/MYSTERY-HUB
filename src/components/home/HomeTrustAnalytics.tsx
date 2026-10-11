import React from 'react';
import { ShieldCheck, ScanLine, Smartphone, MapPin } from 'lucide-react';
import { publishedTrustIndicators, SAMPLE_TRUST_STATISTICS, SERVICE_TRUST_INDICATORS } from '../../config/trustAnalytics';

/** designPreview is explicit and always visibly disclosed; the live homepage never enables it. */
export function HomeTrustAnalytics({ designPreview = false }: { designPreview?: boolean }) {
  const indicators = designPreview ? SAMPLE_TRUST_STATISTICS : publishedTrustIndicators();
  const hasFigures = designPreview || indicators.some(indicator => !SERVICE_TRUST_INDICATORS.includes(indicator));
  const badges = [
    [ShieldCheck, 'Secure Checkout'], [ScanLine, 'Order Tracking'],
    [Smartphone, 'Mobile Money Ready'], [MapPin, 'Built for Ghana'],
  ] as const;
  return (
    <section className="home-container home-analytics" aria-labelledby="analytics-heading">
      <div className="home-analytics-panel">
        <div className="home-analytics-intro">
          <p className="home-eyebrow">{hasFigures ? 'MYSTERY HUB IN NUMBERS' : 'EVERYDAY DIGITAL CONFIDENCE'}</p>
          <h2 id="analytics-heading">Built for confidence.<br /><span>Growing with Ghana.</span></h2>
          <p>A connected platform for everyday digital services, straightforward payments and experiences designed around your needs.</p>
        </div>
        {designPreview && (
          <p className="home-analytics-disclosure" role="note">
            Sample figures · Design preview only. These are not verified operating results.
          </p>
        )}
        <div className="home-analytics-grid">
          {indicators.map(indicator => (
            <div className="home-analytics-metric" key={indicator.label}>
              <strong className={SERVICE_TRUST_INDICATORS.includes(indicator) ? 'home-analytics-value home-analytics-capability' : 'home-analytics-value'}>{indicator.value}</strong>
              <span>{indicator.label}</span>
              {!designPreview && <p>{indicator.detail}</p>}
            </div>
          ))}
        </div>
        <ul className="home-trust-badges" aria-label="Platform capabilities">
          {badges.map(([Icon, label]) => <li key={label}><Icon size={15} aria-hidden="true" />{label}</li>)}
        </ul>
        <p className="home-analytics-footnote">Clear totals before payment. A reference to keep afterward.</p>
      </div>
    </section>
  );
}
