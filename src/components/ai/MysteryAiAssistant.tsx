import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ActivePage } from '../../types';
import { MysteryAiIcon } from './MysteryAiIcon';
import {AssistantText} from './AssistantText';
import {useDialogFocus} from '../../hooks/useDialogFocus';
import { AiRequestGate } from '../../utils/aiRequestGate';
import {
  ChatMessage,
  MysteryAiError,
  SuggestedQuestion,
  getSuggestedQuestionsForPage,
  sendMysteryAiMessage,
} from '../../services/mysteryAiService';
import {
  CHAT_MAX_CHARS,
  canRetry,
  composerCountLabel,
  failureHeading,
  isNearBottom,
  shouldSendOnEnter,
  type ChatFailureKind,
} from '../../utils/chatComposer';
import {
  X,
  Send,
  RotateCcw,
  ArrowRight,
  ArrowDown,
  ExternalLink,
  AlertCircle,
  Pencil,
  Square,
  ShieldCheck,
} from 'lucide-react';

const timeLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const phoneQuery = '(max-width: 639px)';

export const MysteryAiAssistant: React.FC = () => {
  const {
    activePage,
    user,
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
    isAccountOpen,
    selectedTemplatePreview,
    marketplaceInquiryProduct,
    waitlistInfo,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpandedPrompt, setIsExpandedPrompt] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [slowReply, setSlowReply] = useState(false);
  const [failure, setFailure] = useState<{query: string; messageId: string; error: string; kind: ChatFailureKind} | null>(null);
  const [showJump, setShowJump] = useState(false);
  const requestGate = useRef(new AiRequestGate());
  const pendingQuestion = useRef<{query: string; messageId: string} | null>(null);
  const cancelPending = () => {
    requestGate.current.cancel();
    pendingQuestion.current = null;
    setIsTyping(false);
    setFailure(null);
  };
  useEffect(() => () => requestGate.current.cancel(), []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
        return user
          ? `Hi ${user.name.trim().split(/\s+/)[0] || 'there'}, I’m Mystery AI. Ask me how anything on Mystery Hub works.`
          : "Hi, I’m Mystery AI. What would you like help with?";
    }
  };
  const welcomeMessage = (): ChatMessage => ({
    id: `welcome-${activePage}-${Date.now()}`,
    role: 'assistant',
    content: getPageGreeting(activePage),
    timestamp: timeLabel(),
  });

  // Initialize or update opening message when chat opens or page changes with no conversation yet
  useEffect(() => {
    if (messages.length === 0) setMessages([welcomeMessage()]);
  }, [activePage, isInsideEditor, messages.length]);

  // The conversation lives only in this component. A different account (or signing out) must never see it,
  // so a change of account cancels any pending reply and starts a fresh chat.
  const accountId = user?.id ?? null;
  const previousAccount = useRef(accountId);
  useEffect(() => {
    if (previousAccount.current === accountId) return;
    previousAccount.current = accountId;
    cancelPending();
    setInputValue('');
    setMessages([]);
  }, [accountId]);

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

  // A reply that takes longer than usual says so, instead of leaving three dots running silently.
  useEffect(() => {
    if (!isTyping) { setSlowReply(false); return; }
    const timer = setTimeout(() => setSlowReply(true), 6000);
    return () => clearTimeout(timer);
  }, [isTyping]);

  /** Scrolls only the message list (never the page behind it) to the newest message. */
  const scrollToLatest = (smooth = true) => {
    const box = scrollRef.current;
    if (!box) return;
    box.scrollTo({ top: box.scrollHeight, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
    stickToBottom.current = true;
    setShowJump(false);
  };
  const handleScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    stickToBottom.current = isNearBottom(box);
    if (stickToBottom.current) setShowJump(false);
  };

  // New messages follow the reader only while they are at the bottom; someone reading an earlier answer
  // keeps their place and gets a "New reply" button instead. Their own question always scrolls into view.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const last = messages.at(-1);
    if (stickToBottom.current || last?.role === 'user') scrollToLatest(messages.length > 1);
    else if (last?.role === 'assistant') setShowJump(true);
  }, [messages, isOpen]);
  useLayoutEffect(() => {
    if (isOpen && (isTyping || failure) && stickToBottom.current) scrollToLatest();
  }, [isTyping, failure, slowReply, isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setIsExpandedPrompt(false);
      stickToBottom.current = true;
      setTimeout(() => { scrollToLatest(false); inputRef.current?.focus(); }, 150);
    }
  }, [isOpen]);

  // The question box grows with its text (up to about five lines) and shrinks back after sending.
  useLayoutEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 132)}px`;
  }, [inputValue, isOpen]);

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
    if (!query || query.length > CHAT_MAX_CHARS || !chatAvailable.current || requestGate.current.busy) return;
    const request = requestGate.current.begin();
    const userMsg: ChatMessage = {
      id: retry && failure ? failure.messageId : `user-${Date.now()}`,
      role: 'user', content: query,
      timestamp: timeLabel(),
    };
    // History contains prior turns only. The server appends the current question once.
    const priorHistory = retry ? messages.filter(m => m.id !== userMsg.id) : messages;
    if (!retry) setMessages(prev => [...prev, userMsg]);
    pendingQuestion.current = { query, messageId: userMsg.id };
    setFailure(null);
    if (!textToSend || textToSend === inputValue) setInputValue('');
    setIsTyping(true);
    try {
      const response = await sendMysteryAiMessage(query, activePage, priorHistory, undefined, request.signal);
      if (!requestGate.current.accepts(request)) return;
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`, role: 'assistant', content: response.reply,
        timestamp: timeLabel(),
        quickAction: response.quickAction, source: response.source,
      }]);
    } catch (error) {
      if (!requestGate.current.accepts(request)) return;
      // The service exposes only safe product-facing errors, never provider details.
      setFailure({query, messageId: userMsg.id,
        error: error instanceof Error ? error.message : "Couldn't reach Mystery AI just now. Try again.",
        kind: error instanceof MysteryAiError ? error.kind : 'unavailable'});
    } finally {
      if (requestGate.current.accepts(request)) { setIsTyping(false); pendingQuestion.current = null; }
      requestGate.current.finish(request);
    }
  };

  /** Stops waiting for the current reply. The question stays in the chat and can be sent again. */
  const handleStop = () => {
    const pending = pendingQuestion.current;
    cancelPending();
    if (pending) setFailure({ ...pending, error: 'You stopped this reply. Send it again whenever you are ready.', kind: 'stopped' });
    inputRef.current?.focus();
  };

  /** Puts a failed question back into the box for changes; it is removed from the chat until sent again. */
  const handleEditFailed = () => {
    if (!failure) return;
    const { query, messageId } = failure;
    cancelPending();
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setInputValue(query);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClearHistory = () => {
    cancelPending();
    setInputValue('');
    setMessages([welcomeMessage()]);
    inputRef.current?.focus();
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
    : getSuggestedQuestionsForPage(activePage, { signedIn: Boolean(user) });
  const conversationStarted = messages.some(m => m.role === 'user');

  useEffect(() => { if (isAnyModalActive) cancelPending(); }, [isAnyModalActive]);
  const dialogRef = useDialogFocus(isOpen && !isAnyModalActive, ()=>{cancelPending();closeMysteryAi();setIsOpen(false);});
  const [viewport, setViewport] = useState({height:window.visualViewport?.height||window.innerHeight,top:window.visualViewport?.offsetTop||0});
  const [isPhone, setIsPhone] = useState(() => window.matchMedia?.(phoneQuery).matches ?? window.innerWidth < 640);
  useEffect(()=>{
    if(!isOpen)return;
    // The Android keyboard shrinks the visual viewport. The chat follows it so the question box stays above
    // the keyboard, and the newest message stays in view if the reader was already there.
    const update=()=>{
      setViewport({height:window.visualViewport?.height||window.innerHeight,top:window.visualViewport?.offsetTop||0});
      setIsPhone(window.matchMedia?.(phoneQuery).matches ?? window.innerWidth < 640);
      if(stickToBottom.current)requestAnimationFrame(()=>scrollToLatest(false));
    };
    update(); window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
    return()=>{window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[isOpen]);

  if (isAnyModalActive || (user && activePage === 'home' && !isOpen)) {
    return null;
  }

  const countLabel = composerCountLabel(inputValue.length);
  const canSend = Boolean(inputValue.trim()) && inputValue.length <= CHAT_MAX_CHARS && !isTyping;
  // Phones get a near full-height sheet whose own header closes it; larger screens keep the floating panel above its button.
  const panelHeight = isPhone ? Math.max(240, viewport.height - 16) : undefined;

  return (
    <div
      style={isOpen?{height:viewport.height,top:viewport.top}:undefined}
      className={isOpen?'fixed inset-x-0 z-[80] bg-black/60 flex flex-col items-center sm:items-end justify-end p-2 sm:p-6 pb-[calc(.5rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]':`${isInsideEditor ? '' : 'hidden'} fixed ${isInsideEditor?'z-[55] bottom-4':'z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]'} right-3 sm:bottom-6 sm:right-6 pointer-events-none max-w-[calc(100vw-1.5rem)]`}

    >
      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-labelledby="mystery-ai-title"
          aria-modal="true"
          style={isPhone ? { height: panelHeight, maxHeight: panelHeight } : {maxHeight:Math.max(160,viewport.height-88)}}
          className="pointer-events-auto sm:mb-3 w-full sm:w-96 md:w-[420px] max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1.5rem)] sm:h-[560px] bg-[#0c1217] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Clean, Premium Header */}
          <div className="px-3 sm:px-4 py-2 bg-[#090e13] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <MysteryAiIcon size="md" active={isTyping} className="shrink-0" />
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-2">
                  <h3 id="mystery-ai-title" className="font-bold text-sm text-white tracking-tight">Mystery AI</h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00c365]/10 border border-[#00c365]/20 text-[10px] font-medium text-[#00c365]">
                    Guide
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-400 mt-0.5">{isTyping ? 'Writing a reply…' : 'Your guide to Mystery Hub'}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {conversationStarted && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="min-h-11 inline-flex items-center gap-1.5 px-2.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Start a new chat"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>New chat</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  cancelPending();
                  closeMysteryAi();
                  setIsOpen(false);
                }}
                className="min-w-11 min-h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="relative flex-1 min-h-0">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              role="log"
              aria-label="Conversation with Mystery AI"
              aria-live="polite"
              aria-relevant="additions"
              aria-busy={isTyping}
              className="h-full overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-4 text-[15px] sm:text-sm"
            >
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';
                const failedHere = failure?.messageId === msg.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed ${
                        isAssistant
                          ? 'bg-[#141b22] text-slate-100 border border-slate-800 rounded-tl-sm'
                          : `whitespace-pre-wrap break-words bg-[#00c365] text-black font-medium rounded-tr-sm ${failedHere ? 'opacity-80' : ''}`
                      }`}
                    >
                      {isAssistant ? <span className="sr-only">Mystery AI: </span> : <span className="sr-only">You: </span>}
                      {isAssistant?<AssistantText text={msg.content}/>:msg.content}

                      {/* Actionable Redirection Button */}
                      {msg.quickAction && (
                        <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickActionClick(msg.quickAction!.targetPage)}
                            className="w-full min-h-11 py-2 px-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,195,101,0.25)] flex items-center justify-between group cursor-pointer"
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
                    <span className="text-[11px] text-slate-500 mt-1 px-1">
                      {msg.source === 'scripted' ? 'Help guide · ' : msg.source === 'gemini' ? 'AI answer · ' : ''}{failedHere ? 'Not answered · ' : ''}{msg.timestamp}
                    </span>
                  </div>
                );
              })}

              {/* First visit: suggested questions sit under the greeting as full-width, easy-to-tap choices */}
              {!conversationStarted && !isTyping && suggestedQuestions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="px-0.5 text-xs font-semibold text-slate-400">Try asking</p>
                  <ul className="space-y-2">
                    {suggestedQuestions.map((sq) => (
                      <li key={sq.id}>
                        <button
                          type="button"
                          onClick={() => handleSendMessage(sq.text)}
                          className="w-full min-h-11 rounded-xl border border-slate-800 bg-[#10171e] px-3.5 py-2.5 text-left text-sm text-slate-200 hover:border-[#00c365]/50 hover:text-white transition-colors flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <span>{sq.text}</span>
                          <ArrowRight className="w-4 h-4 shrink-0 text-[#00c365]" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="flex items-start gap-2 px-0.5 pt-2 text-xs leading-relaxed text-slate-500">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    <span>Mystery AI explains how Mystery Hub works. It can’t see your account, orders or Wallet, and this chat isn’t saved: it clears when you start a new chat or reload. Never share PINs or passwords.</span>
                  </p>
                </div>
              )}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                  <MysteryAiIcon size="sm" active className="shrink-0" />
                  <div className="flex items-center gap-1 bg-[#141b22] border border-slate-800 rounded-xl px-3 py-2" aria-hidden="true">
                    <span className="w-1.5 h-1.5 bg-[#00c365] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-[#00c365] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-[#00c365] rounded-full animate-bounce" />
                  </div>
                  <span role="status">{slowReply ? 'Still working on it…' : <span className="sr-only">Mystery AI is writing a reply</span>}</span>
                </div>
              )}

              {failure && (
                <div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-slate-200">
                  <p className="flex items-center gap-2 font-semibold text-amber-100">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{failureHeading(failure.kind)}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{failure.error}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {canRetry(failure.kind) && (
                      <button type="button" onClick={() => handleSendMessage(failure.query, true)} disabled={isTyping}
                        className="min-h-11 inline-flex items-center gap-1.5 rounded-xl bg-[#00c365] px-4 text-sm font-bold text-black disabled:opacity-50 cursor-pointer"><RotateCcw className="h-4 w-4" aria-hidden="true" />Retry</button>
                    )}
                    <button type="button" onClick={handleEditFailed}
                      className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:text-white cursor-pointer"><Pencil className="h-4 w-4" aria-hidden="true" />Edit question</button>
                  </div>
                </div>
              )}
            </div>

            {showJump && (
              <button
                type="button"
                onClick={() => scrollToLatest()}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 min-h-10 inline-flex items-center gap-1.5 rounded-full border border-[#00c365]/40 bg-[#0c1217] px-3.5 text-xs font-semibold text-white shadow-xl cursor-pointer"
              >
                <ArrowDown className="h-3.5 w-3.5 text-[#00c365]" aria-hidden="true" />New reply
              </button>
            )}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 sm:p-3 bg-[#090e13] border-t border-slate-800 shrink-0"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                aria-label="Message Mystery AI"
                aria-describedby={countLabel ? 'mystery-ai-count' : undefined}
                data-autofocus
                rows={1}
                maxLength={CHAT_MAX_CHARS}
                enterKeyHint="send"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (shouldSendOnEnter({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing, keyCode: e.keyCode })) {
                    e.preventDefault();
                    if (canSend) handleSendMessage();
                  }
                }}
                placeholder={isInsideEditor ? 'Ask about editing your website…' : 'Ask about data, Wallet, websites…'}
                className="flex-1 min-h-11 max-h-[132px] resize-none bg-[#10171f] border border-slate-700/80 rounded-xl px-3.5 py-[11px] text-base sm:text-sm leading-snug text-white placeholder-slate-500 focus:outline-none focus:border-[#00c365]"
              />
              {isTyping ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="w-11 h-11 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  aria-label="Stop waiting for this reply"
                  title="Stop"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  className="w-11 h-11 rounded-xl bg-[#00c365] hover:bg-[#00e575] disabled:opacity-40 text-black flex items-center justify-center transition-all cursor-pointer shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            {countLabel && <p id="mystery-ai-count" className="mt-1.5 px-1 text-right text-[11px] text-amber-200" aria-live="polite">{countLabel}</p>}
          </form>
        </div>
      )}

      {/* Floating Control Button & Gentle Expanded Prompt (phones close the open sheet from its header) */}
      <div className={`pointer-events-auto items-center gap-2 justify-end ${isOpen ? 'hidden sm:flex self-end' : 'flex'}`}>
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
          type="button"
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
