import React, { createContext, useContext } from 'react';

/** Browser-test alias for AppContext. Synthetic identity only; no application provider or database. */
export const SharingFixtureContext = createContext({
  user: { id: 'synthetic-A', name: 'Synthetic' }, sessionToken: 'synthetic-session-A',
  showToast: (_message: string, _kind?: string, _id?: string) => {},
});
export const useApp = () => useContext(SharingFixtureContext);
