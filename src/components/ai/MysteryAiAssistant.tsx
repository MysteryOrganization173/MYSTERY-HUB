import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ActivePage } from '../../types';
import { MysteryAiIcon } from './MysteryAiIcon';
import {AssistantText} from './AssistantText';
import {useDialogFocus} from '../../hooks/useDialogFocus';
import { AiRequestGate } from '../../utils/aiRequestGate';
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
  ExternalLink,
} from 'lucide-react';

export const MysteryAiAssistant: React.FC = () => {
  const {
    activePage,
    user, isAccountOpen,
    setActivePage,
    activeEditorSite,
    editorAiContext,
    isMysteryAiOpen,
    mysteryAiInitialPrompt,
    openMysteryAi,
    closeMysteryAi,
    isCheckoutOpen,
    isStatusModalOpen,
    isAuthModalOpen,
    selectedTemplatePreview,
    marketplaceInquiryProduct,
    waitlistInfo,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpandedPrompt, setIsExpandedPrompt] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [failure, setFailure] = useState<{query: string; messageId: string; error: string} | null>(null);
  const requestGate = useRef(new AiRequestGate());
  const cancelPending = () => {
    requestGate.current.cancel();
    setIsTyping(false);
    setFailure(null);
  };
  useEffect(() => () => requestGate.current.cancel(), []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dismissPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredPromptRef = useRef(false);

  const isInsideEditor = Boolean(activeEditorSite);

  // If any critical modal or preview dialog is open, step aside to avoid collision
  const isAnyModalActive =
    isCheckoutOpen ||
    isStatusModalOpen ||
    isAuthModalOpen || isAccountOpen || Boolean(user?.mustChangePassword) ||
    Boolean(selectedTemplatePreview) ||
    Boolean(marketplaceInquiryProduct) ||
    Boolean(waitlistInfo?.isOpen);

  const chatAvailable = useRef(false);
  chatAvailable.current = isMysteryAiOpen && !isAnyModalActive;

  // Cancel both delayed prompts and active requests when context closes the chat.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isMysteryAiOpen) {
      setIsOpen(true);
      setIsExpandedPrompt(false);
      if (mysteryAiInitialPrompt) timer = setTimeout(() => handleSendMessage(mysteryAiInitialPrompt), 100);
    } else {
      cancelPending();
      setIsOpen(false);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [isMysteryAiOpen, mysteryAiInitialPrompt]);

  const getPageDisplayName = (page: ActivePage) => {
    if (isInsideEditor) {
      return 'Website Editor';
    }
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
    if (isInsideEditor) {
      return "Building your website? I can guide you through the editor.";
    }
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
        return "Hi, I’m Mystery AI. What would you like help with?";
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
  }, [activePage, isInsideEditor, messages.length]);

  // Inactivity expansion trigger: gently expand prompt once
  useEffect(() => {
    if (hasTriggeredPromptRef.current || isOpen) return;

    const delay = isInsideEditor ? 4000 : 10000;
    promptTimeoutRef.current = setTimeout(() => {
      if (!isOpen && !hasTriggeredPromptRef.current) {
        setIsExpandedPrompt(true);
        hasTriggeredPromptRef.current = true;

        dismissPromptTimeoutRef.current = setTimeout(() => {
          setIsExpandedPrompt(false);
        }, 6000);
      }
    }, delay);

    return () => {
      if (promptTimeoutRef.current) clearTimeout(promptTimeoutRef.current);
      if (dismissPromptTimeoutRef.current) clearTimeout(dismissPromptTimeoutRef.current);
    };
  }, [isOpen, isInsideEditor]);

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

  const handleToggle = () => {
    if (isOpen) {
      cancelPending();
      closeMysteryAi();
      setIsOpen(false);
    } else {
      openMysteryAi();
      setIsOpen(true);
      setIsExpandedPrompt(false);
    }
  };

  const handleSendMessage = async (textToSend?: string, retry = false) => {
    const query = (textToSend || inputValue).trim();
    if (!query || !chatAvailable.current || requestGate.current.busy) return;
    const request = requestGate.current.begin();
    const userMsg: ChatMessage = {
      id: retry && failure ? failure.messageId : `user-${Date.now()}`,
      role: 'user', content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    // History contains prior turns only. The server appends the current question once.
    const priorHistory = retry ? messages.filter(m => m.id !== userMsg.id) : messages;
    if (!retry) setMessages(prev => [...prev, userMsg]);
    setFailure(null);
    setInputValue('');
    setIsTyping(true);
    try {
      const response = await sendMysteryAiMessage(query, activePage, priorHistory, undefined, request.signal);
      if (!requestGate.current.accepts(request)) return;
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`, role: 'assistant', content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickAction: response.quickAction, source: response.source,
      }]);
    } catch (error) {
      if (!requestGate.current.accepts(request)) return;
      // The service exposes only safe product-facing errors, never provider details.
      setFailure({query, messageId: userMsg.id, error: error instanceof Error ? error.message : "Couldn't reach Mystery AI just now. Try again."});
    } finally {
      if (requestGate.current.accepts(request)) setIsTyping(false);
      requestGate.current.finish(request);
    }
  };

  const handleClearHistory = () => {
    cancelPending();
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
      cancelPending();
      closeMysteryAi();
      setIsOpen(false);
    }
  };

  // Programmatically compute suggested questions dynamically for current active page
  const suggestedQuestions: SuggestedQuestion[] = isInsideEditor
    ? [
        { id: 'web-edit-biz', text: 'How do I add my business details and phone?' },
        { id: 'web-edit-bundles', text: 'How do I add or change data packages?' },
        { id: 'web-edit-publish', text: 'How do I publish my website live?' },
        { id: 'web-edit-orders', text: 'How do WhatsApp customer orders work?' },
      ]
    : getSuggestedQuestionsForPage(activePage);

  useEffect(() => { if (isAnyModalActive) cancelPending(); }, [isAnyModalActive]);
  const dialogRef = useDialogFocus(isOpen && !isAnyModalActive, ()=>{cancelPending();closeMysteryAi();setIsOpen(false);});
  const [viewport, setViewport] = useState({height:window.visualViewport?.height||window.innerHeight,top:window.visualViewport?.offsetTop||0});
  useEffect(()=>{
    if(!isOpen)return;
    const update=()=>setViewport({height:window.visualViewport?.height||window.innerHeight,top:window.visualViewport?.offsetTop||0});
    update(); window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
    return()=>{window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[isOpen]);

  if (isAnyModalActive || (user && activePage === 'home' && !isOpen)) {
    return null;
  }

  return (
    <div
      style={isOpen?{height:viewport.height,top:viewport.top}:undefined}
      className={isOpen?'fixed inset-x-0 z-[80] bg-black/60 flex flex-col items-end justify-end p-3 sm:p-6 pb-[calc(.75rem+env(safe-area-inset-bottom,0px))]':`fixed ${isInsideEditor?'z-[55] bottom-4':'z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]'} right-3 sm:bottom-6 sm:right-6 pointer-events-none max-w-[calc(100vw-1.5rem)]`}

    >
      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Mystery AI Assistant"
          aria-modal="true"
          style={{maxHeight:Math.max(160,viewport.height-88)}}
          className="pointer-events-auto mb-3 w-[calc(100vw-1.5rem)] sm:w-96 md:w-[420px] max-w-[calc(100vw-1.5rem)] h-[min(620px,calc(100dvh-5.5rem))] max-h-full sm:h-[560px] bg-[#0c1217] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Clean, Premium Header */}
          <div className="px-4 py-3 bg-[#090e13] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <MysteryAiIcon size="md" active={isTyping} className="shrink-0" />
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white tracking-tight">Mystery AI</h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00c365]/10 border border-[#00c365]/20 text-[10px] font-medium text-[#00c365]">
                    Guide
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Your guide to Mystery Hub</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="min-w-11 min-h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Reset conversation"
                aria-label="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  cancelPending();
                  closeMysteryAi();
                  setIsOpen(false);
                }}
                className="min-w-11 min-h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed whitespace-pre-wrap ${
                      isAssistant
                        ? 'bg-[#141b22] text-slate-200 border border-slate-800 rounded-tl-sm'
                        : 'bg-[#00c365] text-black font-semibold rounded-tr-sm'
                    }`}
                  >
                    {isAssistant?<AssistantText text={msg.content}/>:msg.content}

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
                    {msg.source === 'scripted' ? 'Help guide · ' : msg.source === 'gemini' ? 'AI answer · ' : ''}{msg.timestamp}
                  </span>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                <MysteryAiIcon size="sm" active className="shrink-0" />
                <div className="flex items-center gap-1 bg-[#141b22] border border-slate-800 rounded-xl px-3 py-2">
                  <span className="w-1.5 h-1.5 bg-[#00c365] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-[#00c365] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-[#00c365] rounded-full animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {suggestedQuestions.length > 0 && (
            <div className="px-3.5 py-2 bg-[#090d12] border-t border-slate-800/80 shrink-0">
              <div className="text-xs font-medium text-slate-400 mb-1 px-0.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#00c365]" />
                <span>Suggested Questions</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 no-scrollbar">
                {suggestedQuestions.map((sq) => (
                  <button
                    key={sq.id}
                    onClick={() => handleSendMessage(sq.text)}
                    disabled={isTyping}
                    className="px-2.5 py-1 rounded-lg bg-[#121921] hover:bg-[#1a2530] text-slate-300 hover:text-white border border-slate-800/90 hover:border-[#00c365]/40 text-xs min-h-11 whitespace-nowrap transition-colors shrink-0 disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {sq.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {failure && (
            <div role="alert" className="px-4 py-2 text-xs text-slate-300 border-t border-slate-800">
              {failure.error}
              <button type="button" onClick={() => handleSendMessage(failure.query, true)} disabled={isTyping}
                className="ml-2 underline text-[#00c365] disabled:opacity-50">Retry</button>
            </div>
          )}
          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 sm:p-3 bg-[#090e13] border-t border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              aria-label="Message Mystery AI"
              data-autofocus
              type="text"
              maxLength={2000}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Mystery AI about data, websites, pricing..."
              className="flex-1 bg-[#10171f] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="w-11 h-11 rounded-xl bg-[#00c365] hover:bg-[#00e575] disabled:opacity-40 text-black flex items-center justify-center transition-all cursor-pointer shrink-0"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Control Button & Gentle Expanded Prompt */}
      <div className="pointer-events-auto flex items-center gap-2 justify-end">
        {/* Subtle, gentle expansion prompt after dwell */}
        {isExpandedPrompt && !isOpen && (
          <div
            onClick={handleToggle}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c1217] border border-[#00c365]/40 text-xs text-white shadow-xl cursor-pointer hover:border-[#00c365] transition-all animate-in fade-in slide-in-from-right-2 duration-300 ${
              isInsideEditor ? 'max-w-[280px] sm:max-w-none' : 'hidden sm:flex'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#00c365] shrink-0" />
            <span className="truncate">
              {isInsideEditor
                ? 'Need help building your site? Ask Mystery AI'
                : 'Ask Mystery AI'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpandedPrompt(false);
              }}
              className="text-slate-400 hover:text-white p-0.5 shrink-0"
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
            <MysteryAiIcon size="lg" active={isExpandedPrompt} />
          )}

          {/* Micro status beacon dot */}
          {!isOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#00c365] rounded-full ring-2 ring-[#0b0f12] pointer-events-none z-10" />
          )}
        </button>
      </div>
    </div>
  );
};
