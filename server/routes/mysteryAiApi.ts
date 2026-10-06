import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { getGeminiClient } from '../services/geminiClient.js';
import { buildMysteryAiSystemInstruction } from '../services/mysteryAiContext.js';
import { CommercialService } from '../services/commercialService.js';

export const AI_FAILURE = "Couldn't reach Mystery AI just now. Try again.";

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

/** Per-process/network limits. No caller-supplied forwarded identity is trusted. */
export function createMysteryAiRouter(deps: {
  getClient?: typeof getGeminiClient;
  catalog?: typeof CommercialService.catalog;
} = {}) {
  const router = Router();
  let activeProviderCalls = 0;
  const limit = createRateLimiter({
    windowMs: 60_000, max: 12, enforceInTests: true,
    key: req => req.socket.remoteAddress || 'unknown',
    message: 'Mystery AI is receiving too many messages. Please wait a minute and try again.',
  });

  router.post('/chat', limit, async (req, res) => {
    let input: ReturnType<typeof validateAiRequest>;
    try {
      input = validateAiRequest(req.body);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }
    if (activeProviderCalls >= 4) {
      res.status(429).json({ error: 'Mystery AI is busy. Please try again shortly.' });
      return;
    }
    const started = Date.now();
    try {
      const client = (deps.getClient || getGeminiClient)();
      if (!client) {
        res.status(503).json({ error: AI_FAILURE, source: 'unavailable' });
        return;
      }
      // Preserve the existing editor-context allowlist without private site/account data.
      const e = req.body.editorContext;
      const editor = e?.experienceMode === 'website_editor' ? {
        experienceMode: 'website_editor',
        templateId: typeof e.templateId === 'string' ? e.templateId.slice(0, 50) : '',
        templateName: typeof e.templateName === 'string' ? e.templateName.slice(0, 100) : '',
        siteStatus: e.siteStatus === 'published' ? 'published' : 'draft',
        activeEditorSection: typeof e.activeEditorSection === 'string' ? e.activeEditorSection.slice(0, 50) : 'General',
        previewDevice: ['desktop', 'tablet', 'mobile'].includes(e.previewDevice) ? e.previewDevice : 'mobile',
        hasUnsavedChanges: Boolean(e.hasUnsavedChanges),
      } : null;
      const instruction = buildMysteryAiSystemInstruction(editor, (await (deps.catalog || CommercialService.catalog)()).products);
      const contents = [
        ...input.history.map((m: any) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
        { role: 'user', parts: [{ text: `[Page: ${input.activePage || 'home'}]\nCustomer Question: ${input.message}` }] },
      ];
      // Keep the existing lightweight routing and model deadlines.
      const complex = input.message.trim().split(/\s+/).length > 25 || [
        'rewrite', 're-write', 'compose', 'draft a', 'generate copy', 'headline ideas',
        'recommend a layout', 'structure my', 'compare', 'contrast', 'troubleshoot',
        'why might', 'explain why', 'critique', 'analyse', 'analyze', 'audit',
        'suggest a marketing strategy', 'optimise', 'optimize', 'copywriting',
        'sound premium', 'professional tone', 'persuade',
      ].some(t => input.message.toLowerCase().includes(t));
      const models = complex
        ? [['gemini-3.8-flash', 7000], ['gemini-3.1-flash-lite', 3500]] as const
        : [['gemini-3.1-flash-lite', 3500], ['gemini-3.8-flash', 7000]] as const;

      for (const [model, timeout] of models) {
        // Catalog loading or another request may have filled capacity meanwhile.
        if (activeProviderCalls >= 4) {
          res.status(429).json({ error: 'Mystery AI is busy. Please try again shortly.' });
          return;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          activeProviderCalls++;
          // Keep the capacity slot until upstream settles, even after our timeout.
          const pending = Promise.resolve().then(() => client.models.generateContent({
            model, contents,
            config: { systemInstruction: instruction, temperature: 0.7, topP: 0.9, maxOutputTokens: 1024 },
          })).finally(() => { activeProviderCalls--; });
          const response = await Promise.race([
            pending,
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('timeout')), timeout); }),
          ]);
          if (typeof response.text === 'string' && response.text.trim()) {
            res.json({ reply: response.text, source: 'gemini', fallback: false, model,
              routingClass: complex ? 'complex' : 'simple', latencyMs: Date.now() - started });
            return;
          }
        } catch {
          console.warn(`[Mystery AI] provider_attempt_failed model=${model}`);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
      res.status(503).json({ error: AI_FAILURE, source: 'unavailable' });
    } catch {
      console.warn('[Mystery AI] request_failed');
      res.status(503).json({ error: AI_FAILURE, source: 'unavailable' });
    }
  });
  return router;
}
