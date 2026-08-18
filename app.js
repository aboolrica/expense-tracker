// ---------- State ----------
let selections = { category: null, loggedBy: null };
let selectedPreset = null;
let viewMonth = new Date().getMonth() + 1; // 1-indexed
let viewYear = new Date().getFullYear();
let currentBudgets = [];

const CATEGORY_ICONS = {
  'Utilities': '💡',
  'Groceries': '🛒',
  'Dining Out': '🍽️',
  'Transportation': '🚗',
  'Baby & Childcare': '🩲',
  'Healthcare': '💊',
  'Household Supplies': '🧴',
  'Personal Care': '💇',
  'Entertainment & Subscriptions': '🎬',
  'Other': '📦'
};

const CATEGORY_COLORS = {
  'Utilities': { bg: 'var(--yellow-light)', bar: 'var(--yellow)' },
  'Groceries': { bg: 'var(--green-light)', bar: 'var(--green)' },
  'Dining Out': { bg: 'var(--coral-light)', bar: 'var(--coral)' },
  'Transportation': { bg: 'var(--blue-light)', bar: 'var(--blue-dark)' },
  'Baby & Childcare': { bg: 'var(--plum-light)', bar: 'var(--plum)' },
  'Healthcare': { bg: 'var(--coral-light)', bar: 'var(--coral)' },
  'Household Supplies': { bg: 'var(--sand-deep)', bar: 'var(--ink-soft)' },
  'Personal Care': { bg: 'var(--plum-light)', bar: 'var(--plum)' },
  'Entertainment & Subscriptions': { bg: 'var(--blue-light)', bar: 'var(--blue-dark)' },
  'Other': { bg: 'var(--sand-deep)', bar: 'var(--ink-soft)' }
};

const CATEGORY_LIST = Object.keys(CATEGORY_ICONS);

