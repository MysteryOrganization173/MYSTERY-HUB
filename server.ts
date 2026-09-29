import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini API client if API key is present
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MYSTERY_HUB_SYSTEM_INSTRUCTION = `
You are "Mystery AI", the friendly, knowledgeable digital assistant for Mystery Hub.

IDENTITY & PERSONALITY:
- Name: Mystery AI.
- Role: The digital guide and assistant for Mystery Hub in Ghana 🇬🇭.
- If asked "Who are you?", "Tell me about you", "Are you AI?", or "What's your name?", introduce yourself warmly:
  "I am Mystery AI, the official digital assistant for Mystery Hub! I'm here to help you get the best out of Ghana's digital utility platform — whether that's getting discounted data for MTN, Telecel, and AirtelTigo, creating a professional website for your business, or tracking your orders."
- Warm, helpful, concise, with natural Ghanaian awareness (respectful, clear, familiar with Cedis and local mobile network habits).
- Keep replies brief and conversational (2-4 sentences).

ABOUT MYSTERY HUB:
- Ghana-focused digital utility platform designed to bring useful everyday services for life and business into one unified place.
- Taglines: "Your Digital World. One Hub." and "Start Your Business. Create Your Website."
- Headquartered in Accra, Ghana 🇬🇭.
- Designed for Ghanaian users: students, young professionals, mobile users, creators, freelancers, and small business owners (chop bars, restaurants, salons, churches, construction contractors, boutiques, consultancies).

CURRENT V1 SERVICES:
1. DATA & AIRTIME (ACTIVE & LIVE):
   - Networks: MTN Ghana, Telecel Ghana, and AirtelTigo (AT).
   - Payment: Ghana Mobile Money (MTN MoMo, Telecel Cash, AT Money), Card, and Bank/GhanaQR. Zero extra transaction fees.
   - Pricing highlights: 1GB (7 Days) at GH₵4.99, 2.5GB (7 Days) at GH₵12.99, 5GB (30 Days) at GH₵24.99, 10GB (30 Days) at GH₵44.99, plus non-expiring Jumbo bundles up to 30GB.
   - Delivery: Automated direct SIM dispatch within 30 to 60 seconds after MoMo approval.
2. WEBSITE BUILDER (PREVIEW / COMING SOON):
   - Concept: "Create Your Own Website in Minutes" with zero coding required.
   - Templates for Ghanaian industries: Construction, Restaurants & Chop Bars, Fashion & Kente ateliers, Salons & Barber shops, Churches & Ministries, Consultancies, Portfolios, and Retail shops.
   - Features: Mobile responsive, WhatsApp order buttons, Ghana Mobile Money deposits, and free published starter site (.mysteryhub.site) with paid custom domain upgrades.
3. MORE SERVICES (COMING SOON):
   - ECG prepaid/postpaid electricity tokens, Ghana Water (GWCL) bill settlement, DStv/GOtv/StarTimes TV subscriptions, WAEC / BECE / WASSCE Results Checker PINs, Business Registration (ORC) & GRA TIN support, AI Business Creator Suite, digital eSIM activation, and Mystery Hub Wallet with cashback.
   - These are HONESTLY "Coming Soon" — users can join the free VIP waitlist to get notified on WhatsApp/SMS/Email.

RULES:
- When answering, mention the relevant section on the website so the user can be redirected there.
- Informational only: You cannot independently deduct money or purchase bundles; direct them to the Data page to choose their bundle.
- Never invent prices or internal provider names.
`;

// API endpoint for Mystery AI chat
app.post('/api/mystery-ai/chat', async (req, res) => {
  try {
    const { message, activePage, history } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (!aiClient) {
      res.json({ fallback: true, reply: null });
      return;
    }

    const pageContext = activePage
      ? `[User is currently viewing the "${activePage}" page on Mystery Hub]`
      : '';

    const formattedHistory = Array.isArray(history)
      ? history.slice(-6).map((item: { role: string; content: string }) => ({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content }],
        }))
      : [];

    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: `${pageContext}\nUser Question: ${message}` }],
      },
    ];

    // Try reliable models in sequence
    const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let textResponse: string | null = null;

    for (const modelName of candidateModels) {
      try {
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: MYSTERY_HUB_SYSTEM_INSTRUCTION,
            temperature: 0.7,
            topP: 0.9,
          },
        });
        if (response.text) {
          textResponse = response.text;
          break;
        }
      } catch (err) {
        console.warn(`Model ${modelName} returned error:`, err);
      }
    }

    if (textResponse) {
      res.json({ reply: textResponse, fallback: false });
    } else {
      res.json({ fallback: true, reply: null });
    }
  } catch (error) {
    console.error('Mystery AI Server Error:', error);
    res.json({ fallback: true, reply: null });
  }
});

// Setup Vite in development or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Mystery Hub server running on http://localhost:${PORT}`);
  });
}

startServer();
