import { GoogleGenAI } from '@google/genai';

let clientInstance: GoogleGenAI | null = null;

/**
 * Returns the shared server-side GoogleGenAI client instance.
 * Returns null if GEMINI_API_KEY is not configured in the environment.
 */
export function getGeminiClient(): GoogleGenAI | null {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  clientInstance = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return clientInstance;
}
