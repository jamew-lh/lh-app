// Daily Schedule: the drag-and-drop crew board (editors only).
// The board for a day is saved as one JSON document (Daily Schedules base → Schedule Days):
//   jobs: [jobId]                                order of job cards
//   people: { loc: [{ id, role, machine, note }] }   loc = jobId | LANDSCAPE | OFF | SHOP | DRIVERS
//   equip: { loc: [equipmentId] }                 loc = jobId | LANDSCAPE | REPAIR (not listed = Yard)
//   jobNotes: { jobId: text }
//   haul: { jobId: [{ id, hauler, trucks, kind, material, from, to, time, note }] }
//   moves: [{ id, what, from, to, by, time, note }]   material / other moves (not tracked anywhere else)
//   sent: { personId: { key, at } }               who was texted, and for which spot
//   eqSyncAt: time of the last equipment-app location change applied to this day
import { dayHtml, dayText, haulText, subText, otherMoveText, mapLink, longDate, eqMoveText, movesForDriver, stackCards, byEquipmentType, sortEquipIds } from './schedule-view.js';

let C;
export function initSchedule(ctx) { C = ctx; }

const ROLES = ['Foreman', 'Operator', 'Laborer'];
const SPECIAL = { LANDSCAPE: 'Landscaping Crew', OFF: 'Off', SHOP: 'Office / Shop', DRIVERS: 'Drivers / Moves' };
const TRUCK_KINDS = ['Tri-axle', 'Quad', 'Tandem', 'Tractor-trailer', 'Lowboy', 'Other'];
const QUICK_NOTES = ['Start 6:30', 'Report to shop first', 'Bring trailer', 'Rain day – stand by'];
const TZ = 'America/New_York';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clone = (x) => JSON.parse(JSON.stringify(x));
const uid = () => Math.random().toString(36).slice(2, 10);

// ------------------------------------------------------------------ dates
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const toD = (s) => new Date(`${s}T12:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
function addWorkdays(s, n) {
  const d = toD(s);
  const step = Math.sign(n) || 1;
  for (let left = Math.abs(n); left > 0;) { d.setUTCDate(d.getUTCDate() + step); if (![0, 6].includes(d.getUTCDay())) left -= 1; }
  return iso(d);
}
// Saturdays (and Sundays) start with empty crews. Weekdays copy from the last weekday (the server skips weekends).
const isWeekend = (s) => [0, 6].includes(toD(s).getUTCDay());
const nextSaturday = (s) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7)); return iso(d); };
const todayNY = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const short = (s) => toD(s).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const md = (s) => toD(s).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const clock = (t) => (t ? new Date(t).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '');

// ------------------------------------------------------------------ state
let S = null;          // { setup, people, jobs, equip, haulers, byLabel, date, board, version, day, prev, timeOff, moves, isNew, dirty, banner }
let query = '';
let yard = { q: '', type: '' };
const collapsed = new Set(['p-trucks-info']);

function indexSetup(setup) {
  const by = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  return {
    setup, people: by(setup.people), jobs: by(setup.jobs), equip: by(setup.equipment), haulers: by(setup.haulers), subs: by(setup.subs || []),
    byLabel: Object.fromEntries(setup.equipment.map((e) => [e.label.toLowerCase(), e])),
  };
}
const emptyBoard = () => ({ jobs: [], people: { LANDSCAPE: [], OFF: [], SHOP: [], DRIVERS: [] }, equip: { LANDSCAPE: [], REPAIR: [] }, jobNotes: {}, haul: {}, subs: {}, moves: [], sent: {} });
function normalize(b) {
  const out = { ...emptyBoard(), ...(b || {}) };
  for (const k of ['people', 'equip', 'jobNotes', 'haul', 'subs', 'sent']) out[k] = { ...(emptyBoard()[k] || {}), ...(out[k] || {}) };
  for (const j of out.jobs) { out.people[j] = out.people[j] || []; out.equip[j] = out.equip[j] || []; }
  return out;
}
// A place crews work: a job on the board, or the Landscaping Crew (always there, in the right-hand panels).
const isJob = (loc) => loc === 'LANDSCAPE' || !!S.jobs[loc] || (S.board.jobs || []).includes(loc);
const locName = (loc) => SPECIAL[loc] || (loc === 'REPAIR' ? 'Repair' : loc === 'YARD' ? 'Yard' : S.jobs[loc]?.name || 'Unknown job');
const personName = (id) => S.people[id]?.name || 'Former employee';
const eqLabel = (id) => S.equip[id]?.label || '?';

// ------------------------------------------------------------------ vacations (timecard app)
const offOn = (pid, date = S.date) => S.timeOff.find((t) => t.person === pid && t.date === date && !t.requested);
const requestedOn = (pid, date = S.date) => S.timeOff.find((t) => t.person === pid && t.date === date && t.requested);
const fullDayOff = (pid, date) => { const t = offOn(pid, date); return t && !t.half; };

// ------------------------------------------------------------------ board lookups
function locOf(b, pid) {
  for (const [loc, list] of Object.entries(b.people || {})) {
    const i = (list || []).findIndex((a) => a.id === pid);
    if (i >= 0) return { loc, i, a: list[i] };
  }
  return null;
}
const equipLocs = (b, eid) => Object.entries(b.equip || {}).filter(([, l]) => (l || []).includes(eid)).map(([loc]) => loc);

// ------------------------------------------------------------------ texts: who changed since the last saved day
// A driver's equipment moves for the day count like a job note: new or changed moves flag a text.
const driverMoves = (pid) => movesForDriver(S.moves, personName(pid)).map((m) => eqMoveText(m)).join('; ');
function spotKey(b, pid) {
  const hit = locOf(b, pid);
  if (!hit) return null;
  const jobNote = isJob(hit.loc) ? (b.jobNotes?.[hit.loc] || '') : (hit.loc === 'DRIVERS' && b === S.board ? driverMoves(pid) : '');
  return { loc: hit.loc, note: hit.a.note || '', jobNote };
}
// The day texts are compared with. A weekend day starts empty, so everyone placed on it is flagged.
const compareBoard = () => (isWeekend(S.date) ? emptyBoard() : S.prev?.board);
function textStatus(pid) {
  const base = compareBoard();
  if (!base) return null;
  const now = spotKey(S.board, pid);
  if (!now) return null;
  const was = spotKey(base, pid);
  const changed = !was || was.loc !== now.loc || (now.note && now.note !== was.note) || (now.jobNote && now.jobNote !== was.jobNote);
  if (!changed) return { kind: 'same' };
  const key = `${now.loc}|${now.note}|${now.jobNote}`;
  const sent = S.board.sent?.[pid];
  return { kind: sent && sent.key === key ? 'sent' : 'txt', at: sent?.at, was, now, key };
}
function textList() {
  const out = [];
  for (const [loc, list] of Object.entries(S.board.people)) {
    for (const a of list) {
      const st = textStatus(a.id);
      if (st && st.kind !== 'same') out.push({ pid: a.id, loc, a, ...st });
    }
  }
  return out;
}
function droppedSincePrev() {
  if (!S.prev || isWeekend(S.date)) return [];
  const out = [];
  for (const list of Object.values(S.prev.board.people || {})) {
    for (const a of list || []) if (!locOf(S.board, a.id) && !fullDayOff(a.id)) out.push(a.id);
  }
  return out;
}

// ------------------------------------------------------------------ building a new day
function applyEquipmentMoves(b, moves) {
  const done = [];
  for (const m of moves) {
    const e = S.byLabel[m.equipment.toLowerCase()];
    if (!e) continue;
    for (const [loc, l] of Object.entries(b.equip)) {
      const i = l.indexOf(e.id);
      if (i >= 0) l.splice(i, 1);
      for (const a of b.people[loc] || []) if (a.machine === e.id) a.machine = '';
    }
    if (m.toJob && S.jobs[m.toJob]) {
      if (!b.jobs.includes(m.toJob)) { b.jobs.push(m.toJob); b.people[m.toJob] = b.people[m.toJob] || []; }
      (b.equip[m.toJob] = b.equip[m.toJob] || []).push(e.id);
    }
    done.push(`${e.label} → ${m.toJob && S.jobs[m.toJob] ? S.jobs[m.toJob].name : 'Yard'}`);
  }
  return done;
}
// Machines moved in the equipment app (Change Log "Location") since this day last caught up.
// Only for today and later: past days stay as they were.
function syncEquipment(b, since, date) {
  if (date < todayNY()) return [];
  const list = (S.eqChanges || []).filter((c) => c.when > (since || ''));
  if (!list.length) return [];
  const done = applyEquipmentMoves(b, list);
  b.eqSyncAt = list[list.length - 1].when;
  return done;
}
// People marked Past Employee, or with "Include on Schedule" unchecked, come off today and later days.
// Past days stay as they were.
function dropRemovedPeople(b, date) {
  if (date < todayNY()) return 0;
  let n = 0;
  for (const [loc, list] of Object.entries(b.people)) {
    b.people[loc] = list.filter((a) => {
      const keep = !!S.people[a.id]?.include;
      if (!keep) n++;
      return keep;
    });
  }
  return n;
}
function buildNewDay(date) {
  if (S.prev) {
    const b = normalize(clone(S.prev.board));
    b.sent = {};
    const removed = [];
    for (const [loc, list] of Object.entries(b.people)) {
      b.people[loc] = list.filter((a) => {
        if (fullDayOff(a.id, date)) { removed.push(personName(a.id)); return false; }
        return true;
      });
      if (loc === 'DRIVERS') for (const a of b.people[loc]) a.note = '';
    }
    b.moves = [];
    dropRemovedPeople(b, date);
    const weekend = isWeekend(date);
    if (weekend) {
      // Smaller crew: keep the jobs and where the machines are; start crews, notes and hired trucks empty.
      for (const loc of Object.keys(b.people)) b.people[loc] = [];
      b.jobNotes = {};
      b.haul = {};
      b.subs = {};
      removed.length = 0;
    }
    const synced = syncEquipment(b, S.prev.board.eqSyncAt || S.prev.created, date);
    const moved = [...new Set([...synced, ...applyEquipmentMoves(b, S.moves)])];
    const msg = [weekend
      ? `${short(date)} starts with empty crews. Jobs and machines are copied from ${short(S.prev.date)}; drag in who's working. Monday will copy the last weekday, not this day.`
      : `Started ${short(date)} as a copy of ${short(S.prev.date)}. Just move what changes.`];
    if (removed.length) msg.push(`<b>Taken off for vacation:</b> ${removed.map(esc).join(', ')}.`);
    if (moved.length) msg.push(`<b>Equipment moves from the equipment app:</b> ${moved.map(esc).join(', ')}.`);
    msg.push('Saved as soon as you change something.');
    return { board: b, msg: msg.join(' ') };
  }
  // The very first day: jobs and equipment from the equipment app, no people yet.
  const b = emptyBoard();
  b.eqSyncAt = new Date().toISOString();
  for (const e of S.setup.equipment) {
    if (!e.job || !S.jobs[e.job] || e.down) continue;
    if (!b.jobs.includes(e.job)) { b.jobs.push(e.job); b.people[e.job] = []; b.equip[e.job] = []; }
    b.equip[e.job].push(e.id);
  }
  applyEquipmentMoves(b, S.moves);
  return { board: b, msg: `No schedule saved before ${short(date)}, so this starts clean: jobs and equipment come from the equipment app. Drag people from <b>Not scheduled</b> onto jobs. Saved as soon as you change something.` };
}

