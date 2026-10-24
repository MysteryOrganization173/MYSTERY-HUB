import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { APP_SHARE_URL, shareApp } from '../../utils/appShare';

/**
 * "Share Mystery Hub": the phone's share sheet (WhatsApp, Status, Channels…) with the public /app link, or a copied
 * link where there is no share sheet. Nothing about the person sharing is included.
 */
export const ShareAppButton: React.FC<{ className?: string; label?: string; onDone?: () => void; iconClassName?: string }> = ({
  className = '', label = 'Share Mystery Hub', onDone, iconClassName = 'w-4 h-4',
}) => {
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);
  return <button type="button" className={className} disabled={busy} onClick={async () => {
    setBusy(true);
    const outcome = await shareApp(typeof navigator.share === 'function' ? navigator.share.bind(navigator) : undefined, navigator.clipboard);
    setBusy(false);
    if (outcome === 'copied') showToast('Link copied. Paste it into WhatsApp or anywhere you like.', 'success');
    else if (outcome === 'failed') showToast(`Copy this link to share Mystery Hub: ${APP_SHARE_URL}`, 'info');
    if (outcome !== 'cancelled') onDone?.();
  }}>
    <Share2 className={iconClassName} aria-hidden="true" />{label}
  </button>;
};
