// A finished day of the Daily Schedule, as read-only HTML.
// Used three ways: the no-sign-in page (day.html), Print / Save as PDF, and "Copy for email".
// Email programs ignore style sheets, so mode 'email' writes the styles inline (tables, no classes).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const GREEN = '#004745';
const TAN = '#D4A070';

const SPECIAL = { LANDSCAPE: 'Landscaping Crew', OFF: 'Off', SHOP: 'Office / Shop', DRIVERS: 'Drivers / Moves' };

export function longDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export const mapLink = (address) => `https://maps.google.com/?q=${encodeURIComponent(address)}`;

/** One hauling line as text: "Risbon ×3 tri-axle · 2A modified · Martin's → site · 7:00 · note" */
export function haulText(h, haulerName) {
  const head = `${haulerName || 'Hired truck'}${h.trucks ? ` ×${h.trucks}` : ''}${h.kind ? ` ${h.kind}` : ''}`;
  const route = h.from || h.to ? `${h.from || '?'} → ${h.to || 'site'}` : '';
  return [head, h.material, route, h.time, h.note].filter(Boolean).join(' · ');
}
export function otherMoveText(m) {
  const route = m.from || m.to ? `${m.from || '?'} → ${m.to || '?'}` : '';
  return [m.what, route, m.by && `by ${m.by}`, m.time, m.note].filter(Boolean).join(' · ');
}

/**
 * d = { date, board, people: {id: {name}}, jobs: {id: {name, number, supervisor, address}},
 *       equipment: {id: {label}}, haulers: {id: {name}}, vacation: [{person, half}], updatedAt }
 */
