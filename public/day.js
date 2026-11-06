// The no-sign-in schedule page: /day.html?k=<link code>. Works for 4 days after publishing.
import { dayHtml } from './schedule-view.js';

const box = document.getElementById('day');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const byId = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));

(async () => {
  const k = new URLSearchParams(location.search).get('k') || '';
  let res; let data = {};
  try {
    res = await fetch(`/api/share?k=${encodeURIComponent(k)}`, { cache: 'no-store' });
    data = await res.json();
  } catch { /* offline */ }
  if (!res || !res.ok) {
    box.innerHTML = `<div class="v-msg"><h2>Schedule not available</h2><p>${esc(data.error || 'Check your signal and try again.')}</p></div>`;
    return;
  }
  document.title = `Schedule ${data.date} · Lyons & Hohl`;
  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  const until = new Date(data.expires).toLocaleString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  box.innerHTML = dayHtml({
    date: data.date, board: data.board, people: byId(data.people), jobs: byId(data.jobs),
    equipment: byId(data.equipment), haulers: byId(data.haulers), vacation: data.vacation, eqMoves: data.eqMoves,
  }, 'share') + `<p class="v-foot">${updated ? `Updated ${esc(updated)} · ` : ''}This link works until ${esc(until)}.</p>`;
  const p = document.getElementById('print');
  p.hidden = false;
  p.addEventListener('click', () => window.print());
})();
