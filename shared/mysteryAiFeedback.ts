export const AI_FEEDBACK_CATEGORIES={
  inaccurate:'Incorrect information',
  misunderstood:'Didn’t understand my request',
  unhelpful:'Unhelpful or repetitive',
  broken_action:'Broken action or button',
  other:'Other problem',
} as const;
export type AiFeedbackCategory=keyof typeof AI_FEEDBACK_CATEGORIES;
export const isFeedbackCategory=(v:unknown):v is AiFeedbackCategory=>typeof v==='string'&&Object.hasOwn(AI_FEEDBACK_CATEGORIES,v);
export const AI_FEEDBACK_NOTE_MAX=500;
export const AI_FEEDBACK_ANSWER_MAX=2000;
export type AiFeedbackReport={
  reference:string;category:AiFeedbackCategory;note:string|null;answer:string|null;status:'new'|'reviewed';createdAt:string;
};
