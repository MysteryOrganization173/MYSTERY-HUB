import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ActivePage } from '../../types';
import { MysteryAiIcon } from './MysteryAiIcon';
import {AssistantText} from './AssistantText';
import {useDialogFocus} from '../../hooks/useDialogFocus';
import { AiRequestGate } from '../../utils/aiRequestGate';
import {aiDataChoices,confirmAiDataChoice,maskAiRecipient,parseAiDataRequest,type AiDataChoice,type DataRequest} from '../../services/mysteryAiOrders';
import {readPendingCheckout} from '../../utils/checkoutRecovery';
import {redactAiSavedText} from '../../../shared/mysteryAiPrivacy';
import {useMysteryAiHistory} from './useMysteryAiHistory';
import {MysteryAiHistoryPanel} from './MysteryAiHistoryPanel';
import {validateAiNavigation,type AiNavigation} from '../../../shared/mysteryAiIntent';
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
    dataProductMode,
    user,
    sessionToken,
    setActivePage,
    openDataPage,
    openCheckout,
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
  const [failure, setFailure] = useState<{query: string; messageId: string; error: string; kind: ChatFailureKind; retryable?:boolean; retryAt?:number} | null>(null);
  const [retrySeconds,setRetrySeconds]=useState(0);
  useEffect(()=>{
    const tick=()=>setRetrySeconds(Math.max(0,Math.ceil(((failure?.retryAt||0)-Date.now())/1000)));
    tick();if(!failure?.retryAt)return;
    const timer=setInterval(tick,1000);return ()=>clearInterval(timer);
  },[failure?.retryAt]);
  const [showJump, setShowJump] = useState(false);
  const requestGate = useRef(new AiRequestGate());
  const dataDraft = useRef<DataRequest | undefined>(undefined);
  const choiceOwner = useRef<string | undefined>(undefined);
  const [activeChoiceId,setActiveChoiceId] = useState<string>();
  const updateChoiceOwner = (id?:string) => {
    choiceOwner.current = id;
    setActiveChoiceId(id);
  };
  const [choiceNotice, setChoiceNotice] = useState('');
  const pendingQuestion = useRef<{query: string; messageId: string} | null>(null);
  const cancelPending = () => {
    requestGate.current.cancel();
    dataDraft.current = undefined;
    updateChoiceOwner();
    setChoiceNotice('');
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
        return "Hi, I’m Mystery AI. What would you like to know about Data or Airtime?";
      case 'website':
        return "Hi, I can help you find your way around Website Builder.";
      case 'services':
        return "Hi, which service would you like to know about?";
      case 'orders':
        return "Hi, I can help you find tracking and support for your order.";
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
  const history = useMysteryAiHistory(user?.role === 'customer' ? sessionToken : null, accountId, turns => {
    cancelPending();
    setInputValue('');
    setMessages(turns.length ? turns.flatMap(turn => {
      const timestamp = new Date(turn.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      return [
        {id:`saved-question-${turn.id}`,role:'user' as const,content:turn.question,timestamp},
        {id:`saved-answer-${turn.id}`,role:'assistant' as const,content:turn.reply,timestamp},
      ];
    }) : [welcomeMessage()]);
  });
  useEffect(() => {
    if (isMysteryAiOpen && user?.role === 'customer' && sessionToken) void history.reload();
  }, [isMysteryAiOpen, accountId, sessionToken, user?.role]);
  const previousAccount = useRef({accountId,sessionToken});
  useLayoutEffect(() => {
    if (previousAccount.current.accountId === accountId && previousAccount.current.sessionToken === sessionToken) return;
    previousAccount.current = {accountId,sessionToken};
    cancelPending();
    setInputValue('');
    setMessages([]);
  }, [accountId,sessionToken]);

  const previousPage = useRef({activePage,dataProductMode,isInsideEditor});
  useLayoutEffect(() => {
    const before = previousPage.current;
    previousPage.current = {activePage,dataProductMode,isInsideEditor};
    if (before.activePage !== activePage || before.dataProductMode !== dataProductMode || before.isInsideEditor !== isInsideEditor) {
      cancelPending();
    }
  }, [activePage,dataProductMode,isInsideEditor]);

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
    const rawQuery = (textToSend || inputValue).trim();
    const query = maskAiRecipient(rawQuery);
    if (retry && failure?.retryAt && Date.now() < failure.retryAt) return;
    if (!rawQuery || rawQuery.length > CHAT_MAX_CHARS || !chatAvailable.current || requestGate.current.busy || (history.current && history.busy) || history.unsaved || history.visible) return;
    const orderDraft = !isInsideEditor && !(activePage === 'data' && dataProductMode !== 'data')
      ? retry ? dataDraft.current : parseAiDataRequest(rawQuery, dataDraft.current)
      : null;
    dataDraft.current = orderDraft ?? undefined;
    updateChoiceOwner();
    setChoiceNotice('');
    const request = requestGate.current.begin();
    const saveResponse = (reply:string) => {
      if (!history.current) return;
      void history.saveTurn({requestId:crypto.randomUUID(),question:redactAiSavedText(query).slice(0,2000),reply:redactAiSavedText(reply).slice(0,4000)});
    };
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
      if (orderDraft) {
        const result = await aiDataChoices(orderDraft, request.signal);
        if (!requestGate.current.accepts(request) || !chatAvailable.current) return;
        const id = `ai-${Date.now()}`;
        updateChoiceOwner(result.choices.length ? id : undefined);
        setMessages(prev => [...prev, {id, role:'assistant', content:result.reply, timestamp:timeLabel(), productChoices:result.choices}]);
        saveResponse(result.reply);
        return;
      }
      const response = await sendMysteryAiMessage(query, activePage, priorHistory, editorAiContext, request.signal, undefined, history.style);
      if (!requestGate.current.accepts(request)) return;
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`, role: 'assistant', content: response.reply,
        timestamp: timeLabel(),
        actions: response.actions, source: response.source,
      }]);
      saveResponse(response.reply);
    } catch (error) {
      if (!requestGate.current.accepts(request)) return;
      // The service exposes only safe product-facing errors, never provider details.
      setFailure({query, messageId: userMsg.id,
        error: orderDraft ? 'Current Data bundles could not be loaded. Try again or open the Data page.' : error instanceof Error ? error.message : "Couldn't reach Mystery AI just now. Try again.",
        kind: error instanceof MysteryAiError ? error.kind : 'unavailable',
        retryable: error instanceof MysteryAiError ? error.retryable : true,
        retryAt: error instanceof MysteryAiError && error.retryAfterSeconds ? Date.now()+error.retryAfterSeconds*1000 : undefined});
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
    if (!history.temporary()) return;
    cancelPending();
    setInputValue('');
    setMessages([welcomeMessage()]);
    inputRef.current?.focus();
  };

  const handleBundleChoice = async (messageId:string, choice:AiDataChoice) => {
    if (!chatAvailable.current || choiceOwner.current !== messageId || requestGate.current.busy) return;
    const pendingNotice = 'An earlier payment is still pending. Open Orders to check it before starting another checkout.';
    if (readPendingCheckout()) {
      setChoiceNotice(pendingNotice);
      return;
    }
    const request = requestGate.current.begin();
    const recipient = dataDraft.current?.recipient;
    setIsTyping(true);
    setChoiceNotice('');
    try {
      const bundle = await confirmAiDataChoice(choice, request.signal);
      if (!requestGate.current.accepts(request) || !chatAvailable.current || choiceOwner.current !== messageId) return;
      if (!bundle) {
        updateChoiceOwner();
        setChoiceNotice('This bundle’s price or availability has changed. Ask for current bundles again or open the Data page.');
        return;
      }
      if (readPendingCheckout()) {
        setChoiceNotice(pendingNotice);
        return;
      }
      cancelPending();
      closeMysteryAi();
      setIsOpen(false);
      // An empty value stops checkout falling back to the account phone: the customer chooses the recipient.
      openCheckout(bundle, {recipientPhone:recipient ?? ''});
    } catch {
      if (requestGate.current.accepts(request)) setChoiceNotice('Could not verify this bundle. Try again or open the Data page.');
    } finally {
      if (requestGate.current.accepts(request)) setIsTyping(false);
      requestGate.current.finish(request);
    }
  };

  const handleQuickActionClick = (candidate: AiNavigation) => {
    const action=validateAiNavigation(candidate,activePage,dataProductMode);
    if(!action)return;
    cancelPending();
    closeMysteryAi();
    setIsOpen(false);
    if(action.focus==='track-order'){
      requestAnimationFrame(()=>{
        const target=document.getElementById('mh-track-order');
        const toggle=target?.querySelector<HTMLButtonElement>('button[aria-expanded]');
        if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();
        toggle?.focus({preventScroll:true});
        target?.scrollIntoView({block:'nearest',behavior:reducedMotion()?'auto':'smooth'});
      });
      return;
    }
    if (action.targetPage === 'data' && action.dataMode) openDataPage(action.dataMode);
    else setActivePage(action.targetPage);
    window.scrollTo({ top: 0, behavior: reducedMotion()?'auto':'smooth' });
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
  const canSend = Boolean(inputValue.trim()) && inputValue.length <= CHAT_MAX_CHARS && !isTyping && !(history.current && history.busy) && !history.unsaved && !history.visible;
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
              {user?.role==='customer' && sessionToken && (
                <button type="button" disabled={isTyping||history.busy} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-slate-200 disabled:opacity-50" onClick={history.visible?history.hide:history.show}>
                  {history.visible?'Back':'Saved chats'}
                </button>
              )}
              {conversationStarted && !history.visible && (
                <button
                  type="button"
                  disabled={history.busy}
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
              {history.visible && <MysteryAiHistoryPanel key={accountId} history={history}/>}
              {!history.visible && history.current && <p className="break-words rounded-lg bg-slate-900 p-2 text-xs text-slate-300">Saving to: {history.current.title}</p>}
              {!history.visible && history.unsaved && (
                <div className="space-y-1 text-xs text-amber-200" role="status">
                  <p>Reply not saved. {history.error}</p>
                  <button type="button" disabled={history.busy} className="min-h-11 rounded-lg border border-slate-700 px-2" onClick={()=>history.unsaved && history.saveTurn(history.unsaved)}>Retry save</button>
                </div>
              )}
              {!history.visible && <>
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

                      {!!msg.productChoices?.length && activeChoiceId === msg.id && (
                        <div className="mt-3 flex flex-col gap-2">
                          {msg.productChoices.map(choice => (
                            <button key={choice.id} type="button" disabled={isTyping}
                              onClick={() => handleBundleChoice(msg.id, choice)}
                              className="min-h-11 rounded-xl bg-[#00c365] px-3 py-2 text-left text-xs font-bold text-black disabled:opacity-50">
                              Review checkout · {choice.network === 'airteltigo' ? 'AirtelTigo' : choice.network === 'telecel' ? 'Telecel' : 'MTN'} {choice.dataAmount} · GH₵{choice.priceGhc.toFixed(2)}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Actionable Redirection Button */}
                      {isAssistant && !!msg.actions?.length && (
                        <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex flex-col gap-1.5">
                          {msg.actions.map(action=><button
                            key={action.label}
                            type="button"
                            disabled={!validateAiNavigation(action,activePage,dataProductMode)}
                            onClick={() => handleQuickActionClick(action)}
                            className="w-full min-h-11 py-2 px-3 rounded-xl bg-[#00c365] hover:bg-[#00e575] text-black text-xs font-bold transition-all flex items-center justify-between group cursor-pointer disabled:opacity-50"
                          >
                            <span className="flex items-center gap-1.5">
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>{action.label}</span>
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </button>)}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 px-1">
                      {msg.source === 'scripted' ? 'Help guide · ' : msg.source === 'gemini' ? 'AI answer · ' : ''}{failedHere ? 'Not answered · ' : ''}{msg.timestamp}
                    </span>
                  </div>
                );
              })}

              {choiceNotice && <p role="status" className="text-sm text-amber-200">{choiceNotice}</p>}
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
                    <span>Mystery AI explains how Mystery Hub works. It can’t see your orders or Wallet. Temporary chat isn’t saved. {sessionToken && user?.role==='customer'?'To keep a conversation, choose Saved chats and start a saved chat. ':''}Never share PINs or passwords.</span>
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
                    {canRetry(failure.kind) && failure.retryable !== false && (
                      <button type="button" onClick={() => handleSendMessage(failure.query, true)} disabled={isTyping || retrySeconds > 0}
                        className="min-h-11 inline-flex items-center gap-1.5 rounded-xl bg-[#00c365] px-4 text-sm font-bold text-black disabled:opacity-50 cursor-pointer"><RotateCcw className="h-4 w-4" aria-hidden="true" />{retrySeconds > 0 ? `Retry in ${retrySeconds}s` : 'Retry'}</button>
                    )}
                    <button type="button" onClick={handleEditFailed}
                      className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:text-white cursor-pointer"><Pencil className="h-4 w-4" aria-hidden="true" />Edit question</button>
                  </div>
                </div>
              )}
              </>}
            </div>

            {showJump && !history.visible && (
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
          {!history.visible && <form
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
          </form>}
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
