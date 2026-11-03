import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../lib/app.mjs';
import { clearCache, resetForceFresh } from '../lib/store.mjs';
import { resetThrottle } from '../lib/auth.mjs';
import { parseNumber } from '../lib/jobs.mjs';
import { fakeFetch } from './fake-airtable.mjs';

const env = { AIRTABLE_TOKEN: 'patTEST', SESSION_SECRET: 'x'.repeat(32) };
const BASE = 'https://lh.test';

beforeEach(() => { clearCache(); resetThrottle(); resetForceFresh(); });

async function call(method, path, { body, cookie, fetchImpl = fakeFetch() } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await handle(new Request(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), { env, fetchImpl });
  return { status: res.status, data: await res.json(), setCookie: res.headers.get('set-cookie') || '' };
}
async function login(lastName, pin) {
  const r = await call('POST', '/api/login', { body: { lastName, pin } });
  return { ...r, cookie: r.setCookie.split(';')[0] };
}

test('sign in with last name + timecard PIN', async () => {
  const r = await login('walker', '1234');
  assert.equal(r.status, 200);
  assert.equal(r.data.person.name, 'James Walker');
  assert.equal(r.data.person.first, 'James');
  assert.match(r.setCookie, /HttpOnly/);
  assert.ok(!('pin' in r.data.person));
});

test('wrong PIN, past employees, Paving and blank PINs cannot sign in', async () => {
  assert.equal((await login('Walker', '1111')).status, 401);
  assert.equal((await login('Old', '9999')).status, 401);
  assert.equal((await login('Paver', '7777')).status, 401);
  assert.equal((await login('Adams', '')).status, 401);
});

test('named exception (Tyler Enck, Paving) can sign in', async () => {
  const r = await login('Enck', '8642');
  assert.equal(r.status, 200);
  assert.equal(r.data.person.name, 'Tyler L. Enck');
  assert.equal(r.data.person.equipment, true);   // Shop
});

test('several people with the same last name each sign in with their own PIN', async () => {
  assert.equal((await login('Smoker', '1111')).data.person.name, 'Gage Smoker');
  const chad = (await login('Smoker', '2222')).data.person;
  assert.equal(chad.name, 'Chad M. Smoker');
  assert.equal(chad.equipment, true);  // Shop
  assert.equal(chad.pm, true);         // Shop
  assert.equal((await login('Walker', '1234')).data.person.pm, false);
});

test('vacation calendar link only for Management, and only when set', async () => {
  const mgr = 'recEMP0000000011';
  const r1 = await call('POST', '/api/login', { body: { lastName: 'Boss', pin: '3333' } });
  assert.equal(r1.data.person.calendarUrl, '');                       // not set in Netlify yet
  env.VACATION_CALENDAR_URL = 'https://lhtimecard.netlify.app/calendar.html#k=abc';
  try {
    assert.equal((await login('Boss', '3333')).data.person.calendarUrl, env.VACATION_CALENDAR_URL);
    assert.equal((await login('Walker', '1234')).data.person.calendarUrl, '');  // Office
    assert.equal((await login('Smoker', '2222')).data.person.calendarUrl, ''); // Shop
  } finally { delete env.VACATION_CALENDAR_URL; }
  void mgr;
});

test('start date, driving list, medical card and address only for Management and supervisors', async () => {
  const crew = await login('Walker', '1234');               // Office: no
  const r1 = await call('GET', '/api/phones', { cookie: crew.cookie });
  assert.ok(r1.data.people.every((p) => !('details' in p)));
  assert.equal(crew.data.person.details, false);
  for (const [last, pin] of [['Boss', '3333'], ['Chen', '2468']]) {  // Management, "Superviser"
    const m = await login(last, pin);
    assert.equal(m.data.person.details, true);
    const r = await call('GET', '/api/phones', { cookie: m.cookie });
    const tony = r.data.people.find((p) => p.name === 'Rivera, Tony');
    assert.deepEqual(tony.details, {
      hireDate: '2016-04-11', driving: 'Yes', medical: 'Yes', medExp: '2026-11-20',
      endorsements: ['CDL A', 'Tanker'], address: '12 Main St', cityStateZip: 'Downingtown, PA 19335',
    });
    assert.ok(!JSON.stringify(r.data).includes('3333'));     // never PINs
  }
});

test('refresh re-reads Airtable, only when signed in, at most every 15 seconds', async () => {
  const f = fakeFetch();
  const r = await call('POST', '/api/login', { body: { lastName: 'Rivera', pin: '4321' }, fetchImpl: f });
  const cookie = r.setCookie.split(';')[0];
  const before = f.calls.length;
  await call('GET', '/api/me', { cookie, fetchImpl: f });
  assert.equal(f.calls.length, before);                       // cached
  await call('GET', '/api/me?fresh=1', { cookie, fetchImpl: f });
  assert.ok(f.calls.length > before);                         // re-read
  const after = f.calls.length;
  await call('GET', '/api/me?fresh=1', { cookie, fetchImpl: f });
  assert.equal(f.calls.length, after);                        // throttled
  resetForceFresh();
  assert.equal((await call('GET', '/api/me?fresh=1', { fetchImpl: f })).status, 401);
});

