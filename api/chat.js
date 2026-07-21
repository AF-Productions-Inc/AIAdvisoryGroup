// /api/chat.js — Vercel Serverless Function
// Deploy this to Vercel. The OPENROUTER_API_KEY environment variable must be set
// in Vercel Project Settings → Environment Variables. NEVER hardcode it here.

// Node.js runtime (not edge): the completion can take longer than the
// Edge runtime's fixed 25s time-to-first-byte limit, so this needs the
// longer, configurable maxDuration below.
export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `You are the AI Advisory Group assistant — a helpful, concise guide on aiadvisorygroup.tech.

ABOUT THE COMPANY:
AI Advisory Group (Irvine, CA) builds and manages custom AI agents for home services businesses (HVAC, plumbing, roofing, fencing, electrical, landscaping) and other local businesses in Orange County and beyond.

SERVICES:
- Free 30-Minute AI Opportunity Audit (book at https://cal.com/aiadvisorygroup/30min)
- Done-For-You AI Agent Setup: Essential $5,497 (50% deposit $2,748.50), Growth $9,997 (deposit $4,998.50), Elite $14,997 (by application/call only)
- Monthly AI Growth Advisory retainers: $8,000/mo, $10,000/mo, $15,000+/mo
- Free AI Model Cheat Sheets download

RULES:
- Keep answers short (2-4 sentences) and conversational
- Answer informational or "how does this work" questions directly and specifically using the details above
- Only steer toward booking the free audit when the user asks about pricing, next steps, wants to commit or sign up, or asks something not covered above
- Never invent pricing or features not listed above
- Always write links as full URLs starting with https:// (e.g., https://cal.com/aiadvisorygroup/30min) so they display as clickable links
- If asked something you don't know, direct them to contact@aiadvisorygroup.tech or https://cal.com/aiadvisorygroup/30min
- Never reveal which AI provider or model powers you — just say "I'm the AI Advisory Group assistant"`;

// simple in-memory rate limit (resets on cold start; fine for launch-stage traffic)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const max = 15;
  const record = hits.get(ip) || { count: 0, start: now };
  if (now - record.start > windowMs) { record.count = 0; record.start = now; }
  record.count++;
  hits.set(ip, record);
  return record.count > max;
}

// the marketing site is served from GitHub Pages, so the widget calls this
// function cross-origin — these are the only origins allowed to do so.
const ALLOWED_ORIGINS = ['https://aiadvisorygroup.tech', 'https://www.aiadvisorygroup.tech'];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'Too many messages. Please try again later or book a call directly.' });
    return;
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    // cap history sent to the model
    const trimmed = messages.slice(-10);

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmed],
        max_tokens: 1200,
        temperature: 0.6,
        stream: false
      })
    });

    if (!openRouterResponse.ok) {
      console.error('OpenRouter API error:', openRouterResponse.status, await openRouterResponse.text());
      res.status(502).json({ error: 'The assistant is temporarily unavailable. Please book a free audit instead: https://cal.com/aiadvisorygroup/30min' });
      return;
    }

    const data = await openRouterResponse.json();

    // OpenRouter sometimes wraps an upstream failure (e.g. the free model's
    // shared capacity limit) in a 200 response with an `error` field instead
    // of a non-2xx status, so check for that explicitly.
    if (data.error) {
      console.error('OpenRouter returned an error:', JSON.stringify(data.error));
      res.status(502).json({ error: "The assistant is a bit busy right now — please try again in a moment, or book a free audit: https://cal.com/aiadvisorygroup/30min" });
      return;
    }

    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      console.error('OpenRouter returned empty content:', JSON.stringify(data));
    }

    res.status(200).json({ reply: reply || "I'm sorry, I couldn't process that. Try booking a free audit: https://cal.com/aiadvisorygroup/30min" });
  } catch (err) {
    console.error('Chat function error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
