import React, {useState} from 'react';
import type {WebsiteTemplate} from '../../types';
import {whatsappDigits} from '../../utils/websiteOrderList.js';

const field = 'w-full min-h-11 rounded-xl border bg-transparent px-3 py-2.5 text-sm [border-color:color-mix(in_srgb,currentColor_25%,transparent)]';

/**
 * Published templates offer contact, never simulate a reservation or a submitted form. With a
 * WhatsApp number the design keeps its enquiry form: it writes the customer's message and opens a
 * WhatsApp chat with the business. Nothing is booked or sent by the website itself.
 */
export function BusinessEnquiry({onContact, template, askLabel = 'What would you like to ask about?', dateLabel = 'Preferred date', topics, guestsLabel}: {onContact?: () => void; template?: WebsiteTemplate; askLabel?: string; dateLabel?: string; topics?: string[]; guestsLabel?: string}) {
  const content = template?.siteContent, number = whatsappDigits(content?.whatsapp);
  // A design can offer its own topics (a restaurant asks about a table, not a dish); otherwise the owner's items.
  const options = topics || (template?.items || []).map(item => item.name).filter(Boolean);
  const [topic, setTopic] = useState(options[0] || ''), [date, setDate] = useState(''), [name, setName] = useState(''), [guests, setGuests] = useState('');
  if (!number) return <div className="space-y-4 text-sm">
    <p>Contact the business to discuss availability and your requirements. Any booking or payment must be confirmed directly with them.</p>
    <button type="button" onClick={onContact} className="min-h-11 rounded-xl border border-current px-5 py-3 font-semibold">Contact the business</button>
  </div>;
  const business = content?.businessName || template?.demoBusinessName || '';
  const party = Number(guests);
  const message = [`Hello ${business},`, topic ? `I'd like to ask about ${topic}.` : 'I have an enquiry.', date ? `${dateLabel}: ${date}.` : '', guestsLabel && party >= 1 ? `${guestsLabel}: ${Math.min(party, 200)}.` : '', name.trim() ? `My name is ${name.trim()}.` : ''].filter(Boolean).join(' ');
  return <div role="group" aria-label="Enquiry" className="space-y-3 text-sm text-left">
    {options.length > 0 && <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wider opacity-70">{askLabel}</span>
      <select value={topic} onChange={e => setTopic(e.target.value)} className={field}>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
        <option value="">Something else</option>
      </select></label>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wider opacity-70">{dateLabel} <span className="normal-case font-normal">(optional)</span></span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={field}/></label>
      {guestsLabel && <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wider opacity-70">{guestsLabel} <span className="normal-case font-normal">(optional)</span></span>
        <input type="number" inputMode="numeric" min={1} max={200} value={guests} onChange={e => setGuests(e.target.value.replace(/\D/g, '').slice(0, 3))} className={field}/></label>}
      <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wider opacity-70">Your name <span className="normal-case font-normal">(optional)</span></span>
        <input value={name} maxLength={60} onChange={e => setName(e.target.value)} autoComplete="name" className={field}/></label>
    </div>
    <a href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" data-website-event="whatsapp_click" className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#25D366] px-5 py-3 font-bold text-[#062b16]">Send on WhatsApp</a>
    <p className="text-xs opacity-70">This opens a WhatsApp chat with {business}. Any booking or payment must be confirmed directly with them.</p>
  </div>;
}
