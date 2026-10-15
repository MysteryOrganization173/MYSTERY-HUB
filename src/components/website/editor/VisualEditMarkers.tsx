import React, {createContext, useContext} from 'react';
import type {VisualTarget} from '../../../utils/websiteVisualEditing';

export const VisualEditContext = createContext<readonly VisualTarget[]>([]);
/** No annotations, tab stops or editor labels are emitted on public/demo pages. */
export function useVisualEditMarkers() {
  const targets = useContext(VisualEditContext);
  return (id: string) => {
    const target = targets.find(t => t.id === id);
    return target ? {'data-visual-target': id, tabIndex: 0, 'aria-label': `Edit ${target.label}`} : {};
  };
}
