const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const KEYWORDS_FILE = path.join(DATA_DIR, 'keywords.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  ensureFile(KEYWORDS_FILE, []);
  ensureFile(HISTORY_FILE, []);
}

function getKeywords() {
  init();
  return JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf-8'));
}

function saveKeywords(keywords) {
  init();
  fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2));
}

function getHistory() {
  init();
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
}

function appendHistorySnapshot(snapshot) {
  init();
  const history = getHistory();
  history.push(snapshot);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  return history;
}

module.exports = {
  getKeywords,
  saveKeywords,
  getHistory,
  appendHistorySnapshot,
};