// ---------- Utilities ----------
function fmtRp(n) {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function setSync(state) {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  if (state === 'ok') { dot.style.background = '#C7E8A1'; label.textContent = 'Synced'; }
  else if (state === 'error') { dot.style.background = '#FFB3A7'; label.textContent = 'Offline'; }
  else { dot.style.background = '#FFF3D0'; label.textContent = 'Syncing'; }
}

function configReady() {
  return typeof API_URL === 'string' && API_URL.startsWith('http');
}

// ---------- Currency-aware amount input ----------
function attachCurrencyFormatting(inputEl) {
  inputEl.addEventListener('input', () => {
    const raw = inputEl.value.replace(/\D/g, '');
    inputEl.value = raw ? Number(raw).toLocaleString('id-ID') : '';
  });
}
function rawAmount(inputEl) {
  return inputEl.value.replace(/\D/g, '');
}

// ---------- Month switching ----------
function shiftMonth(delta) {
  let m = viewMonth + delta;
  let y = viewYear;
  if (m > 12) { m = 1; y++; }
  if (m < 1) { m = 12; y--; }
  viewMonth = m; viewYear = y;
  loadSummary();
}

function goToCurrentMonth() {
  viewMonth = new Date().getMonth() + 1;
  viewYear = new Date().getFullYear();
  loadSummary();
}

// ---------- Load data ----------
async function loadSummary() {
  if (!configReady()) { setSync('error'); showToast('Set your API_URL in config.js first'); return; }
  try {
    setSync('syncing');
    const res = await fetch(`${API_URL}?action=summary&month=${viewMonth}&year=${viewYear}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderSummary(data);
    setSync('ok');
  } catch (err) {
    setSync('error');
    console.error(err);
  }
}

async function loadLogs() {
  if (!configReady()) return;
  try {
    const res = await fetch(`${API_URL}?action=logs&limit=15`);
    const data = await res.json();
    renderTimeline(data.events || [], 'timeline');
  } catch (err) {
    console.error(err);
  }
}

async function loadTrend() {
  if (!configReady()) return;
  try {
    const res = await fetch(`${API_URL}?action=trend&months=6`);
    const data = await res.json();
    renderTrend(data.months || []);
  } catch (err) {
    console.error(err);
  }
}

async function loadBudgets() {
  if (!configReady()) return [];
  try {
    const res = await fetch(`${API_URL}?action=budgets`);
    const data = await res.json();
    currentBudgets = data.budgets || [];
    return currentBudgets;
  } catch (err) {
    console.error(err);
    return [];
  }
}

function renderSummary(data) {
  document.getElementById('monthTotal').textContent = fmtRp(data.monthTotal);
  document.getElementById('monthLabelBtn').textContent = (data.monthLabel || '—') + ' ⚙️';

  const now = new Date();
  const isCurrent = (viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear());
  document.getElementById('thisMonthBtn').style.display = isCurrent ? 'none' : 'inline-block';

  const el = document.getElementById('categoryList');
  const breakdown = data.categoryBreakdown || [];
  if (!breakdown.length) {
    el.innerHTML = '<div class="empty-state">No expenses logged this month yet.</div>';
    return;
  }
  const maxAmount = Math.max(...breakdown.map(c => c.amount));
  el.innerHTML = breakdown.map(c => {
    const colors = CATEGORY_COLORS[c.category] || CATEGORY_COLORS['Other'];
    const pct = maxAmount > 0 ? Math.round((c.amount / maxAmount) * 100) : 0;
    let barColor = colors.bar;
    let note = '';
    if (c.limit) {
      const usedPct = Math.round((c.amount / c.limit) * 100);
      if (c.status === 'over') { barColor = 'var(--red)'; note = `<div class="cat-budget-note over">Over budget — ${usedPct}% of ${fmtRp(c.limit)}</div>`; }
      else if (c.status === 'warning') { barColor = 'var(--amber)'; note = `<div class="cat-budget-note warning">${usedPct}% of ${fmtRp(c.limit)} budget</div>`; }
      else { note = `<div class="cat-budget-note ok">${usedPct}% of ${fmtRp(c.limit)} budget</div>`; }
    }
    return `
      <div class="cat-row">
        <div class="cat-row-top">
          <div class="cat-icon" style="background:${colors.bg};">${CATEGORY_ICONS[c.category] || '📦'}</div>
          <div class="cat-body">
            <div class="cat-name">${c.category}</div>
            <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%; background:${barColor};"></div></div>
          </div>
          <div class="cat-amount">${fmtRp(c.amount)}</div>
        </div>
        ${note}
      </div>`;
  }).join('');
}

function renderTrend(months) {
  const el = document.getElementById('trendChart');
  if (!months.length) { el.innerHTML = '<div class="empty-state">Not enough data yet.</div>'; return; }
  const max = Math.max(...months.map(m => m.total), 1);
  const now = new Date();
  el.innerHTML = months.map(m => {
    const h = Math.max(Math.round((m.total / max) * 100), 2);
    const isCurrent = (m.month === now.getMonth() + 1 && m.year === now.getFullYear());
    return `
      <div class="trend-bar-col">
        <div class="trend-amount">${m.total > 0 ? (m.total / 1000).toFixed(0) + 'k' : ''}</div>
        <div class="trend-bar ${isCurrent ? 'current' : ''}" style="height:${h}%;"></div>
        <div class="trend-label">${m.label}</div>
      </div>`;
  }).join('');
}

function renderTimeline(events, targetId) {
  const el = document.getElementById(targetId);
  if (!events.length) {
    el.innerHTML = '<div class="empty-state">Nothing logged yet — tap "Add Expense" above.</div>';
    return;
  }
  el.innerHTML = events.map(ev => {
    const d = new Date(ev.date || ev.timestamp);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <div class="tl-row">
        <div class="tl-icon">${CATEGORY_ICONS[ev.category] || '📦'}</div>
        <div style="flex:1; min-width:0;">
          <div class="tl-label">${ev.category}${ev.notes ? ' — ' + ev.notes : ''}</div>
          <div class="tl-meta">${dateStr}${ev.loggedBy ? ' · ' + ev.loggedBy : ''}</div>
        </div>
        <div class="tl-amount">${fmtRp(ev.amount)}</div>
      </div>`;
  }).join('');
}

// ---------- Modal handling ----------
function openModal(kind) {
  if (kind === 'expense') {
    document.getElementById('expDate').value = fmtDate(new Date());
  }
  if (kind === 'budgets') {
    renderBudgetForm();
  }
  document.getElementById(kind + 'ModalBackdrop').classList.add('open');
}
function closeModal(kind) {
  document.getElementById(kind + 'ModalBackdrop').classList.remove('open');
}

async function renderBudgetForm() {
  const budgets = await loadBudgets();
  const el = document.getElementById('budgetRows');
  el.innerHTML = CATEGORY_LIST.map(cat => {
    const existing = budgets.find(b => b.category === cat);
    const val = existing && existing.limit ? Number(existing.limit).toLocaleString('id-ID') : '';
    return `
      <div class="budget-row">
        <div class="budget-row-name">${CATEGORY_ICONS[cat]} ${cat}</div>
        <input type="text" class="budget-input" data-category="${cat}" placeholder="No limit" value="${val}" inputmode="numeric">
      </div>`;
  }).join('');
  document.querySelectorAll('.budget-input').forEach(attachCurrencyFormatting);
}

async function saveBudgets() {
  const inputs = document.querySelectorAll('.budget-input');
  const updates = [];
  inputs.forEach(inp => {
    const cat = inp.dataset.category;
    const val = rawAmount(inp);
    updates.push({ category: cat, limit: val });
  });
  closeModal('budgets');
  showToast('Saving budgets…');
  for (const u of updates) {
    await postEvent({ type: 'set_budget', category: u.category, limit: u.limit });
  }
  showToast('Budgets saved ✅');
  loadSummary();
}

document.querySelectorAll('.pill-row').forEach(row => {
  row.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    const rowId = row.id;
    const val = pill.dataset.val;
    [...row.children].forEach(c => c.classList.remove('selected'));
    pill.classList.add('selected');

    if (rowId === 'expCategoryRow') selections.category = val;
    if (rowId === 'expLoggedByRow') selections.loggedBy = val;
  });
});

