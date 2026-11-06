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

// Equipment moves from the equipment app (Moves table) for the day.
const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
export function eqMoveText(m, withDriver = false) {
  const truck = m.truck && nameKey(m.truck) !== nameKey(m.driver) ? `truck ${m.truck}` : '';
  const status = m.status && !/^scheduled$/i.test(m.status) ? m.status : '';
  return [withDriver && m.driver ? `${m.driver}:` : '', m.equipment, `${m.from || '?'} → ${m.to || '?'}`, truck, status]
    .filter(Boolean).join(' ');
}
/** The moves whose Driver matches this name ("Dan I" matches "Dan I."). */
export const movesForDriver = (moves, name) => (moves || []).filter((m) => m.driver && nameKey(m.driver) === nameKey(name));

/**
 * d = { date, board, people: {id: {name}}, jobs: {id: {name, number, supervisor, address}},
 *       equipment: {id: {label}}, haulers: {id: {name}}, vacation: [{person, half}], updatedAt,
 *       eqMoves: [{ equipment, from, to, driver, truck, status }] }
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
  for (const loc of ['OFF', 'SHOP']) {
    const crew = b.people?.[loc] || [];
    if (crew.length) blocks.push(block(SPECIAL[loc], '', table(crew.map(crewRow).join(''))));
  }
  // Drivers / Moves: each driver with their equipment moves under them, then moves for other drivers
  // (hired trucks, people not in Drivers), then material / other moves.
  {
    const drivers = b.people?.DRIVERS || [];
    const eqMoves = d.eqMoves || [];
    const claimed = new Set();
    const sub = (t) => `<tr><td></td><td ${s('v-what', 'padding:1px 0 3px;color:#17201F;vertical-align:top')}>${esc(t)}</td></tr>`;
    const rows = drivers.map((a) => {
      const mine = movesForDriver(eqMoves, P(a.id));
      mine.forEach((m) => claimed.add(m));
      return crewRow(a) + mine.map((m) => sub(eqMoveText(m))).join('');
    }).join('');
    const others = eqMoves.filter((m) => !claimed.has(m)).map((m) => para(esc(eqMoveText(m, true)))).join('');
    const material = (b.moves || []).map((m) => para(esc(otherMoveText(m)))).join('');
    if (rows || others || material) {
      blocks.push(block(SPECIAL.DRIVERS, '', table(rows) + list(rows ? 'Other equipment moves' : 'Equipment moves', others) + list('Material / other moves', material)));
    }
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

/**
 * Stacked columns: each card goes into the shortest column, so short cards don't leave
 * empty space under them (a plain grid makes every card in a row as tall as the tallest).
 * Order still runs left to right. Safe to call again (e.g. after the window is resized).
 */
export function stackCards(box, minWidth = 260, gap = 12) {
  if (!box) return;
  const loose = [...box.children].filter((c) => !c.classList.contains('mcol'));
  const placed = [...box.querySelectorAll(':scope > .mcol > *')];
  const cards = [...loose, ...placed];
  cards.forEach((c, i) => { if (c.dataset.mi === undefined) c.dataset.mi = String(i); });
  cards.sort((a, b) => Number(a.dataset.mi) - Number(b.dataset.mi));
  box.classList.add('stacked');
  const n = Math.max(1, Math.floor((box.clientWidth + gap) / (minWidth + gap)));
  // Phones fire "resize" when the address bar hides or shows while scrolling. Same column count: nothing to do.
  if (!loose.length && box.querySelectorAll(':scope > .mcol').length === n) return;
  // Hold the height while the cards move, so the page doesn't shrink and jump back to the top.
  box.style.minHeight = `${box.offsetHeight}px`;
  const cols = Array.from({ length: n }, () => { const d = document.createElement('div'); d.className = 'mcol'; return d; });
  box.replaceChildren(...cols);
  for (const c of cards) {
    let best = cols[0];
    for (const col of cols) if (col.offsetHeight < best.offsetHeight) best = col;
    best.appendChild(c);
  }
  box.style.minHeight = '';
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
  for (const loc of ['OFF', 'SHOP']) {
    if (!(b.people?.[loc] || []).length) continue;
    lines.push(SPECIAL[loc], ...crew(b.people[loc]), '');
  }
  const eqMoves = d.eqMoves || [];
  if ((b.people?.DRIVERS || []).length || eqMoves.length || (b.moves || []).length) {
    lines.push(SPECIAL.DRIVERS);
    const claimed = new Set();
    for (const a of b.people?.DRIVERS || []) {
      lines.push(...crew([a]));
      for (const m of movesForDriver(eqMoves, P(a.id))) { claimed.add(m); lines.push(`    ${eqMoveText(m)}`); }
    }
    for (const m of eqMoves.filter((x) => !claimed.has(x))) lines.push(`  ${eqMoveText(m, true)}`);
    for (const m of b.moves || []) lines.push(`  Move: ${otherMoveText(m)}`);
    lines.push('');
  }
  if ((d.vacation || []).length) lines.push(`Vacation: ${d.vacation.map((v) => P(v.person)).join(', ')}`);
  return lines.join('\n');
}
