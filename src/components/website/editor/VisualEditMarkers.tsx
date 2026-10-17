import React, {createContext, useContext} from 'react';
import type {VisualTarget} from '../../../utils/websiteVisualEditing';
import type {WebsiteTemplate} from '../../../types';
import {templateCopyLayout, templateCopyText} from '../../../config/websiteTemplateCopy';

export const VisualEditContext = createContext<readonly VisualTarget[]>([]);
/** No annotations, tab stops or editor labels are emitted on public/demo pages. */
export function useVisualEditMarkers() {
  const targets = useContext(VisualEditContext);
  return (id: string) => {
    const target = targets.find(t => t.id === id);
    // Empty text shows an owner-only prompt (CSS `:empty::before`), so blank spots invite a tap.
    return target ? {'data-visual-target': id, 'data-visual-empty': `Tap to add ${target.label.toLowerCase()}`, tabIndex: 0, 'aria-label': `Edit ${target.label}`} : {};
  };
}

/** True only inside the owner's editor, where empty slots render as tap prompts. */
export function useIsVisualEditing() {
  return useContext(VisualEditContext).length > 0;
}

/** A designed template's headings and labels: the wording to show and, in the editor, its tap target. */
export function useTemplateCopy(template: WebsiteTemplate) {
  const edit = useVisualEditMarkers(), layout = templateCopyLayout(template);
  return {text: (slot: string) => templateCopyText(template, slot), edit: (slot: string) => edit(`copy:${layout}.${slot}`)};
}
