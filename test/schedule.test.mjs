import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../lib/app.mjs';
import { clearCache, resetForceFresh } from '../lib/store.mjs';
import { resetThrottle } from '../lib/auth.mjs';
import { describeChanges, addWorkdays, cleanBoard } from '../lib/schedule.mjs';
import { dayHtml, dayText, byEquipmentType, giveMachine, onePageHtml } from '../public/schedule-view.js';
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
  // Management without the checkbox can't (it's the checkbox, not the position)
  assert.equal((await login('Boss', '3333')).person.schedule, false);
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
  assert.deepEqual(r.data.subs.map((x) => x.name), ['Brandywine Electric', 'Valley Paving']);
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
  // same order as the equipment app's "Scheduled and needed" list (Arrange order number)
  assert.deepEqual(r.data.moves.map((m) => m.equipment), ['349-02', '938-09']);
  assert.equal(r.data.moves[1].toJob, 'recJOB0000000006');
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
  // crew texts ignore Schedule Link Phone (only the published link uses it)
  await call('POST', `/api/schedule/texts?date=${D}`, { cookie, body: { messages: [{ id: 'recEMP0000000003', text: 'x', key: 'k3' }] } });
  assert.equal(f.texts.at(-1).contacts, '5550003');
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
  assert.ok(f.texts.some((t) => t.phones === '14845550999' && !t.contacts), 'Sam B.: link goes to his Schedule Link Phone, not his TextMagic contact');
  assert.ok(!f.texts.some((t) => t.contacts === '5550003'));
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

test('Saturdays: Monday copies Friday even when a Saturday was saved; Saturday copies Friday', async () => {
  const a = await editor();
  const fri = '2026-11-13'; const sat = '2026-11-14'; const mon = '2026-11-16';
  assert.equal((await call('PUT', `/api/schedule/day?date=${fri}`, { cookie: a.cookie, body: { board: board(), version: 0 } })).status, 200);
  const small = board({ people: { recJOB0000000006: [{ id: 'recEMP0000000003', role: 'Foreman' }], OFF: [], SHOP: [], DRIVERS: [] } });
  assert.equal((await call('PUT', `/api/schedule/day?date=${sat}`, { cookie: a.cookie, body: { board: small, version: 0 } })).status, 200);
  assert.equal((await call('GET', `/api/schedule/day?date=${sat}`, { cookie: a.cookie })).data.prev.date, fri);
  assert.equal((await call('GET', `/api/schedule/day?date=${mon}`, { cookie: a.cookie })).data.prev.date, fri);
});

test('equipment is listed by type in James\'s order, then other types A–Z, then no type', () => {
  const list = [['B-1', 'Bucket'], ['V-1', 'Vehicle'], ['E-10', 'Excavator'], ['E-2', 'Excavator'], ['P-1', 'Plow Disc'],
    ['D-1', 'Dozer'], ['G-1', 'Generator'], ['N-1', ''], ['R-1', 'Rental'], ['A-1', 'Air Compressor']].map(([label, type]) => ({ label, type }));
  assert.deepEqual(list.sort(byEquipmentType).map((e) => e.label), ['E-2', 'E-10', 'D-1', 'P-1', 'R-1', 'B-1', 'A-1', 'G-1', 'V-1', 'N-1']);
});

test('subcontractors: saved with the day, listed under hired trucks on the email / print / link', async () => {
  const subs = { recJOB0000000006: [{ id: 's1', sub: 'recSUB0000000001', note: 'Binder course, start 7:00' }] };
  assert.deepEqual(cleanBoard({ jobs: [], subs }).subs, subs);
  const d = {
    date: '2026-11-10', jobs: { recJOB0000000006: { name: 'Sadsbury', number: '425224' } }, people: { p1: { name: 'Tony R.' } }, equipment: {},
    haulers: { h1: { name: 'Risbon' } }, subs: { recSUB0000000001: { name: 'Valley Paving' } }, vacation: [],
    board: { jobs: ['recJOB0000000006'], people: { recJOB0000000006: [{ id: 'p1', role: 'Foreman' }] }, equip: {}, jobNotes: {},
      haul: { recJOB0000000006: [{ id: 'x', hauler: 'h1', trucks: 2 }] }, subs, moves: [] },
  };
  const html = dayHtml(d, 'email');
  assert.ok(html.indexOf('Hired trucks') < html.indexOf('Subcontractors'), 'subcontractors come after hired trucks');
  assert.match(html, /Valley Paving · Binder course, start 7:00/);
  assert.match(dayText(d), /Sub: Valley Paving · Binder course, start 7:00/);
});

