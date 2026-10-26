/** F2 Mystery AI polish: composer keyboard rules, scrolling, honest failure states and account isolation. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AI_FAILURE} from '../../routes/mysteryAiApi.js';
import {sendMysteryAiMessage, getSuggestedQuestionsForPage, getGroundedLocalResponse, MysteryAiError, MYSTERY_AI_TIMEOUT_MESSAGE, MYSTERY_AI_OFFLINE_MESSAGE} from '../../../src/services/mysteryAiService.js';
import {shouldSendOnEnter, isNearBottom, composerCountLabel, failureHeading, canRetry, CHAT_MAX_CHARS} from '../../../src/utils/chatComposer.js';
import {AssistantText} from '../../../src/components/ai/AssistantText.js';

const ui = readFileSync('src/components/ai/MysteryAiAssistant.tsx', 'utf8');

test('Enter sends, Shift+Enter adds a line, and an Android keyboard confirming a word never sends', () => {
  assert.equal(shouldSendOnEnter({key: 'Enter', shiftKey: false}), true);
  assert.equal(shouldSendOnEnter({key: 'Enter', shiftKey: true}), false);
  assert.equal(shouldSendOnEnter({key: 'Enter', shiftKey: false, isComposing: true}), false);
  assert.equal(shouldSendOnEnter({key: 'Enter', shiftKey: false, keyCode: 229}), false, 'IME process key');
  assert.equal(shouldSendOnEnter({key: 'a', shiftKey: false}), false);
  assert.match(ui, /enterKeyHint="send"/);
  assert.match(ui, /<textarea/);
  assert.match(ui, /text-base sm:text-sm/, '16px on phones avoids browser zoom and reads comfortably');
});

test('new replies follow the reader only near the bottom; the list scrolls itself, never the page', () => {
  assert.equal(isNearBottom({scrollTop: 900, scrollHeight: 1400, clientHeight: 420}), true);
  assert.equal(isNearBottom({scrollTop: 200, scrollHeight: 1400, clientHeight: 420}), false);
  assert.match(ui, /box\.scrollTo\(\{ top: box\.scrollHeight/);
  assert.doesNotMatch(ui, /scrollIntoView/, 'scrollIntoView can scroll the page behind the dialog');
  assert.match(ui, />New reply/);
  assert.match(ui, /prefers-reduced-motion/);
});

test('character guidance appears near the server limit only', () => {
  assert.equal(CHAT_MAX_CHARS, 2000);
  assert.equal(composerCountLabel(20), null);
  assert.equal(composerCountLabel(1700), '300 characters left');
  assert.equal(composerCountLabel(2000), 'Character limit reached');
});

test('failures are classified: busy, over-limit, timeout, offline and plain unavailable keep distinct wording', async () => {
  const oldFetch = globalThis.fetch;
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    globalThis.fetch = async () => new Response('{}', {status: 429});
    await assert.rejects(sendMysteryAiMessage('Explain quantum physics', 'home', []), (e: unknown) => e instanceof MysteryAiError && e.kind === 'busy');
    globalThis.fetch = async () => new Response('{}', {status: 400});
    await assert.rejects(sendMysteryAiMessage('Explain quantum physics', 'home', []), (e: unknown) => e instanceof MysteryAiError && e.kind === 'limits');
    globalThis.fetch = async () => new Response(JSON.stringify({error: AI_FAILURE}), {status: 503});
    await assert.rejects(sendMysteryAiMessage('Explain quantum physics', 'home', []), (e: unknown) => e instanceof MysteryAiError && e.kind === 'unavailable' && e.message === AI_FAILURE);
    globalThis.fetch = (_url, init) => new Promise((_, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    await assert.rejects(sendMysteryAiMessage('Explain quantum physics', 'home', [], undefined, undefined, 20), {message: MYSTERY_AI_TIMEOUT_MESSAGE});
    // A known question still gets the grounded help guide when the request times out.
    assert.equal((await sendMysteryAiMessage('How do I add money to my Wallet?', 'home', [], undefined, undefined, 20)).source, 'scripted');
    Object.defineProperty(globalThis, 'navigator', {value: {onLine: false}, configurable: true});
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(sendMysteryAiMessage('Explain quantum physics', 'home', []), {message: MYSTERY_AI_OFFLINE_MESSAGE});
  } finally {
    globalThis.fetch = oldFetch;
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete (globalThis as any).navigator;
  }
  assert.equal(failureHeading('timeout'), 'No answer yet');
  assert.equal(canRetry('limits'), false, 'an over-limit question must be edited, not retried');
  assert.equal(canRetry('timeout'), true);
});

test('the chat can be stopped, and a failed question can be retried or edited without duplicating history', () => {
  assert.match(ui, /aria-label="Stop waiting for this reply"/);
  assert.match(ui, /const handleStop = \(\) => \{\s*const pending = pendingQuestion\.current;\s*cancelPending\(\)/);
  assert.match(ui, />Edit question<\/button>/);
  assert.match(ui, /setMessages\(prev => prev\.filter\(m => m\.id !== messageId\)\)/);
  assert.match(ui, /const priorHistory = retry \? messages\.filter\(m => m\.id !== userMsg\.id\) : messages/);
});

test('accessible chat: labelled dialog, polite log, busy state and status text', () => {
  assert.match(ui, /role="log"/);
  assert.match(ui, /aria-live="polite"/);
  assert.match(ui, /aria-busy=\{isTyping\}/);
  assert.match(ui, /aria-labelledby="mystery-ai-title"/);
  assert.match(ui, /Still working on it…/);
  assert.match(ui, /Mystery AI is writing a reply/);
});

test('one account never sees another account\'s conversation', () => {
  const effect = ui.slice(ui.indexOf('const accountId = user?.id ?? null;'), ui.indexOf('// Inactivity expansion trigger'));
  assert.match(effect, /cancelPending\(\);\s*setInputValue\(''\);\s*setMessages\(\[\]\);/);
  assert.match(effect, /\[accountId\]/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage/, 'the conversation is never written to device storage');
});

test('no claims of memory or voice; the privacy note says exactly what the chat is', () => {
  assert.doesNotMatch(ui, /remembers|voice|microphone/i);
  assert.match(ui, /can’t see your account, orders or Wallet, and this chat isn’t saved/);
});

test('signed-in Home suggests member questions, each with a grounded answer during an outage', () => {
  const member = getSuggestedQuestionsForPage('home', {signedIn: true});
  assert.notDeepEqual(member, getSuggestedQuestionsForPage('home'));
  for (const q of member) assert.ok(getGroundedLocalResponse(q.text, 'home'), q.text);
});

test('numbered steps render as an ordered list and keep their starting number', () => {
  const html = renderToStaticMarkup(React.createElement(AssistantText, {text: 'Steps:\n1. Open Data\n2. Pick a bundle\n\n3. Pay with MoMo'}));
  assert.match(html, /<ol class="[^"]*"><li>Open Data<\/li><li>Pick a bundle<\/li><\/ol>/);
  assert.match(html, /<ol start="3"/);
});
