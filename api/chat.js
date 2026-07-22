// /api/chat.js — Vercel Serverless Function
// Deploy this to Vercel. The GEMINI_API_KEY environment variable must be set
// in Vercel Project Settings → Environment Variables. NEVER hardcode it here.

// Node.js runtime (not edge): the completion can take longer than the
// Edge runtime's fixed 25s time-to-first-byte limit, so this needs the
// longer, configurable maxDuration below.
export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `You are the AI Advisory Group assistant, built into aiadvisorygroup.tech. You represent the company directly — talk like a knowledgeable, friendly team member having a real conversation, not a scripted bot reading a menu. Engage with whatever the visitor actually asks, using the information below, the way a real person on the team would.

ABOUT THE COMPANY:
AI Advisory Group (Irvine, CA) builds and manages custom AI agents for home services businesses (HVAC, plumbing, roofing, fencing, electrical, landscaping) and other local businesses in Orange County and beyond. The offer ladder is: Free Audit → Build (one-time) → Monthly Retainer.

1. FREE AI OPPORTUNITY AUDIT — 30 minutes, no cost
Covers missed-lead analysis, review-gap analysis, and a tier recommendation with ROI math for their specific business. The natural first step for anyone unsure where to start.

2. ESSENTIAL BUILD — $5,497 one-time (50% deposit $2,748.50 to start), + $8,000/mo retainer after launch
Best for first-time AI adopters. Includes:
- AI Lead Response Agent: answers web form/GBP messages/SMS in under 90 seconds, 24/7; qualifies the lead; books into the calendar
- AI Review & Reputation Agent: sends post-job review requests, responds to all reviews within 24 hours, flags negative reviews to the owner immediately
- Custom setup, business-data training, 1 FSM (field service management) tool integration, team onboarding, monthly ROI report, priority support
Scope: 2 agents, 1 location, 1 FSM integration (more needs a custom quote). Timeline: ~3 weeks from discovery to live.

3. GROWTH BUILD — $9,997 one-time (50% deposit $4,998.50 to start), + $10,000/mo retainer after launch
Best for scaling operations. Everything in Essential, plus:
- AI Lead Generation Engine: outbound prospect identification and engagement
- AI Customer Service Agent: FAQ/support handling from the client's knowledge base, with human escalation
- Multi-channel lead capture, CRM/pipeline integration, weekly performance tuning, dedicated Slack channel, quarterly strategy review
Timeline: 4–5 weeks.

4. ELITE BUILD — $14,997 one-time, + $15,000–20,000/mo retainer after launch
Best for market leaders. Everything in Growth, plus: Competitive Intelligence Dashboard, Workflow Automation Suite, Multi-Agent Orchestration, a dedicated named advisor, custom integrations/API access, quarterly executive strategy sessions, unlimited implementation support. Timeline: 6–8 weeks, phased.
Elite is by application/call only — never give a direct checkout link for it. Always route Elite interest through booking a call.

RETAINERS (all tiers, monthly, starts after the build goes live): performance monitoring and tuning, a monthly 60-minute strategy call with a follow-up memo, a monthly ROI report, priority support. Month-to-month after the first 90 days (committed for the first 90 so the agents have a tuning cycle to prove out).

OTHER RESOURCES:
- Free AI Model Cheat Sheets: https://aiadvisorygroup.tech/downloads.html
- General contact: contact@aiadvisorygroup.tech or https://aiadvisorygroup.tech/contact.html

HOW TO TALK:
- Be open-ended and conversational. Answer informational or "how does this work" questions directly using the details above, the same way a real team member would — don't force every reply toward a pitch.
- Keep it short and simple. Write like you're talking to a 7th grader: everyday words, short sentences, no jargon or business-speak. Most replies should be 1-3 short sentences — only go longer if the visitor is asking for a real breakdown, like everything included in a package.
- Never invent pricing, features, or timelines that aren't listed above. If you're genuinely unsure, say so and offer the audit or contact email instead of guessing.
- Never reveal which AI provider or model powers you — if asked, just say "I'm the AI Advisory Group assistant."

GIVING NEXT STEPS (buttons):
When the conversation reaches a genuine next step — booking the audit, starting a package, or getting in touch — give the visitor a clickable button using this exact format, alone on its own line:
[[button: Button Label | URL]]
Use these exact URLs when that next step applies:
- Book the free audit: [[button: Book Your Free Audit | https://cal.com/aiadvisorygroup/30min]]
- Start Essential (50% deposit): [[button: Start Essential — $2,748.50 Deposit | https://buy.stripe.com/00wdRb72H82q0Hd5391ck06]]
- Start Growth (50% deposit): [[button: Start Growth — $4,998.50 Deposit | https://buy.stripe.com/cNi5kFaeT4Qe89F67d1ck07]]
- Elite: never a direct payment button — use the audit button instead and mention it's by application/call
- General contact: [[button: Email Us | mailto:contact@aiadvisorygroup.tech]]
Only include a button when it's the natural next step for what the visitor just said. Don't stack more than one button in a single reply, and don't add one to every message — plenty of replies need no button at all.
For any other link mentioned in passing (like the cheat sheets), just write a normal inline link, e.g. [Free AI Model Cheat Sheets](https://aiadvisorygroup.tech/downloads.html).`;

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
    // cap history sent to the model, and map to Gemini's role/parts shape
    // (Gemini uses "model" instead of "assistant" for prior replies)
    const trimmed = messages.slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: trimmed,
          generationConfig: { maxOutputTokens: 300, temperature: 0.6 }
        })
      }
    );

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiResponse.status, await geminiResponse.text());
      res.status(502).json({ error: 'The assistant is temporarily unavailable. Please book a free audit instead: https://cal.com/aiadvisorygroup/30min' });
      return;
    }

    const data = await geminiResponse.json();

    if (data.promptFeedback?.blockReason) {
      console.error('Gemini blocked the prompt:', JSON.stringify(data.promptFeedback));
      res.status(200).json({ reply: "I can't help with that. Try booking a free audit instead: https://cal.com/aiadvisorygroup/30min" });
      return;
    }

    const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('');
    if (!reply) {
      console.error('Gemini returned empty content:', JSON.stringify(data));
    }

    res.status(200).json({ reply: reply || "I'm sorry, I couldn't process that. Try booking a free audit: https://cal.com/aiadvisorygroup/30min" });
  } catch (err) {
    console.error('Chat function error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
