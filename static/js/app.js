/**
 * 播放统计 — 前端入口
 * SongloftPlugin 由主程序自动注入
 */
const { apiGet } = SongloftPlugin;

const SOURCE_LABELS = {
  'songloft-player': '客户端',
  'miot': '智能音箱',
  'web': '网页端',
  'mobile': '手机端',
  'airplay': 'AirPlay',
  'bluetooth': '蓝牙',
  'unknown': '未知',
};

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function formatDuration(sec) {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分钟`;
  return `${sec} 秒`;
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (dateOnly.getTime() === today.getTime()) return `今天 ${time}`;
  if (dateOnly.getTime() === yesterday.getTime()) return `昨天 ${time}`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + time;
}

function sourceLabel(src) {
  return SOURCE_LABELS[src] || src || '未知';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ── 渲染函数 ──────────────────────────────────────────────────────────────────

function showError(message) {
  const errMsg = escapeHtml(message);
  // 重置统计卡片
  document.getElementById('totalPlays').textContent = '—';
  document.getElementById('totalDuration').textContent = '—';
  document.getElementById('uniqueSongs').textContent = '—';
  document.getElementById('uniqueArtists').textContent = '—';
  // 显示错误提示
  document.getElementById('topArtists').innerHTML =
    `<li class="rank-list__empty">加载失败: ${errMsg}</li>`;
  document.getElementById('topSongs').innerHTML =
    `<li class="rank-list__empty">加载失败: ${errMsg}</li>`;
  document.getElementById('sourceList').innerHTML =
    `<li class="rank-list__empty">加载失败: ${errMsg}</li>`;
  document.getElementById('historyList').innerHTML =
    `<li class="history-list__empty">加载失败: ${errMsg}</li>`;
}

// ── 渲染函数 ──────────────────────────────────────────────────────────────────

function renderSummary(data) {
  document.getElementById('totalPlays').textContent = String(data.totalPlays);
  document.getElementById('totalDuration').textContent = formatDuration(data.totalDurationSec);
  document.getElementById('uniqueSongs').textContent = String(data.uniqueSongs);
  document.getElementById('uniqueArtists').textContent = String(data.uniqueArtists);

  const artistEl = document.getElementById('topArtists');
  if (!data.topArtists.length) {
    artistEl.innerHTML = '<li class="rank-list__empty">暂无数据</li>';
  } else {
    artistEl.innerHTML = data.topArtists
      .map(
        (a) =>
          `<li><span class="rank-list__name">${escapeHtml(a.artist)}</span>` +
          `<span class="rank-list__count">${a.plays} 次</span></li>`,
      )
      .join('');
  }

  const songEl = document.getElementById('topSongs');
  if (!data.topSongs.length) {
    songEl.innerHTML = '<li class="rank-list__empty">暂无数据</li>';
  } else {
    songEl.innerHTML = data.topSongs
      .map(
        (s) =>
          `<li><span class="rank-list__name">${escapeHtml(s.title)}` +
          `<span style="color:var(--md-on-surface-variant);font-weight:400"> · ${escapeHtml(s.artist)}</span></span>` +
          `<span class="rank-list__count">${s.plays} 次</span></li>`,
      )
      .join('');
  }

  // 来源分布
  renderBySource(data.bySource);
}

function renderBySource(bySource) {
  const el = document.getElementById('sourceList');
  if (!el) return;
  const entries = Object.entries(bySource || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    el.innerHTML = '<li class="rank-list__empty">暂无数据</li>';
    return;
  }
  el.innerHTML = entries
    .map(
      ([src, count]) =>
        `<li><span class="rank-list__name">${escapeHtml(sourceLabel(src))}</span>` +
        `<span class="rank-list__count">${count} 次</span></li>`,
    )
    .join('');
}

function renderHistory(records) {
  const el = document.getElementById('historyList');
  if (!records.length) {
    el.innerHTML = '<li class="history-list__empty">暂无播放记录，开始听歌吧</li>';
    return;
  }
  const html = records
    .map(
      (r) =>
        `<li>` +
        `<span class="history-list__song">${escapeHtml(r.artist)} — ${escapeHtml(r.title)}</span>` +
        `<span class="history-list__meta">${formatTime(r.timestamp)} · ${sourceLabel(r.source)}</span>` +
        `</li>`,
    )
    .join('');
  el.innerHTML = html;
}

// ── 数据请求 ──────────────────────────────────────────────────────────────────

async function loadData() {
  try {
    const [summary, history] = await Promise.all([
      apiGet('/api/stats/summary'),
      apiGet('/api/history?limit=5&offset=0'),
    ]);
    if (summary.success) renderSummary(summary.data);
    if (history.success) {
      renderHistory(history.data.records);
    }
  } catch (err) {
    showError(err.message || '未知错误');
  }
}

// ── 初始化 ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  // 每 30 秒自动刷新数据
  setInterval(loadData, 30_000);
});
