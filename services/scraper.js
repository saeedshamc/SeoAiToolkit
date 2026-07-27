const cheerio = require('cheerio');

/**
 * دریافت یک صفحه وب و استخراج محتوای متنی خوانا از آن.
 * فقط برای خواندن محتوا استفاده می‌شود؛ هیچ کلیک یا رفتار کاربری شبیه‌سازی نمی‌شود.
 */
async function fetchPageContent(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SEO-AI-Toolkit/1.0; +local-analysis-tool)',
    },
  });

  if (!res.ok) {
    throw new Error(`دریافت صفحه ناموفق بود (${res.status}): ${url}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  $('script, style, noscript, svg, iframe').remove();

  const title = $('title').first().text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const h1 = $('h1')
    .map((_, el) => $(el).text().trim())
    .get();
  const h2 = $('h2')
    .map((_, el) => $(el).text().trim())
    .get();

  const bodyText = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return { title, metaDescription, h1, h2, bodyText };
}

module.exports = { fetchPageContent };
