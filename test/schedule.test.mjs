import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../lib/app.mjs';
import { clearCache, resetForceFresh } from '../lib/store.mjs';
import { resetThrottle } from '../lib/auth.mjs';
import { describeChanges, addWorkdays } from '../lib/schedule.mjs';
import { dayHtml, dayText } from '../public/schedule-view.js';
import { fakeFetch, addScheduleCrew } from './fake-airtable.mjs';

addScheduleCrew();

const BASE = 'https://lhapp.test';
let env; let f;
beforeEach(() => {
  clearCache(); resetThrottle(); resetForceFresh();
  env = { AIRTABLE_TOKEN: 'patTEST', SESSION_SECRET: 'z'.repeat(32), TEXTMAGIC_USERNAME: 'lh', TEXTMAGIC_API_KEY: 'k' };
  f = fakeFetch();
});
async function call(method, path, { body, cookie } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await handle(new Request(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), { env, fetchImpl: f });
  return { status: res.status, data: await res.json() };
}
async function login(lastName, pin) {
  const res = await handle(new Request(`${BASE}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lastName, pin }) }), { env, fetchImpl: f });
  assert.equal(res.status, 200);
  return { cookie: res.headers.get('set-cookie').split(';')[0], person: (await res.json()).person };
}
const editor = () => login('Woodard', '6060');
const D = '2026-11-10';
const board = (extra = {}) => ({
  jobs: ['recJOB0000000006'],
  people: { recJOB0000000006: [{ id: 'recEMP0000000003', role: 'Foreman' }, { id: 'recEMP0000000002', role: 'Operator', machine: 'recEQP0000000001' }], OFF: [], SHOP: [], DRIVERS: [] },
  equip: { recJOB0000000006: ['recEQP0000000001', 'recEQP0000000002'], REPAIR: [] },
  jobNotes: {}, haul: {}, moves: [], sent: {}, ...extra,
});

test('only the schedule editors can open the Daily Schedule', async () => {
  assert.equal((await editor()).person.schedule, true);
  assert.equal((await login('Arment', '8080')).person.schedule, true);
  const office = await login('Walker', '1234');
  assert.equal(office.person.schedule, false);
  assert.equal((await call('GET', '/api/schedule/setup', { cookie: office.cookie })).status, 403);
  assert.equal((await call('GET', `/api/schedule/day?date=${D}`, { cookie: office.cookie })).status, 403);
  assert.equal((await call('PUT', `/api/schedule/day?date=${D}`, { cookie: office.cookie, body: { board: board(), version: 0 } })).status, 403);
  assert.equal((await call('GET', '/api/schedule/setup')).status, 401);
});

test('setup: people with schedule names and no phone numbers, equipment placed at jobs', async () => {
  const { cookie } = await editor();
  const r = await call('GET', '/api/schedule/setup', { cookie });
  assert.equal(r.status, 200);
  const tony = r.data.people.find((p) => p.id === 'recEMP0000000002');
  assert.equal(tony.name, 'Tony R.');
  assert.equal(tony.include, true);
  assert.equal(r.data.people.find((p) => p.id === 'recEMP0000000001').name, 'James W.');  // no Schedule Name → first + initial
  assert.ok(!JSON.stringify(r.data.people).includes('555-01'), 'no phone numbers sent to the browser');
  assert.ok(!r.data.people.some((p) => p.id === 'recEMP0000000004'), 'past employees left out');
  const eq = Object.fromEntries(r.data.equipment.map((e) => [e.label, e]));
  assert.equal(eq['336-06'].job, 'recJOB0000000006');        // "Sadsbury" → Sadsbury job
  assert.equal(eq['730-06'].job, 'recJOB0000000011');        // "Southern berks" → Southern Berks
  assert.equal(eq['938-09'].job, '');                        // HB Shop → Yard
  assert.equal(eq['323-01'].down, true);
  assert.equal(eq['938-09'].tracked, true);
  assert.equal(eq['Old Plate'].tracked, false);
  assert.ok(!eq['Old Dozer'], 'sold equipment left out');
  assert.deepEqual(r.data.haulers.map((h) => h.name), ['Leary', 'Quarry - Martin Stone', 'Risbon']);
  assert.equal(r.data.linkPeople, 3);
});

test('day: vacations from the timecard app (approved, half day, requested; denied ignored) and equipment moves', async () => {
  const { cookie } = await editor();
  const r = await call('GET', `/api/schedule/day?date=${D}`, { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.data.day, null);
  const on = r.data.timeOff.filter((t) => t.date === D);
  assert.deepEqual(on.find((t) => t.person === 'recEMP0000000022'), { person: 'recEMP0000000022', date: D, half: false, requested: false });
  assert.equal(on.find((t) => t.person === 'recEMP0000000023').half, true);
  assert.ok(!on.some((t) => t.person === 'recEMP0000000024'), 'denied is left out');
  assert.equal(r.data.timeOff.find((t) => t.person === 'recEMP0000000027').requested, true);
  assert.equal(r.data.moves.length, 1);
  assert.equal(r.data.moves[0].equipment, '938-09');
  assert.equal(r.data.moves[0].toJob, 'recJOB0000000006');
  assert.equal((await call('GET', '/api/schedule/day?date=nope', { cookie })).status, 400);
});

test('day: machines moved in the equipment app (Change Log "Location"), oldest first, mapped to jobs', async () => {
  const { cookie } = await editor();
  const r = await call('GET', `/api/schedule/day?date=${D}`, { cookie });
  assert.deepEqual(r.data.eqChanges.map((c) => [c.equipment, c.toJob]), [['CS54-01', 'recJOB0000000006'], ['349-03', '']]);
  assert.ok(r.data.eqChanges[0].when < r.data.eqChanges[1].when);
  // a saved day reports when it was created and keeps its sync point
  await call('PUT', `/api/schedule/day?date=${D}`, { cookie, body: { board: board({ eqSyncAt: '2026-11-06T14:48:53.170Z' }), version: 0 } });
  const again = await call('GET', `/api/schedule/day?date=${D}`, { cookie });
  assert.ok(again.data.day.created);
  assert.equal(again.data.day.board.eqSyncAt, '2026-11-06T14:48:53.170Z');
});

test('saving: versions stop two editors overwriting each other, and changes are logged', async () => {
  const a = await editor();
  const b = await login('Arment', '8080');
  const s1 = await call('PUT', `/api/schedule/day?date=${D}`, { cookie: a.cookie, body: { board: board(), version: 0 } });
  assert.equal(s1.status, 200);
  assert.equal(s1.data.day.version, 1);
  assert.equal(s1.data.day.updatedBy, 'James L. Woodard');
  // Bob saves on top of version 1
  const moved = board({ people: { recJOB0000000006: [{ id: 'recEMP0000000003', role: 'Foreman' }], OFF: [{ id: 'recEMP0000000002' }], SHOP: [], DRIVERS: [] } });
  assert.equal((await call('PUT', `/api/schedule/day?date=${D}`, { cookie: b.cookie, body: { board: moved, version: 1 } })).data.day.version, 2);
  // James still has version 1 open: refused, gets Bob's version back
  const stale = await call('PUT', `/api/schedule/day?date=${D}`, { cookie: a.cookie, body: { board: board(), version: 1 } });
  assert.equal(stale.data.conflict, true);
  assert.equal(stale.data.day.version, 2);
  assert.equal(stale.data.day.updatedBy, 'Leon R. Arment');
  const log = await call('GET', `/api/schedule/log?date=${D}`, { cookie: a.cookie });
  assert.equal(log.data.log.length, 2);
  assert.match(log.data.log.map((l) => l.change).join('\n'), /Tony R\.: Sadsbury → Off/);
  // the next workday sees this one as "previous"
  const next = await call('GET', `/api/schedule/day?date=${addWorkdays(D, 1)}`, { cookie: a.cookie });
  assert.equal(next.data.prev.date, D);
});

test('crew texts go to the TextMagic contact (or the cell), and mark people as sent', async () => {
  const { cookie } = await editor();
  assert.equal((await call('POST', `/api/schedule/texts?date=${D}`, { cookie, body: { messages: [{ id: 'recEMP0000000002', text: 'hi' }] } })).status, 409);
  await call('PUT', `/api/schedule/day?date=${D}`, { cookie, body: { board: board(), version: 0 } });
  const r = await call('POST', `/api/schedule/texts?date=${D}`, { cookie, body: { messages: [
    { id: 'recEMP0000000002', text: 'Tue 11/10 you are at Sadsbury', key: 'k1' },
    { id: 'recEMP0000000009', text: 'Tue 11/10 you are at Sadsbury', key: 'k2' },
  ] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(f.texts.map((t) => t.contacts || t.phones), ['5550002', '16105550109']);
  assert.equal(r.data.day.board.sent.recEMP0000000002.key, 'k1');
  assert.equal(r.data.day.version, 2);
});

test('publish: a no-sign-in link that lasts 4 days, keeps its link when re-published, and can be turned off', async () => {
  const { cookie } = await editor();
  await call('PUT', `/api/schedule/day?date=${D}`, { cookie, body: { board: board({ sent: { x: {} } }), version: 0 } });
  const p = await call('POST', `/api/schedule/publish?date=${D}`, { cookie, body: { textLink: true } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  const token = p.data.day.token;
  assert.match(p.data.url, /^https:\/\/lhapp\.test\/day\.html\?k=[\w-]{20,}$/);
  const days = (Date.parse(p.data.day.expires) - Date.now()) / 86400000;
  assert.ok(days > 3.99 && days <= 4, `expires in ${days} days`);
  assert.equal(p.data.texted.sent.length, 3);                          // everyone with Daily Schedule checked
  assert.ok(f.texts.every((t) => t.text.includes(token)));
  const again = await call('POST', `/api/schedule/publish?date=${D}`, { cookie, body: {} });
  assert.equal(again.data.day.token, token);
  assert.equal(again.data.day.expires, p.data.day.expires);
  // anyone with the link, no sign-in
  const s = await call('GET', `/api/share?k=${token}`);
  assert.equal(s.status, 200);
  assert.equal(s.data.date, D);
  assert.ok(s.data.people.some((x) => x.name === 'Tony R.'));
  assert.ok(!JSON.stringify(s.data).match(/555-01|5550002|cell/), 'no phone numbers on the shared page');
  assert.equal(s.data.board.sent, undefined);
  assert.equal((await call('GET', '/api/share?k=wrongwrongwrongwrongwrong')).status, 404);
  await call('POST', `/api/schedule/unpublish?date=${D}`, { cookie });
  assert.equal((await call('GET', `/api/share?k=${token}`)).status, 404);
});

test('an expired link says so', async () => {
  const { cookie } = await editor();
  await call('PUT', `/api/schedule/day?date=${D}`, { cookie, body: { board: board(), version: 0 } });
  const p = await call('POST', `/api/schedule/publish?date=${D}`, { cookie, body: {} });
  const rec = [...f.days.values()][0];
  rec.fields[Object.keys(rec.fields).find((k) => rec.fields[k] === p.data.day.expires)] = new Date(Date.now() - 1000).toISOString();
  const s = await call('GET', `/api/share?k=${p.data.day.token}`);
  assert.equal(s.status, 410);
  assert.match(s.data.error, /expired/);
});

test('change log wording', () => {
  const names = { people: { p1: 'Tom C.' }, jobs: { j1: 'Valley Creek', j2: 'TOA III' }, equipment: { e1: 'D5-01' } };
  const a = { jobs: ['j1', 'j2'], people: { j1: [{ id: 'p1' }] }, equip: { j1: ['e1'] } };
  const b = { jobs: ['j1', 'j2'], people: { j2: [{ id: 'p1' }] }, equip: {}, jobNotes: { j2: 'Start 6:30' } };
  assert.deepEqual(describeChanges(a, b, names), ['Tom C.: Valley Creek → TOA III', 'D5-01: Valley Creek → Yard', 'Job note for TOA III: "Start 6:30"']);
  assert.deepEqual(describeChanges(b, { ...b, equip: { j2: ['e1'] } }, names), ['D5-01: Yard → TOA III']);
  const land = { ...b, people: { LANDSCAPE: [{ id: 'p1' }] }, jobNotes: { j2: 'Start 6:30', LANDSCAPE: 'Mulch at Gray Farm' } };
  assert.deepEqual(describeChanges(b, land, names), ['Tom C.: TOA III → Landscaping Crew', 'Job note for Landscaping Crew: "Mulch at Gray Farm"']);
  assert.deepEqual(describeChanges(null, b, names), ['Started this day.']);
});

test('workdays skip weekends', () => {
  assert.equal(addWorkdays('2026-11-06', 1), '2026-11-09');
  assert.equal(addWorkdays('2026-11-09', -1), '2026-11-06');
  assert.equal(addWorkdays('2026-11-10', -3), '2026-11-05');
});

test('email / print / link: equipment moves listed under their driver, others after', () => {
  const d = {
    date: '2026-11-09',
    board: { jobs: [], people: { DRIVERS: [{ id: 'p1' }] }, equip: {}, moves: [{ what: '20 pcs RCP', from: 'Shop', to: 'Odessa' }] },
    people: { p1: { name: 'Jared E.' } }, jobs: {}, equipment: {}, haulers: {}, vacation: [],
    eqMoves: [
      { equipment: '349-02', from: 'TOA 3', to: '1201 Colllegeville', driver: 'Jared E', truck: '01-08', status: 'Scheduled' },
      { equipment: '335-01', from: 'Brandywine Walk', to: 'Sadsbury', driver: 'Blair', truck: 'Blair', status: 'Scheduled' },
    ],
  };
  const text = dayText(d);
  assert.match(text, /Jared E\.\n {4}349-02 TOA 3 → 1201 Colllegeville truck 01-08/);
  assert.match(text, /  Blair: 335-01 Brandywine Walk → Sadsbury\n/);
  assert.match(text, /Move: 20 pcs RCP/);
  const html = dayHtml(d, 'email');
  assert.match(html, /Blair: 335-01 Brandywine Walk → Sadsbury/);
  assert.match(html, /Other equipment moves/);
  // no drivers on the board: moves still show
  assert.match(dayHtml({ ...d, board: { jobs: [], people: {}, equip: {} } }, 'email'), /Equipment moves.*Jared E: 349-02/s);
});
