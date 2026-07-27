const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

/**
 * لایه ارتباط با Google Search Console API.
 * از یک Service Account استفاده می‌کند که باید به‌عنوان کاربر «Full» یا
 * «Restricted» به پراپرتی مربوطه در Search Console اضافه شده باشد.
 */
function loadServiceAccount() {
  const keyPath = process.env.GSC_SERVICE_ACCOUNT_PATH || './data/gsc-service-account.json';
  const resolved = path.resolve(keyPath);
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf-8'));
}

async function getSearchConsoleClient() {
  const credentials = loadServiceAccount();
  if (!credentials) {
    throw new Error(
      'فایل سرویس‌اکانت گوگل پیدا نشد. مسیر GSC_SERVICE_ACCOUNT_PATH را در .env بررسی کنید.'
    );
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  return google.searchconsole({ version: 'v1', auth });
}

/**
 * دریافت آمار کلمات کلیدی برای یک بازه زمانی مشخص.
 * خروجی شامل query, clicks, impressions, ctr, position برای هر کلمه است.
 */
async function fetchKeywordMetrics({ siteUrl, startDate, endDate, keywords }) {
  const searchconsole = await getSearchConsoleClient();

  const requestBody = {
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: 5000,
  };

  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody,
  });

  const rows = response.data.rows || [];

  // اگر لیست خاصی از کلمات کلیدی داده شده، فقط همان‌ها را فیلتر کن
  const normalizedKeywords = (keywords || []).map((k) => k.trim().toLowerCase());
  const filtered =
    normalizedKeywords.length > 0
      ? rows.filter((r) => normalizedKeywords.includes(r.keys[0].toLowerCase()))
      : rows;

  return filtered.map((r) => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/**
 * بررسی اینکه آیا اتصال به Search Console درست کار می‌کند یا نه.
 */
async function testConnection(siteUrl) {
  const searchconsole = await getSearchConsoleClient();
  const sites = await searchconsole.sites.list();
  const found = (sites.data.siteEntry || []).some((s) => s.siteUrl === siteUrl);
  return { connected: true, siteFound: found, sites: sites.data.siteEntry || [] };
}

module.exports = { fetchKeywordMetrics, testConnection, loadServiceAccount };
