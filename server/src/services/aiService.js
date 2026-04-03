'use strict';
/**
 * aiService.js
 * Wraps OpenAI GPT-3.5-turbo for NoteFlow's chatbot.
 * Falls back to rule-based FAQ answers if OPENAI_API_KEY is not set.
 */

// Only import OpenAI if the package is available
let OpenAI;
try {
  OpenAI = require('openai');
} catch {
  OpenAI = null;
}

// ─── Rule-based FAQ fallback ──────────────────────────────────────────────────
const FAQ_RULES = [
  {
    patterns: ['join', 'classroom', 'enroll', 'class code'],
    answer: `**How to join a classroom:**\n1. Go to **My Classrooms** in the sidebar.\n2. Click **Join Classroom**.\n3. Enter the 6-character class code provided by your professor.\n4. Click **Join** — you'll be enrolled immediately! 🎉`,
  },
  {
    patterns: ['upload', 'file', 'resource', 'pdf', 'add resource'],
    answer: `**How to upload a resource:**\n1. Open the classroom and scroll to the **Resources** tab.\n2. Click **Upload Resource**.\n3. Select your file (PDF, image, etc.).\n4. Fill in the title, unit, and tags.\n5. Click **Submit** — your resource earns you Karma points! ✨`,
  },
  {
    patterns: ['karma', 'points', 'score', 'reputation'],
    answer: `**What are Karma points?**\nKarma is NoteFlow's reputation system:\n- 📤 Uploading a resource: **+20 pts**\n- ✅ Resource verified: **+10 pts**\n- 💬 Starting a discussion: **+5 pts**\n- 🏹 Completing a bounty: **+bounty reward**\n- 👍 Receiving upvotes: **+2 pts each**\n\nCheck your karma on your **Profile** page!`,
  },
  {
    patterns: ['heatmap', 'heat map', 'highlight', 'annotation'],
    answer: `**How do heatmaps work?**\nHeatmaps show which parts of a PDF are most read/highlighted by your classmates:\n- 🟡 Light yellow = a few students highlighted this\n- 🟠 Orange = many students highlighted this\n- 🔴 Red = hot spot — very popular section!\n\nYou can see heatmaps in the PDF viewer. They update in real time as classmates highlight text.`,
  },
  {
    patterns: ['bounty', 'reward', 'task', 'request'],
    answer: `**What is the Bounty Board?**\nThe Bounty Board lets students and professors post resource requests:\n- 🎯 A **bounty** is a request for a specific resource (e.g., "Unit 3 notes")\n- Anyone can **claim** a bounty and upload the resource\n- Once approved, the claimant earns the **karma reward**\n\nFind the Bounty Board inside each classroom page!`,
  },
  {
    patterns: ['password', 'reset', 'forgot', 'login', 'sign in'],
    answer: `**Login / Password help:**\n- **Reset password**: On the login page, click **Forgot password** and enter your email.\n- **Can't log in?** Make sure you're using the email you signed up with.\n- **Still stuck?** Contact support at your university email.`,
  },
  {
    patterns: ['discussion', 'comment', 'reply', 'thread'],
    answer: `**How to start a discussion:**\n1. Open any resource in the PDF viewer.\n2. Highlight some text.\n3. A popup will appear — click **Discuss** to start a thread.\n4. Type your question or comment and post!\n\nOther students can reply to your thread directly on the highlighted text. 💬`,
  },
  {
    patterns: ['professor', 'teacher', 'instructor', 'dashboard', 'analytics'],
    answer: `**For Professors:**\n- Go to any classroom and click **Professor Dashboard** to see:\n  - Student engagement analytics\n  - Resource quality scores\n  - Heatmap insights across all PDFs\n  - Moderation tools for resources and discussions\n- Create bounties to incentivise students to share notes!`,
  },
  {
    patterns: ['download', 'save', 'export'],
    answer: `**Downloading resources:**\nYou can download any resource by:\n1. Opening the resource in the PDF viewer.\n2. Clicking the **Download** button in the toolbar.\n\nNote: some resources may be restricted by your professor.`,
  },
  {
    patterns: ['search', 'find', 'look for'],
    answer: `**Searching for resources:**\n- Use the **search bar** at the top of the Resources tab inside any classroom.\n- You can filter by unit, file type, or tags.\n- Resources are also sorted by karma rating — highest quality first!`,
  },
];

