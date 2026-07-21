// /api/chat.js — Vercel Serverless Function
// Deploy this to Vercel. The NIM_API_KEY environment variable must be set
// in Vercel Project Settings → Environment Variables. NEVER hardcode it here.

// Node.js runtime (not edge): the NIM completion can take longer than the
// Edge runtime's fixed 25s time-to-first-byte limit, so this needs the
// longer, configurable maxDuration below.
export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `You are the AI Advisory Group assistant — a helpful, concise guide on aiadvisorygroup.tech.

ABOUT THE COMPANY:
AI Advisory Group (Irvine, CA) builds and manages custom AI agents for home services businesses (HVAC, plumbing, roofing, fencing, electrical, landscaping) and other local businesses in Orange County and beyond.

SERVICES:
- Free 30-Minute AI Opportunity Audit (book at cal.com/aiadvisorygroup/30min)
- Done-For-You AI Agent Setup: Essential $5,497 (50% deposit $2,748.50), Growth $9,997 (deposit $4,998.50), Elite $14,997 (by application/call only)
- Monthly AI Growth Advisory retainers: $8,000/mo, $10,000/mo, $15,000+/mo
- Free AI Model Cheat Sheets download

RULES:
- Keep answers short (2-4 sentences) and conversational
- Always steer toward booking the free audit when relevant
- Never invent pricing or features not listed above
- If asked something you don't know, direct them to contact@aiadvisorygroup.tech or the free audit call
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

export default async function handler(req, res) {
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

    const nimResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NIM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-ai/deepseek-v4-pro',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmed],
        max_tokens: 400,
        temperature: 0.6,
        stream: false
      })
    });

    if (!nimResponse.ok) {
      console.error('NIM API error:', nimResponse.status, await nimResponse.text());
      res.status(502).json({ error: 'The assistant is temporarily unavailable. Please book a free audit instead: cal.com/aiadvisorygroup/30min' });
      return;
    }

    const data = await nimResponse.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Try booking a free audit: cal.com/aiadvisorygroup/30min";

    res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat function error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
