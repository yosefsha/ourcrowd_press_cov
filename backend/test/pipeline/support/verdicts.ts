import type { ScriptedVerdict } from './scripted-classifiers';

/**
 * Explicit classifier verdicts for every recorded Article that passes the name
 * check. Interim: these move to #6's recorded Ollama verdicts once they exist.
 */
export const RECORDED_ARTICLE_VERDICTS: readonly ScriptedVerdict[] = [
  // Cerebras, en-US, 22–25 Jul 2026
  { company: 'Cerebras', title: 'Cerebras stock gains on AMD partnership', sentiment: 'positive' },
  { company: 'Cerebras', title: 'AMD and Cerebras join forces against Nvidia’s Groq LPUs', sentiment: 'positive' },
  {
    company: 'Cerebras',
    title:
      'AMD Fires Back At NVIDIA’s Groq Bet, Fuses The Cerebras Wafer-Scale Engine With Helios For 5x Higher Tokens Per Second Per Watt',
    sentiment: 'positive',
  },
  {
    company: 'Cerebras',
    title: 'AMD partners with big chip co. Cerebras for ultra-low-latency and high throughput AI inference system',
    sentiment: 'positive',
  },
  { company: 'Cerebras', title: 'Cerebras stock jumps 6% on CrowdStrike partnership', sentiment: 'positive' },
  { company: 'Cerebras', title: 'AMD AAI 2026 Keynote Cerebras', sentiment: 'neutral' },
  { company: 'Cerebras', title: 'CrowdStrike And Cerebras Partner To Power Falcon AIDR', sentiment: 'positive' },
  // Groq, en-US, 22–25 Jul 2026 — the same AMD/Cerebras story, seen from Groq's side.
  {
    company: 'Groq',
    title: 'AMD and Cerebras join forces against Nvidia’s Groq LPUs',
    rejected: 'About Nvidia’s LPU product line competing with AMD and Cerebras, not about Groq the company.',
  },
  {
    company: 'Groq',
    title:
      'AMD Fires Back At NVIDIA’s Groq Bet, Fuses The Cerebras Wafer-Scale Engine With Helios For 5x Higher Tokens Per Second Per Watt',
    sentiment: 'neutral',
  },
  // Innoviz, en-US and he-IL, 27–31 Jul 2026
  { company: 'Innoviz', title: 'Why Is Innoviz Technologies Stock Falling Tuesday?', sentiment: 'negative' },
  { company: 'Innoviz', title: 'Innoviz Technologies stock tumbles 30% on share offering', sentiment: 'negative' },
  {
    company: 'Innoviz',
    title: 'מניית Innoviz Technologies צונחת 30% בעקבות הנפקת מניות מאת Investing.com',
    sentiment: 'negative',
  },
  { company: 'Innoviz', title: 'אינוויז שוב מגייסת בדיסקאונט – ושוב מפילה את המניה', sentiment: 'negative' },
  { company: 'Innoviz', title: 'Innoviz מתמחרת הנפקה פרטית רשומה של $30 מיליון מאת Investing.com', sentiment: 'neutral' },
  { company: 'Innoviz', title: 'מניות אינוויז צונחות ב-30%: מגייסת 30 מיליון דולר בדיסקאונט חד', sentiment: 'negative' },
  { company: 'Innoviz', title: 'מחיר הדילול: מפתחת חיישני ה-LiDAR אינוויז צללה בעקבות גיוס הון', sentiment: 'negative' },
];
