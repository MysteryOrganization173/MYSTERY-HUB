import React from 'react';
import { ShieldCheck, ScanLine, Smartphone, MapPin } from 'lucide-react';
import { publishedTrustIndicators, SAMPLE_TRUST_STATISTICS, SERVICE_TRUST_INDICATORS } from '../../config/trustAnalytics';

/** Samples are explicit and disclosed. Production capabilities never occupy numerical slots. */
export function HomeTrustAnalytics({ designPreview = false }: { designPreview?: boolean }) {
  const indicators = designPreview ? SAMPLE_TRUST_STATISTICS : publishedTrustIndicators();
  const hasFigures = indicators.length > 0;
  const badges = [
    [ShieldCheck, 'Secure Checkout'], [ScanLine, 'Order Tracking'],
    [Smartphone, 'Mobile Money Ready'], [MapPin, 'Built for Ghana'],
  ] as const;
  return (
    <section className={`home-container home-analytics home-analytics--${hasFigures ? 'figures' : 'capabilities'}`} aria-labelledby="analytics-heading">
      <div className="home-analytics-panel">
        {designPreview && (
          <p className="home-analytics-disclosure" role="note">
            Design preview only · Sample figures, not verified operating results.
          </p>
        )}
        <div className="home-analytics-main">
          <div className="home-analytics-intro">
            <p className="home-eyebrow">THE MYSTERY HUB EXPERIENCE</p>
            <h2 id="analytics-heading">Built for Ghana.<br /><span>Designed for what’s next.</span></h2>
            <p>A growing digital ecosystem bringing everyday services, modern tools and smoother transactions into one connected experience.</p>
          </div>
          {hasFigures ? (
            <div className="home-analytics-grid" aria-label={designPreview ? 'Illustrative statistics' : 'Verified platform statistics'}>
              {indicators.map(indicator => (
                <div className="home-analytics-metric" key={indicator.label}>
                  <strong className="home-analytics-value">{indicator.value}</strong>
                  <span>{indicator.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <ul className="home-analytics-capabilities" aria-label="Everyday service capabilities">
              {SERVICE_TRUST_INDICATORS.map((indicator, index) => {
                const Icon = badges[index][0];
                return <li key={indicator.label}>
                  <Icon size={22} aria-hidden="true" />
                  <div><h3>{indicator.label}</h3><p>{indicator.value === 'Paystack' && 'Pay through Paystack. '}{indicator.detail}</p></div>
                </li>;
              })}
            </ul>
          )}
        </div>
        <ul className="home-trust-badges" aria-label="Platform capabilities">
          {badges.map(([Icon, label]) => <li key={label}><Icon size={15} aria-hidden="true" />{label}</li>)}
        </ul>
      </div>
    </section>
  );
}
