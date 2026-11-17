// The Equipment Tracker button: a short-lived signed pass that signs the person in to
// the equipment app (lh-equipment.netlify.app) at their level, with no second PIN.
// Both sites have the same LH_HANDOFF_SECRET; the equipment app checks the signature.
import { createHmac } from 'node:crypto';
import { HttpError } from './airtable.mjs';
import { EQUIPMENT_APP } from './config.mjs';

// The name shown and logged in the equipment app: Schedule Name ("Jared E."), else "First Last".
export const equipmentName = (p) => p.scheduleName || `${(p.first || '').split(' ')[0]} ${p.last || ''}`.trim() || p.name;
// What a driver's name looks like on a move ("Jared E"), for "only their own moves".
export const driverName = (p) => p.scheduleName || `${(p.first || '').split(' ')[0]} ${(p.last || '').slice(0, 1)}.`.trim();

export function makePass(person, env, now = Date.now()) {
  const secret = String(env.LH_HANDOFF_SECRET || '');
  if (secret.length < 24) throw new HttpError(500, 'The Equipment Tracker link is not set up yet: add LH_HANDOFF_SECRET in Netlify (the same value on both sites).');
  if (!person.equipment) throw new HttpError(403, "You don't have access to the Equipment Tracker. Ask the office.");
  const payload = Buffer.from(JSON.stringify({
    i: person.id, n: equipmentName(person), r: person.equipment, k: driverName(person), e: now + EQUIPMENT_APP.passSeconds * 1000,
  })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(`lh-equip.${payload}`).digest('base64url')}`;
}

export const equipmentUrl = (pass) => `${EQUIPMENT_APP.url}/api/sso?t=${encodeURIComponent(pass)}`;
