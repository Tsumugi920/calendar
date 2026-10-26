'use strict';

const API_BASE = '/api';
const CATEGORY_COLORS = { '工作': 'blue', '个人': 'orange', '学习': 'purple', '生活': 'green', '其他': 'gray' };

const els = {
  monthLabel: document.getElementById('monthLabel'),
  calendarGrid: document.getElementById('calendarGrid'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  todayBtn: document.getElementById('todayBtn'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  addEventBtn: document.getElementById('addEventBtn'),
  listTitle: document.getElementById('listTitle'),
  listCount: document.getElementById('listCount'),
  eventList: document.getElementById('eventList'),
  reminderTotal: document.getElementById('reminderTotal'),
  reminderStats: document.getElementById('reminderStats'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  eventForm: document.getElementById('eventForm'),
  fieldId: document.getElementById('fieldId'),
  fieldTitle: document.getElementById('fieldTitle'),
  fieldDate: document.getElementById('fieldDate'),
  fieldTime: document.getElementById('fieldTime'),
  fieldLocation: document.getElementById('fieldLocation'),
  fieldCategory: document.getElementById('fieldCategory'),
  fieldNotes: document.getElementById('fieldNotes'),
  fieldReminder: document.getElementById('fieldReminder'),
  deleteEventBtn: document.getElementById('deleteEventBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  toast: document.getElementById('toast')
};

const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),   // 0-11
  selectedDate: null,
  keyword: '',
  events: []
};

// ---------- 工具 ----------
function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return fmtDate(new Date()); }
function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}
function catColor(c) { return CATEGORY_COLORS[c] || 'gray'; }
function sortEvents(list) {
  return list.slice().sort((a, b) => {
    const ka = `${a.date}T${a.time || '99:99'}`;
    const kb = `${b.date}T${b.time || '99:99'}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
function matchKeyword(e, kw) {
  return [e.title, e.location, e.notes, e.category]
    .some((v) => typeof v === 'string' && v.toLowerCase().includes(kw));
}

// ---------- 数据加载 ----------
async function fetchEvents() {
  const res = await fetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error(`加载事件失败（HTTP ${res.status}）`);
  const data = await res.json();
  state.events = Array.isArray(data.events) ? data.events : [];
}

async function fetchReminderSummary() {
  const res = await fetch(`${API_BASE}/reminders`);
  if (!res.ok) throw new Error(`加载提醒汇总失败（HTTP ${res.status}）`);
  const s = await res.json();
  els.reminderTotal.textContent = s.total;
  const next = (s.upcoming && s.upcoming[0]) || null;
  els.reminderStats.innerHTML =
    `未来 <b>${s.upcomingCount}</b> 条 · 今日 <b>${s.todayCount}</b> 条 · 已过 <b>${s.pastCount}</b> 条` +
    (next
      ? `<div class="next-reminder">最近提醒：${esc(next.date)}${next.time ? ' ' + esc(next.time) : ''} · ${esc(next.title)}</div>`
      : `<div class="next-reminder">暂无即将到来的提醒</div>`);
}

async function refresh() {
  await Promise.all([fetchEvents(), fetchReminderSummary()]);
}

// ---------- 渲染 ----------
function renderAll() { renderCalendar(); renderList(); }

function chipHtml(e) {
  return `<div class="chip ${catColor(e.category)}" data-id="${esc(e.id)}" title="${esc(e.title)}">` +
    (e.reminder ? '<span class="bell">🔔</span>' : '') +
    (e.time ? `<span class="chip-time">${esc(e.time)}</span>` : '') +
    `<span class="chip-text">${esc(e.title)}</span></div>`;
}

function renderCalendar() {
  els.monthLabel.textContent = `${state.year} 年 ${state.month + 1} 月`;

  const first = new Date(state.year, state.month, 1);
  const start = new Date(state.year, state.month, 1 - first.getDay()); // 周日开头
  const today = todayStr();

  const byDate = new Map();
  for (const e of state.events) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }

  const kw = state.keyword.trim().toLowerCase();
  const hitDates = kw ? new Set(state.events.filter((e) => matchKeyword(e, kw)).map((e) => e.date)) : null;

  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const ds = fmtDate(d);
    const items = byDate.get(ds) || [];
    const cls = [
      'cell',
      d.getMonth() === state.month ? '' : 'dim',
      ds === today ? 'today' : '',
      (!kw && ds === state.selectedDate) ? 'selected' : '',
      hitDates && hitDates.has(ds) ? 'hit' : ''
    ].filter(Boolean).join(' ');

    const chips = sortEvents(items).slice(0, 3).map(chipHtml).join('');
    const more = items.length > 3 ? `<div class="more">还有 ${items.length - 3} 条…</div>` : '';
    html += `<div class="${cls}" data-date="${ds}"><div class="cell-date">${d.getDate()}</div>${chips}${more}</div>`;
  }
  els.calendarGrid.innerHTML = html;
}

function itemHtml(e, showDate) {
  const d = parseDateStr(e.date);
  const when = [showDate ? `${d.getMonth() + 1} 月 ${d.getDate()} 日` : '', e.time || '']
    .filter(Boolean).join(' ');
  return `<div class="event-item ${catColor(e.category)}" data-id="${esc(e.id)}">
    <div class="item-top">
      <span class="cat-dot"></span>
      <span class="item-when">${esc(when)}${e.reminder ? '<span class="bell" title="已开启提醒">🔔</span>' : ''}</span>
    </div>
    <div class="item-title">${esc(e.title)}</div>
    ${e.location ? `<div class="item-meta">📍 ${esc(e.location)}</div>` : ''}
    ${e.notes ? `<div class="item-notes">${esc(e.notes)}</div>` : ''}
  </div>`;
}

function renderList() {
  const kw = state.keyword.trim();
  let items, title;
  if (kw) {
    items = sortEvents(state.events.filter((e) => matchKeyword(e, kw.toLowerCase())));
    title = `搜索「${kw}」的结果`;
  } else {
    const d = parseDateStr(state.selectedDate);
    title = `${d.getMonth() + 1} 月 ${d.getDate()} 日${state.selectedDate === todayStr() ? '（今天）' : ''} 事件`;
    items = sortEvents(state.events.filter((e) => e.date === state.selectedDate));
  }
  els.listTitle.textContent = title;
  els.listCount.textContent = items.length;

  if (!items.length) {
    els.eventList.innerHTML = kw
      ? `<div class="empty">没有匹配「${esc(kw)}」的事件</div>`
      : `<div class="empty">这一天还没有日程<br><button class="btn ghost" id="emptyAddBtn">＋ 添加一个事件</button></div>`;
  } else {
    els.eventList.innerHTML = items.map((e) => itemHtml(e, Boolean(kw))).join('');
  }
}

// ---------- 弹窗 ----------
function openAddModal() {
  els.modalTitle.textContent = '添加事件';
  els.eventForm.reset();
  els.fieldId.value = '';
  els.fieldDate.value = state.selectedDate;
  els.deleteEventBtn.hidden = true;
  els.modalOverlay.hidden = false;
  document.body.classList.add('modal-open');
  els.fieldTitle.focus();
}

function openEditModal(id) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return;
  els.modalTitle.textContent = '编辑事件';
  els.fieldId.value = e.id;
  els.fieldTitle.value = e.title;
  els.fieldDate.value = e.date;
  els.fieldTime.value = e.time || '';
  els.fieldLocation.value = e.location || '';
  els.fieldCategory.value = e.category || '其他';
  els.fieldNotes.value = e.notes || '';
  els.fieldReminder.checked = e.reminder === true;
  els.deleteEventBtn.hidden = false;
  els.modalOverlay.hidden = false;
  document.body.classList.add('modal-open');
}

function closeModal() {
  els.modalOverlay.hidden = true;
  document.body.classList.remove('modal-open');
}

function jumpToDate(ds) {
  const d = parseDateStr(ds);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  state.selectedDate = ds;
}

function clearSearch() {
  state.keyword = '';
  els.searchInput.value = '';
  els.clearSearchBtn.hidden = true;
}

// ---------- 事件绑定 ----------
function shiftMonth(delta) {
  const d = new Date(state.year, state.month + delta, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  renderAll();
}
els.prevMonthBtn.addEventListener('click', () => shiftMonth(-1));
els.nextMonthBtn.addEventListener('click', () => shiftMonth(1));

els.todayBtn.addEventListener('click', () => {
  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();
  state.selectedDate = todayStr();
  clearSearch();
  renderAll();
});

els.calendarGrid.addEventListener('click', (ev) => {
  const chip = ev.target.closest('.chip');
  if (chip) { openEditModal(chip.dataset.id); return; }
  const cell = ev.target.closest('.cell');
  if (cell) {
    state.selectedDate = cell.dataset.date;
    clearSearch();
    renderAll();
  }
});

els.eventList.addEventListener('click', (ev) => {
  if (ev.target.closest('#emptyAddBtn')) { openAddModal(); return; }
  const item = ev.target.closest('.event-item');
  if (item) openEditModal(item.dataset.id);
});

els.addEventBtn.addEventListener('click', openAddModal);

els.searchInput.addEventListener('input', () => {
  state.keyword = els.searchInput.value;
  els.clearSearchBtn.hidden = !state.keyword;
  renderCalendar();
  renderList();
});

els.clearSearchBtn.addEventListener('click', () => {
  clearSearch();
  renderAll();
  els.searchInput.focus();
});

els.modalCloseBtn.addEventListener('click', closeModal);
els.cancelBtn.addEventListener('click', closeModal);
els.modalOverlay.addEventListener('click', (ev) => { if (ev.target === els.modalOverlay) closeModal(); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !els.modalOverlay.hidden) closeModal(); });

els.eventForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const payload = {
    title: els.fieldTitle.value.trim(),
    date: els.fieldDate.value,
    time: els.fieldTime.value || null,
    location: els.fieldLocation.value.trim(),
    category: els.fieldCategory.value,
    notes: els.fieldNotes.value.trim(),
    reminder: els.fieldReminder.checked
  };
  if (!payload.title) { showToast('请填写事件标题', true); els.fieldTitle.focus(); return; }
  if (!payload.date) { showToast('请选择事件日期', true); els.fieldDate.focus(); return; }

  const editingId = els.fieldId.value;
  const url = editingId ? `${API_BASE}/events/${editingId}` : `${API_BASE}/events`;
  try {
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data.errors && data.errors[0]) || data.error || `保存失败（HTTP ${res.status}）`, true);
      return;
    }
    closeModal();
    showToast(editingId ? '事件已更新 ✅' : '事件已添加 ✅');
    clearSearch();
    jumpToDate(payload.date);
    await refresh();
    renderAll();
  } catch (err) {
    showToast(`网络错误：${err.message}`, true);
  }
});

els.deleteEventBtn.addEventListener('click', async () => {
  const id = els.fieldId.value;
  if (!id) return;
  if (!window.confirm('确定要删除这个事件吗？')) return;
  try {
    const res = await fetch(`${API_BASE}/events/${id}`, { method: 'DELETE' });
    if (!res.ok) { showToast(`删除失败（HTTP ${res.status}）`, true); return; }
    closeModal();
    showToast('事件已删除 🗑️');
    await refresh();
    renderAll();
  } catch (err) {
    showToast(`网络错误：${err.message}`, true);
  }
});

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg, isError = false) {
  els.toast.textContent = msg;
  els.toast.classList.toggle('error', isError);
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2600);
}

// ---------- 启动 ----------
(async function init() {
  state.selectedDate = todayStr();
  try {
    await refresh();
  } catch (err) {
    showToast(err.message, true);
    els.reminderStats.textContent = '加载失败，请确认后端已启动';
    els.eventList.innerHTML = `<div class="empty">无法连接后端接口<br>${esc(err.message)}<br>请先运行 npm start</div>`;
  }
  renderAll();
})();
