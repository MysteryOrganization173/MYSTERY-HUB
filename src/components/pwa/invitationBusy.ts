import type { useApp } from '../../context/AppContext';

/**
 * App states no suggestion may appear over or interrupt: the editor, the assistant, checkout and the receipt, sign-in,
 * account, template preview, Marketplace enquiry, the waitlist and a forced password change. Shared by the installed
 * app's welcome/notification layer and the invitation layer (which also steps aside for any overlay on the stack).
 */
export function appBusy(app: ReturnType<typeof useApp>) {
  return Boolean(app.activeEditorSite || app.isMysteryAiOpen || app.isCheckoutOpen || app.isStatusModalOpen || app.isAuthModalOpen
    || app.selectedTemplatePreview || app.marketplaceInquiryProduct || app.waitlistInfo.isOpen || app.isAccountOpen || app.user?.mustChangePassword);
}

/**
 * Active form entry: focus is in a field someone types or picks in (a phone number, a search box, an editor). No
 * suggestion appears then, and one on screen steps aside, so a phone keyboard never ends up under a card.
 */
const NOT_TYPED = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'image', 'file', 'color', 'hidden']);
export function isFormEntry(element: { tagName?: string; type?: string; isContentEditable?: boolean } | null | undefined) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = (element.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  return tag === 'input' && !NOT_TYPED.has((element.type || 'text').toLowerCase());
}
