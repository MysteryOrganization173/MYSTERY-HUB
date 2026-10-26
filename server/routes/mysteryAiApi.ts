import {createReliableMysteryAiRouter} from '../services/mysteryAiReliability.js';
export {AI_FAILURE} from '../services/mysteryAiReliability.js';

export function validateAiRequest(body: any) {
  if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) {
    throw Error('Use a message between 1 and 2,000 characters.');
  }
  const history = body.history === undefined ? [] : body.history;
  if (!Array.isArray(history) || history.length > 8) {
    throw Error('Send no more than eight previous messages.');
  }
  for (const turn of history) {
    if (!turn || !['user', 'assistant'].includes(turn.role) || typeof turn.content !== 'string' ||
        !turn.content.trim() || turn.content.length > 4000) {
      throw Error('Conversation messages must have a supported role and 1–4,000 characters.');
    }
  }
  if (body.activePage !== undefined && (typeof body.activePage !== 'string' || body.activePage.length > 64)) {
    throw Error('Invalid page context.');
  }
  return { message: body.message, history, activePage: body.activePage };
}

export const createMysteryAiRouter = (deps: Parameters<typeof createReliableMysteryAiRouter>[1] = {}) => createReliableMysteryAiRouter(validateAiRequest, deps);
