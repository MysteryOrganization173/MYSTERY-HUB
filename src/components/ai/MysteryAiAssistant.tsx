import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ActivePage } from '../../types';
import { MysteryAiIcon } from './MysteryAiIcon';
import {
  ChatMessage,
  SuggestedQuestion,
  getSuggestedQuestionsForPage,
  sendMysteryAiMessage,
} from '../../services/mysteryAiService';
import {
  X,
  Send,
  RotateCcw,
  ArrowRight,
  Sparkles,
  Wifi,
  Globe,
  Grid2X2,
  Clock,
  ExternalLink,
} from 'lucide-react';

export const MysteryAiAssistant: React.FC = () => {
  const { activePage, setActivePage } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpandedPrompt, setIsExpandedPrompt] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dismissPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredPromptRef = useRef(false);

  const getPageDisplayName = (page: ActivePage) => {
    switch (page) {
      case 'data':
        return 'Data & Airtime';
      case 'website':
        return 'Website Builder';
      case 'services':
        return 'More Services';
      case 'orders':
        return 'Order Tracking';
      case 'about':
        return 'About Mystery Hub';
      case 'home':
      default:
        return 'Home';
    }
  };

  const getPageGreeting = (page: ActivePage): string => {
    switch (page) {
      case 'data':
        return "Hi 👋 I'm Mystery AI. I see you're browsing our Data & Airtime offers! What would you like to know about our MTN, Telecel, and AirtelTigo bundles or MoMo checkout?";
      case 'website':
        return "Hi 👋 I'm Mystery AI. I see you're exploring the Website Builder! Ready to create a no-code website for your Ghanaian business, church, salon, or shop?";
      case 'services':
        return "Hi 👋 I'm Mystery AI. Looking through our upcoming digital utilities? Let me know which services (like ECG power tokens or WAEC checker) you'd like to hear about.";
      case 'orders':
        return "Hi 👋 I'm Mystery AI. Tracking an order or have questions about delivery? I can guide you on lookups and WhatsApp support.";
      case 'about':
        return "Hi 👋 I'm Mystery AI. Want to learn more about Mystery Hub's mission and who we serve in Ghana?";
      case 'home':
      default:
        return "Hi 👋 I'm Mystery AI, your guide to Mystery Hub. What would you like to know about our data bundles or website builder?";
    }
  };

  // Initialize or update opening message when chat opens or page changes with no conversation yet
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: `welcome-${activePage}-${Date.now()}`,
          role: 'assistant',
          content: getPageGreeting(activePage),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [activePage, messages.length]);

  // Inactivity expansion trigger: after 10s of quiet dwell, gently expand prompt once
  useEffect(() => {
    if (hasTriggeredPromptRef.current || isOpen) return;

    promptTimeoutRef.current = setTimeout(() => {
      if (!isOpen && !hasTriggeredPromptRef.current) {
        setIsExpandedPrompt(true);
        hasTriggeredPromptRef.current = true;

        dismissPromptTimeoutRef.current = setTimeout(() => {
          setIsExpandedPrompt(false);
        }, 6000);
      }
    }, 10000);

    return () => {
      if (promptTimeoutRef.current) clearTimeout(promptTimeoutRef.current);
      if (dismissPromptTimeoutRef.current) clearTimeout(dismissPromptTimeoutRef.current);
    };
  }, [isOpen]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setIsExpandedPrompt(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
      setIsExpandedPrompt(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await sendMysteryAiMessage(query, activePage, [...messages, userMsg]);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickAction: response.quickAction,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content:
            "I'm here to help you navigate Mystery Hub in Ghana! How can I assist you with data, websites, or upcoming utilities?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Browse Data Offers' },
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${activePage}-${Date.now()}`,
        role: 'assistant',
        content: getPageGreeting(activePage),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleQuickActionClick = (targetPage: ActivePage) => {
    setActivePage(targetPage);
    // Smooth auto-scroll to top and toast feedback
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 640) {
      setIsOpen(false);
    }
  };

  // Programmatically compute suggested questions dynamically for current active page
  const suggestedQuestions: SuggestedQuestion[] = getSuggestedQuestionsForPage(activePage);

  return (
    <div className="fixed z-50 bottom-20 right-4 sm:bottom-6 sm:right-6 pointer-events-none">
      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Mystery AI Assistant"
          aria-modal="true"
          className="pointer-events-auto mb-3 w-[calc(100vw-2rem)] sm:w-96 md:w-[430px] h-[540px] max-h-[80vh] bg-[#0c1217] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[#090e13] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#00c365]/15 border border-[#00c365]/30 flex items-center justify-center">
                <MysteryAiIcon size="sm" active={isTyping} />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-white">Mystery AI</h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00c365]" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-400">Viewing:</span>
                  <span className="text-[10px] font-semibold text-[#00c365] bg-[#00c365]/10 px-1.5 py-0.2 rounded border border-[#00c365]/20">
                    {getPageDisplayName(activePage)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Reset conversation"
                aria-label="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Page Jump Bar */}
          <div className="px-3 py-1.5 bg-[#080c10] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] shrink-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold shrink-0">
              Jump:
            </span>
            <button
              onClick={() => handleQuickActionClick('data')}
              className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 shrink-0 ${
                activePage === 'data'
                  ? 'bg-[#00c365]/20 text-[#00c365] border-[#00c365]/40 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3 h-3" />
              <span>Data</span>
            </button>
            <button
              onClick={() => handleQuickActionClick('website')}
              className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 shrink-0 ${
                activePage === 'website'
                  ? 'bg-[#00c365]/20 text-[#00c365] border-[#00c365]/40 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Websites</span>
            </button>
            <button
              onClick={() => handleQuickActionClick('orders')}
              className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 shrink-0 ${
                activePage === 'orders'
                  ? 'bg-[#00c365]/20 text-[#00c365] border-[#00c365]/40 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Orders</span>
            </button>
            <button
              onClick={() => handleQuickActionClick('services')}
              className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 shrink-0 ${
                activePage === 'services'
                  ? 'bg-[#00c365]/20 text-[#00c365] border-[#00c365]/40 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Grid2X2 className="w-3 h-3" />
              <span>Services</span>
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs sm:text-sm">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed whitespace-pre-wrap ${
                      isAssistant
                        ? 'bg-[#141b22] text-slate-200 border border-slate-800 rounded-tl-sm'
                        : 'bg-[#00c365] text-black font-semibold rounded-tr-sm'
                    }`}
                  >
                    {msg.content}

                    {/* Actionable Redirection Button */}
                    {msg.quickAction && (
                      <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex flex-col gap-1.5">
                        <button
                          onClick={() => handleQuickActionClick(msg.quickAction!.targetPage)}
                          className="w-full py-2 px-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,195,101,0.25)] flex items-center justify-between group cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{msg.quickAction.label}</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-1.5 text-slate-400 text-xs py-1">
                <div className="w-6 h-6 rounded-lg bg-[#141b22] border border-slate-800 flex items-center justify-center">
                  <MysteryAiIcon size="sm" active />
                </div>
                <div className="flex items-center gap-1 bg-[#141b22] border border-slate-800 rounded-xl px-3 py-2">
                  <span className="w-1.5 h-1.5 bg-[#00c365] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-[#00c365] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-[#00c365] rounded-full animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Programmatically Detected Page Suggested Questions */}
          <div className="p-2.5 bg-[#0a0f13] border-t border-slate-800/80">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#00c365]" />
                <span>Suggested for {getPageDisplayName(activePage)}</span>
              </span>
              <span className="text-[9px] text-[#00c365] font-medium">Auto-detected</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {suggestedQuestions.map((sq) => (
                <button
                  key={sq.id}
                  onClick={() => handleSendMessage(sq.text)}
                  disabled={isTyping}
                  className="px-2.5 py-1 rounded-lg bg-[#131b22] hover:bg-[#1a2530] text-slate-300 hover:text-white border border-slate-800 hover:border-[#00c365]/40 text-[11px] whitespace-nowrap transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  {sq.text}
                </button>
              ))}
            </div>
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-[#090e13] border-t border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Mystery AI about data, websites, pricing..."
              className="flex-1 bg-[#10171f] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="w-8 h-8 rounded-xl bg-[#00c365] hover:bg-[#00e575] disabled:opacity-40 text-black flex items-center justify-center transition-all cursor-pointer shrink-0"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Control Button & Gentle Expanded Prompt */}
      <div className="pointer-events-auto flex items-center gap-2 justify-end">
        {/* Subtle, gentle expansion prompt after 10s idle */}
        {isExpandedPrompt && !isOpen && (
          <div
            onClick={handleToggle}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c1217] border border-[#00c365]/40 text-xs text-white shadow-xl cursor-pointer hover:border-[#00c365] transition-all animate-in fade-in slide-in-from-right-2 duration-300"
          >
            <span className="w-2 h-2 rounded-full bg-[#00c365] animate-pulse" />
            <span>Have a question? Ask Mystery AI</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpandedPrompt(false);
              }}
              className="text-slate-400 hover:text-white p-0.5"
              aria-label="Dismiss message"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Primary Mystery AI Compact Control */}
        <button
          onClick={handleToggle}
          className={`relative group w-12 h-12 rounded-full bg-[#0d1419] border transition-all duration-200 shadow-2xl flex items-center justify-center active:scale-95 cursor-pointer ${
            isOpen
              ? 'border-[#00c365] ring-2 ring-[#00c365]/30'
              : 'border-slate-700/80 hover:border-[#00c365]'
          }`}
          aria-label={isOpen ? 'Close Mystery AI' : 'Open Mystery AI Assistant'}
          title="Mystery AI — Your guide to Mystery Hub"
        >
          {/* Subtle eco-glow ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#00c365]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {isOpen ? (
            <X className="w-5 h-5 text-slate-300 group-hover:text-white" />
          ) : (
            <MysteryAiIcon size="md" active={isExpandedPrompt} />
          )}

          {/* Micro status beacon dot */}
          {!isOpen && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-[#00c365] rounded-full ring-2 ring-[#0b0f12]" />
          )}
        </button>
      </div>
    </div>
  );
};
