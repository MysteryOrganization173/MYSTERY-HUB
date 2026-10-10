import React from 'react';
import type { NetworkId } from '../../types';
export const DATA_NETWORK_CHOICES = [
  { id: 'all', label: 'All', name: 'All Networks', color: '#00c365', ink: '#03160c' },
  { id: 'mtn', label: 'MTN', name: 'MTN', color: '#ffcc00', ink: '#191500' },
  { id: 'airteltigo', label: 'AT', name: 'AirtelTigo', color: '#004b93', ink: '#ffffff' },
  { id: 'telecel', label: 'Telecel', name: 'Telecel', color: '#c90000', ink: '#ffffff' },
] as const;
export function DataNetworkSelector({ value, onChange }: { value: NetworkId | 'all'; onChange: (network: NetworkId | 'all') => void }) {
  return <div role="group" aria-label="Choose data network" className="grid grid-cols-4 gap-1.5 sm:gap-2 max-w-xl">
    {DATA_NETWORK_CHOICES.map(network => <button key={network.id} type="button" aria-label={network.name}
      aria-pressed={value === network.id} onClick={() => onChange(network.id)}
      className="min-h-11 min-w-0 rounded-xl border px-1.5 sm:px-4 text-xs sm:text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={value === network.id ? { backgroundColor: network.color, color: network.ink, borderColor: network.color }
        : { backgroundColor: '#101820', color: '#dce4ee', borderColor: '#334155' }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" aria-hidden="true" style={{ backgroundColor: value === network.id ? network.ink : network.color }} />{network.label}
    </button>)}
  </div>;
}
