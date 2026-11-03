import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../lib/app.mjs';
import { clearCache, resetForceFresh } from '../lib/store.mjs';
import { resetThrottle } from '../lib/auth.mjs';
import { SAFETY as S } from '../lib/config.mjs';
import { fakeFetch, TINY_JPG_BYTES } from './fake-airtable.mjs';

const BASE = 'https://lhapp.test';
let env; let f;
beforeEach(() => {
  clearCache(); resetThrottle(); resetForceFresh();
  env = { AIRTABLE_TOKEN: 'patTEST', SESSION_SECRET: 'y'.repeat(32), TEXTMAGIC_USERNAME: 'lh', TEXTMAGIC_API_KEY: 'k' };
  f = fakeFetch();
});

async function call(method, path, { body, cookie } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await handle(new Request(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), { env, fetchImpl: f });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.arrayBuffer(), headers: res.headers };
}
async function login(lastName, pin) {
  const r = await call('POST', '/api/login', { body: { lastName, pin } });
  assert.equal(r.status, 200, `${lastName} should sign in`);
  return { cookie: r.headers.get('set-cookie').split(';')[0], person: r.data.person };
}
const photo = { kind: 'photo', contentType: 'image/jpeg', data: TINY_JPG_BYTES, filename: 'scene.jpg' };
const sig = { contentType: 'image/png', data: TINY_JPG_BYTES };
const form = {
  date: '2026-11-03', time: '14:05', began: '07:00', shift: 'Regular Shift',
  job: 'Sadsbury', jobNumber: '425224', injured: 'Rivera, Tony', jobTitle: 'Operator',
  injuryClass: ['Medical', 'Automobile', 'Bogus'], location: 'Other', locationOther: 'Rt 30 shoulder',
  working: 'With Co-Worker', witnesses: 'Baker, Sam', task: 'Hauling stone', nature: 'Cut on left hand',
  how: 'Backing up, hit a post', causes: 'Blind spot', corrective: 'Spotter required', cases: 'PD #2026-1234',
  preparedTitle: 'Foreman', gps: '40.0253,-75.6459',
};

async function fileReport(cookie) {
  const c = await call('POST', '/api/incidents', { cookie, body: form });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  const id = c.data.id;
  assert.equal((await call('POST', `/api/incidents/${id}/file`, { cookie, body: photo })).status, 200);
  assert.equal((await call('POST', `/api/incidents/${id}/file`, { cookie, body: { ...sig, kind: 'signature' } })).status, 200);
  const s = await call('POST', `/api/incidents/${id}/submit`, { cookie });
  assert.equal(s.status, 200, JSON.stringify(s.data));
  return id;
}

test('who can file and review incident reports', async () => {
  assert.deepEqual((await login('Baker', '5555')).person.incidents, { file: true, view: true, all: false, office: false });   // Foreman
  assert.deepEqual((await login('Chen', '2468')).person.incidents, { file: true, view: true, all: true, office: false });     // Superviser
  assert.deepEqual((await login('Boss', '3333')).person.incidents, { file: true, view: true, all: true, office: true });      // Management
  assert.deepEqual((await login('Grafstrom', '7070')).person.incidents, { file: false, view: true, all: true, office: true }); // Lisa: Office, committee
  assert.deepEqual((await login('Rivera', '4321')).person.incidents, { file: false, view: false, all: false, office: false }); // Operator
  const op = await login('Rivera', '4321');
  assert.equal((await call('GET', '/api/incidents', { cookie: op.cookie })).status, 403);
  assert.equal((await call('POST', '/api/incidents', { cookie: op.cookie, body: form })).status, 403);
});