// ------------------------------------------------------------------ saving
let saveTimer = null;
let saving = null;
function changed() {
  S.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1200);
  render();
  setSaveState('Saving…');
}
async function saveNow() {
  clearTimeout(saveTimer); saveTimer = null;
  if (saving) { await saving; }
  if (!S?.dirty) return;
  const date = S.date;
  const body = { board: clone(S.board), version: S.version };
  S.dirty = false;
  saving = C.api(`schedule/day?date=${date}`, { method: 'PUT', body })
    .then((r) => {
      if (S.date !== date) return;
      if (r.conflict) return onConflict(r.day);
      S.version = r.day.version; S.day = r.day; S.isNew = false;
      setSaveState(`Saved ${clock(r.day.updatedAt) || ''}`);
    })
    .catch((e) => {
      if (e.message === 'signed-out') return;
      if (S.date === date) { S.dirty = true; setSaveState(`Not saved: ${e.message}`, true); }
    })
    .finally(() => { saving = null; });
  await saving;
}
/** Called before leaving the screen or changing days. */
export async function flushSchedule() { if (S) await saveNow(); }
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (document.body.classList.contains('sched-on')) stackCards($('.sd-board'), 260, 12); }, 150);
});
window.addEventListener('beforeunload', (e) => { if (S?.dirty) { e.preventDefault(); e.returnValue = ''; } });

function onConflict(day) {
  S.board = normalize(day.board); S.version = day.version; S.day = day; S.isNew = false;
  render();
  modal(`<h3>Someone else changed this day</h3>
    <p>${esc(day.updatedBy || 'Another editor')} saved ${esc(short(S.date))} at ${esc(clock(day.updatedAt))}. Your last change was <b>not</b> saved. Their version is on the screen now; make your change again.</p>
    <div class="sd-btns"><button class="sd-btn primary" data-close>OK</button></div>`);
}
function setSaveState(text, bad = false) {
  const el = $('#sdSave');
  if (el) { el.textContent = text; el.classList.toggle('bad', bad); }
}
function savedText() {
  if (S.isNew) return 'Not saved yet';
  if (!S.day) return '';
  return `Saved ${clock(S.day.updatedAt)}${S.day.updatedBy ? ` · ${S.day.updatedBy}` : ''}`;
}

// ------------------------------------------------------------------ entry
export async function showSchedule(dateArg) {
  const me = C.me();
  if (!me?.schedule) { location.hash = ''; return; }
  await flushSchedule();
  document.title = 'Daily Schedule · Lyons & Hohl';
  const date = DATE.test(dateArg || '') ? dateArg : addWorkdays(todayNY(), 1);
  if (!S?.setup || S.date !== date) {
    C.app.innerHTML = `${topBar()}<main class="sd-loading"><p>Loading ${esc(longDate(date))}…</p></main>`;
  }
  try {
    if (!S?.setup) S = { ...indexSetup(await C.api('schedule/setup')) };
    const r = await C.api(`schedule/day?date=${date}`);
    Object.assign(S, { date, prev: r.prev, timeOff: r.timeOff, moves: r.moves, eqChanges: r.eqChanges || [], day: r.day, dirty: false });
    if (r.day?.board) {
      Object.assign(S, { board: normalize(r.day.board), version: r.day.version, isNew: false, banner: '' });
      const synced = syncEquipment(S.board, r.day.board.eqSyncAt || r.day.created, date);
      const dropped = dropRemovedPeople(S.board, date);
      if (synced.length || dropped) {
        if (synced.length) S.banner = `<b>Updated from the equipment app:</b> ${[...new Set(synced)].map(esc).join(', ')}.`;
        S.dirty = true;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, 600);
      }
    } else {
      const built = buildNewDay(date);
      Object.assign(S, { board: normalize(built.board), version: r.day?.version || 0, isNew: true, banner: built.msg });
    }
    render(true);
  } catch (e) {
    if (e.message === 'signed-out') return;
    C.app.innerHTML = `${topBar()}<main class="sd-loading"><div class="err">${esc(e.message)}</div><p><button class="sd-btn" data-go="schedule">Try again</button></p></main>`;
  }
}
async function goDate(date) {
  if (!DATE.test(date)) return;
  await flushSchedule();
  location.hash = `schedule/${date}`;
}

