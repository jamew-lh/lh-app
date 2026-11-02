// Sign-in with last name + Timecard Pin (same PIN as the timecard app).
// The session is a signed cookie. The signature includes a fingerprint of the
// person's PIN, so changing someone's PIN in Airtable signs them out, and so
// does marking them Past Employee (they are no longer found).
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from './airtable.mjs';
import { SESSION_DAYS, LOCKOUT } from './config.mjs';
import { employees, norm } from './store.mjs';

export const COOKIE = 'lh_s';

function secret(env) {
  const s = env.SESSION_SECRET;
  if (!s || s.length < 24) throw new HttpError(500, 'Server is missing SESSION_SECRET (at least 24 characters).');
  return s;
}

export function sameText(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  if (x.length !== y.length) { timingSafeEqual(x, x); return false; }
  return timingSafeEqual(x, y);
}

const pinPrint = (pin) => createHash('sha256').update(String(pin)).digest('hex').slice(0, 16);
const sign = (payload, pin, env) => createHmac('sha256', secret(env)).update(`${payload}|${pinPrint(pin)}`).digest('base64url');

export function makeCookie(person, env, now = Date.now(), secure = true) {
  const payload = Buffer.from(JSON.stringify({ i: person.id, e: now + SESSION_DAYS * 86400000 })).toString('base64url');
  const value = `${payload}.${sign(payload, person.pin, env)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;
}

export const clearCookie = (secure = true) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;

function readCookie(req) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return '';
}

/** Returns the signed-in employee, or throws 401. */
export async function requirePerson(req, env, fetchImpl, now = Date.now()) {
  const value = readCookie(req);
  const [payload, mac] = value.split('.');
  if (!payload || !mac) throw new HttpError(401, 'Please sign in.');
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new HttpError(401, 'Please sign in.'); }
  if (!data?.i || !data.e || now > data.e) throw new HttpError(401, 'Please sign in again.');
  const person = (await employees(env, fetchImpl)).find((p) => p.id === data.i);
  if (!person || !person.pin || !sameText(mac, sign(payload, person.pin, env))) throw new HttpError(401, 'Please sign in again.');
  return person;
}

// Best-effort brute-force protection (function instances are short-lived).
const failures = new Map();
export function resetThrottle() { failures.clear(); }
export function checkThrottle(key, now = Date.now()) {
  const f = failures.get(key);
  if (f?.lockedUntil > now) throw new HttpError(429, 'Too many tries. Wait 15 minutes, or call the office.');
}
export function recordFailure(key, now = Date.now()) {
  const f = failures.get(key);
  const fresh = !f || now - f.first > LOCKOUT.windowMinutes * 60000;
  const next = fresh ? { first: now, count: 1, lockedUntil: 0 } : { ...f, count: f.count + 1 };
  if (next.count >= LOCKOUT.maxFailures) next.lockedUntil = now + LOCKOUT.lockMinutes * 60000;
  failures.set(key, next);
}

export async function findForLogin(lastName, pin, env, fetchImpl) {
  const want = norm(lastName);
  const p = String(pin ?? '').trim();
  if (!want || !/^\d{3,8}$/.test(p)) return { status: 'bad' };
  const all = await employees(env, fetchImpl);
  const match = all.filter((e) => norm(e.last) === want && e.pin && sameText(e.pin, p));
  if (match.length === 1) return { status: 'ok', person: match[0] };
  if (match.length > 1) return { status: 'ambiguous' };
  return { status: 'bad' };
}
