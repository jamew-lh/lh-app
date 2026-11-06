// Daily Schedule (crew scheduler): data, saving, texts and the shared link.
// Editors only (SCHEDULE.editors in config). The board itself is built in public/schedule.js;
// the server stores it as JSON in the Daily Schedules base, one row per day.
import { randomBytes } from 'node:crypto';
import { SCHEDULE as SC, EMPLOYEES as E, TIME_ZONE } from './config.mjs';
import { listAll, createRecord, updateRecord, HttpError } from './airtable.mjs';
import { jobs as allJobs, cached, str, splitName, norm } from './store.mjs';
import { toE164, textMagicConfigured } from './textmagic.mjs';

export const canSchedule = (p) => !!p && SC.editors.includes(p.id);
const requireEditor = (p) => { if (!canSchedule(p)) throw new HttpError(403, 'Only schedule editors can open the Daily Schedule.'); };

// ---------------------------------------------------------------- dates
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function checkDate(d) {
  if (!DATE.test(String(d || '')) || Number.isNaN(Date.parse(`${d}T12:00:00Z`))) throw new HttpError(400, 'Pick a date.');
  return d;
}
const toDate = (s) => new Date(`${s}T12:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
const isWeekday = (s) => ![0, 6].includes(toDate(s).getUTCDay());
export function addWorkdays(s, n) {
  const d = toDate(s);
  const step = Math.sign(n) || 1;
  let left = Math.abs(n);
  while (left > 0) { d.setUTCDate(d.getUTCDate() + step); if (isWeekday(iso(d))) left -= 1; }
  return iso(d);
}
const fmtDay = (s) => toDate(s).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const fmtWhen = (ms) => new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE });

// ---------------------------------------------------------------- people
const PF = SC.people;
const PEOPLE_FIELDS = [E.f.name, E.f.status, E.f.location, E.f.position, E.f.cell, E.f.endorsements, PF.scheduleName, PF.include, PF.getsLink, PF.textMagicId];

/** Every current employee, with the schedule fields. Phone numbers stay on the server. */
export async function schedulePeople(env, fetchImpl) {
  return cached('sched-people', async () => {
    const recs = await listAll(E.base, E.table, PEOPLE_FIELDS, env, fetchImpl);
    return recs.map((r) => {
      const f = r.fields || {};
      const n = splitName(f[E.f.name]);
      const short = str(f[PF.scheduleName]) || `${n.first.split(' ')[0]} ${n.last.slice(0, 1)}.`.trim();
      return {
        id: r.id, name: short, full: n.display, sortName: str(f[E.f.name]),
        status: str(f[E.f.status]), position: str(f[E.f.position]),
        include: !!f[PF.include], getsLink: !!f[PF.getsLink],
        cdl: (f[E.f.endorsements] || []).map(str).filter((x) => x && x !== 'Standard DL'),
        tm: str(f[PF.textMagicId]), cell: str(f[E.f.cell]),
      };
    }).filter((p) => p.sortName && E.allowStatus.includes(p.status));
  });
}
const clientPerson = ({ id, name, full, position, include, cdl }) => ({ id, name, full, position, include, cdl });

// ---------------------------------------------------------------- jobs ↔ equipment app locations
export function locationMatcher(jobList) {
  const byName = new Map(jobList.map((j) => [norm(j.name), j.id]));
  const ids = new Set(jobList.map((j) => j.id));
  return (loc) => {
    const name = str(loc);
    if (!name) return '';
    if (ids.has(SC.locationToJob[name])) return SC.locationToJob[name];
    const n = norm(name);
    if (!n) return '';
    if (byName.has(n)) return byName.get(n);
    if (n.length < 4) return '';
    const hit = jobList.find((j) => j.active && norm(j.name).startsWith(n));
    return hit ? hit.id : '';
  };
}
async function scheduleJobs(env, fetchImpl) {
  return (await allJobs(env, fetchImpl)).map((j) => ({
    id: j.id, name: j.name, number: j.number, active: j.active, supervisor: j.supervisor, address: j.address,
  }));
}

// ---------------------------------------------------------------- equipment, haulers
const Q = SC.equipment;
export async function equipment(env, fetchImpl) {
  return cached('sched-equipment', async () => {
    const recs = await listAll(Q.base, Q.table, Object.values(Q.f), env, fetchImpl);
    const match = locationMatcher(await scheduleJobs(env, fetchImpl));
    return recs.map((r) => {
      const f = r.fields || {};
      const status = str(f[Q.f.status]);
      return {
        id: r.id, label: str(f[Q.f.id]), type: str(f[Q.f.type]), status,
        down: Q.downStatus.includes(status), location: str(f[Q.f.location]), job: match(f[Q.f.location]),
        make: str(f[Q.f.make]), model: str(f[Q.f.model]),
      };
    }).filter((e) => e.label && !Q.hideStatus.includes(e.status))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  });
}

const H = SC.haulers;
export async function haulers(env, fetchImpl) {
  return cached('sched-haulers', async () => {
    let recs;
    try { recs = await listAll(H.base, H.table, Object.values(H.f), env, fetchImpl); }
    catch (e) { if (/cannot read/i.test(e.message)) e.message = 'The app cannot open the Hired Trucks table. In Airtable, check the L&H App token has the Vendors base.'; throw e; }
    return recs.map((r) => ({ id: r.id, name: str(r.fields?.[H.f.name]) }))
      .filter((h) => h.name).sort((a, b) => a.name.localeCompare(b.name));
  });
}

// ---------------------------------------------------------------- time off (timecard app)
const T = SC.timeOff;
/** Weekdays off between from and to (inclusive): [{ person, date, half, requested }]. Denied entries are left out. */
export async function timeOff(from, to, env, fetchImpl) {
  const recs = await cached('sched-timeoff', async () => {
    try { return await listAll(T.base, T.table, Object.values(T.f), env, fetchImpl); }
    catch (e) { if (/cannot read/i.test(e.message)) e.message = 'The app cannot read vacations. In Airtable, add the Timecards base to the L&H App token.'; throw e; }
  });
  const out = [];
  for (const r of recs) {
    const f = r.fields || {};
    const status = str(f[T.f.status]).toLowerCase();
    if (status === 'denied') continue;
    const person = str(f[T.f.employee]);
    const start = str(f[T.f.from]).slice(0, 10);
    const end = str(f[T.f.to]).slice(0, 10) || start;
    if (!person || !DATE.test(start) || end < from || start > to) continue;
    const hours = Number(f[T.f.hours]);
    const half = Number.isFinite(hours) && hours > 0 && hours < T.fullDayHours;
    for (let d = toDate(start < from ? from : start); iso(d) <= end && iso(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      if (isWeekday(iso(d))) out.push({ person, date: iso(d), half, requested: status === 'requested' });
    }
  }
  return out;
}

// ---------------------------------------------------------------- equipment moves (equipment app)
const M = SC.moves;
export async function movesOn(date, env, fetchImpl) {
  return cached(`sched-moves-${date}`, async () => {
    let recs;
    try {
      recs = await listAll(M.base, M.table, Object.values(M.f), env, fetchImpl,
        { filterByFormula: `DATETIME_FORMAT({Date}, 'YYYY-MM-DD') = '${date}'` });
    } catch (e) { if (/cannot read/i.test(e.message)) e.message = 'The app cannot read equipment moves. In Airtable, add the LH Equipment base to the L&H App token.'; throw e; }
    const match = locationMatcher(await scheduleJobs(env, fetchImpl));
    return recs.map((r) => {
      const f = r.fields || {};
      return {
        id: r.id, equipment: str(f[M.f.equipment]), type: str(f[M.f.type]), status: str(f[M.f.status]),
        from: str(f[M.f.from]), to: str(f[M.f.to]), fromJob: match(f[M.f.from]), toJob: match(f[M.f.to]),
        truck: str(f[M.f.truck]), driver: str(f[M.f.driver]),
      };
    }).filter((m) => m.equipment && m.status.toLowerCase() !== 'n/a');
  }, Date.now(), 1);
}

// ---------------------------------------------------------------- equipment app location changes
const CH = SC.changes;
/** Location changes made in the equipment app over the last few weeks, oldest first. */
export async function equipmentChanges(env, fetchImpl) {
  return cached('sched-eqchanges', async () => {
    let recs;
    try {
      recs = await listAll(CH.base, CH.table, Object.values(CH.f), env, fetchImpl,
        { filterByFormula: `AND({Change} = 'Location', IS_AFTER({When}, DATEADD(TODAY(), -${CH.days}, 'days')))` });
    } catch (e) { if (/cannot read/i.test(e.message)) e.message = 'The app cannot read the equipment Change Log. In Airtable, add the LH Equipment base to the L&H App token.'; throw e; }
    const match = locationMatcher(await scheduleJobs(env, fetchImpl));
    return recs
      .filter((r) => str(r.fields?.[CH.f.change]) === 'Location')
      .map((r) => {
        const f = r.fields || {};
        return { equipment: str(f[CH.f.equipment]), to: str(f[CH.f.to]), toJob: match(f[CH.f.to]), when: str(f[CH.f.when]) };
      })
      .filter((c) => c.equipment && c.when)
      .sort((a, b) => a.when.localeCompare(b.when));
  }, Date.now(), 1);
}

// ---------------------------------------------------------------- saved days
const D = SC.days;
const DAY_FIELDS = Object.values(D.f);
function shapeDay(r) {
  const f = r.fields || {};
  let board = null;
  try { board = JSON.parse(f[D.f.board] || 'null'); } catch { board = null; }
  return {
    rec: r.id, created: str(r.createdTime), date: str(f[D.f.date]), board, version: Number(f[D.f.version]) || 0,
    updatedAt: str(f[D.f.updatedAt]), updatedBy: str(f[D.f.updatedBy]), publishedAt: str(f[D.f.publishedAt]),
    token: str(f[D.f.token]), expires: str(f[D.f.expires]), textedAt: str(f[D.f.textedAt]),
  };
}
const quote = (s) => `'${String(s).replace(/[^0-9A-Za-z_-]/g, '')}'`;
async function findDays(dates, env, fetchImpl) {
  if (!dates.length) return [];
  const formula = dates.length === 1 ? `{Date} = ${quote(dates[0])}` : `OR(${dates.map((d) => `{Date} = ${quote(d)}`).join(', ')})`;
  const recs = await listAll(D.base, D.table, DAY_FIELDS, env, fetchImpl, { filterByFormula: formula });
  return recs.map(shapeDay).filter((d) => dates.includes(d.date));
}
async function findDay(date, env, fetchImpl) {
  const all = await findDays([date], env, fetchImpl);
  // If two rows ever share a date, the newest version wins.
  return all.sort((a, b) => b.version - a.version)[0] || null;
}
const publicDay = (d) => d && ({
  created: d.created, date: d.date, board: d.board, version: d.version, updatedAt: d.updatedAt, updatedBy: d.updatedBy,
  publishedAt: d.publishedAt, token: d.token, expires: d.expires, textedAt: d.textedAt,
});

/** Everything the editor needs once: people, jobs, equipment, haulers. */
export async function setup(viewer, env, fetchImpl) {
  requireEditor(viewer);
  const [people, jobList, eq, hl] = await Promise.all([
    schedulePeople(env, fetchImpl), scheduleJobs(env, fetchImpl), equipment(env, fetchImpl), haulers(env, fetchImpl),
  ]);
  return {
    people: people.map(clientPerson), jobs: jobList, equipment: eq, haulers: hl,
    linkPeople: people.filter((p) => p.getsLink).length,
    textsReady: textMagicConfigured(env),
  };
}

/** One day: the saved board (or null), the latest saved day before it, time off around it, and equipment moves. */
export async function getDay(date, viewer, env, fetchImpl) {
  requireEditor(viewer);
  checkDate(date);
  const before = Array.from({ length: 10 }, (_, i) => addWorkdays(date, -(i + 1)));
  const [found, prior, off, moves, eqChanges] = await Promise.all([
    findDay(date, env, fetchImpl),
    findDays(before, env, fetchImpl),
    timeOff(addWorkdays(date, -10), addWorkdays(date, 15), env, fetchImpl),
    movesOn(date, env, fetchImpl),
    equipmentChanges(env, fetchImpl),
  ]);
  const prev = prior.filter((d) => d.board).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  return { day: publicDay(found), prev: prev && { date: prev.date, board: prev.board, created: prev.created }, timeOff: off, moves, eqChanges };
}

// ---------------------------------------------------------------- saving + change log
const MAX_BOARD = 95000; // Airtable long text holds 100,000 characters
export function cleanBoard(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new HttpError(400, 'Nothing to save.');
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const out = {
    jobs: Array.isArray(b.jobs) ? b.jobs.filter((x) => typeof x === 'string') : [],
    people: obj(b.people), equip: obj(b.equip), jobNotes: obj(b.jobNotes), haul: obj(b.haul),
    moves: Array.isArray(b.moves) ? b.moves : [], sent: obj(b.sent),
    eqSyncAt: typeof b.eqSyncAt === 'string' ? b.eqSyncAt.slice(0, 40) : '',
  };
  if (JSON.stringify(out).length > MAX_BOARD) throw new HttpError(413, 'This day is too big to save. Remove some notes and try again.');
  return out;
}

/** Plain-English list of what changed, for the Schedule Log. */
export function describeChanges(oldB, newB, names = {}) {
  const lines = [];
  const nm = (k, id) => names[k]?.[id] || id;
  const where = (b, kind, id) => {
    for (const [loc, list] of Object.entries(b?.[kind] || {})) {
      if ((list || []).some((x) => (kind === 'people' ? x?.id : x) === id)) return loc;
    }
    return '';
  };
  const place = (loc) => ({ OFF: 'Off', SHOP: 'Office / Shop', DRIVERS: 'Drivers / Moves', REPAIR: 'Repair', '': 'not scheduled' }[loc] || nm('jobs', loc));
  if (!oldB) lines.push('Started this day.');
  const ids = (b, kind) => new Set(Object.values(b?.[kind] || {}).flat().map((x) => (kind === 'people' ? x?.id : x)).filter(Boolean));
  for (const kind of ['people', 'equip']) {
    const all = new Set([...ids(oldB, kind), ...ids(newB, kind)]);
    for (const id of all) {
      const a = oldB ? where(oldB, kind, id) : '';
      const b = where(newB, kind, id);
      const off = kind === 'equip' ? 'Yard' : 'not scheduled';
      if (oldB && a !== b) lines.push(`${nm(kind === 'people' ? 'people' : 'equipment', id)}: ${a ? place(a) : off} → ${b ? place(b) : off}`);
    }
  }
  const oj = new Set(oldB?.jobs || []), nj = new Set(newB.jobs || []);
  for (const j of nj) if (oldB && !oj.has(j)) lines.push(`Added job ${nm('jobs', j)}`);
  for (const j of oj) if (!nj.has(j)) lines.push(`Took off job ${nm('jobs', j)}`);
  for (const j of new Set([...Object.keys(oldB?.jobNotes || {}), ...Object.keys(newB.jobNotes || {})])) {
    if ((oldB?.jobNotes?.[j] || '') !== (newB.jobNotes?.[j] || '') && oldB) lines.push(`Job note for ${nm('jobs', j)}: "${newB.jobNotes?.[j] || '(cleared)'}"`);
  }
  const haulText = (b) => JSON.stringify(b?.haul || {});
  if (oldB && haulText(oldB) !== haulText(newB)) lines.push('Changed hired trucks');
  if (oldB && JSON.stringify(oldB.moves || []) !== JSON.stringify(newB.moves || [])) lines.push('Changed material / other moves');
  if (oldB && lines.length === 0) lines.push('Changed roles, machines or notes');
  return lines;
}

async function nameLookup(env, fetchImpl) {
  const [people, jobList, eq] = await Promise.all([schedulePeople(env, fetchImpl), scheduleJobs(env, fetchImpl), equipment(env, fetchImpl)]);
  return {
    people: Object.fromEntries(people.map((p) => [p.id, p.name])),
    jobs: Object.fromEntries(jobList.map((j) => [j.id, j.name])),
    equipment: Object.fromEntries(eq.map((e) => [e.id, e.label])),
  };
}

async function writeLog(date, who, lines, env, fetchImpl) {
  if (!lines.length) return;
  const L = SC.log;
  try {
    await createRecord(L.base, L.table, {
      [L.f.title]: `${date} · ${who}`, [L.f.day]: date, [L.f.when]: new Date().toISOString(), [L.f.who]: who,
      [L.f.change]: lines.join('\n').slice(0, 20000),
    }, env, fetchImpl);
  } catch (e) { console.error('Schedule log not written', e.message); }
}

async function writeDay(date, found, fields, env, fetchImpl) {
  return found
    ? shapeDay(await updateRecord(D.base, D.table, found.rec, fields, env, fetchImpl))
    : shapeDay(await createRecord(D.base, D.table, { [D.f.date]: date, ...fields }, env, fetchImpl));
}

/** Save a day. `version` must match what the editor loaded, so two editors can't overwrite each other. */
export async function saveDay(date, body, viewer, env, fetchImpl) {
  requireEditor(viewer);
  checkDate(date);
  const board = cleanBoard(body?.board);
  const found = await findDay(date, env, fetchImpl);
  const have = found?.version || 0;
  if (Number(body?.version || 0) !== have) {
    return { conflict: true, day: publicDay(found) };
  }
  const saved = await writeDay(date, found, {
    [D.f.board]: JSON.stringify(board), [D.f.version]: have + 1,
    [D.f.updatedAt]: new Date().toISOString(), [D.f.updatedBy]: viewer.name,
  }, env, fetchImpl);
  const lines = describeChanges(found?.board || null, board, await nameLookup(env, fetchImpl));
  await writeLog(date, viewer.name, lines, env, fetchImpl);
  return { day: publicDay(saved) };
}

export async function getLog(date, viewer, env, fetchImpl) {
  requireEditor(viewer);
  checkDate(date);
  const L = SC.log;
  const recs = await listAll(L.base, L.table, Object.values(L.f), env, fetchImpl, { filterByFormula: `{Day} = ${quote(date)}` });
  return recs.map((r) => ({ when: str(r.fields?.[L.f.when]), who: str(r.fields?.[L.f.who]), change: str(r.fields?.[L.f.change]) }))
    .filter((x) => x.when).sort((a, b) => b.when.localeCompare(a.when)).slice(0, 100);
}

// ---------------------------------------------------------------- texts
async function textOne(person, text, env, fetchImpl) {
  const body = { text };
  if (/^\d+$/.test(person.tm)) body.contacts = person.tm;          // the TextMagic contact (preferred)
  else if (toE164(person.cell)) body.phones = toE164(person.cell);  // fall back to the cell in Airtable
  else return { ok: false, why: 'no cell number' };
  const res = await fetchImpl('https://rest.textmagic.com/api/v2/messages', {
    method: 'POST',
    headers: { 'X-TM-Username': env.TEXTMAGIC_USERNAME, 'X-TM-Key': env.TEXTMAGIC_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('TextMagic', res.status, t.slice(0, 200));
    return { ok: false, why: 'TextMagic did not accept it' };
  }
  return { ok: true, via: body.contacts ? 'TextMagic contact' : 'cell in Airtable' };
}

/** Send crew texts. body.messages: [{ id: personId, text, key }]. Marks each sent person on the saved day. */
export async function sendCrewTexts(date, body, viewer, env, fetchImpl) {
  requireEditor(viewer);
  checkDate(date);
  if (!textMagicConfigured(env)) throw new HttpError(500, 'Texts are not set up: TEXTMAGIC_USERNAME and TEXTMAGIC_API_KEY are missing in Netlify.');
  const msgs = (Array.isArray(body?.messages) ? body.messages : []).slice(0, 150);
  if (!msgs.length) throw new HttpError(400, 'Pick at least one person.');
  const found = await findDay(date, env, fetchImpl);
  if (!found?.board) throw new HttpError(409, 'Save this day before sending texts.');
  const people = new Map((await schedulePeople(env, fetchImpl)).map((p) => [p.id, p]));
  const results = [];
  for (const m of msgs) {
    const p = people.get(m.id);
    const text = String(m.text || '').trim().slice(0, 640);
    if (!p || !text) { results.push({ id: m.id, ok: false, why: 'not found' }); continue; }
    results.push({ id: m.id, name: p.name, ...(await textOne(p, text, env, fetchImpl)) });
  }
  // Re-read so a save that happened while texting isn't lost, then mark who was texted.
  const now = new Date().toISOString();
  const latest = await findDay(date, env, fetchImpl);
  const board = latest.board || {};
  board.sent = board.sent || {};
  for (const r of results) if (r.ok) board.sent[r.id] = { key: String(msgs.find((m) => m.id === r.id)?.key || ''), at: now };
  const saved = await writeDay(date, latest, {
    [D.f.board]: JSON.stringify(board), [D.f.version]: latest.version + 1, [D.f.updatedAt]: now, [D.f.updatedBy]: viewer.name,
  }, env, fetchImpl);
  const okNames = results.filter((r) => r.ok).map((r) => r.name);
  await writeLog(date, viewer.name, okNames.length ? [`Texted: ${okNames.join(', ')}`] : [], env, fetchImpl);
  return { results, day: publicDay(saved) };
}

// ---------------------------------------------------------------- publish + shared link
const newToken = () => randomBytes(18).toString('base64url');

export async function publish(date, body, viewer, origin, env, fetchImpl, now = Date.now()) {
  requireEditor(viewer);
  checkDate(date);
  const found = await findDay(date, env, fetchImpl);
  if (!found?.board) throw new HttpError(409, 'Save this day before publishing.');
  const live = found.token && Date.parse(found.expires) > now;
  const fields = { [D.f.publishedAt]: new Date(now).toISOString() };
  if (!live) {
    fields[D.f.token] = newToken();
    fields[D.f.expires] = new Date(now + SC.shareDays * 86400000).toISOString();
  }
  let day = await writeDay(date, found, fields, env, fetchImpl);
  const url = `${origin}/day.html?k=${day.token}`;
  let texted = null;
  if (body?.textLink) {
    if (!textMagicConfigured(env)) throw new HttpError(500, 'Texts are not set up: TEXTMAGIC_USERNAME and TEXTMAGIC_API_KEY are missing in Netlify.');
    const list = (await schedulePeople(env, fetchImpl)).filter((p) => p.getsLink);
    const msg = `L&H schedule for ${fmtDay(date)}: ${url}  (link works until ${fmtWhen(Date.parse(day.expires))})`;
    const results = [];
    for (const p of list) results.push({ name: p.name, ...(await textOne(p, msg, env, fetchImpl)) });
    texted = { sent: results.filter((r) => r.ok).map((r) => r.name), failed: results.filter((r) => !r.ok).map((r) => `${r.name} (${r.why})`) };
    day = await writeDay(date, day, { [D.f.textedAt]: new Date(now).toISOString() }, env, fetchImpl);
    await writeLog(date, viewer.name, [`Texted the schedule link to ${texted.sent.length} people`], env, fetchImpl);
  } else {
    await writeLog(date, viewer.name, ['Published'], env, fetchImpl);
  }
  return { url, day: publicDay(day), texted };
}

export async function unpublish(date, viewer, env, fetchImpl) {
  requireEditor(viewer);
  checkDate(date);
  const found = await findDay(date, env, fetchImpl);
  if (!found) throw new HttpError(404, 'Nothing saved for that day.');
  const day = await writeDay(date, found, { [D.f.token]: '', [D.f.expires]: null }, env, fetchImpl);
  await writeLog(date, viewer.name, ['Turned off the shared link'], env, fetchImpl);
  return { day: publicDay(day) };
}

/** The no-sign-in page. Only names, jobs and equipment: no phone numbers. */
export async function sharedDay(token, env, fetchImpl, now = Date.now()) {
  const t = String(token || '');
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(t)) throw new HttpError(404, 'This link is not valid.');
  const recs = await listAll(D.base, D.table, DAY_FIELDS, env, fetchImpl, { filterByFormula: `{Share Token} = ${quote(t)}` });
  const day = recs.map(shapeDay).find((d) => d.token === t);
  if (!day?.board) throw new HttpError(404, 'This link is not valid.');
  if (!(Date.parse(day.expires) > now)) throw new HttpError(410, 'This link has expired. Ask the office for the latest schedule.');
  const b = day.board;
  const [people, jobList, eq, hl] = await Promise.all([
    schedulePeople(env, fetchImpl), scheduleJobs(env, fetchImpl), equipment(env, fetchImpl), haulers(env, fetchImpl),
  ]);
  const onBoard = new Set(Object.values(b.people || {}).flat().map((a) => a?.id));
  const eqOn = new Set(Object.values(b.equip || {}).flat());
  const off = await timeOff(day.date, day.date, env, fetchImpl);
  const strip = { ...b }; delete strip.sent;
  return {
    date: day.date, updatedAt: day.updatedAt, expires: day.expires, board: strip,
    people: people.filter((p) => onBoard.has(p.id) || off.some((o) => o.person === p.id)).map(({ id, name }) => ({ id, name })),
    jobs: jobList.filter((j) => (b.jobs || []).includes(j.id)),
    equipment: eq.filter((e) => eqOn.has(e.id)).map(({ id, label, type }) => ({ id, label, type })),
    haulers: hl,
    vacation: off.filter((o) => !o.requested).map(({ person, half }) => ({ person, half })),
  };
}