// ------------------------------------------------------------------ rendering
function topBar() {
  const me = C.me();
  const L = C.LINKS;
  const links = [
    ['Home', '#', false],
    ['Timecard', L.timecard, true],
    ['Vacation Requests', L.vacation, true],
    me.equipment && ['Equipment Viewer', L.equipment, true],
    me.pm && L.pmService && ['PM Service', L.pmService, true],
    me.calendarUrl && ['Vacation Calendar', me.calendarUrl, true],
  ].filter(Boolean);
  return `<header class="bar sd-bar"><div class="sd-wrap">
    <img class="logo" src="logo.svg" alt="Lyons &amp; Hohl">
    <h1>Daily Schedule</h1>
    <nav class="sd-apps" aria-label="Other apps">${links.map(([t, href, ext]) => (ext
      ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(t)}</a>`
      : `<a href="#" data-go="">${esc(t)}</a>`)).join('')}<span class="on">Daily Schedule</span></nav>
    <span class="spacer"></span>
    <button class="refresh" data-refresh aria-label="Refresh" title="Get the latest from Airtable">${C.I.refresh}</button>
  </div></header>`;
}

function render(first = false) {
  const side = $('.sd-side');
  const keep = { y: window.scrollY, side: side ? side.scrollTop : 0 };
  const tl = textList();
  const b = S.board;
  const addable = Object.values(S.jobs).filter((j) => j.active && !b.jobs.includes(j.id)).sort((x, y) => x.name.localeCompare(y.name));
  C.app.innerHTML = `${topBar()}
  <div class="sd-tools"><div class="sd-wrap">
    <div class="sd-datenav">
      <button class="sd-btn" data-day="-1" title="Previous workday" aria-label="Previous workday">◀</button>
      <label class="sd-date"><b>${esc(longDate(S.date))}</b><input type="date" id="sdDate" value="${S.date}"></label>
      <button class="sd-btn" data-day="1" title="Next workday" aria-label="Next workday">▶</button>
      ${isWeekend(S.date) ? '' : `<button class="sd-btn" id="sdSat" title="Go to ${esc(short(nextSaturday(S.date)))}">Sat</button>`}
    </div>
    <input type="search" id="sdQ" placeholder="Find a person or machine…" value="${esc(query)}">
    <span id="sdSave" class="sd-save">${esc(savedText())}</span>
    <span class="spacer"></span>
    <button class="sd-btn" id="sdHistory">History</button>
    <button class="sd-btn" id="sdTexts">Texts <span class="sd-count ${tl.some((t) => t.kind === 'txt') ? 'on' : ''}">${tl.filter((t) => t.kind === 'txt').length}</span></button>
    <button class="sd-btn primary" id="sdPublish">${S.day?.token && Date.parse(S.day.expires) > Date.now() ? 'Published ✓' : 'Publish'}</button>
  </div></div>
  ${S.banner ? `<div class="sd-wrap"><div class="sd-banner"><span>${S.banner}</span><button class="sd-link" id="sdBannerX">Dismiss</button></div></div>` : ''}
  <div class="sd-wrap sd-main">
    <section>
      <div class="sd-boardhead">
        <h2>Jobs <span>${b.jobs.length} on the board</span></h2>
        <select id="sdAddJob"><option value="">+ Add a job to this day…</option>${addable.map((j) => `<option value="${j.id}">${esc(j.name)}${j.number ? ` — ${esc(j.number)}` : ''}</option>`).join('')}</select>
      </div>
      <div class="sd-board">${b.jobs.map(jobCard).join('') || '<p class="sd-hint">No jobs on this day yet. Use “Add a job” above.</p>'}</div>
    </section>
    <aside class="sd-side">${sidebar()}</aside>
  </div>
  <div id="sdPrint" class="sd-print"></div>`;
  stackCards($('.sd-board'), 260, 12);
  wire();
  applySearch(false);
  if (!first) { window.scrollTo(0, keep.y); const s = $('.sd-side'); if (s) s.scrollTop = keep.side; }
}

function jobWarnings(jid) {
  const w = [];
  const crew = S.board.people[jid] || [];
  for (const a of crew) {
    const v = offOn(a.id);
    if (v) w.push({ red: !v.half, t: `${personName(a.id)} is on vacation${v.half ? ' part of the day' : ''}` });
    else if (requestedOn(a.id)) w.push({ t: `${personName(a.id)} asked for this day off (not approved yet)` });
  }
  if (jid !== 'LANDSCAPE' && crew.length >= 4 && !crew.some((a) => a.role === 'Foreman')) w.push({ t: 'No foreman' });
  for (const eid of S.board.equip[jid] || []) {
    const e = S.equip[eid];
    if (!e) continue;
    if (e.down) w.push({ red: true, t: `${e.label} is down for maintenance` });
    const other = equipLocs(S.board, eid).filter((l) => l !== jid);
    if (other.length) w.push({ red: true, t: `${e.label} is also at ${other.map(locName).join(', ')}` });
  }
  return w;
}

function jobCard(jid) {
  const j = S.jobs[jid] || { name: 'Job not in the list', number: '' };
  const b = S.board;
  const crew = b.people[jid] || [];
  const operated = new Set(crew.map((a) => a.machine).filter(Boolean));
  const eqs = sortEquipIds((b.equip[jid] || []).filter((e) => !operated.has(e) && S.equip[e]), S.equip);
  const haul = b.haul[jid] || [];
  const subs = b.subs[jid] || [];
  const warns = jobWarnings(jid);
  const note = b.jobNotes[jid];
  return `<div class="sd-job" data-job="${jid}">
    <div class="sd-job-h">
      <div class="r1"><b>${esc(j.name)}</b><span class="sd-num">${esc(j.number)}</span><button class="sd-x" data-rmjob="${jid}" title="Take this job off ${esc(short(S.date))}" aria-label="Remove job">×</button></div>
      <div class="meta">${j.supervisor ? `<span>Sup: ${esc(j.supervisor)}</span>` : ''}${j.address ? `<a href="${mapLink(j.address)}" target="_blank" rel="noopener" title="${esc(j.address)}">map</a>` : ''}<span>${crew.length} crew · ${(b.equip[jid] || []).length} equip</span><button class="sd-link" data-jobnote="${jid}">${note ? 'Edit note' : '+ Note'}</button></div>
      ${note ? `<div class="sd-jobnote">${esc(note)}</div>` : ''}
      ${warns.length ? `<div class="sd-warns">${warns.map((w) => `<div class="sd-warn ${w.red ? 'red' : ''}">${esc(w.t)}</div>`).join('')}</div>` : ''}
    </div>
    <div class="sd-zl">Crew</div>
    <div class="sd-zone" data-zone="people:${jid}">${crew.map((a) => personChip(a, jid)).join('') || '<div class="sd-empty">Drag people here</div>'}</div>
    <div class="sd-zl">Hired trucks</div>
    <div class="sd-zone haul" data-zone="haul:${jid}">${haul.map((h) => `<button class="sd-haul" data-haul="${jid}|${h.id}">${esc(haulText(h, S.haulers[h.hauler]?.name))}</button>`).join('') || '<div class="sd-empty">Drag a hauler here</div>'}</div>
    <div class="sd-zl">Subcontractors</div>
    <div class="sd-zone haul" data-zone="sub:${jid}">${subs.map((x) => `<button class="sd-haul sd-subline" data-subline="${jid}|${x.id}">${esc(subText(x, S.subs[x.sub]?.name))}</button>`).join('') || '<div class="sd-empty">Drag a subcontractor here</div>'}</div>
    <div class="sd-zl">Equipment</div>
    <div class="sd-zone eq" data-zone="equip:${jid}">${eqs.map((e) => eqChip(e, jid)).join('') || '<div class="sd-empty">Drag equipment here</div>'}</div>
  </div>`;
}

function personChip(a, loc) {
  const p = S.people[a.id] || { name: 'Former employee', position: '', cdl: [] };
  const v = offOn(a.id);
  const st = textStatus(a.id);
  let tag = '';
  if (v) tag = `<span class="tag vac">${v.half ? 'part day' : 'vacation'}</span>`;
  else if (st?.kind === 'txt') tag = `<span class="tag txt" title="Was: ${esc(st.was ? locName(st.was.loc) : 'not scheduled')}">txt</span>`;
  else if (st?.kind === 'sent') tag = '<span class="tag sent">sent ✓</span>';
  else if (st?.kind === 'same') tag = '<span class="tag same">same</span>';
  const mach = a.machine ? `<span class="mach">${esc(eqLabel(a.machine))}</span>`
    : (a.role === 'Operator' && isJob(loc) ? '<span class="mach sd-pickm">pick machine</span>' : '');
  const role = a.role && a.role !== 'Operator' ? `<span class="role">${esc(a.role)}</span>` : '';
  return `<div class="sd-chip r-${esc(a.role || 'x')} ${v && !v.half ? 'flag' : ''}" data-drag data-pid="${a.id}" data-loc="${loc}"
    title="${esc(p.full || p.name)} · ${esc(p.position)}${p.cdl?.length ? ` · ${esc(p.cdl.join(', '))}` : ''} — click to edit">
    <span class="nm">${esc(p.name)}</span>${role}${mach}${a.note ? `<span class="sd-pnote">${esc(a.note)}</span>` : ''}${tag}</div>`;
}
function poolChip(p) {
  const r = ROLES.includes(p.position) ? p.position : 'x';
  const req = requestedOn(p.id);
  const half = offOn(p.id);
  return `<div class="sd-chip r-${r}" data-drag data-pid="${p.id}" data-loc="POOL" title="${esc(p.full)} · ${esc(p.position)}">
    <span class="nm">${esc(p.name)}</span><span class="role">${esc(p.position)}</span>${half ? '<span class="tag vac">part day</span>' : req ? '<span class="tag req">asked off</span>' : ''}</div>`;
}
function eqChip(eid, loc) {
  const e = S.equip[eid];
  if (!e) return '';
  const dup = loc && equipLocs(S.board, eid).length > 1;
  const rental = /rental/i.test(e.type) || /^R-/.test(e.label);
  return `<span class="sd-eq ${rental ? 'rental' : ''} ${e.down ? 'down' : ''} ${dup ? 'dup' : ''}" data-drag data-eid="${eid}" data-loc="${loc || 'YARD'}"
    title="${esc([e.type, e.make, e.model].filter(Boolean).join(' · '))}${e.location ? ` · equipment app: ${esc(e.location)}` : ''}">${esc(e.label)}</span>`;
}

function panel(id, title, n, src, body) {
  return `<div class="sd-panel ${collapsed.has(id) ? 'collapsed' : ''}" data-panel="${id}">
    <h3>${title} <span class="n">${n ?? ''}</span>${src ? `<span class="src">${src}</span>` : ''}</h3><div class="body">${body}</div></div>`;
}

function sidebar() {
  const b = S.board;
  const today = S.timeOff.filter((t) => t.date === S.date && !t.requested);
  const asked = S.timeOff.filter((t) => t.date === S.date && t.requested);
  const upcoming = {};
  for (const t of S.timeOff.filter((x) => x.date > S.date)) (upcoming[t.person] = upcoming[t.person] || []).push(`${md(t.date)}${t.half ? '½' : ''}${t.requested ? '?' : ''}`);
  const vacBody = `<div class="sd-zone" data-zone="people:VACATION">${today.map((v) => `<div class="sd-row"><span>${esc(personName(v.person))}</span><span class="d">${v.half ? 'part day' : 'all day'}</span></div>`).join('') || '<div class="sd-empty">Nobody off</div>'}</div>
    ${asked.length ? `<div class="sd-sub">Asked off (not approved yet)</div>${asked.map((v) => `<div class="sd-row"><span>${esc(personName(v.person))}</span><span class="d">requested</span></div>`).join('')}` : ''}
    ${Object.keys(upcoming).length ? `<div class="sd-sub">Coming up</div>${Object.entries(upcoming).slice(0, 25).map(([pid, ds]) => `<div class="sd-row"><span>${esc(personName(pid))}</span><span class="d">${esc(ds.slice(0, 6).join(', '))}</span></div>`).join('')}` : ''}
    <div class="sd-hint">From the timecard app. ½ = part day, ? = requested.</div>`;

  const placed = new Set(Object.values(b.people).flat().map((a) => a.id));
  const pool = Object.values(S.people).filter((p) => p.include && !placed.has(p.id) && !fullDayOff(p.id))
    .sort((x, y) => (x.position + x.name).localeCompare(y.position + y.name));
  const dropped = droppedSincePrev();
  const poolBody = `${dropped.length ? `<div class="sd-alert">On ${esc(short(S.prev.date))} but not placed today: ${dropped.map((id) => esc(personName(id))).join(', ')}</div>` : ''}
    <div class="sd-zone" data-zone="people:POOL">${pool.map(poolChip).join('') || '<div class="sd-empty">Everyone is placed</div>'}</div>`;

  const zone = (loc) => `<div class="sd-zone" data-zone="people:${loc}">${(b.people[loc] || []).map((a) => personChip(a, loc)).join('') || '<div class="sd-empty">Drag people here</div>'}</div>`;

  const landCrew = b.people.LANDSCAPE || [];
  const landRun = new Set(landCrew.map((a) => a.machine).filter(Boolean));
  const landEq = sortEquipIds((b.equip.LANDSCAPE || []).filter((e) => !landRun.has(e) && S.equip[e]), S.equip);
  const landWarn = jobWarnings('LANDSCAPE');
  const landBody = `<div class="sd-landhead"><span class="sd-muted">${landCrew.length} crew · ${(b.equip.LANDSCAPE || []).length} equip</span><button class="sd-link" data-jobnote="LANDSCAPE">${b.jobNotes.LANDSCAPE ? 'Edit note' : '+ Note'}</button></div>
    ${b.jobNotes.LANDSCAPE ? `<div class="sd-jobnote">${esc(b.jobNotes.LANDSCAPE)}</div>` : ''}
    ${landWarn.length ? `<div class="sd-warns">${landWarn.map((w) => `<div class="sd-warn ${w.red ? 'red' : ''}">${esc(w.t)}</div>`).join('')}</div>` : ''}
    <div class="sd-sub">Crew</div>${zone('LANDSCAPE')}
    <div class="sd-sub">Equipment</div>
    <div class="sd-zone eq" data-zone="equip:LANDSCAPE">${landEq.map((e) => eqChip(e, 'LANDSCAPE')).join('') || '<div class="sd-empty">Drag equipment here</div>'}</div>`;

  // equipment moves: from the equipment app, and changes on this board since the last saved day
  const appMoves = S.moves.map((m) => `<div class="sd-row move"><span><b>${esc(m.equipment)}</b> ${esc(m.from)} → ${esc(m.to)}</span><span class="d">${esc([m.driver, m.status].filter(Boolean).join(' · '))}</span></div>`).join('');
  const inApp = new Set(S.moves.map((m) => m.equipment.toLowerCase()));
  // Where the equipment app last put each machine (its Change Log, else its Location field).
  const appLoc = {};
  for (const e of S.setup.equipment) appLoc[e.label.toLowerCase()] = e.job || 'YARD';
  for (const c of S.eqChanges || []) appLoc[c.equipment.toLowerCase()] = c.toJob || 'YARD';
  const boardMoves = [];
  if (S.prev) {
    for (const e of S.setup.equipment) {
      const now = equipLocs(b, e.id)[0] || 'YARD';
      const was = equipLocs(S.prev.board, e.id)[0] || 'YARD';
      const key = e.label.toLowerCase();
      // Already in the equipment app (today's Moves, or the app has it where the board has it): not a board-only move.
      if (now !== was && !inApp.has(key) && appLoc[key] !== now) boardMoves.push(`<div class="sd-row move"><span><b>${esc(e.label)}</b> ${esc(locName(was))} → ${esc(locName(now))}</span></div>`);
    }
  }
  const om = b.moves || [];
  const other = om.map((m, i) => `<div class="sd-mrow"><button class="sd-haul" data-move="${m.id}">${esc(otherMoveText(m))}</button>${om.length > 1 ? `<span class="sd-ord"><button class="sd-up" data-mup="${i}" title="Move up" aria-label="Move up"${i ? '' : ' disabled'}>▲</button><button class="sd-up" data-mdn="${i}" title="Move down" aria-label="Move down"${i < om.length - 1 ? '' : ' disabled'}>▼</button></span>` : ''}</div>`).join('');
  const movesBody = `${zone('DRIVERS')}
    <div class="sd-sub">Equipment moves (equipment app)</div>${appMoves || '<div class="sd-hint">None entered for this day.</div>'}
    ${boardMoves.length ? `<div class="sd-sub">Moved on this board, not in the equipment app</div>${boardMoves.join('')}<div class="sd-hint">Enter these in the equipment app so the drivers and the shop TV see them.</div>` : ''}
    <div class="sd-sub">Material / other moves</div>${other}<button class="sd-link add" id="sdAddMove">+ Add a move</button>`;

  const downIds = S.setup.equipment.filter((e) => e.down && !equipLocs(b, e.id).length).map((e) => e.id);
  const repairBody = `<div class="sd-zone eq" data-zone="equip:REPAIR">${sortEquipIds([...(b.equip.REPAIR || []), ...downIds], S.equip).map((e) => eqChip(e, 'REPAIR')).join('') || '<div class="sd-empty">Drag equipment here</div>'}</div>`;

  const placedEq = new Set(Object.values(b.equip).flat());
  // Only machines with TRACKING checked in the equipment table (the ones the equipment app follows).
  const inYard = S.setup.equipment.filter((e) => e.tracked && !placedEq.has(e.id) && !e.down);
  const types = [...new Set([...inYard].sort(byEquipmentType).map((e) => e.type).filter(Boolean))];
  const shown = [...inYard].sort(byEquipmentType).filter((e) => (!yard.type || e.type === yard.type) && (!yard.q || e.label.toLowerCase().includes(yard.q.toLowerCase())));
  const yardBody = `<div class="sd-yardtools"><input id="sdYardQ" placeholder="Filter yard…" value="${esc(yard.q)}">
    <select id="sdYardType"><option value="">All types</option>${types.map((t) => `<option ${t === yard.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
    <div class="sd-zone eq" data-zone="equip:YARD">${shown.map((e) => eqChip(e.id, null)).join('') || '<div class="sd-empty">Nothing matches</div>'}</div>`;

  const totals = {};
  for (const lines of Object.values(b.haul)) for (const h of lines || []) totals[h.hauler] = (totals[h.hauler] || 0) + (Number(h.trucks) || 0);
  const truckBody = `<div class="sd-hint">Drag a hauler onto a job, then fill in trucks and what they're hauling.</div>
    <div class="sd-zone eq">${S.setup.haulers.map((h) => `<span class="sd-hauler" data-drag data-hid="${h.id}">${esc(h.name)}${totals[h.id] ? ` <b>${totals[h.id]}</b>` : ''}</span>`).join('') || '<div class="sd-empty">Add haulers in Airtable: Vendors → Hired Trucks</div>'}</div>`;

  const subJobs = {};
  for (const lines of Object.values(b.subs)) for (const x of lines || []) subJobs[x.sub] = (subJobs[x.sub] || 0) + 1;
  const subBody = `<div class="sd-hint">Drag a subcontractor onto a job, then add a note.</div>
    <div class="sd-zone eq">${(S.setup.subs || []).map((x) => `<span class="sd-hauler sd-subc" data-drag data-sid="${x.id}">${esc(x.name)}${subJobs[x.id] ? ` <b>${subJobs[x.id]}</b>` : ''}</span>`).join('') || '<div class="sd-empty">Add subcontractors in Airtable: Vendors → Sub-Contractors</div>'}</div>`;

  return [
    panel('p-land', 'Landscaping Crew', landCrew.length, 'every day', landBody),
    panel('p-vac', 'Vacation', today.length, 'timecard app', vacBody),
    panel('p-pool', 'Not scheduled', pool.length, 'drag onto a job', poolBody),
    panel('p-off', 'Off', (b.people.OFF || []).length, '', zone('OFF')),
    panel('p-shop', 'Office / Shop', (b.people.SHOP || []).length, '', zone('SHOP')),
    panel('p-moves', 'Drivers / Moves', (b.people.DRIVERS || []).length, '', movesBody),
    panel('p-trucks', 'Hired trucks', Object.values(totals).reduce((x, y) => x + y, 0) || '', 'trucks today', truckBody),
    panel('p-subs', 'Subcontractors', Object.values(subJobs).reduce((x, y) => x + y, 0) || '', 'on jobs today', subBody),
    panel('p-repair', 'Repair', (b.equip.REPAIR || []).length + downIds.length, '', repairBody),
    panel('p-yard', 'Yard', inYard.length, 'not on a job', yardBody),
  ].join('');
}

// ------------------------------------------------------------------ changes to the board
function removePerson(pid) {
  const hit = locOf(S.board, pid);
  if (hit) S.board.people[hit.loc].splice(hit.i, 1);
  return hit;
}
function takeEquip(eid) {
  for (const [loc, l] of Object.entries(S.board.equip)) {
    const i = l.indexOf(eid);
    if (i >= 0) l.splice(i, 1);
    for (const a of S.board.people[loc] || []) if (a.machine === eid) a.machine = '';
  }
}
const defaultRole = (pid) => (ROLES.includes(S.people[pid]?.position) ? S.people[pid].position : '');

function movePerson(pid, toLoc, beforePid) {
  if (toLoc === 'VACATION') { toast('Vacations come from the timecard app. Enter time off there.'); return; }
  const old = removePerson(pid);
  if (toLoc === 'POOL') { changed(); return; }
  const a = old ? old.a : { id: pid, role: defaultRole(pid), machine: '', note: '' };
  const oldMachine = old && old.loc !== toLoc ? a.machine : '';
  if (old && old.loc !== toLoc) a.machine = '';
  if (!a.role && isJob(toLoc)) a.role = defaultRole(pid);
  const list = (S.board.people[toLoc] = S.board.people[toLoc] || []);
  const idx = beforePid ? list.findIndex((x) => x.id === beforePid) : -1;
  if (idx >= 0) list.splice(idx, 0, a); else list.push(a);
  changed();
  if (fullDayOff(pid)) toast(`Heads up: ${personName(pid)} is on vacation ${short(S.date)}.`);
  else if (oldMachine && isJob(toLoc) && S.equip[oldMachine]) {
    toast(`${personName(pid)} was running ${eqLabel(oldMachine)} at ${locName(old.loc)}.`, `Bring ${eqLabel(oldMachine)} too`, () => {
      takeEquip(oldMachine);
      (S.board.equip[toLoc] = S.board.equip[toLoc] || []).push(oldMachine);
      const hit = locOf(S.board, pid);
      if (hit) hit.a.machine = oldMachine;
      changed();
    });
  }
}
function moveEquip(eid, toLoc, ontoPid) {
  takeEquip(eid);
  if (toLoc !== 'YARD') (S.board.equip[toLoc] = S.board.equip[toLoc] || []).push(eid);
  if (ontoPid) {
    const hit = locOf(S.board, ontoPid);
    if (hit) { hit.a.machine = eid; if (!hit.a.role || hit.a.role === 'Laborer') hit.a.role = 'Operator'; }
  }
  changed();
}
function removeJob(jid) {
  const n = (S.board.people[jid] || []).length;
  const m = (S.board.equip[jid] || []).length;
  const h = (S.board.haul[jid] || []).length;
  const sc = (S.board.subs[jid] || []).length;
  if ((n || m || h || sc) && !window.confirm(`Take ${S.jobs[jid]?.name || 'this job'} off ${short(S.date)}?\n${n} people go back to "Not scheduled", ${m} pieces of equipment go to the Yard${h ? `, ${h} hired-truck lines are removed` : ''}${sc ? `, ${sc} subcontractor lines are removed` : ''}.`)) return;
  S.board.jobs = S.board.jobs.filter((j) => j !== jid);
  delete S.board.people[jid]; delete S.board.equip[jid]; delete S.board.haul[jid]; delete S.board.subs[jid]; delete S.board.jobNotes[jid];
  changed();
}

// ------------------------------------------------------------------ drag & drop (pointer events: mouse, touch, pen)
let drag = null;
function wire() {
  $$('.sd-panel').forEach((p) => {
    $('h3', p).addEventListener('click', () => {
      p.classList.toggle('collapsed');
      if (p.classList.contains('collapsed')) collapsed.add(p.dataset.panel); else collapsed.delete(p.dataset.panel);
    });
  });
  $$('[data-drag]').forEach((el) => el.addEventListener('pointerdown', startDrag));
  $$('[data-rmjob]').forEach((el) => el.addEventListener('click', () => removeJob(el.dataset.rmjob)));
  $$('[data-jobnote]').forEach((el) => el.addEventListener('click', () => editJobNote(el.dataset.jobnote)));
  $$('[data-haul]').forEach((el) => el.addEventListener('click', () => { const [jid, id] = el.dataset.haul.split('|'); editHaul(jid, id); }));
  $$('[data-subline]').forEach((el) => el.addEventListener('click', () => { const [jid, id] = el.dataset.subline.split('|'); editSub(jid, id); }));
  $$('[data-move]').forEach((el) => el.addEventListener('click', () => editOtherMove(el.dataset.move)));
  // Reorder material / other moves; the email, print and link list them in this order.
  const swapMoves = (i, j) => { const l = S.board.moves; if (!l?.[i] || !l?.[j]) return; [l[i], l[j]] = [l[j], l[i]]; changed(); };
  $$('[data-mup]').forEach((el) => el.addEventListener('click', () => swapMoves(+el.dataset.mup, +el.dataset.mup - 1)));
  $$('[data-mdn]').forEach((el) => el.addEventListener('click', () => swapMoves(+el.dataset.mdn, +el.dataset.mdn + 1)));
  $$('[data-day]').forEach((el) => el.addEventListener('click', () => goDate(addWorkdays(S.date, Number(el.dataset.day)))));
  $('#sdDate').addEventListener('change', (e) => goDate(e.target.value));
  $('#sdSat')?.addEventListener('click', () => goDate(nextSaturday(S.date)));
  $('#sdQ').addEventListener('input', (e) => { query = e.target.value; applySearch(true); });
  $('#sdAddJob').addEventListener('change', (e) => {
    const id = e.target.value;
    if (!id) return;
    addJob(id);
    changed();
  });
  $('#sdBannerX')?.addEventListener('click', () => { S.banner = ''; render(); });
  $('#sdAddMove')?.addEventListener('click', () => editOtherMove(null));
  $('#sdTexts').addEventListener('click', openTexts);
  $('#sdPublish').addEventListener('click', openPublish);
  $('#sdHistory').addEventListener('click', openHistory);
  const yq = $('#sdYardQ');
  if (yq) yq.addEventListener('input', () => { yard.q = yq.value; const pos = yq.selectionStart; render(); const n = $('#sdYardQ'); n.focus(); n.setSelectionRange(pos, pos); });
  $('#sdYardType')?.addEventListener('change', (e) => { yard.type = e.target.value; render(); });
}
function startDrag(e) {
  if (e.button !== 0) return;
  const el = e.currentTarget;
  e.preventDefault();
  const kind = el.dataset.pid ? 'person' : el.dataset.eid ? 'equip' : el.dataset.sid ? 'sub' : 'hauler';
  drag = { el, kind, id: el.dataset.pid || el.dataset.eid || el.dataset.sid || el.dataset.hid, from: el.dataset.loc, x0: e.clientX, y0: e.clientY, ghost: null, target: null };
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag, { once: true });
}
function moveDrag(e) {
  if (!drag) return;
  if (!drag.ghost) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    const r = drag.el.getBoundingClientRect();
    drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top;
    drag.ghost = drag.el.cloneNode(true);
    drag.ghost.classList.add('sd-ghost');
    drag.ghost.style.width = `${r.width}px`;
    document.body.appendChild(drag.ghost);
    drag.el.classList.add('dragging');
    document.body.classList.add('sd-dragging');
  }
  drag.ghost.style.left = `${e.clientX - drag.dx}px`;
  drag.ghost.style.top = `${e.clientY - drag.dy}px`;
  clearOver();
  drag.target = dropTarget(e.clientX, e.clientY);
  if (drag.target) {
    drag.target.zone.classList.add('over');
    if (drag.target.onto && drag.kind === 'equip') drag.target.onto.classList.add('drop-on');
  }
}
function dropTarget(x, y) {
  const under = document.elementFromPoint(x, y);
  const zone = under?.closest('[data-zone]');
  if (!zone) return null;
  const [kind, loc] = zone.dataset.zone.split(':');
  const onto = under.closest('.sd-chip[data-pid]');
  const ok = (drag.kind === 'person' && kind === 'people')
    || (drag.kind === 'equip' && kind === 'equip')
    || (drag.kind === 'hauler' && kind === 'haul')
    || (drag.kind === 'sub' && kind === 'sub')
    || (drag.kind === 'equip' && kind === 'people' && isJob(loc) && onto);
  return ok ? { zone, kind, loc, onto } : null;
}
function endDrag() {
  window.removeEventListener('pointermove', moveDrag);
  document.body.classList.remove('sd-dragging');
  const d = drag; drag = null;
  if (!d) return;
  clearOver();
  if (!d.ghost) {                                  // a click, not a drag
    if (d.kind === 'person' && d.from !== 'POOL') editPerson(d.id);
    return;
  }
  d.ghost.remove();
  d.el.classList.remove('dragging');
  const t = d.target;
  if (!t) return;
  const ontoPid = t.onto && t.onto.dataset.pid !== d.id ? t.onto.dataset.pid : null;
  if (d.kind === 'person') movePerson(d.id, t.loc, ontoPid);
  else if (d.kind === 'hauler') editHaul(t.loc, null, d.id);
  else if (d.kind === 'sub') editSub(t.loc, null, d.id);
  else if (t.kind === 'equip') moveEquip(d.id, t.loc);
  else moveEquip(d.id, t.loc, ontoPid);
}
function clearOver() {
  $$('.over').forEach((z) => z.classList.remove('over'));
  $$('.drop-on').forEach((z) => z.classList.remove('drop-on'));
}

