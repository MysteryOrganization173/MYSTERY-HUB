import React from 'react';
import type { NetworkId } from '../../types';
export const DATA_NETWORK_CHOICES = [
  { id: 'all', label: 'All', name: 'All Networks', color: '#00c365', ink: '#03160c' },
  { id: 'mtn', label: 'MTN', name: 'MTN', color: '#ffcc00', ink: '#191500' },
  { id: 'airteltigo', label: 'AT', name: 'AirtelTigo', color: '#004b93', ink: '#ffffff' },
  { id: 'telecel', label: 'Telecel', name: 'Telecel', color: '#c90000', ink: '#ffffff' },
] as const;

/**
 * One network selector for Data and Instant Bundles. The selected network's colour sits on a single indicator that
 * slides between the four choices (transform only; still with reduced motion), so the choice reads at a glance.
 * `counts` (optional) shows how many packages each choice holds, from the catalogue already on the page.
 */
export function DataNetworkSelector({ value, onChange, counts, paused }: { value: NetworkId | 'all'; onChange: (network: NetworkId | 'all') => void; counts?: Partial<Record<NetworkId | 'all', number>>; paused?: Partial<Record<NetworkId, boolean>> }) {
  const index = Math.max(0, DATA_NETWORK_CHOICES.findIndex(choice => choice.id === value));
  const selected = DATA_NETWORK_CHOICES[index];
  return <div role="group" aria-label="Choose data network" className="mh-ds-nets"
    style={{ '--net-i': index, '--net-color': selected.color, '--net-ink': selected.ink } as React.CSSProperties}>
    <span className="mh-ds-nets-thumb" aria-hidden="true" />
    {DATA_NETWORK_CHOICES.map(network => {
      const on = value === network.id;
      // 3.6.3: a network under maintenance stays selectable (it explains itself) and carries a small amber marker.
      const isPaused = network.id !== 'all' && Boolean(paused?.[network.id as NetworkId]);
      return <button key={network.id} type="button" aria-label={isPaused ? `${network.name}, under maintenance` : network.name}
        aria-pressed={on} onClick={() => onChange(network.id)}
        className="mh-ds-net min-h-11 min-w-0 px-1.5 sm:px-3 text-xs sm:text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={on ? { color: network.ink } : undefined}>
        <span className="hidden min-[360px]:inline-block mh-ds-net-dot" aria-hidden="true" style={{ backgroundColor: on ? network.ink : network.color }} />
        <span className="truncate">{network.label}</span>
        {isPaused ? <span className="mh-ds-net-paused" aria-hidden="true" title="Under maintenance" />
          : counts?.[network.id] !== undefined && <span className="mh-ds-net-count hidden sm:inline" aria-hidden="true">{counts[network.id]}</span>}
      </button>;
    })}
  </div>;
}