test('foreman files a report: saved, photos + signature attached, texts sent with link', async () => {
  const fm = await login('Baker', '5555');
  const id = await fileReport(fm.cookie);
  const rec = f.safety.get(id).fields;
  assert.equal(rec[S.f.status], 'Submitted');
  assert.equal(rec[S.f.day], 'Tuesday');
  assert.equal(rec[S.f.time], '2:05 PM');
  assert.deepEqual(rec[S.f.injuryClass], ['Medical', 'Automobile']);  // bogus class dropped
  assert.equal(rec[S.f.preparedBy], 'Sam Baker');
  assert.equal(rec[S.f.appLink], `${BASE}/#incident/${id}`);
  assert.equal(rec[S.f.photos].length, 1);
  // texts: Bob Arment, James Woodard, HR cell
  assert.deepEqual(f.texts.map((t) => t.phones).sort(), ['14849868153', '16106367289', '16108584549']);
  assert.match(f.texts[0].text, /L&H INCIDENT REPORT #1: Rivera, Tony \(Medical, Automobile\), 425224 Sadsbury, 11\/3\/2026 2:05 PM\. Filed by Sam Baker\. Open: https:\/\/lhapp\.test\/#incident\//);
  assert.match(rec[S.f.textsSent], /Leon R\. Arment \(\(610\) 636-7289\): sent/);
  // after sending, no more photos
  assert.equal((await call('POST', `/api/incidents/${id}/file`, { cookie: fm.cookie, body: photo })).status, 409);
  // submitting twice doesn't text twice
  await call('POST', `/api/incidents/${id}/submit`, { cookie: fm.cookie });
  assert.equal(f.texts.length, 3);
});

test('signature is required before sending; required fields checked', async () => {
  const fm = await login('Baker', '5555');
  assert.equal((await call('POST', '/api/incidents', { cookie: fm.cookie, body: { ...form, injuryClass: [] } })).status, 400);
  assert.equal((await call('POST', '/api/incidents', { cookie: fm.cookie, body: { ...form, how: ' ' } })).status, 400);
  const c = await call('POST', '/api/incidents', { cookie: fm.cookie, body: form });
  const s = await call('POST', `/api/incidents/${c.data.id}/submit`, { cookie: fm.cookie });
  assert.equal(s.status, 400);
  assert.match(s.data.error, /Sign/);
});

test('foremen see only their own reports; office sees all and the test results', async () => {
  const fm = await login('Baker', '5555');
  const id = await fileReport(fm.cookie);
  const sup = await login('Chen', '2468');
  const id2 = await fileReport(sup.cookie);
  const mine = await call('GET', '/api/incidents', { cookie: fm.cookie });
  assert.deepEqual(mine.data.reports.map((r) => r.id), [id]);
  assert.equal((await call('GET', `/api/incidents/${id2}`, { cookie: fm.cookie })).status, 404);
  const lisa = await login('Grafstrom', '7070');
  assert.equal((await call('GET', '/api/incidents', { cookie: lisa.cookie })).data.reports.length, 2);
  // drug test: office only
  const saved = await call('POST', `/api/incidents/${id}/office`, { cookie: lisa.cookie, body: { drug: 'Yes', drugDate: '2026-11-03', alcohol: 'No', officeNotes: 'Sent to WC carrier' } });
  assert.equal(saved.data.report.drug, 'Yes');
  assert.equal((await call('POST', `/api/incidents/${id}/office`, { cookie: sup.cookie, body: { drug: 'No' } })).status, 403);
  const supView = await call('GET', `/api/incidents/${id}`, { cookie: sup.cookie });
  assert.equal(supView.data.report.drug, undefined);
  assert.equal(supView.data.report.officeNotes, undefined);
});

test('sign-off chain: supervisor, safety coordinator (James), safety committee (Lisa), then Closed', async () => {
  const fm = await login('Baker', '5555');
  const id = await fileReport(fm.cookie);
  // foreman cannot sign supervisor line
  assert.equal((await call('POST', `/api/incidents/${id}/review`, { cookie: fm.cookie, body: { step: 'supervisor', signature: sig } })).status, 403);
  const sup = await login('Chen', '2468');
  let r = await call('POST', `/api/incidents/${id}/review`, { cookie: sup.cookie, body: { step: 'supervisor', signature: sig } });
  assert.equal(r.status, 200);
  assert.equal(r.data.report.status, 'In Review');
  assert.equal(r.data.report.reviews[0].name, 'Lee Chen');
  // supervisor can't sign coordinator line
  assert.equal((await call('POST', `/api/incidents/${id}/review`, { cookie: sup.cookie, body: { step: 'coordinator', signature: sig } })).status, 403);
  const james = await login('Woodard', '6060');
  r = await call('POST', `/api/incidents/${id}/review`, { cookie: james.cookie, body: { step: 'coordinator', signature: sig } });
  assert.equal(r.data.report.status, 'In Review');
  assert.equal((await call('POST', `/api/incidents/${id}/review`, { cookie: james.cookie, body: { step: 'coordinator', signature: sig } })).status, 409); // already
  const lisa = await login('Grafstrom', '7070');
  r = await call('POST', `/api/incidents/${id}/review`, { cookie: lisa.cookie, body: { step: 'committee', signature: sig } });
  assert.equal(r.data.report.status, 'Closed');
  assert.ok(r.data.report.reviews.every((x) => x.done));
});

test('PDF download', async () => {
  const fm = await login('Baker', '5555');
  const id = await fileReport(fm.cookie);
  const r = await call('GET', `/api/incidents/${id}/pdf`, { cookie: fm.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(r.data).subarray(0, 4).toString(), '%PDF');
});

test('without TextMagic set up, the report still goes through and says texts were not sent', async () => {
  delete env.TEXTMAGIC_USERNAME;
  const fm = await login('Baker', '5555');
  const id = await fileReport(fm.cookie);
  assert.equal(f.texts.length, 0);
  assert.match(f.safety.get(id).fields[S.f.textsSent], /TextMagic is not set up/);
  assert.equal(f.safety.get(id).fields[S.f.status], 'Submitted');
});

test('injured-employee picker lists every current employee (incl. Paving)', async () => {
  const fm = await login('Baker', '5555');
  const r = await call('GET', '/api/incidents/people', { cookie: fm.cookie });
  const names = r.data.people.map((p) => p.name);
  assert.ok(names.includes('Paver, Pat'));
  assert.ok(!names.includes('Old, Former'));
  assert.ok(r.data.people.every((p) => Object.keys(p).sort().join() === 'name,position'));
});
