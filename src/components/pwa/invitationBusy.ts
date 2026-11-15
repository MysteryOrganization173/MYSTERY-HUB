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