function applySearch(scroll) {
  const q = query.trim().toLowerCase();
  $$('.sd-chip, .sd-eq').forEach((el) => {
    el.classList.remove('dim', 'hit');
    if (q) el.classList.add(el.textContent.toLowerCase().includes(q) ? 'hit' : 'dim');
  });
  if (q && scroll) $('.sd-main .hit')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ------------------------------------------------------------------ dialogs
function modal(html) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'sd-modal';
  back.innerHTML = `<div class="sd-card" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) closeModal(); });
  document.body.appendChild(back);
  return back;
}
function closeModal() { $('.sd-modal')?.remove(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

let toastTimer;
function toast(msg, actionLabel, action) {
  let t = $('#sdToast');
  if (!t) { t = document.createElement('div'); t.id = 'sdToast'; t.className = 'sd-toast'; document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button class="sd-btn">${esc(actionLabel)}</button>` : ''}`;
  t.hidden = false;
  if (actionLabel) $('button', t).addEventListener('click', () => { t.hidden = true; action(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, actionLabel ? 9000 : 4500);
}
const quick = (target) => `<div class="sd-quick">${QUICK_NOTES.map((q) => `<button type="button" class="sd-pill" data-quick="${esc(q)}" data-target="${target}">${esc(q)}</button>`).join('')}</div>`;
function wireQuick(back) {
  $$('[data-quick]', back).forEach((b) => b.addEventListener('click', () => {
    const f = $(`#${b.dataset.target}`, back);
    f.value = f.value ? `${f.value.replace(/\.?\s*$/, '')}. ${b.dataset.quick}` : b.dataset.quick;
    f.focus();
  }));
}

