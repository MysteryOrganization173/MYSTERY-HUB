import React, { useEffect } from 'react';
import { useApp, ROUTE_PATH_MAP } from '../../context/AppContext';
import { applySocialHead, marketplaceProductHead, pageIndexingHead, PUBLIC_ORIGIN, PUBLIC_PAGE_METADATA, publicPageHead } from '../../utils/socialMetadata';

const OTHER_PAGES: Record<string, {title:string;description:string}> = {
  help: { title: 'Help & FAQs — Mystery Hub Ghana',description:'Find answers about Data, Airtime, payments, order tracking, Mystery Earn, Website Builder, Wallet and support.'},
  wallet: {title:'Mystery Wallet — Mystery Hub',description:'Top up your Wallet and use your available balance for supported Mystery Hub purchases.'},
  about: {title:'About Mystery Hub — Reliable Digital Solutions for Ghana',description:'Learn about Mystery Hub’s mission to provide honest, reliable data bundles, website building tools, and everyday digital utilities across Ghana.'},
  orders: {title:'Track Your Order & Receipts — Mystery Hub Ghana',description:'Track your Mystery Hub orders using your reference or recipient number. Check payment and delivery status, and find support if you need help.'},
  admin: {title:'Staff & Operations Portal — Mystery Hub Ghana',description:'Authorized administrator and staff operations portal for Mystery Hub Ghana order processing, customers, and fulfillment.'},
};

export const SEOHead: React.FC = () => {
  const { activePage, marketplaceOverlay } = useApp();
  useEffect(() => {
    const product = activePage === 'marketplace' && marketplaceOverlay.kind !== 'none' ? marketplaceOverlay.product : null;
    const head = product ? marketplaceProductHead(product) : publicPageHead(activePage);
    const indexing = pageIndexingHead(window.location.pathname, window.location.search);
    if (indexing.noindex) Object.assign(head, indexing);
    if (!product && !PUBLIC_PAGE_METADATA[activePage] && OTHER_PAGES[activePage]) {
      Object.assign(head, OTHER_PAGES[activePage], {url: `${PUBLIC_ORIGIN}${ROUTE_PATH_MAP[activePage] || '/'}`});
    }
    applySocialHead(head);
  }, [activePage, marketplaceOverlay]);
  return null;
};
