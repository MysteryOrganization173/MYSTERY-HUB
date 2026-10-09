import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getPublicMarketplaceProducts } from '../../services/apiClient';
import { BUSINESS_CONFIG } from '../../config/business';
import { MarketplaceProduct } from '../../types';
import { OptimizedImage } from '../common/OptimizedImage';
import { Laptop, Mic, Cpu, Store, ArrowRight, FileQuestion, Image as ImageIcon } from 'lucide-react';

export const HomeMarketplaceSection: React.FC = () => {
  const { setActivePage, openMarketplaceInquiry } = useApp();
  const [featuredProducts, setFeaturedProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let mounted = true;
    setLoading(true); setFailed(false);
    getPublicMarketplaceProducts({ featured: true }).then(res => {
      if (!res.success) throw new Error('Marketplace unavailable');
      if (mounted) setFeaturedProducts((res.products || []).slice(0, 4));
    }).catch(() => { if (mounted) setFailed(true); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [retry]);

  const categories = [
    { icon: Laptop, title: 'Laptops & Workstations', desc: 'Tools for study and work' },
    { icon: Mic, title: 'Creator & Media Tools', desc: 'Audio, video and creative gear' },
    { icon: Cpu, title: 'AI & Productivity Tools', desc: 'Software for everyday tasks' },
    { icon: Store, title: 'Business Hardware', desc: 'Retail and POS equipment' },
  ];
  return (
    <section className="home-marketplace" aria-labelledby="marketplace-heading">
      <div className="home-container">
        <div className="home-marketplace-intro">
          <div>
            <p className="home-eyebrow">Tech & Digital Marketplace</p>
            <h2 id="marketplace-heading">Find your next<br /><span>work companion.</span></h2>
            <p>Browse technology and digital tools. Send an enquiry to check availability, pricing and delivery before deciding.</p>
            <a href="/marketplace" onClick={(e) => { e.preventDefault(); setActivePage('marketplace'); }} className="mh-button-secondary">Browse Marketplace<ArrowRight className="w-4 h-4" /></a>
          </div>
          <div className="home-marketplace-art" aria-hidden="true">
            <OptimizedImage src={BUSINESS_CONFIG.marketplaceHeroImageUrl} alt="" aspectRatio="16/9" objectFit="cover" responsiveWidths={[480, 800, 1200]} sizes="(min-width: 768px) 50vw, 100vw" fallbackIcon={<Store className="w-12 h-12" />} />
          </div>
        </div>
        <div aria-busy={loading}>
          {loading ? <div className="home-marketplace-loading" role="status">Loading featured items…</div> : featuredProducts.length > 0 ? (
            <div className="home-product-grid">{featuredProducts.map(p => (
              <article key={p.id} className="home-product">
                <div className="home-product-image"><OptimizedImage src={p.imageUrl} alt={p.imageAlt || p.name} aspectRatio="4/3" objectFit="contain" responsiveWidths={[320, 480, 640]} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" fallbackIcon={<ImageIcon className="w-8 h-8" />} /></div>
                <div className="home-product-details"><p>{p.categoryLabel}</p><h3>{p.name}</h3><strong>{p.priceDisplay}</strong>{p.tagline && <p>{p.tagline}</p>}</div>
                <button onClick={() => openMarketplaceInquiry(p)} className="mh-button-secondary"><FileQuestion className="w-4 h-4" />Ask About This Item</button>
              </article>
            ))}</div>
          ) : (
            <>
              <p className="home-marketplace-state" role="status">{failed ? 'Featured items could not load.' : 'Explore categories and check current availability in Marketplace.'}{failed && <button onClick={() => setRetry(n => n + 1)} className="home-text-action">Try Again</button>}</p>
              <div className="home-marketplace-categories">{categories.map(({ icon: Icon, title, desc }) => (
                <button key={title} onClick={() => setActivePage('marketplace')}><Icon className="w-6 h-6" /><span><strong>{title}</strong><span>{desc}</span></span><ArrowRight className="w-4 h-4" /></button>
              ))}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