export function dayHtml(d, mode = 'page') {
  const email = mode === 'email';
  const b = d.board || {};
  const P = (id) => d.people[id]?.name || 'Unknown';
  const Q = (id) => d.equipment[id]?.label || '?';
  const s = (cls, css) => (email ? `style="${css}"` : `class="${cls}"`);

  const crewRow = (a) => {
    const what = [a.role && a.role !== 'Operator' ? a.role : '', a.machine ? Q(a.machine) : ''].filter(Boolean).join(' · ');
    return `<tr><td ${s('v-name', 'padding:3px 8px 3px 0;font-weight:600;white-space:nowrap;vertical-align:top')}>${esc(P(a.id))}</td>`
      + `<td ${s('v-what', 'padding:3px 8px 3px 0;color:#55625F;vertical-align:top')}>${esc(what)}${a.note ? ` <i ${s('v-note', 'color:#92400E')}>${esc(a.note)}</i>` : ''}</td></tr>`;
  };
  const block = (title, sub, inner) => (email
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D5DBD9;border-top:4px solid ${GREEN};border-radius:8px;margin:0 0 12px;background:#fff"><tr><td style="padding:10px 12px">
        <div style="font-weight:700;font-size:16px;color:${GREEN}">${title}</div>${sub ? `<div style="font-size:13px;color:#55625F;margin-top:2px">${sub}</div>` : ''}${inner}</td></tr></table>`
    : `<section class="v-block"><h3>${title}</h3>${sub ? `<div class="v-sub">${sub}</div>` : ''}${inner}</section>`);
  const list = (label, html) => (html ? `<div ${s('v-label', `font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#55625F;margin:8px 0 2px;font-weight:700`)}>${label}</div>${html}` : '');
  const table = (rows) => (rows ? `<table ${s('v-table', 'border-collapse:collapse;font-size:14px')} cellpadding="0" cellspacing="0">${rows}</table>` : '');
  const para = (t) => `<div ${s('v-line', 'font-size:14px;margin:2px 0')}>${t}</div>`;

  const blocks = [];
  for (const jid of [...(b.jobs || []), 'LANDSCAPE']) {
    const j = jid === 'LANDSCAPE' ? { name: SPECIAL.LANDSCAPE } : d.jobs[jid] || { name: 'Job' };
    const crew = b.people?.[jid] || [];
    const operated = new Set(crew.map((a) => a.machine).filter(Boolean));
    const eq = (b.equip?.[jid] || []).filter((e) => !operated.has(e)).map(Q);
    const haul = (b.haul?.[jid] || []).map((h) => para(esc(haulText(h, d.haulers[h.hauler]?.name))));
    if (!crew.length && !haul.length && (mode !== 'page' || jid === 'LANDSCAPE')) continue;     // parked equipment only: leave off the email/print
    const sub = [j.number && /^\d/.test(j.number) ? j.number : '', j.supervisor && `Sup: ${esc(j.supervisor)}`,
      j.address && `<a href="${mapLink(j.address)}" ${s('v-map', `color:${GREEN}`)}>${esc(j.address)}</a>`].filter(Boolean).join(' · ');
    const note = b.jobNotes?.[jid] ? `<div ${s('v-jobnote', 'background:#FEF3C7;color:#92400E;border-radius:6px;padding:4px 8px;margin:6px 0;font-size:14px')}>${esc(b.jobNotes[jid])}</div>` : '';
    blocks.push(block(esc(j.name), sub, note
      + list('Crew', table(crew.map(crewRow).join('')))
      + list('Hired trucks', haul.join(''))
      + list('Equipment', eq.length ? para(esc(eq.join(', '))) : '')));
  }
  for (const loc of ['OFF', 'SHOP', 'DRIVERS']) {
    const crew = b.people?.[loc] || [];
    const extra = loc === 'DRIVERS' ? (b.moves || []).map((m) => para(esc(otherMoveText(m)))).join('') : '';
    if (!crew.length && !extra) continue;
    blocks.push(block(SPECIAL[loc], '', table(crew.map(crewRow).join('')) + list(loc === 'DRIVERS' ? 'Material / other moves' : '', extra)));
  }
  const vac = (d.vacation || []).map((v) => `${esc(P(v.person))}${v.half ? ' (part day)' : ''}`);
  if (vac.length) blocks.push(block('Vacation', '', para(vac.join(', '))));

  const head = email
    ? `<div style="border-bottom:4px solid ${TAN};padding:0 0 8px;margin:0 0 12px"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${TAN};font-weight:700">Lyons &amp; Hohl · Daily Schedule</div><div style="font-size:22px;font-weight:700;color:${GREEN}">${esc(longDate(d.date))}</div></div>`
    : `<header class="v-head"><div class="eyebrow">Lyons &amp; Hohl · Daily Schedule</div><h2>${esc(longDate(d.date))}</h2></header>`;
  const body = blocks.join('') || para('Nothing scheduled yet.');
  return email
    ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#17201F;max-width:640px">${head}${body}</div>`
    : `<div class="v-day">${head}<div class="v-grid">${body}</div></div>`;
}

/** Plain text version (for the clipboard alongside the HTML). */
export function dayText(d) {
  const b = d.board || {};
  const P = (id) => d.people[id]?.name || 'Unknown';
  const lines = [`L&H Daily Schedule — ${longDate(d.date)}`, ''];
  const crew = (list) => (list || []).map((a) => `  ${P(a.id)}${a.role && a.role !== 'Operator' ? ` (${a.role})` : ''}${a.machine ? ` ${d.equipment[a.machine]?.label || ''}` : ''}${a.note ? ` — ${a.note}` : ''}`);
  for (const jid of [...(b.jobs || []), 'LANDSCAPE']) {
    const c = b.people?.[jid] || [];
    if (!c.length && !(b.haul?.[jid] || []).length) continue;
    const j = jid === 'LANDSCAPE' ? { name: SPECIAL.LANDSCAPE } : d.jobs[jid] || { name: 'Job' };
    lines.push(`${j.name}${j.number ? ` (${j.number})` : ''}`);
    if (b.jobNotes?.[jid]) lines.push(`  NOTE: ${b.jobNotes[jid]}`);
    lines.push(...crew(c));
    for (const h of b.haul?.[jid] || []) lines.push(`  Truck: ${haulText(h, d.haulers[h.hauler]?.name)}`);
    lines.push('');
  }
  for (const loc of ['OFF', 'SHOP', 'DRIVERS']) {
    if (!(b.people?.[loc] || []).length && !(loc === 'DRIVERS' && (b.moves || []).length)) continue;
    lines.push(SPECIAL[loc], ...crew(b.people[loc]));
    if (loc === 'DRIVERS') for (const m of b.moves || []) lines.push(`  Move: ${otherMoveText(m)}`);
    lines.push('');
  }
  if ((d.vacation || []).length) lines.push(`Vacation: ${d.vacation.map((v) => P(v.person)).join(', ')}`);
  return lines.join('\n');
}