function editPerson(pid) {
  const hit = locOf(S.board, pid);
  if (!hit) return;
  const p = S.people[pid] || { name: 'Former employee', full: '', position: '', cdl: [] };
  const a = hit.a;
  const machines = (S.board.equip[hit.loc] || []).map((e) => S.equip[e]).filter(Boolean).sort(byEquipmentType);
  const back = modal(`<h3>${esc(p.name)} <span class="sd-muted">${esc(p.full)}</span></h3>
    <p class="sd-muted">${esc(locName(hit.loc))} · ${esc(p.position || '—')}${p.cdl?.length ? ` · ${esc(p.cdl.join(', '))}` : ''}</p>
    <label class="sd-field">Where ${esc(p.name)} works<select id="eWhere">${whereOptions(hit.loc)}</select></label>
    <label class="sd-field">Role today<select id="eRole"><option value="">—</option>${ROLES.map((r) => `<option ${r === a.role ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    ${isJob(hit.loc) ? `<label class="sd-field">Machine (equipment at this job)<select id="eMach"><option value="">—</option>${machines.map((e) => `<option value="${e.id}" ${e.id === a.machine ? 'selected' : ''}>${esc(e.label)}${e.type ? ` · ${esc(e.type)}` : ''}</option>`).join('')}</select></label>` : ''}
    <label class="sd-field">Note for ${esc(p.name)} (goes in their text and on the sheet)<input id="eNote" value="${esc(a.note || '')}" maxlength="200" placeholder="e.g. pick up the laser at the shop first"></label>
    ${quick('eNote')}
    <div class="sd-btns"><span class="left"><button class="sd-btn" id="eOff">Move to Off</button><button class="sd-btn" id="eRm">Unschedule</button></span>
      <button class="sd-btn" data-close>Cancel</button><button class="sd-btn primary" id="eSave">Save</button></div>`);
  wireQuick(back);
  $('#eSave', back).addEventListener('click', () => {
    a.role = $('#eRole', back).value;
    if ($('#eMach', back)) a.machine = $('#eMach', back).value;
    a.note = $('#eNote', back).value.trim();
    const where = $('#eWhere', back).value;
    closeModal();
    if (where === hit.loc) { changed(); return; }
    if (where.startsWith('add:')) addJob(where.slice(4));
    movePerson(pid, where.replace(/^add:/, ''));
  });
  $('#eOff', back).addEventListener('click', () => { closeModal(); movePerson(pid, 'OFF'); });
  $('#eRm', back).addEventListener('click', () => { closeModal(); movePerson(pid, 'POOL'); });
  $('#eNote', back).focus();
}

function whereOptions(current) {
  const b = S.board;
  const opt = (v, t) => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(t)}</option>`;
  const onBoard = b.jobs.map((j) => opt(j, `${S.jobs[j]?.name || 'Job'}${S.jobs[j]?.number ? ` — ${S.jobs[j].number}` : ''}`)).join('');
  const others = Object.values(S.jobs).filter((j) => j.active && !b.jobs.includes(j.id)).sort((x, y) => x.name.localeCompare(y.name))
    .map((j) => opt(`add:${j.id}`, `${j.name}${j.number ? ` — ${j.number}` : ''}`)).join('');
  return `<optgroup label="Jobs on this day">${onBoard}</optgroup>
    <optgroup label="Crews and other">${opt('LANDSCAPE', 'Landscaping Crew')}${opt('OFF', 'Off')}${opt('SHOP', 'Office / Shop')}${opt('DRIVERS', 'Drivers / Moves')}${opt('POOL', 'Not scheduled')}</optgroup>
    ${others ? `<optgroup label="Add another job to this day">${others}</optgroup>` : ''}`;
}
function addJob(id) {
  if (!S.board.jobs.includes(id)) S.board.jobs.push(id);
  S.board.people[id] = S.board.people[id] || [];
  S.board.equip[id] = S.board.equip[id] || [];
}
function editJobNote(jid) {
  const back = modal(`<h3>Note for ${esc(locName(jid))}</h3>
    <p class="sd-muted">Goes on the text of everyone at this job and on the printed / emailed schedule.</p>
    <label class="sd-field">Note<textarea id="jNote" maxlength="300" rows="3">${esc(S.board.jobNotes[jid] || '')}</textarea></label>
    ${quick('jNote')}
    <div class="sd-btns"><span class="left"><button class="sd-btn" id="jClear">Clear note</button></span><button class="sd-btn" data-close>Cancel</button><button class="sd-btn primary" id="jSave">Save</button></div>`);
  wireQuick(back);
  const set = (v) => { if (v) S.board.jobNotes[jid] = v; else delete S.board.jobNotes[jid]; closeModal(); changed(); };
  $('#jSave', back).addEventListener('click', () => set($('#jNote', back).value.trim()));
  $('#jClear', back).addEventListener('click', () => set(''));
  $('#jNote', back).focus();
}

function editSub(jid, lineId, subId) {
  const lines = (S.board.subs[jid] = S.board.subs[jid] || []);
  const x = lines.find((y) => y.id === lineId) || { id: uid(), sub: subId || '', note: '' };
  const isNew = !lines.includes(x);
  const back = modal(`<h3>Subcontractor · ${esc(S.jobs[jid]?.name || '')}</h3>
    <div class="sd-grid2">
      <label class="sd-field">Subcontractor<select id="sS">${(S.setup.subs || []).map((y) => `<option value="${y.id}" ${y.id === x.sub ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}</select></label>
      <label class="sd-field wide">Note<input id="sNote" value="${esc(x.note)}" maxlength="200" placeholder="what they're doing, start time, who to meet…"></label>
    </div>
    <div class="sd-btns">${isNew ? '' : '<span class="left"><button class="sd-btn" id="sRm">Remove</button></span>'}<button class="sd-btn" data-close>Cancel</button><button class="sd-btn primary" id="sSave">Save</button></div>`);
  $('#sSave', back).addEventListener('click', () => {
    Object.assign(x, { sub: $('#sS', back).value, note: $('#sNote', back).value.trim() });
    if (isNew) lines.push(x);
    closeModal(); changed();
  });
  $('#sRm', back)?.addEventListener('click', () => { S.board.subs[jid] = lines.filter((y) => y !== x); closeModal(); changed(); });
  $('#sNote', back).focus();
}

function editHaul(jid, lineId, haulerId) {
  const lines = (S.board.haul[jid] = S.board.haul[jid] || []);
  const h = lines.find((x) => x.id === lineId) || { id: uid(), hauler: haulerId || '', trucks: 1, kind: 'Tri-axle', material: '', from: '', to: '', time: '', note: '' };
  const isNew = !lines.includes(h);
  const back = modal(`<h3>Hired trucks · ${esc(S.jobs[jid]?.name || '')}</h3>
    <div class="sd-grid2">
      <label class="sd-field">Hauler<select id="hH">${S.setup.haulers.map((x) => `<option value="${x.id}" ${x.id === h.hauler ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="sd-field">How many trucks<input id="hN" type="number" min="1" max="40" value="${esc(h.trucks)}"></label>
      <label class="sd-field">Truck type<select id="hK">${TRUCK_KINDS.map((k) => `<option ${k === h.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="sd-field">Start time<input id="hT" value="${esc(h.time)}" placeholder="7:00"></label>
      <label class="sd-field">Hauling<input id="hM" value="${esc(h.material)}" placeholder="2A modified, spoils, RCP…"></label>
      <label class="sd-field">From<input id="hF" value="${esc(h.from)}" placeholder="Martin Stone / site"></label>
      <label class="sd-field">To<input id="hTo" value="${esc(h.to)}" placeholder="site / dump"></label>
      <label class="sd-field">Note<input id="hNote" value="${esc(h.note)}" maxlength="200"></label>
    </div>
    <div class="sd-btns">${isNew ? '' : '<span class="left"><button class="sd-btn" id="hRm">Remove</button></span>'}<button class="sd-btn" data-close>Cancel</button><button class="sd-btn primary" id="hSave">Save</button></div>`);
  $('#hSave', back).addEventListener('click', () => {
    Object.assign(h, {
      hauler: $('#hH', back).value, trucks: Math.max(1, Math.min(40, Number($('#hN', back).value) || 1)), kind: $('#hK', back).value,
      time: $('#hT', back).value.trim(), material: $('#hM', back).value.trim(), from: $('#hF', back).value.trim(), to: $('#hTo', back).value.trim(), note: $('#hNote', back).value.trim(),
    });
    if (isNew) lines.push(h);
    closeModal(); changed();
  });
  $('#hRm', back)?.addEventListener('click', () => { S.board.haul[jid] = lines.filter((x) => x !== h); closeModal(); changed(); });
  $('#hN', back).focus();
}

function editOtherMove(id) {
  const list = (S.board.moves = S.board.moves || []);
  const m = list.find((x) => x.id === id) || { id: uid(), what: '', from: '', to: '', by: '', time: '', note: '' };
  const isNew = !list.includes(m);
  const drivers = (S.board.people.DRIVERS || []).map((a) => personName(a.id));
  const back = modal(`<h3>Material / other move</h3>
    <p class="sd-muted">Things the equipment app doesn't track: pipe, stone, forms, a container… Kept with this day only.</p>
    <div class="sd-grid2">
      <label class="sd-field wide">What<input id="mW" value="${esc(m.what)}" placeholder="20 pcs 15&quot; RCP"></label>
      <label class="sd-field">From<input id="mF" value="${esc(m.from)}"></label>
      <label class="sd-field">To<input id="mT" value="${esc(m.to)}"></label>
      <label class="sd-field">Who moves it<input id="mB" value="${esc(m.by)}" list="mBy" placeholder="driver or hauler"><datalist id="mBy">${[...drivers, ...S.setup.haulers.map((h) => h.name)].map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <label class="sd-field">Time<input id="mTi" value="${esc(m.time)}"></label>
      <label class="sd-field wide">Note<input id="mN" value="${esc(m.note)}" maxlength="200"></label>
    </div>
    <div class="sd-btns">${isNew ? '' : '<span class="left"><button class="sd-btn" id="mRm">Remove</button></span>'}<button class="sd-btn" data-close>Cancel</button><button class="sd-btn primary" id="mSave">Save</button></div>`);
  $('#mSave', back).addEventListener('click', () => {
    const what = $('#mW', back).value.trim();
    if (!what) { $('#mW', back).focus(); return; }
    Object.assign(m, { what, from: $('#mF', back).value.trim(), to: $('#mT', back).value.trim(), by: $('#mB', back).value.trim(), time: $('#mTi', back).value.trim(), note: $('#mN', back).value.trim() });
    if (isNew) list.push(m);
    closeModal(); changed();
  });
  $('#mRm', back)?.addEventListener('click', () => { S.board.moves = list.filter((x) => x !== m); closeModal(); changed(); });
  $('#mW', back).focus();
}

// ------------------------------------------------------------------ texts
function foremanAt(loc, pid) {
  const f = (S.board.people[loc] || []).find((a) => a.role === 'Foreman' && a.id !== pid);
  return f ? personName(f.id).replace(/\.$/, '') : '';
}
// Machines sometimes change on site without the office knowing, so the text calls it the planned machine.
function plannedMachine(a) {
  const m = a.machine && S.equip[a.machine];
  if (!m) return '';
  return a.role === 'Foreman' ? ` Planned machine: ${m.label}.` : ` Planned machine: ${m.label}. Check with your foreman.`;
}
function draftText(t) {
  const when = short(S.date);
  const a = t.a;
  const note = a.note ? ` ${a.note.replace(/\.?$/, '.')}` : '';
  if (t.loc === 'OFF') return `L&H: You are OFF ${when}.${note}`;
  if (t.loc === 'SHOP') return `L&H: ${when} report to the shop.${note}`;
  if (t.loc === 'DRIVERS') {
    const mv = driverMoves(t.pid);
    return `L&H: ${when} you're driving.${mv ? ` Moves: ${mv}.` : ' Check the equipment app for moves.'}${note}`;
  }
  if (t.loc === 'LANDSCAPE') {
    const lf = a.role === 'Foreman' ? ' You are running the crew.' : (foremanAt(t.loc, t.pid) ? ` Foreman: ${foremanAt(t.loc, t.pid)}.` : '');
    const lr = plannedMachine(a);
    const ln = S.board.jobNotes.LANDSCAPE ? ` ${S.board.jobNotes.LANDSCAPE.replace(/\.?$/, '.')}` : '';
    return `L&H: ${when} you're on the Landscaping Crew.${lf}${lr}${ln}${note}`;
  }
  const j = S.jobs[t.loc] || { name: 'the job' };
  const num = j.number && /^\d/.test(j.number) ? ` (${j.number})` : '';
  const where = j.address ? ` ${j.address.replace(/\.?$/, '.')}` : '';
  const fm = a.role === 'Foreman' ? ' You are running the crew.' : (foremanAt(t.loc, t.pid) ? ` Foreman: ${foremanAt(t.loc, t.pid)}.` : '');
  const run = plannedMachine(a);
  const jn = S.board.jobNotes[t.loc] ? ` ${S.board.jobNotes[t.loc].replace(/\.?$/, '.')}` : '';
  return `L&H: ${when} you're at ${j.name}${num}.${where}${fm}${run}${jn}${note}`;
}
function whyText(t) {
  if (!t.was) return `not scheduled → ${locName(t.loc)}`;
  if (t.was.loc !== t.loc) return `${locName(t.was.loc)} → ${locName(t.loc)}`;
  if (t.now.note !== t.was.note) return `${locName(t.loc)} · their note changed`;
  return t.loc === 'DRIVERS' ? 'Drivers · moves for the day' : `${locName(t.loc)} · job note changed`;
}
async function openTexts() {
  if (!compareBoard()) {
    modal(`<h3>Texts</h3><p>There's no saved day before ${esc(short(S.date))} to compare with, so nobody is flagged yet. Starting with the next day, anyone whose spot or note changes gets a <b>txt</b> tag.</p><div class="sd-btns"><button class="sd-btn primary" data-close>OK</button></div>`);
    return;
  }
  const list = textList();
  const dropped = droppedSincePrev();
  const back = modal(`<h3>Texts for ${esc(longDate(S.date))}</h3>
    <p class="sd-muted">${isWeekend(S.date) ? 'Everyone working this day.' : `Everyone whose job, note or job note changed since ${esc(short(S.prev.date))}.`} Edit any message, then send. Texts go through TextMagic to the person's TextMagic contact (or their cell in Airtable).</p>
    ${S.setup.textsReady ? '' : '<div class="err">Texts are not set up yet: add TEXTMAGIC_USERNAME and TEXTMAGIC_API_KEY in Netlify.</div>'}
    ${dropped.length ? `<div class="sd-alert">Not on this day's schedule (no text drafted): ${dropped.map((id) => esc(personName(id))).join(', ')}</div>` : ''}
    ${list.map((t, i) => `<div class="sd-msg ${t.kind === 'sent' ? 'done' : ''}">
      <div class="top"><label><input type="checkbox" data-i="${i}" ${t.kind === 'txt' ? 'checked' : ''}> <b>${esc(personName(t.pid))}</b></label>
        <span class="sd-muted">${esc(whyText(t))}</span>
        <span class="st">${t.kind === 'sent' ? `sent ${esc(clock(t.at))}` : ''}</span></div>
      <textarea data-i="${i}" rows="3">${esc(draftText(t))}</textarea></div>`).join('') || '<p>Nobody changed spots. No texts needed.</p>'}
    <div id="tResult"></div>
    <div class="sd-btns"><button class="sd-btn" data-close>Close</button>${list.length && S.setup.textsReady ? '<button class="sd-btn primary" id="tSend">Send checked texts</button>' : ''}</div>`);
  $('#tSend', back)?.addEventListener('click', async (e) => {
    const picks = $$('.sd-msg input:checked', back).map((c) => {
      const t = list[Number(c.dataset.i)];
      return { id: t.pid, key: t.key, text: $(`textarea[data-i="${c.dataset.i}"]`, back).value.trim() };
    });
    if (!picks.length) return;
    e.target.disabled = true; e.target.textContent = 'Sending…';
    try {
      if (S.isNew) S.dirty = true;
      await saveNow();
      const r = await C.api(`schedule/texts?date=${S.date}`, { method: 'POST', body: { messages: picks } });
      S.board.sent = r.day.board.sent || {}; S.version = r.day.version; S.day = r.day; S.isNew = false;
      const bad = r.results.filter((x) => !x.ok);
      closeModal(); render();
      toast(`${r.results.length - bad.length} text${r.results.length - bad.length === 1 ? '' : 's'} sent.${bad.length ? ` Not sent: ${bad.map((x) => `${x.name || '?'} (${x.why})`).join(', ')}` : ''}`);
    } catch (err) {
      if (err.message === 'signed-out') return;
      e.target.disabled = false; e.target.textContent = 'Send checked texts';
      $('#tResult', back).innerHTML = `<div class="err">${esc(err.message)}</div>`;
    }
  });
}

// ------------------------------------------------------------------ publish: email, print, link
function viewData() {
  const vac = S.timeOff.filter((t) => t.date === S.date && !t.requested).map((t) => ({ person: t.person, half: t.half }));
  return { date: S.date, board: S.board, people: S.people, jobs: S.jobs, equipment: S.equip, haulers: S.haulers, subs: S.subs, vacation: vac, eqMoves: S.moves };
}
async function copyForEmail() {
  const d = viewData();
  const html = dayHtml(d, 'email');
  const text = dayText(d);
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
    return 'Copied. Paste it into the body of an Outlook email (Ctrl/⌘ + V).';
  } catch {
    try { await navigator.clipboard.writeText(text); return 'Copied as plain text (this browser would not copy the formatted version).'; } catch { return 'This browser would not copy. Try Chrome or Edge.'; }
  }
}
function printDay() {
  $('#sdPrint').innerHTML = dayHtml(viewData(), 'print');
  window.print();
}
function linkState() {
  const d = S.day;
  if (!d?.token) return { live: false, text: 'Not published yet.' };
  const exp = Date.parse(d.expires);
  if (!(exp > Date.now())) return { live: false, text: `The last link expired ${clock(d.expires)}.` };
  return { live: true, url: `${location.origin}/day.html?k=${d.token}`, text: `Link works until ${clock(d.expires)}.${d.textedAt ? ` Texted ${clock(d.textedAt)}.` : ''}` };
}
function openPublish() {
  const ls = linkState();
  const n = S.setup.linkPeople;
  const back = modal(`<h3>Publish ${esc(longDate(S.date))}</h3>
    <div class="sd-pub">
      <div class="sd-pubrow"><div><b>Email</b><p class="sd-muted">Copies the schedule, formatted for phones and computers. Paste it into an Outlook email to your usual list.</p></div><button class="sd-btn" id="pEmail">Copy for email</button></div>
      <div class="sd-pubrow"><div><b>Print or PDF</b><p class="sd-muted">Opens the print window. Choose “Save as PDF” to make a PDF.</p></div><button class="sd-btn" id="pPrint">Print / PDF</button></div>
      <div class="sd-pubrow"><div><b>Link for phones</b><p class="sd-muted">A read-only page anyone with the link can open, no sign-in. Works for ${4} days after you first publish. ${esc(ls.text)}</p>
        ${ls.live ? `<p class="sd-linkbox"><a href="${esc(ls.url)}" target="_blank" rel="noopener">${esc(ls.url)}</a></p>` : ''}</div>
        <div class="sd-col">
          <button class="sd-btn primary" id="pText" ${S.setup.textsReady && n ? '' : 'disabled'}>Text link to ${n} ${n === 1 ? 'person' : 'people'}</button>
          <button class="sd-btn" id="pLink">${ls.live ? 'Copy link' : 'Make link (no texts)'}</button>
          ${ls.live ? '<button class="sd-btn" id="pOff">Turn off link</button>' : ''}
        </div></div>
    </div>
    <p class="sd-muted small">"Daily Schedule" is checked for these ${n} people in the Employee List. Change who gets it there.</p>
    <div id="pResult"></div>
    <div class="sd-btns"><button class="sd-btn" data-close>Close</button></div>`);
  const result = (html) => { $('#pResult', back).innerHTML = html; };
  $('#pEmail', back).addEventListener('click', async () => result(`<div class="sd-ok">${esc(await copyForEmail())}</div>`));
  $('#pPrint', back).addEventListener('click', () => { closeModal(); printDay(); });
  const doPublish = async (textLink, btn) => {
    btn.disabled = true;
    try {
      if (S.isNew) S.dirty = true;
      await saveNow();
      if (S.dirty) throw new Error('Could not save this day. Try again.');
      const r = await C.api(`schedule/publish?date=${S.date}`, { method: 'POST', body: { textLink } });
      S.day = { ...S.day, ...r.day }; S.version = r.day.version;
      render();
      openPublish();
      const extra = r.texted ? `Texted ${r.texted.sent.length}.${r.texted.failed.length ? ` Not sent: ${r.texted.failed.map(esc).join(', ')}.` : ''}` : '';
      try { if (!textLink) await navigator.clipboard.writeText(r.url); } catch { /* ignore */ }
      $('#pResult').innerHTML = `<div class="sd-ok">${textLink ? '' : 'Link copied. '}${extra}</div>`;
    } catch (err) {
      if (err.message === 'signed-out') return;
      btn.disabled = false;
      result(`<div class="err">${esc(err.message)}</div>`);
    }
  };
  $('#pText', back).addEventListener('click', (e) => {
    if (window.confirm(`Text the link for ${short(S.date)} to ${n} people now?`)) doPublish(true, e.currentTarget);
  });
  $('#pLink', back).addEventListener('click', async (e) => {
    if (ls.live) { try { await navigator.clipboard.writeText(ls.url); result('<div class="sd-ok">Link copied.</div>'); } catch { result(`<div class="sd-ok">${esc(ls.url)}</div>`); } return; }
    doPublish(false, e.currentTarget);
  });
  $('#pOff', back)?.addEventListener('click', async () => {
    if (!window.confirm('Turn off the link? Anyone who opens it will see "not valid".')) return;
    try {
      const r = await C.api(`schedule/unpublish?date=${S.date}`, { method: 'POST' });
      S.day = { ...S.day, ...r.day }; render(); openPublish();
    } catch (err) { if (err.message !== 'signed-out') result(`<div class="err">${esc(err.message)}</div>`); }
  });
}

async function openHistory() {
  const back = modal(`<h3>History · ${esc(longDate(S.date))}</h3><div id="hBody"><p class="sd-muted">Loading…</p></div><div class="sd-btns"><button class="sd-btn" data-close>Close</button></div>`);
  try {
    const { log } = await C.api(`schedule/log?date=${S.date}`);
    $('#hBody', back).innerHTML = log.length
      ? log.map((l) => `<div class="sd-log"><div class="sd-muted">${esc(clock(l.when))} · ${esc(l.who)}</div><div>${l.change.split('\n').map(esc).join('<br>')}</div></div>`).join('')
      : '<p>No changes saved for this day yet.</p>';
  } catch (err) { if (err.message !== 'signed-out') $('#hBody', back).innerHTML = `<div class="err">${esc(err.message)}</div>`; }
}
