const express = require('express');
const router = express.Router();

const gsc = require('../services/gsc');
const ai = require('../services/ai');
const scraper = require('../services/scraper');
const store = require('../services/store');

// ---------- وضعیت و تنظیمات ----------
router.get('/status', (req, res) => {
  res.json({
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    gscConfigured: Boolean(gsc.loadServiceAccount()),
    gscSiteUrl: process.env.GSC_SITE_URL || null,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  });
});

router.post('/gsc/test', async (req, res) => {
  try {
    const siteUrl = req.body.siteUrl || process.env.GSC_SITE_URL;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl مشخص نشده است.' });
    const result = await gsc.testConnection(siteUrl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- مدیریت کلمات کلیدی ----------
router.get('/keywords', (req, res) => {
  res.json(store.getKeywords());
});

router.post('/keywords', (req, res) => {
  const { keyword } = req.body;
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: 'کلمه کلیدی نمی‌تواند خالی باشد.' });
  }
  const keywords = store.getKeywords();
  if (!keywords.includes(keyword.trim())) {
    keywords.push(keyword.trim());
    store.saveKeywords(keywords);
  }
  res.json(keywords);
});

router.delete('/keywords/:keyword', (req, res) => {
  const keywords = store.getKeywords().filter((k) => k !== req.params.keyword);
  store.saveKeywords(keywords);
  res.json(keywords);
});

// ---------- رتبه‌بندی و تاریخچه ----------
router.get('/rankings/history', (req, res) => {
  res.json(store.getHistory());
});

router.post('/rankings/sync', async (req, res) => {
  try {
    const siteUrl = req.body.siteUrl || process.env.GSC_SITE_URL;
    if (!siteUrl) return res.status(400).json({ error: 'GSC_SITE_URL تنظیم نشده است.' });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 28); // میانگین ۲۸ روز اخیر (تاخیر داده گوگل)

    const fmt = (d) => d.toISOString().split('T')[0];

    const keywords = store.getKeywords();
    const metrics = await gsc.fetchKeywordMetrics({
      siteUrl,
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      keywords,
    });

    const snapshot = {
      date: fmt(endDate),
      metrics,
    };

    const history = store.appendHistorySnapshot(snapshot);
    res.json({ snapshot, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- تحلیل رقبا ----------
router.post('/analyze/competitor', async (req, res) => {
  try {
    const { myUrl, competitorUrl, targetKeyword } = req.body;
    if (!myUrl || !competitorUrl) {
      return res.status(400).json({ error: 'آدرس سایت من و آدرس رقیب هر دو لازم هستند.' });
    }

    const [myPage, competitorPage] = await Promise.all([
      scraper.fetchPageContent(myUrl),
      scraper.fetchPageContent(competitorUrl),
    ]);

    const analysis = await ai.compareContent({
      myContent: `Title: ${myPage.title}\nH1: ${myPage.h1.join(', ')}\nH2: ${myPage.h2.join(', ')}\n\n${myPage.bodyText}`,
      myUrl,
      competitorContent: `Title: ${competitorPage.title}\nH1: ${competitorPage.h1.join(', ')}\nH2: ${competitorPage.h2.join(', ')}\n\n${competitorPage.bodyText}`,
      competitorUrl,
      targetKeyword,
    });

    res.json({ myPage: { title: myPage.title, h1: myPage.h1 }, competitorPage: { title: competitorPage.title, h1: competitorPage.h1 }, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- پیشنهاد متادیتا ----------
router.post('/analyze/meta', async (req, res) => {
  try {
    const { url, targetKeyword } = req.body;
    if (!url) return res.status(400).json({ error: 'آدرس صفحه لازم است.' });

    const page = await scraper.fetchPageContent(url);
    const suggestion = await ai.suggestMeta({
      url,
      content: `Current Title: ${page.title}\nCurrent Meta Description: ${page.metaDescription}\nH1: ${page.h1.join(', ')}\n\n${page.bodyText}`,
      targetKeyword,
    });

    res.json({ currentTitle: page.title, currentMeta: page.metaDescription, suggestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
