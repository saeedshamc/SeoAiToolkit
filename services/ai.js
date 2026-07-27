/**
 * لایه ارتباط با Claude API (Anthropic) برای تحلیل محتوا و پیشنهاد بهبود سئو.
 * توجه: این ابزار هیچ درخواستی به موتور جستجو یا کلیک شبیه‌سازی‌شده‌ای ارسال نمی‌کند؛
 * فقط محتوای متنی صفحات را برای تحلیل به مدل زبانی می‌فرستد.
 */

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

async function callClaude({ system, messages, maxTokens = 1500 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY تنظیم نشده است. آن را در فایل .env قرار دهید.');
  }
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`خطا در فراخوانی Claude API (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((c) => c.type === 'text');
  return textBlock ? textBlock.text : '';
}

async function compareContent({ myContent, myUrl, competitorContent, competitorUrl, targetKeyword }) {
  const system = `تو یک متخصص سئو (SEO) هستی که محتوای دو صفحه وب را مقایسه می‌کنی.
پاسخ را دقیقاً به فرمت JSON زیر و به زبان فارسی برگردان، بدون هیچ متن اضافه یا Markdown:
{
  "content_gaps": ["..."],
  "structure_differences": ["..."],
  "keyword_opportunities": ["..."],
  "actionable_suggestions": ["..."],
  "overall_verdict": "..."
}`;

  const userPrompt = `کلمه کلیدی هدف: ${targetKeyword || 'مشخص نشده'}

آدرس سایت من: ${myUrl}
محتوای سایت من (خلاصه‌شده):
${myContent.slice(0, 6000)}

---

آدرس رقیب: ${competitorUrl}
محتوای رقیب (خلاصه‌شده):
${competitorContent.slice(0, 6000)}

لطفاً تحلیل رقابتی سئو را طبق فرمت خواسته‌شده انجام بده.`;

  const raw = await callClaude({
    system,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 2000,
  });

  return safeParseJson(raw);
}

async function suggestMeta({ url, content, targetKeyword }) {
  const system = `تو یک متخصص سئو هستی که تگ‌های عنوان (title) و توضیحات متا (meta description) را بهینه می‌کنی.
پاسخ را دقیقاً به فرمت JSON زیر و به زبان فارسی برگردان، بدون هیچ متن اضافه یا Markdown:
{
  "current_analysis": "...",
  "suggested_titles": ["...", "...", "..."],
  "suggested_descriptions": ["...", "...", "..."],
  "notes": "..."
}`;

  const userPrompt = `آدرس صفحه: ${url || 'نامشخص'}
کلمه کلیدی هدف: ${targetKeyword || 'مشخص نشده'}

محتوای صفحه (خلاصه‌شده):
${content.slice(0, 6000)}

سه پیشنهاد برای title (حداکثر ۶۰ کاراکتر) و سه پیشنهاد برای meta description (حداکثر ۱۵۵ کاراکتر) ارائه بده.`;

  const raw = await callClaude({
    system,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1500,
  });

  return safeParseJson(raw);
}

function safeParseJson(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return { raw_response: cleaned, parse_error: true };
  }
}

module.exports = { compareContent, suggestMeta, callClaude };