// ---------- Submit ----------
async function postEvent(payload) {
  if (!configReady()) { showToast('Set your API_URL in config.js first'); return false; }
  try {
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    return true;
  } catch (err) {
    console.error(err);
    showToast('Could not save — check connection');
    return false;
  }
}

async function submitExpense() {
  const amount = rawAmount(document.getElementById('expAmount'));
  if (!amount || Number(amount) <= 0) { showToast('Enter an amount first'); return; }
  if (!selections.category) { showToast('Pick a category first'); return; }

  const payload = {
    amount: amount,
    category: selections.category,
    date: document.getElementById('expDate').value,
    notes: document.getElementById('expNotes').value || '',
    loggedBy: selections.loggedBy || ''
  };
  closeModal('expense');
  showToast('Expense logged 💸');
  const ok = await postEvent(payload);
  if (ok) { loadSummary(); loadLogs(); loadTrend(); }
  resetExpenseForm();
}

function resetExpenseForm() {
  selections.category = selections.loggedBy = null;
  document.querySelectorAll('#expCategoryRow .pill, #expLoggedByRow .pill').forEach(p => p.classList.remove('selected'));
  document.getElementById('expAmount').value = '';
  document.getElementById('expNotes').value = '';
}

// ---------- Filter ----------
function presetRange(preset) {
  const now = new Date();
  let start, end = new Date(now);
  if (preset === 'today') { start = new Date(now); }
  else if (preset === 'week') { start = new Date(now); start.setDate(now.getDate() - now.getDay()); }
  else if (preset === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (preset === 'lastmonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  }
  else if (preset === '30') { start = new Date(now); start.setDate(now.getDate() - 29); }
  else if (preset === '90') { start = new Date(now); start.setDate(now.getDate() - 89); }
  else if (preset === 'year') { start = new Date(now.getFullYear(), 0, 1); }
  else if (preset === 'all') { start = new Date(2020, 0, 1); }
  else { start = new Date(now); }
  return { start, end };
}

document.getElementById('filterPresets').addEventListener('click', (e) => {
  const btn = e.target.closest('.preset-pill');
  if (!btn) return;
  document.querySelectorAll('#filterPresets .preset-pill').forEach(p => p.classList.remove('selected'));
  btn.classList.add('selected');
  selectedPreset = btn.dataset.preset;
  const { start, end } = presetRange(selectedPreset);
  document.getElementById('filterStart').value = fmtDate(start);
  document.getElementById('filterEnd').value = fmtDate(end);
});

async function applyFilter() {
  const start = document.getElementById('filterStart').value;
  const end = document.getElementById('filterEnd').value;
  if (!start || !end) { showToast('Pick a date range or preset first'); return; }
  if (!configReady()) { showToast('Set your API_URL in config.js first'); return; }

  const category = document.getElementById('filterCategory').value;
  const keyword = document.getElementById('filterKeyword').value;

  try {
    const url = `${API_URL}?action=filter&category=${encodeURIComponent(category)}&keyword=${encodeURIComponent(keyword)}&start=${start}&end=${end}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderFilterResults(data);
  } catch (err) {
    console.error(err);
    showToast('Could not load filter results');
  }
}

function renderFilterResults(data) {
  document.getElementById('filterResults').style.display = 'block';
  document.getElementById('filterTotal').textContent = fmtRp(data.total);
  document.getElementById('filterCount').textContent = `${data.entryCount || 0} ${data.entryCount === 1 ? 'entry' : 'entries'}`;
  renderTimeline(data.events || [], 'filterTimeline');
}

// ---------- Init ----------
document.getElementById('filterStart').value = fmtDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
document.getElementById('filterEnd').value = fmtDate(new Date());
attachCurrencyFormatting(document.getElementById('expAmount'));

loadSummary();
loadLogs();
loadTrend();
setInterval(() => { loadSummary(); loadLogs(); }, 30000);
