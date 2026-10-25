/**
 * Optional AI help for notification wording, through Codex's secure Admin AI-drafting endpoint (Gemini on the
 * server). The AI only proposes text: the founder must choose to use a proposal, and nothing here can send.
 *
 * Contract status (checked 2026-10-25): the drafting endpoint does not exist yet, so the pending client reports
 * `available: false` and the composer hides nothing except these optional buttons' results; writing, previewing
 * and (once the backend exists) sending all work without AI.
 */
export type AiDraftAction = 'improve' | 'shorter' | 'professional' | 'friendly' | 'alternatives' | 'grammar';

export const AI_DRAFT_ACTIONS: Array<{ id: AiDraftAction; label: string }> = [
  { id: 'improve', label: 'Improve wording' },
  { id: 'shorter', label: 'Make shorter' },
  { id: 'professional', label: 'Professional tone' },
  { id: 'friendly', label: 'Friendly tone' },
  { id: 'grammar', label: 'Correct grammar' },
  { id: 'alternatives', label: 'Suggest alternatives' },
];

export interface AiDraftProposal { title: string; body: string }
export type AiDraftResult = { ok: true; proposals: AiDraftProposal[] } | { ok: false; message: string };

export interface AdminAiDraftingClient {
  readonly available: boolean;
  propose(token: string, input: { action: AiDraftAction; title: string; body: string; placeholders: string[] }, signal?: AbortSignal): Promise<AiDraftResult>;
}

export const AI_DRAFTING_UNAVAILABLE = 'AI wording help is not connected yet. Your message and preview work normally without it.';

export const pendingAiDraftingClient: AdminAiDraftingClient = {
  available: false,
  propose: () => Promise.resolve({ ok: false, message: AI_DRAFTING_UNAVAILABLE }),
};
