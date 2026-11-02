import React, {useState} from 'react';
import {Check, Copy, MessageCircle, Share2} from 'lucide-react';

/**
 * V7.1 "Get your first customers": ready-to-send messages for an open Data Store, plus three practical tips.
 * Messages are fixed templates filled with the owner's own name and link only: no prices, discounts, delivery
 * times or claims, so they stay true whatever the owner sells. Nothing is sent without the owner tapping.
 */
export function storeShareMessages(name: string, url: string) {
  const store = name.trim() || 'my store';
  return [
    {id: 'friendly', label: 'Friendly', text: `Hi! I now sell data bundles. You can choose a bundle and pay securely on my store any time: ${url}`},
    {id: 'status', label: 'For your Status', text: `Need data? Buy your bundle from ${store} in a few taps: ${url}`},
    {id: 'short', label: 'Short', text: `${store} · data bundles: ${url}`},
  ];
}

export function StoreShareKit({name, url}: {name: string; url: string}) {
  const messages = storeShareMessages(name, url);
  const [pick, setPick] = useState(messages[0].id), [copied, setCopied] = useState('');
  const message = messages.find(m => m.id === pick) || messages[0];
  const copy = async () => {
    try {await navigator.clipboard.writeText(message.text); setCopied('yes');} catch {setCopied('blocked');}
  };
  const share = async () => {try {await navigator.share({text: message.text});} catch {/* closed or unsupported */}};
  return <section className="bw-share-kit" aria-labelledby="bw-share-kit-title" data-share-kit>
    <div>
      <h2 id="bw-share-kit-title">Get your first customers</h2>
      <p>Your store is open. Send your link to people who already buy data from you.</p>
    </div>
    <div className="bw-share-pick" role="radiogroup" aria-label="Message">
      {messages.map(m => <button key={m.id} type="button" role="radio" aria-checked={m.id === pick} onClick={() => {setPick(m.id); setCopied('');}}>{m.label}</button>)}
    </div>
    <blockquote className="bw-share-message">{message.text}</blockquote>
    <div className="bw-share-actions">
      <a className="bw-button" data-primary href={`https://wa.me/?text=${encodeURIComponent(message.text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true"/>Send on WhatsApp</a>
      <button type="button" className="bw-button" onClick={() => void copy()}>{copied === 'yes' ? <Check size={16} aria-hidden="true"/> : <Copy size={16} aria-hidden="true"/>}{copied === 'yes' ? 'Copied' : 'Copy message'}</button>
      {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" className="bw-button" onClick={() => void share()}><Share2 size={16} aria-hidden="true"/>More apps</button>}
    </div>
    {copied === 'blocked' && <p role="status" className="bw-share-note">Copying is blocked in this browser. Press and hold the message above to copy it.</p>}
    <ul className="bw-share-tips" aria-label="Selling tips">
      <li><strong>Post it on your WhatsApp Status.</strong> Friends see it without you messaging each one.</li>
      <li><strong>Put the link in your profile.</strong> Your WhatsApp Business, Instagram or TikTok bio is where people look.</li>
      <li><strong>Mention order tracking.</strong> Buyers get an order reference after paying and can check it on your store.</li>
    </ul>
  </section>;
}
