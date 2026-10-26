'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3008;
const DATA_FILE = path.join(__dirname, 'data.json');
const CLIENT_DIR = path.join(__dirname, '..', 'client');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const CATEGORIES = ['工作', '个人', '学习', '生活', '其他'];

const app = express();
app.use(express.json());
app.use(express.static(CLIENT_DIR));

// ---------- 数据持久化 ----------
function readEvents() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('读取 data.json 失败：', err.message);
    return [];
  }
}

function writeEvents(events) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ events }, null, 2) + '\n', 'utf8');
}

// ---------- 工具 ----------
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function compareEvent(a, b) {
  const ka = `${a.date}T${a.time || '99:99'}`;
  const kb = `${b.date}T${b.time || '99:99'}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

// 校验并提取事件字段；返回 { errors, value }
function sanitizeEvent(body) {
  const errors = [];
  const src = body && typeof body === 'object' ? body : {};

  const title = typeof src.title === 'string' ? src.title.trim() : '';
  if (!title) errors.push('title 不能为空');

  const date = typeof src.date === 'string' ? src.date.trim() : '';
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`))) {
    errors.push('date 必须是有效的 YYYY-MM-DD 日期');
  }

  const time = src.time == null || src.time === '' ? '' : String(src.time).trim();
  if (time && !TIME_RE.test(time)) errors.push('time 必须是 HH:MM 格式（如 09:30）');

  if (errors.length) return { errors, value: null };

  return {
    errors: [],
    value: {
      title,
      date,
      time: time || null,
      location: typeof src.location === 'string' ? src.location.trim() : '',
      category: CATEGORIES.includes(src.category) ? src.category : '其他',
      notes: typeof src.notes === 'string' ? src.notes.trim() : '',
      reminder: src.reminder === true || src.reminder === 'true'
    }
  };
}

// ---------- REST API ----------
// 列出事件；支持 ?date=YYYY-MM-DD 按日期查询、?keyword=xx 关键词搜索
app.get('/api/events', (req, res) => {
  let events = readEvents();
  const { date, keyword } = req.query;

  if (date !== undefined) {
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`))) {
      return res.status(400).json({ error: 'date 参数必须是 YYYY-MM-DD 格式' });
    }
    events = events.filter((e) => e.date === date);
  }

  const kw = keyword === undefined ? '' : String(keyword).trim().toLowerCase();
  if (kw) {
    events = events.filter((e) =>
      [e.title, e.location, e.notes, e.category].some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(kw)
      )
    );
  }

  events.sort(compareEvent);
  res.json({ total: events.length, events });
});

// 查询单个事件
app.get('/api/events/:id', (req, res) => {
  const event = readEvents().find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: `事件 ${req.params.id} 不存在` });
  res.json(event);
});

// 新增事件
app.post('/api/events', (req, res) => {
  const { errors, value } = sanitizeEvent(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const now = new Date().toISOString();
  const event = { id: crypto.randomUUID(), ...value, createdAt: now, updatedAt: now };
  const events = readEvents();
  events.push(event);
  writeEvents(events);
  res.status(201).json(event);
});

// 更新事件
app.put('/api/events/:id', (req, res) => {
  const events = readEvents();
  const idx = events.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: `事件 ${req.params.id} 不存在` });

  const { errors, value } = sanitizeEvent(req.body);
  if (errors.length) return res.status(400).json({ errors });

  events[idx] = { ...events[idx], ...value, updatedAt: new Date().toISOString() };
  writeEvents(events);
  res.json(events[idx]);
});

// 删除事件
app.delete('/api/events/:id', (req, res) => {
  const events = readEvents();
  const idx = events.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: `事件 ${req.params.id} 不存在` });

  const [removed] = events.splice(idx, 1);
  writeEvents(events);
  res.json({ message: '事件已删除', deleted: removed });
});

// 提醒汇总：所有开启提醒的事件，按时间排序并区分未来 / 今日 / 已过
app.get('/api/reminders', (req, res) => {
  const today = todayStr();
  const all = readEvents().filter((e) => e.reminder === true).sort(compareEvent);
  const upcoming = all.filter((e) => e.date >= today);
  const past = all.filter((e) => e.date < today);
  res.json({
    total: all.length,
    upcomingCount: upcoming.length,
    todayCount: all.filter((e) => e.date === today).length,
    pastCount: past.length,
    upcoming,
    past
  });
});

// 未知 API 路由返回 404 JSON（而不是前端页面）
app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// JSON 解析错误等统一处理
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求体不是合法的 JSON' });
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`calendar 日程管理后端已启动：http://localhost:${PORT}`);
});
