export type AiReplyStyle = 'brief' | 'step_by_step';
export const isAiReplyStyle = (value:unknown):value is AiReplyStyle => value==='brief'||value==='step_by_step';

// Deliberately redact whole credential-like lines and number runs. Do not claim
// to recognize every secret; the save UI also asks customers not to share them.
export function redactAiSavedText(text:string) {
  return text
    .replace(/^.*\b(?:password|passcode|otp|(?:momo|payment|voucher|card)\s+pin|(?:voucher|recovery|verification|one.time)\s+code|cvv|api[_ -]?key|secret|bearer|access[_ -]?token)\b.*$/gim,'[sensitive text hidden]')
    .replace(/^.*\bpin\s*(?:is\b|:|=).*$/gim,'[sensitive text hidden]')
    .replace(/^\s*\d{4,8}\s*$/gm,'[number hidden]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email hidden]')
    .replace(/\+?\(?\d(?:[ \t()./\u00a0\u202f-]*\d){5,}\)?/g,'[number hidden]');
}
