import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getPublicMarketplaceProducts } from '../../services/apiClient';
import { marketplaceControlRequest, ManagedCategory } from '../../services/marketplaceControls';
import { BUSINESS_CONFIG } from '../../config/business';
import { MarketplaceProduct } from '../../types';
import { OptimizedImage } from '../common/OptimizedImage';
import { Laptop, Mic, Cpu, Store, ArrowRight, FileQuestion, Image as ImageIcon } from 'lucide-react';
import { marketplaceHref, openMarketplaceAt, productPriceText } from '../../utils/marketplaceBrowse';

export const HomeMarketplaceSection: React.FC = () => {
  const { setActivePage, openMarketplaceInquiry } = useApp();
  const [featuredProducts, setFeaturedProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeCategories, setActiveCategories] = useState<ManagedCategory[] | null>(null);
  useEffect(() => { let on = true; marketplaceControlRequest('categories').then(d => { if (on) setActiveCategories(d.categories || []); }).catch(() => {}); return () => { on = false; }; }, []);
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
    // Each shortcut opens its matching admin category in the Marketplace, not the unfiltered feed.
    { icon: Laptop, slug: 'laptops_computers', title: 'Laptops & Workstations', desc: 'Tools for study and work' },
    { icon: Mic, slug: 'creator_tools', title: 'Creator & Media Tools', desc: 'Audio, video and creative gear' },
    { icon: Cpu, slug: 'ai_productivity', title: 'AI & Productivity Tools', desc: 'Software for everyday tasks' },
    { icon: Store, slug: 'business_essentials', title: 'Business Hardware', desc: 'Retail and POS equipment' },
  ];
  const go = (e: React.MouseEvent, params: { category?: string; product?: string }) => { e.preventDefault(); openMarketplaceAt(setActivePage, params); };
  // Hide shortcuts the admin has retired; if categories cannot load, keep them all.
  const shortcuts = activeCategories ? categories.filter(c => activeCategories.some(a => a.slug === c.slug && a.active !== false)) : categories;
  const shortcutRow = shortcuts.length > 0 && (
    <div className="home-marketplace-categories" aria-label="Marketplace categories">{shortcuts.map(({ icon: Icon, slug, title, desc }) => (
      <a key={slug} href={marketplaceHref({ category: slug })} onClick={e => go(e, { category: slug })}><Icon className="w-5 h-5" /><span><strong>{title}</strong><span>{desc}</span></span><ArrowRight className="w-4 h-4" /></a>
    ))}</div>
  );
  return (
    <section className="home-container home-marketplace" aria-labelledby="marketplace-heading">
      <div className="home-marketplace-panel">
        <div className="home-marketplace-art" aria-hidden="true">
          <OptimizedImage src={BUSINESS_CONFIG.marketplaceHeroImageUrl} alt="" aspectRatio="16/10" objectFit="cover" responsiveWidths={[400, 640, 800]} sizes="(min-width: 1024px) 400px, (min-width: 768px) 40vw, 100vw" fallbackIcon={<Store className="w-12 h-12" />} />
        </div>
        <div className="home-marketplace-intro">
          <p className="home-eyebrow">Tech & Digital Marketplace</p>
          <h2 id="marketplace-heading">Find your next <span>work companion.</span></h2>
          <p>Browse technology and digital tools. Send an enquiry to check availability, pricing and delivery before deciding.</p>
          <a href="/marketplace" onClick={(e) => { e.preventDefault(); setActivePage('marketplace'); }} className="mh-button-secondary">Browse Marketplace<ArrowRight className="w-4 h-4" /></a>
        </div>
      </div>
      <div aria-busy={loading} className="home-marketplace-items">
        {loading ? <div className="home-marketplace-loading" role="status">Loading featured items…</div> : featuredProducts.length > 0 ? (
          <>
          <div className="home-product-grid">{featuredProducts.map(p => (
            <article key={p.id} className="home-product">
              <a href={marketplaceHref({ product: p.slug || p.id })} onClick={e => go(e, { product: p.slug || p.id })} className="home-product-image" aria-label={`View ${p.name}`}><OptimizedImage src={p.imageUrl} alt={p.imageAlt || p.name} aspectRatio="4/3" objectFit="contain" responsiveWidths={[320, 480, 640]} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" fallbackIcon={<ImageIcon className="w-8 h-8" />} /></a>
              <div className="home-product-details"><p><a href={marketplaceHref({ category: p.category })} onClick={e => go(e, { category: p.category })} className="home-product-category">{p.categoryLabel}</a></p><h3><a href={marketplaceHref({ product: p.slug || p.id })} onClick={e => go(e, { product: p.slug || p.id })}>{p.name}</a></h3><strong>{productPriceText(p)}</strong>{p.tagline && <p>{p.tagline}</p>}</div>
              <button type="button" onClick={() => openMarketplaceInquiry(p)} className="mh-button-secondary"><FileQuestion className="w-4 h-4" />Ask About This Item</button>
            </article>
          ))}</div>
          {shortcutRow && <div className="home-marketplace-shortcuts">{shortcutRow}</div>}
          </>
        ) : (
          <>
            {failed && <p className="home-marketplace-state" role="status">Featured items could not load.<button type="button" onClick={() => setRetry(n => n + 1)} className="home-text-action">Try Again</button></p>}
            {shortcutRow}
          </>
        )}
      </div>
    </section>
  );
};