test('Supervisors section: Superviser, SUP, Foreman, Management only', async () => {
  assert.equal((await login('Chen', '2468')).data.person.supervisor, true);   // Superviser
  assert.equal((await login('Baker', '5555')).data.person.supervisor, true);  // Foreman
  assert.equal((await login('Boss', '3333')).data.person.supervisor, true);   // Management
  assert.equal((await login('Rivera', '4321')).data.person.supervisor, false); // Operator
  assert.equal((await login('Walker', '1234')).data.person.supervisor, false); // Office
});

test('too many wrong tries locks the name for a while', async () => {
  for (let i = 0; i < 6; i++) await login('Rivera', '0000');
  assert.equal((await login('Rivera', '4321')).status, 429);
});

test('equipment viewer only for Management, Office, Supervisor, Foreman', async () => {
  assert.equal((await login('Walker', '1234')).data.person.equipment, true);   // Office
  assert.equal((await login('Baker', '5555')).data.person.equipment, true);    // Foreman
  assert.equal((await login('Chen', '2468')).data.person.equipment, true);     // "Superviser"
  assert.equal((await login('Rivera', '4321')).data.person.equipment, false);  // Operator
});

test('data needs a sign-in', async () => {
  assert.equal((await call('GET', '/api/jobs')).status, 401);
  assert.equal((await call('GET', '/api/phones')).status, 401);
  assert.equal((await call('GET', '/api/me', { cookie: 'lh_s=abc.def' })).status, 401);
});

test('tampered cookie is refused', async () => {
  const { cookie } = await login('Rivera', '4321');
  const [name, value] = cookie.split('=');
  const [payload, mac] = value.split('.');
  const forged = Buffer.from(JSON.stringify({ i: 'recEMP0000000001', e: Date.now() + 1e9 })).toString('base64url');
  assert.equal((await call('GET', '/api/me', { cookie: `${name}=${forged}.${mac}` })).status, 401);
  assert.equal((await call('GET', '/api/me', { cookie })).data.person.name, 'Tony Rivera');
  void payload;
});

test('job order: newest year first, 000 X jobs at the end of their year, non-jobs hidden', async () => {
  const { cookie } = await login('Rivera', '4321');
  const r = await call('GET', '/api/jobs', { cookie });
  assert.equal(r.status, 200);
  const nums = r.data.jobs.map((j) => j.number);
  assert.deepEqual(nums, [
    '426000 X10', '426000 X4',
    '325230', '425225', '425224', '425000 X11', '425000 x6', '425000 x',
    '424213', '423208', '12345',
  ]);
  assert.ok(!nums.includes('VACATION') && !nums.includes('SHOP TIME') && !nums.includes('PUT IN COMMENTS'));
  const sad = r.data.jobs.find((j) => j.name === 'Sadsbury');
  assert.equal(sad.supervisor, 'Seth Mast');
  assert.equal(sad.year, 2025);
  assert.match(sad.hospital, /Penn Medicine/);
  assert.equal(sad.files[0].name, 'Sadsbury codes.pdf');
  assert.equal(r.data.jobs.find((j) => j.name === 'Maple Springs').active, false);
});

test('parseNumber', () => {
  assert.equal(parseNumber('SHOP'), null);
  assert.deepEqual(parseNumber('425224'), { year: 25, seq: 224, extra: false, x: -1 });
  assert.deepEqual(parseNumber('426000 X10'), { year: 26, seq: 0, extra: true, x: 10 });
  assert.deepEqual(parseNumber('425000 x'), { year: 25, seq: 0, extra: true, x: 0 });
});

test('phone list: current Site Contractors with a cell, sorted, no PINs', async () => {
  const { cookie } = await login('Rivera', '4321');
  const r = await call('GET', '/api/phones', { cookie });
  assert.deepEqual(r.data.people.map((p) => p.name), ['Adams, Nopin', 'Arment, Leon R.', 'Baker, Sam', 'Boss, Morgan', 'Chen, Lee', 'Enck, Tyler L.', 'Rivera, Tony', 'Smoker, Chad M.', 'Smoker, Gage', 'Walker, James', 'Woodard, James L.']);
  assert.ok(r.data.people.every((p) => Object.keys(p).sort().join() === 'cell,name,position'));
  assert.deepEqual(r.data.company, [{ name: 'Site Office', cell: '610-942-2400', text: false }, { name: 'L&H HR Cell', cell: '484-986-8153', text: true }]);
  // hidden from the list, but can still sign in
  assert.equal((await login('Korth', '4444')).status, 200);
});

test('Airtable token problems give a clear message', async () => {
  const r = await call('POST', '/api/login', { body: { lastName: 'Walker', pin: '1234' }, fetchImpl: fakeFetch({ fail: true }) });
  assert.equal(r.status, 502);
  assert.match(r.data.error, /AIRTABLE_TOKEN/);
});

test('missing settings are reported', async () => {
  const res = await handle(new Request(BASE + '/api/login', { method: 'POST', body: JSON.stringify({ lastName: 'Walker', pin: '1234' }) }), { env: { AIRTABLE_TOKEN: 'x' }, fetchImpl: fakeFetch() });
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /SESSION_SECRET/);
});