function buildFallbackAnswer(message) {
  const lower = message.toLowerCase();
  for (const rule of FAQ_RULES) {
    if (rule.patterns.some((p) => lower.includes(p))) {
      return rule.answer;
    }
  }
  return (
    "I'm not sure about that. Here are some things I can help with:\n\n" +
    '- Joining a classroom\n' +
    '- Uploading resources\n' +
    '- Karma points & bounties\n' +
    '- PDF heatmaps & highlights\n' +
    '- Discussions & comments\n\n' +
    'Try asking one of those, or contact your professor for classroom-specific help! 😊'
  );
}

// ─── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(context) {
  let system = `You are NoteFlow AI, a helpful assistant for the NoteFlow academic platform.
NoteFlow is a collaborative note-sharing platform for university students and professors.

Key features:
- Classrooms: Students join with a code, professors manage them
- Resources: Students upload PDFs and files, earn Karma points
- Heatmaps: Show which parts of PDFs are most highlighted
- Bounties: Reward requests for specific resources
- Karma: Reputation points for contributions
- Discussions: Threaded comments anchored to PDF highlights

Always be concise, friendly, and use markdown formatting (bold, lists) in responses.
Keep answers under 200 words. If asked about something outside NoteFlow, politely redirect.`;

  if (context) {
    system += `\n\nCurrent context for this user:\n${context}`;
  }
  return system;
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * @param {string} userMessage
 * @param {Array}  history       - [{role, content}, ...] previous messages
 * @param {string} [contextText] - optional DB-fetched context string
 * @returns {Promise<string>}    - assistant reply
 */
async function getChatResponse(userMessage, history = [], contextText = '') {
  // --- Try OpenAI ---
  if (process.env.OPENAI_API_KEY && OpenAI) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const messages = [
        { role: 'system', content: buildSystemPrompt(contextText) },
        // Keep last 6 turns of history for context window budget
        ...history.slice(-6),
        { role: 'user', content: userMessage },
      ];

      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages,
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500', 10),
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content?.trim() || buildFallbackAnswer(userMessage);
    } catch (err) {
      console.error('[aiService] OpenAI error – falling back to rules:', err.message);
      // Fall through to rule-based
    }
  }

  // --- Rule-based fallback ---
  return buildFallbackAnswer(userMessage);
}

// ─── Document-based Test Generation ───────────────────────────────────────────
/**
 * @param {string} prompt - User instructions for the test
 * @param {string} contextText - Extracted text from resources
 * @returns {Promise<Object>} - The generated test object in JSON
 */
async function generateTestFromContext(prompt, contextText) {
  let aiClient = OpenAI;
  if (!aiClient) {
    try {
      const { OpenAI: DynamicOpenAI } = require('openai');
      aiClient = DynamicOpenAI;
    } catch {
      // ignore
    }
  }

  if (!process.env.OPENAI_API_KEY || !aiClient) {
    throw new Error('OpenAI API is not configured. Cannot generate tests. Please ensure the openai package is installed.');
  }

  const client = new aiClient({ apiKey: process.env.OPENAI_API_KEY });
  
  const systemPrompt = `You are NoteFlow AI, an expert academic professor.
Your task is to generate a JSON response representing a multiple-choice test based on the provided source material. 
Follow the user's instructions regarding difficulty, number of questions, and topic focus.

You MUST return a strict JSON object that perfectly matches the following TypeScript interface (do not output markdown code blocks or any other text, ONLY the raw JSON object string):

{
  "title": string,
  "description": string,
  "duration_mins": number,
  "topics_covered": string[],
  "questions": [
    {
      "question": string,
      "options": [
        { "id": "A", "text": string },
        { "id": "B", "text": string },
        { "id": "C", "text": string },
        { "id": "D", "text": string }
      ],
      "correct_opt": "A" | "B" | "C" | "D",
      "explanation": string
    }
  ]
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Source material to base the test on:\n\n---\n${contextText}\n---\n\nUser Instructions:\n${prompt}` }
  ];

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages,
      max_tokens: 3000,
      temperature: 0.5, // keep it focused and accurate
    });

    const rawResponse = response.choices[0]?.message?.content?.trim();
    if (!rawResponse) throw new Error('AI returned an empty response.');
    
    // strip markdown code block wrapping if present
    const cleanJson = rawResponse.replace(/^```json\n?/, '').replace(/```$/, '').trim();
    return JSON.parse(cleanJson);

  } catch (err) {
    console.error('[aiService] generateTestFromContext error:', err.message);
    throw new Error('Failed to generate test from AI: ' + err.message);
  }
}

module.exports = { getChatResponse, generateTestFromContext };
