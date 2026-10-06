import { ManagedDataStorefront } from './ManagedDataStorefront';
import { trackPublicWebsite, publicWebsiteClickKind } from '../../services/websiteBusinessApi';
import React, { useState, useEffect } from 'react';
import { getPublicSiteBySlug } from '../../services/apiClient';
import { PublicWebsiteSite } from '../../types';
import { getTemplateById, mergeSiteWithTemplate, renderTemplateLayout } from '../../utils/templateRendererUtils';
import { Globe, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

interface PublicPublishedSiteProps {
  slug: string;
}

export const PublicPublishedSite: React.FC<PublicPublishedSiteProps> = ({ slug }) => {
  const [site, setSite] = useState<PublicWebsiteSite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getPublicSiteBySlug(slug)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.site) {
          setSite(res.site);
          trackPublicWebsite(res.site.id,'site_view');
          if (res.site.content?.businessName) {
            document.title = `${res.site.content.businessName} · Official Website`;
          }
        } else {
          setError('Website not found or not currently published.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Website unavailable.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b0e] text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#00c365]/10 border border-[#00c365]/30 flex items-center justify-center text-[#00c365] animate-pulse">
          <Globe className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          Loading Website...
        </p>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="min-h-screen bg-[#070b0e] text-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Website Not Found
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            This website is currently unpublished or does not exist. Check the URL or create your own free website.
          </p>
        </div>
        <a
          href="/website-builder"
          className="px-5 py-2.5 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg"
        >
          <span>Build Your Website Free</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  const baseTemplate = getTemplateById(site.template_id);
  const mergedTemplate = mergeSiteWithTemplate(baseTemplate, site.content, site.settings);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-slate-900 antialiased selection:bg-[#00c365] selection:text-black">
      {/* Dynamic Website Render */}
      <div className="flex-1 w-full" onClickCapture={event=>{const target=(event.target as HTMLElement).closest('a,button');if(!target)return;const kind=publicWebsiteClickKind(target);if(kind)trackPublicWebsite(site.id,kind);}}>
        {site.template_id==='tmpl-data-reseller'?<ManagedDataStorefront siteId={site.id} template={mergedTemplate}/>:renderTemplateLayout(mergedTemplate)}
      </div>

      {/* Free Tier Attribution Link (Tasteful, Non-Intrusive) */}
      {site.showAttribution !== false && <footer className="py-3 px-4 bg-[#090d11] border-t border-slate-800 text-center text-xs text-slate-400 select-none">
        <a
          href="/website-builder"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <Sparkles className="w-3 h-3 text-[#00c365]" />
          <span>Powered by</span>
          <span className="font-bold text-[#00c365]">Mystery Hub</span>
          <span className="text-[10px] text-slate-400">· Build Free</span>
        </a>
      </footer>}
    </div>
  );
};