// ---------------------------------------------------------------- read-only view
import { viewDays, viewDay } from '../lib/schedule.mjs';

async function saveAndMaybePublish(cookie, date, publish, extra = {}) {
  const s = await call('PUT', `/api/schedule/day?date=${date}`, { cookie, body: { board: board(extra), version: 0 } });
  assert.equal(s.status, 200, JSON.stringify(s.data));
  if (publish) assert.equal((await call('POST', `/api/schedule/publish?date=${date}`, { cookie, body: {} })).status, 200);
}
const asViewer = (position, id = 'recEMP0000000003') => ({ id, position });

test('read-only view: who can see it', async () => {
  assert.equal((await login('Baker', '5555')).person.scheduleView, true);   // Foreman
  assert.equal((await login('Chen', '2468')).person.scheduleView, true);    // Superviser
  assert.equal((await login('Walker', '1234')).person.scheduleView, true);  // Office
  assert.equal((await login('Boss', '3333')).person.scheduleView, true);    // Management
  const op = await login('Rivera', '4321');
  assert.equal(op.person.scheduleView, false);                              // Operator
  assert.equal((await call('GET', '/api/schedule/view-days', { cookie: op.cookie })).status, 403);
});

test('read-only view: 2 posted days back (keeps Saturday), today, next 2 posted days; drafts hidden', async () => {
  const { cookie } = await editor();
  // Today = Monday 11/16. Posted: Thu 11/12, Fri 11/13, Sat 11/14, Tue 11/17, Wed 11/18, Thu 11/19. Draft only: Mon 11/16.
  for (const d of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-17', '2026-11-18', '2026-11-19']) await saveAndMaybePublish(cookie, d, true);
  await saveAndMaybePublish(cookie, '2026-11-16', false);
  const mon = new Date('2026-11-16T14:00:00Z');
  const r = await viewDays(asViewer('Foreman'), env, f, mon);
  assert.deepEqual(r.days.map((d) => [d.date, d.posted]), [
    ['2026-11-13', true], ['2026-11-14', true], ['2026-11-16', false], ['2026-11-17', true], ['2026-11-18', true],
  ]);
  assert.equal(r.days[2].today, true);
  assert.deepEqual(await viewDay('2026-11-16', asViewer('Foreman'), env, f, mon), { date: '2026-11-16', posted: false }); // draft stays hidden
  await assert.rejects(viewDay('2026-11-12', asViewer('Foreman'), env, f, mon), /isn’t available/);                 // outside the window
});

test('read-only view: on a Friday the next days are Saturday and Monday', async () => {
  const { cookie } = await editor();
  for (const d of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-16']) await saveAndMaybePublish(cookie, d, true);
  const fri = new Date('2026-11-13T14:00:00Z');
  const r = await viewDays(asViewer('Superviser'), env, f, fri);
  assert.deepEqual(r.days.map((d) => d.date), ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-16']);
});

test('read-only view: personal notes are left off; job notes stay', async () => {
  const { cookie } = await editor();
  const extra = {
    people: { recJOB0000000006: [{ id: 'recEMP0000000003', role: 'Foreman', note: 'Dentist at 2' }, { id: 'recEMP0000000002', role: 'Operator', machine: 'recEQP0000000001' }], OFF: [], SHOP: [], DRIVERS: [] },
    jobNotes: { recJOB0000000006: 'Start at 6:30' },
  };
  await saveAndMaybePublish(cookie, '2026-11-16', true, extra);
  const d = await viewDay('2026-11-16', asViewer('Office', 'recEMP0000000001'), env, f, new Date('2026-11-16T14:00:00Z'));
  assert.equal(d.posted, true);
  assert.ok(!JSON.stringify(d).includes('Dentist'));
  assert.equal(d.board.jobNotes.recJOB0000000006, 'Start at 6:30');
  assert.equal(d.board.sent, undefined);
  assert.ok(!JSON.stringify(d).includes('555-'));   // no phone numbers
});

test('giveMachine: hand a machine to someone else on the crew', () => {
  const crew = () => [{ id: 'bob', machine: 'ex1' }, { id: 'joe', machine: '' }, { id: 'al', machine: 'dz1' }];
  // Dragged off Bob onto Joe (who had nothing): Joe has it, Bob has nothing.
  let c = crew();
  assert.deepEqual(giveMachine(c, 'ex1', 'joe', 'bob'), { was: '', took: [{ id: 'bob', machine: 'ex1' }] });
  assert.deepEqual(c.map((a) => a.machine), ['', 'ex1', 'dz1']);
  // Dragged off Bob onto Al (who had a dozer): they swap.
  c = crew();
  giveMachine(c, 'ex1', 'al', 'bob');
  assert.deepEqual(c.map((a) => a.machine), ['dz1', '', 'ex1']);
  // Picked in Al's edit box (no drag): Al takes it from Bob, nobody gets the dozer back.
  c = crew();
  assert.deepEqual(giveMachine(c, 'ex1', 'al'), { was: 'dz1', took: [{ id: 'bob', machine: 'ex1' }] });
  assert.deepEqual(c.map((a) => a.machine), ['', '', 'ex1']);
  // Dropped back on Bob himself: nothing changes. Unknown person: nothing happens.
  c = crew();
  giveMachine(c, 'ex1', 'bob', 'bob');
  assert.deepEqual(c.map((a) => a.machine), ['ex1', '', 'dz1']);
  assert.equal(giveMachine(c, 'ex1', 'nobody'), null);
});

test('one-page PDF: active sites with crew, trucks, subs, equipment and moves; no notes or side lists', () => {
  const d = {
    date: '2026-11-18',
    board: {
      jobs: ['j1', 'j2'],
      people: {
        j1: [{ id: 'p1', role: 'Foreman', machine: '', note: 'bring the laser' }, { id: 'p2', role: 'Operator', machine: 'e1' }],
        LANDSCAPE: [{ id: 'p3', role: 'Laborer' }],
        OFF: [{ id: 'p4' }], SHOP: [{ id: 'p5' }], DRIVERS: [{ id: 'p6' }],
      },
      equip: { j1: ['e1', 'e2'], j2: ['e3'] },
      haul: { j1: [{ id: 'h', hauler: 'v1', trucks: 2, kind: 'Tri-axle', material: '2A' }] },
      subs: { j1: [{ id: 's', sub: 's1', note: 'Pipe' }] },
      jobNotes: { j1: 'Start at 6:30' },
      moves: [{ what: '20 pcs RCP', from: 'Shop', to: 'Odessa' }],
    },
    people: { p1: { name: 'Nick H.' }, p2: { name: 'Jeff S.' }, p3: { name: 'Scott C.' }, p4: { name: 'Off Guy' }, p5: { name: 'Shop Guy' }, p6: { name: 'Jared E.' } },
    jobs: { j1: { name: 'TOA III', number: '326227', address: '1 Main St', supervisor: 'Seth' }, j2: { name: 'Empty Job', number: '1' } },
    equipment: { e1: { label: '340-01' }, e2: { label: 'D6K-01' }, e3: { label: 'X-1' } },
    haulers: { v1: { name: 'Risbon' } }, subs: { s1: { name: 'JFC' } }, vacation: [{ person: 'p4' }],
    eqMoves: [{ equipment: '730-05', from: 'TOA 3', to: 'Maple Inn', driver: 'Jared E', status: 'Scheduled' }],
  };
  const html = onePageHtml(d);
  assert.match(html, /TOA III <small>326227<\/small>/);
  assert.match(html, /Nick H\.<\/b> <span>Foreman<\/span>/);
  assert.match(html, /Jeff S\.<\/b> <span>340-01<\/span>/);
  assert.match(html, /Risbon ×2 Tri-axle · 2A/);
  assert.match(html, /JFC · Pipe/);
  assert.match(html, /Equipment<\/div><div class="o-r">D6K-01<\/div>/);   // the operated machine isn't listed twice
  assert.match(html, /Landscaping Crew/);
  assert.match(html, /Moves<\/h3><div class="o-r"><b>Jared E\.<\/b><\/div><div class="o-r o-i">730-05 TOA 3 → Maple Inn/);
  assert.match(html, /20 pcs RCP/);
  for (const gone of ['bring the laser', 'Start at 6:30', '1 Main St', 'Seth', 'Empty Job', 'X-1', 'Off Guy', 'Shop Guy', 'Vacation']) {
    assert.ok(!html.includes(gone), `should leave off ${gone}`);
  }
});

test('No work: saved with the day, skipped as the copy source, listed in "Start from", logged, and texted on request', async () => {
  const a = await editor();
  const wed = '2026-11-25'; const thu = '2026-11-26'; const fri = '2026-11-27'; const mon = '2026-11-30';
  assert.equal((await call('PUT', `/api/schedule/day?date=${wed}`, { cookie: a.cookie, body: { board: board(), version: 0 } })).status, 200);
  const off = await call('PUT', `/api/schedule/day?date=${thu}`, { cookie: a.cookie, body: { board: board({ noWork: { reason: ' Thanksgiving ' } }), version: 0 } });
  assert.deepEqual(off.data.day.board.noWork, { reason: 'Thanksgiving' });
  // Friday copies Wednesday, not the No work Thursday
  const f1 = await call('GET', `/api/schedule/day?date=${fri}`, { cookie: a.cookie });
  assert.equal(f1.data.prev.date, wed);
  assert.deepEqual(f1.data.sources.map((s) => [s.date, s.noWork]), [[thu, true], [wed, false]]);
  // a saved Friday is the usual copy for Monday; Start from… can still list Wednesday
  await call('PUT', `/api/schedule/day?date=${fri}`, { cookie: a.cookie, body: { board: board(), version: 0 } });
  const m = await call('GET', `/api/schedule/day?date=${mon}`, { cookie: a.cookie });
  assert.equal(m.data.prev.date, fri);
  assert.ok(m.data.sources.some((s) => s.date === wed));
  const log = await call('GET', `/api/schedule/log?date=${thu}`, { cookie: a.cookie });
  assert.match(log.data.log.map((l) => l.change).join('\n'), /Marked No work \(Thanksgiving\)/);
  // No work text: only on a No work day, to the usual link list
  assert.equal((await call('POST', `/api/schedule/no-work-text?date=${wed}`, { cookie: a.cookie })).status, 409);
  const t = await call('POST', `/api/schedule/no-work-text?date=${thu}`, { cookie: a.cookie });
  assert.equal(t.status, 200, JSON.stringify(t.data));
  assert.ok(t.data.texted.sent.length > 0);
  assert.match(f.texts.at(-1).text, /No work Thu, 11\/26 \(Thanksgiving\)/);
  // turning it off is logged too
  assert.equal(cleanBoard(board()).noWork, null);
  assert.deepEqual(describeChanges(board({ noWork: { reason: '' } }), board()), ['Turned No work off']);
});

test('No work: link, email, text and one-page PDF say No work instead of the schedule', () => {
  const d = {
    date: '2026-11-26', jobs: { recJOB0000000006: { name: 'Sadsbury' } }, people: { p1: { name: 'Tony R.' } }, equipment: {}, haulers: {}, subs: {}, vacation: [],
    board: { jobs: ['recJOB0000000006'], people: { recJOB0000000006: [{ id: 'p1', role: 'Foreman' }] }, equip: {}, jobNotes: {}, haul: {}, subs: {}, moves: [], noWork: { reason: 'Thanksgiving' } },
  };
  for (const html of [dayHtml(d, 'share'), dayHtml(d, 'email'), onePageHtml(d)]) {
    assert.match(html, /No work — Thanksgiving/);
    assert.doesNotMatch(html, /Tony R\./);
  }
  assert.match(dayText(d), /No work — Thanksgiving/);
  assert.doesNotMatch(dayText(d), /Tony/);
  d.board.noWork = { reason: '' };
  assert.match(dayHtml(d, 'share'), />No work</);
});
