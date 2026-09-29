import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Monitor, Smartphone, Tablet, Check, ArrowRight, Sparkles, MessageSquare } from 'lucide-react';

export const TemplatePreviewModal: React.FC = () => {
  const { selectedTemplatePreview, closeTemplatePreview, showToast, openWaitlist } = useApp();
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'home' | 'about' | 'services' | 'contact'>('home');

  if (!selectedTemplatePreview) return null;

  const t = selectedTemplatePreview;

  const handleStartBuilding = () => {
    closeTemplatePreview();
    openWaitlist(`Website Builder (${t.title})`);
    showToast(`Template "${t.title}" selected! Reserve your free launch access.`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] bg-[#0c1116] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Control Bar */}
        <div className="px-4 py-3 bg-[#090d10] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c365]" />
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>{t.title}</span>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-normal">
                  {t.categoryLabel}
                </span>
              </h3>
            </div>
          </div>

          {/* Device Responsive Switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDeviceView('desktop')}
              className={`p-1.5 rounded text-xs transition-colors ${
                deviceView === 'desktop' ? 'bg-[#00c365] text-black font-semibold' : 'text-slate-400 hover:text-white'
              }`}
              title="Desktop View"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeviceView('tablet')}
              className={`p-1.5 rounded text-xs transition-colors ${
                deviceView === 'tablet' ? 'bg-[#00c365] text-black font-semibold' : 'text-slate-400 hover:text-white'
              }`}
              title="Tablet View"
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeviceView('mobile')}
              className={`p-1.5 rounded text-xs transition-colors ${
                deviceView === 'mobile' ? 'bg-[#00c365] text-black font-semibold' : 'text-slate-400 hover:text-white'
              }`}
              title="Mobile View"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartBuilding}
              className="px-3.5 py-1.5 rounded-lg bg-[#00c365] hover:bg-[#00e575] text-black font-bold text-xs transition-all shadow-[0_0_12px_rgba(0,195,101,0.3)] flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Use This Template</span>
            </button>
            <button
              onClick={closeTemplatePreview}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Browser Mockup Canvas Area */}
        <div className="flex-1 bg-[#05080a] p-2 sm:p-6 overflow-y-auto flex items-center justify-center">
          <div
            className={`transition-all duration-300 bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col ${
              deviceView === 'desktop'
                ? 'w-full max-w-4xl h-full'
                : deviceView === 'tablet'
                ? 'w-[640px] h-full'
                : 'w-[360px] h-full max-h-[700px]'
            }`}
          >
            {/* Mock Browser Header */}
            <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between text-xs text-slate-600 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="bg-white px-3 py-0.5 rounded border border-slate-200 text-[11px] text-slate-500 font-mono flex items-center gap-1 max-w-xs truncate">
                <span className="text-emerald-600 font-bold">https://</span>
                <span>{t.id.replace('tmpl-', '')}.mysteryhub.site</span>
              </div>
              <div className="text-[10px] text-slate-400">Ghana 🇬🇭</div>
            </div>

            {/* Template Rendered Mock Website */}
            <div className="flex-1 overflow-y-auto bg-slate-50">
              {/* Site Navigation */}
              <nav className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="font-bold text-base tracking-tight text-slate-900 flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: t.accentColor }}
                  />
                  <span>{t.demoBusinessName}</span>
                </div>
                <div className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-600">
                  <button
                    onClick={() => setActiveTab('home')}
                    className={activeTab === 'home' ? 'text-slate-900 font-bold' : ''}
                  >
                    Home
                  </button>
                  <button
                    onClick={() => setActiveTab('about')}
                    className={activeTab === 'about' ? 'text-slate-900 font-bold' : ''}
                  >
                    About Us
                  </button>
                  <button
                    onClick={() => setActiveTab('services')}
                    className={activeTab === 'services' ? 'text-slate-900 font-bold' : ''}
                  >
                    Services & Rates
                  </button>
                  <button
                    onClick={() => setActiveTab('contact')}
                    className={activeTab === 'contact' ? 'text-slate-900 font-bold' : ''}
                  >
                    Contact (Accra)
                  </button>
                </div>
                <a
                  href="#contact"
                  className="px-3 py-1.5 rounded text-xs font-semibold text-white shadow-sm"
                  style={{ backgroundColor: t.accentColor }}
                >
                  Contact Now
                </a>
              </nav>

              {/* Hero Banner */}
              <div className="relative py-12 px-6 sm:px-10 bg-slate-900 text-white overflow-hidden">
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `radial-gradient(circle at 70% 30%, ${t.accentColor}, transparent 60%)`,
                  }}
                />
                <div className="relative max-w-xl space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-slate-200 border border-white/15">
                    <span>{t.industry}</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                    {t.demoHeroTagline}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {t.demoSubtext}
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <button
                      className="px-4 py-2 rounded-lg text-xs font-bold text-white shadow-md flex items-center gap-1.5"
                      style={{ backgroundColor: t.accentColor }}
                    >
                      <span>Explore Offerings</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp Inquiries</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Highlights & Features */}
              <div className="py-8 px-6 sm:px-10 space-y-6">
                <div className="text-center max-w-md mx-auto space-y-1">
                  <h2 className="font-bold text-lg text-slate-900">Why Choose Us</h2>
                  <p className="text-xs text-slate-500">
                    Trusted by clients across Accra, Kumasi, and nationwide.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {t.features.map((feat, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-sm flex items-start gap-2.5"
                    >
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-white"
                        style={{ backgroundColor: t.accentColor }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-xs text-slate-800">{feat}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Built-in capability with one-click Ghana Mobile Money and WhatsApp automation.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mock Contact / Location Section */}
              <div className="bg-slate-100 p-6 sm:p-8 border-t border-slate-200 text-center space-y-3">
                <h3 className="font-bold text-sm text-slate-800">Visit Us or Connect Directly</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Located in Greater Accra, Ghana. We accept MTN Mobile Money, Telecel Cash, and Bank Transfer.
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat on WhatsApp: +233 24 000 0000</span>
                </div>
              </div>

              {/* Mock Footer */}
              <div className="bg-slate-900 text-slate-400 py-4 px-6 text-center text-[10px]">
                <p>© 2026 {t.demoBusinessName}. Powered by Mystery Hub Sites Ghana.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
