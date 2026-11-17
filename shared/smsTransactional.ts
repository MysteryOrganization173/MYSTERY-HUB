/** Reviewed copy only. The server supplies every order fact; AI never renders these. */
export const SMS_AUTO_EVENTS = ['order_processing', 'order_delivered', 'delivery_attention', 'refund_update'] as const;
export const SMS_DEFAULT_AUTO_EVENTS = ['order_processing', 'order_delivered', 'delivery_attention'] as const;
export const SMS_EVENT_LABELS: Record<string, string> = {
  order_processing: 'Received and processing', order_delivered: 'Order delivered',
  delivery_attention: 'Delivery attention', refund_update: 'Verified refund update (optional)',
};
export const SMS_TRANSACTIONAL_COPY = {
  order_processing: {
    standard: "{{subject}} {{bundle}} {{network}} data order for {{destination}} has been received and is processing. We'll notify {{notify}} once delivered.",
    concise: '{{subject}} {{bundle}} {{network}} order for {{destination}} is processing. {{delivery_notice}}',
  },
  order_delivered: {
    standard: '{{subject}} {{bundle}} {{network}} data bundle for {{destination}} has been delivered successfully. Enjoy your data, and thank you for choosing us!',
    concise: '{{subject}} {{bundle}} {{network}} bundle for {{destination}} is delivered. Enjoy your data. Thank you for choosing us!',
  },
  delivery_attention: {
    standard: "{{subject}} {{bundle}} {{network}} order for {{destination}} needs more time. It's in our review queue. No need to place the same order again.",
    concise: '{{subject}} {{bundle}} {{network}} order for {{destination}} needs more time and is in our review queue. Please avoid placing it again.',
  },
} as const;
export type TransactionalStage = keyof typeof SMS_TRANSACTIONAL_COPY;
export function transactionalExample(stage: TransactionalStage, wording: 'standard'|'concise'='standard', guest=false) {
  return substituteTransactional(SMS_TRANSACTIONAL_COPY[stage][wording], {
    subject:guest?'A':'Your', bundle:'3GB', network:'MTN', destination:'055XXXX116',
    notify:guest?'this number':'you', delivery_notice:guest?"We'll text this number when delivered.":"We'll text you when delivered.",
  });
}
export function substituteTransactional(body: string, facts: Record<string,string>) {
  return body.replace(/\{\{(\w+)\}\}/g,(_,key)=>facts[key]||'');
}
