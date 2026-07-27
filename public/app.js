// ---------- ناوبری بین بخش‌ها ----------
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    navItems.forEach((b) => b.classList.remove('active'));
    views.forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
  });
});

// ---------- وضعیت اتصال ----------
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const bothOk = data.anthropicConfigured && data.gscConfigured;

    dot.className = 'status-dot ' + (bothOk ? 'ok' : 'warn');
    text.textContent = bothOk ? 'همه اتصالات فعال' : 'برخی اتصالات ناقص — بخش تنظیمات را ببینید';

    document.getElementById('gscBadge').textContent = data.gscConfigured ? 'متصل' : 'تنظیم نشده';
    document.getElementById('gscBadge').className = 'badge' + (data.gscConfigured ? '' : ' badge-danger');

    document.getElementById('aiBadge').textContent = data.anthropicConfigured ? `فعال (${data.model})` : 'تنظیم نشده';
    document.getElementById('aiBadge').className = 'badge' + (data.anthropicConfigured ? '' : ' badge-danger');

    document.getElementById('siteBadge').textContent = data.gscSiteUrl || 'تعیین نشده';
  } catch (e) {
    console.error(e);
  }
}

// ---------- کلمات کلیدی ----------
async function loadKeywords() {
  const res = await fetch('/api/keywords');
  const keywords = await res.json();
  const list = document.getElementById('keywordList');
  const empty = document.getElementById('keywordEmpty');
  list.innerHTML = '';

  if (keywords.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  keywords.forEach((kw) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(kw)}</span>`;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف';
    delBtn.addEventListener('click', async () => {
      await fetch(`/api/keywords/${encodeURIComponent(kw)}`, { method: 'DELETE' });
      loadKeywords();
    });
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

document.getElementById('addKeywordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('keywordInput');
  if (!input.value.trim()) return;
  await fetch('/api/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: input.value }),
  });
  input.value = '';
  loadKeywords();
});

// ---------- داشبورد رتبه‌ها ----------
let rankChartInstance = null;

async function loadHistory() {
  const res = await fetch('/api/rankings/history');
  const history = await res.json();
  renderTable(history);
  renderChart(history);

  if (history.length > 0) {
    document.getElementById('syncHint').textContent = `آخرین همگام‌سازی: ${history[history.length - 1].date}`;
  }
}

function renderTable(history) {
  const tbody = document.querySelector('#rankTable tbody');
  const empty = document.getElementById('rankEmpty');
  tbody.innerHTML = '';

  if (history.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const latest = history[history.length - 1];
  latest.metrics.forEach((m) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(m.query)}</td>
      <td class="mono">${m.position.toFixed(1)}</td>
      <td class="mono">${m.clicks}</td>
      <td class="mono">${m.impressions}</td>
      <td class="mono">${(m.ctr * 100).toFixed(2)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderChart(history) {
  if (history.length === 0) return;

  // میانگین موقعیت کل کلمات کلیدی در هر تاریخ همگام‌سازی
  const labels = history.map((h) => h.date);
  const avgPositions = history.map((h) => {
    if (h.metrics.length === 0) return null;
    const sum = h.metrics.reduce((acc, m) => acc + m.position, 0);
    return +(sum / h.metrics.length).toFixed(2);
  });

  const ctx = document.getElementById('rankChart');
  if (rankChartInstance) rankChartInstance.destroy();

  rankChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'میانگین موقعیت (کمتر بهتر است)',
          data: avgPositions,
          borderColor: '#4FD1C5',
          backgroundColor: 'rgba(79,209,197,0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#7C8798' } } },
      scales: {
        y: {
          reverse: true,
          ticks: { color: '#7C8798' },
          grid: { color: '#232B38' },
        },
        x: {
          ticks: { color: '#7C8798' },
          grid: { color: '#232B38' },
        },
      },
    },
  });
}

document.getElementById('syncBtn').addEventListener('click', async () => {
  const btn = document.getElementById('syncBtn');
  btn.disabled = true;
  btn.textContent = 'در حال همگام‌سازی…';
  try {
    const res = await fetch('/api/rankings/sync', { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    loadHistory();
  } catch (e) {
    alert('خطا در همگام‌سازی: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'همگام‌سازی از Search Console';
  }
});

// ---------- تحلیل رقبا ----------
document.getElementById('competitorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    myUrl: form.myUrl.value,
    competitorUrl: form.competitorUrl.value,
    targetKeyword: form.targetKeyword.value,
  };

  const resultBox = document.getElementById('competitorResult');
  resultBox.hidden = false;
  resultBox.innerHTML = '<p class="loading">در حال واکشی صفحات و تحلیل با Claude…</p>';

  try {
    const res = await fetch('/api/analyze/competitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const a = data.analysis;
    resultBox.innerHTML = `
      ${renderList('شکاف‌های محتوایی', a.content_gaps)}
      ${renderList('تفاوت ساختاری', a.structure_differences)}
      ${renderList('فرصت‌های کلمه کلیدی', a.keyword_opportunities)}
      ${renderList('پیشنهادهای عملی', a.actionable_suggestions)}
      ${a.overall_verdict ? `<div class="verdict">${escapeHtml(a.overall_verdict)}</div>` : ''}
    `;
  } catch (err) {
    resultBox.innerHTML = `<p class="loading">خطا: ${escapeHtml(err.message)}</p>`;
  }
});

// ---------- بهینه‌سازی متا ----------
document.getElementById('metaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = { url: form.url.value, targetKeyword: form.targetKeyword.value };

  const resultBox = document.getElementById('metaResult');
  resultBox.hidden = false;
  resultBox.innerHTML = '<p class="loading">در حال واکشی صفحه و تحلیل با Claude…</p>';

  try {
    const res = await fetch('/api/analyze/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const s = data.suggestion;
    resultBox.innerHTML = `
      <h3>وضعیت فعلی</h3>
      <p><strong>Title:</strong> ${escapeHtml(data.currentTitle || '—')}</p>
      <p><strong>Meta Description:</strong> ${escapeHtml(data.currentMeta || '—')}</p>
      ${s.current_analysis ? `<p>${escapeHtml(s.current_analysis)}</p>` : ''}
      ${renderList('پیشنهادهای Title', s.suggested_titles)}
      ${renderList('پیشنهادهای Meta Description', s.suggested_descriptions)}
      ${s.notes ? `<div class="verdict">${escapeHtml(s.notes)}</div>` : ''}
    `;
  } catch (err) {
    resultBox.innerHTML = `<p class="loading">خطا: ${escapeHtml(err.message)}</p>`;
  }
});

// ---------- تنظیمات ----------
document.getElementById('testGscBtn').addEventListener('click', async () => {
  const log = document.getElementById('settingsLog');
  log.textContent = 'در حال تست اتصال…';
  try {
    const res = await fetch('/api/gsc/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    log.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    log.textContent = 'خطا: ' + err.message;
  }
});

// ---------- ابزار کمکی ----------
function renderList(title, items) {
  if (!items || items.length === 0) return '';
  return `<h3>${title}</h3><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------- بارگذاری اولیه ----------
loadStatus();
loadKeywords();
loadHistory();
