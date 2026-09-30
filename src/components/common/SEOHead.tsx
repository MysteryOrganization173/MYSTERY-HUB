import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ROUTE_PATH_MAP } from '../../context/AppContext';
import { BUSINESS_CONFIG } from '../../config/business';

interface PageMetadata {
  title: string;
  description: string;
}

const SEO_MAP: Record<string, PageMetadata> = {
  home: {
    title: 'Mystery Hub — Ghana’s All-in-One Digital Platform | Data & Websites',
    description:
      'Buy affordable data bundles for MTN, Telecel, and AirtelTigo with Mobile Money. Explore modern website templates and essential everyday digital services across Ghana.',
  },
  data: {
    title: 'Buy Data Bundles (MTN, Telecel, AirtelTigo) — Mystery Hub Ghana',
    description:
      'Fast, reliable data bundles for MTN, Telecel, and AirtelTigo. 1GB to 30GB non-expiring Jumbo packages with secure Mobile Money checkout.',
  },
  website: {
    title: 'Website Builder for Ghanaian Businesses — Mystery Hub',
    description:
      'Explore mobile-responsive website templates handcrafted for chop bars, salons, construction firms, boutiques, and churches in Ghana. With native WhatsApp & MoMo support.',
  },
  services: {
    title: 'Digital Services & Utility Bill Payments in Ghana — Mystery Hub',
    description:
      'Upcoming digital utilities for Ghana: ECG prepaid tokens, Ghana Water bills, WAEC checker PINs, and business services. Join early access.',
  },
  about: {
    title: 'About Mystery Hub — Reliable Digital Solutions for Ghana',
    description:
      'Learn about Mystery Hub’s mission to provide honest, reliable data bundles, website building tools, and everyday digital utilities across Ghana.',
  },
  orders: {
    title: 'Track Your Order & Receipts — Mystery Hub Ghana',
    description:
      'Check live status and transaction receipts for your Mystery Hub data bundle orders across MTN, Telecel, and AirtelTigo.',
  },
};

export const SEOHead: React.FC = () => {
  const { activePage } = useApp();

  useEffect(() => {
    const meta = SEO_MAP[activePage] || SEO_MAP.home;
    const path = ROUTE_PATH_MAP[activePage] || '/';
    const canonicalUrl = `https://${BUSINESS_CONFIG.domain}${path === '/' ? '' : path}`;

    // Update Document Title
    document.title = meta.title;

    // Update or create Meta Description
    let descTag = document.querySelector('meta[name="description"]');
    if (!descTag) {
      descTag = document.createElement('meta');
      descTag.setAttribute('name', 'description');
      document.head.appendChild(descTag);
    }
    descTag.setAttribute('content', meta.description);

    // Update or create Canonical Link
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', canonicalUrl);

    // Update OpenGraph tags
    const updateOrCreateMeta = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    updateOrCreateMeta('og:title', meta.title);
    updateOrCreateMeta('og:description', meta.description);
    updateOrCreateMeta('og:url', canonicalUrl);
  }, [activePage]);

  return null;
};
