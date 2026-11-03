// PDF of an incident report, laid out like the paper
// "Lyons Hohl Loss Incident Investigation Report", with photos on extra pages.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { LOGO_JPG } from './pdf-logo.mjs';
import { usDate } from './incidents.mjs';

const W = 612, H = 792, M = 46;
const INK = rgb(0.1, 0.12, 0.14), MUTED = rgb(0.38, 0.42, 0.45), LINE = rgb(0.72, 0.75, 0.77), GREEN = rgb(0, 0.278, 0.271);

// Standard PDF fonts only know plain characters: swap the common "smart" ones.
const clean = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E\n]/g, '');

function wrap(text, font, size, width) {
  const out = [];
  for (const para of clean(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(t, size) <= width) line = t;
      else { if (line) out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

async function fetchImage(pdf, url, fetchImpl) {
  if (!url) return null;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const png = buf[0] === 0x89 && buf[1] === 0x50;
    return png ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
  } catch { return null; }
}

export async function incidentPdf(r, fetchImpl = fetch) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Incident Report ${r.number ? `#${r.number} ` : ''}- ${clean(r.injured)}`);
  pdf.setAuthor('Lyons & Hohl');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const need = (h) => { if (y - h < M + 20) newPage(); };

  // header
  const logo = await pdf.embedJpg(Buffer.from(LOGO_JPG, 'base64'));
  const lw = 150, lh = lw * logo.height / logo.width;
  page.drawImage(logo, { x: M, y: y - lh, width: lw, height: lh });
  const title = 'Lyons Hohl Loss Incident Investigation Report';
  page.drawText(title, { x: W - M - bold.widthOfTextAtSize(title, 13), y: y - 16, size: 13, font: bold, color: INK });
  const sub = '(to be completed by site supervisor)';
  page.drawText(sub, { x: W - M - font.widthOfTextAtSize(sub, 9), y: y - 30, size: 9, font, color: MUTED });
  const num = `Report #${r.number || '-'}   Status: ${r.status}`;
  page.drawText(num, { x: W - M - font.widthOfTextAtSize(num, 9), y: y - 43, size: 9, font, color: MUTED });
  y -= Math.max(lh, 48) + 14;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.5, color: GREEN });
  y -= 16;

  // one "Label: value" line, value underlined like the paper form
  const field = (label, value, x = M, width = W - 2 * M) => {
    const lab = `${label}:`;
    page.drawText(lab, { x, y, size: 10, font, color: MUTED });
    const vx = x + font.widthOfTextAtSize(lab, 10) + 6;
    const lines = wrap(value || '', bold, 10, x + width - vx);
    lines.forEach((ln, i) => {
      if (i > 0) { y -= 14; need(14); }
      page.drawText(ln, { x: vx, y, size: 10, font: bold, color: INK });
      page.drawLine({ start: { x: vx, y: y - 3 }, end: { x: x + width, y: y - 3 }, thickness: 0.5, color: LINE });
    });
  };
  const row = (cols) => { // [[label, value, widthFraction], ...]
    need(18);
    let x = M; const total = W - 2 * M;
    const startY = y; let minY = y;
    for (const [label, value, frac] of cols) {
      y = startY; field(label, value, x, total * frac - 10); minY = Math.min(minY, y); x += total * frac;
    }
    y = minY - 18;
  };
  const checks = (label, options, chosen) => {
    need(18);
    page.drawText(`${label}:`, { x: M, y, size: 10, font, color: MUTED });
    let x = M + font.widthOfTextAtSize(`${label}:`, 10) + 10;
    for (const o of options) {
      const on = chosen.includes(o);
      const itemW = 13 + (on ? bold : font).widthOfTextAtSize(o, 10);
      if (x + itemW > W - M) { y -= 16; x = M + 20; }
      page.drawRectangle({ x, y: y - 1, width: 9, height: 9, borderColor: INK, borderWidth: 0.8, color: on ? GREEN : undefined });
      if (on) page.drawText('X', { x: x + 1.6, y: y + 0.5, size: 8, font: bold, color: rgb(1, 1, 1) });
      page.drawText(o, { x: x + 13, y, size: 10, font: on ? bold : font, color: INK });
      x += itemW + 14;
    }
    y -= 18;
  };
  const block = (label, text) => {
    need(34);
    page.drawText(label, { x: M, y, size: 10, font, color: MUTED });
    y -= 14;
    const lines = wrap(text || '', font, 10, W - 2 * M);
    for (const ln of (lines.length ? lines : [''])) {
      need(14);
      page.drawText(ln, { x: M, y, size: 10, font, color: INK });
      page.drawLine({ start: { x: M, y: y - 3 }, end: { x: W - M, y: y - 3 }, thickness: 0.5, color: LINE });
      y -= 14;
    }
    y -= 6;
  };

  row([['Date of Incident', usDate(r.date), 0.5], ['Day', r.day, 0.5]]);
  row([['Injured Employee', r.injured, 0.5], ['Job Title', r.jobTitle, 0.5]]);
  row([['Job', [r.jobNumber, r.job].filter(Boolean).join(' '), 1]]);
  row([['Time began work', r.began, 0.33], ['Time of Incident', r.time, 0.33], ['Shift', r.shift, 0.34]]);
  checks('Injury Class', ['Fatality', 'Medical', 'First Aid', 'Automobile', 'Property Damage', 'Near Miss'], r.injuryClass);
  checks('Location of Incident', ["Employer's Premises", 'Other'], [r.location]);
  if (r.locationOther) row([['Location details', r.locationOther, 1]]);
  checks('Employee was working', ['Alone', 'With Co-Worker', 'Other'], [r.working]);
  if (r.workingOther) row([['Working details', r.workingOther, 1]]);
  row([['Witnesses', r.witnesses.replace(/\n+/g, ', '), 1]]);
  block('Task/Activity When Incident Occurred:', r.task);
  block('Nature of Injury/Illness (body part affected, how affected, severity):', r.nature);
  block('Describe How Incident Occurred:', r.how);
  block('List Causal Factors (events, actions, conditions, and equipment that contributed to the loss incident):', r.causes);
  block('Corrective Actions/Recommendations to Prevent Reoccurrence:', r.corrective);
  if (r.office) {
    row([['Drug Test', r.drug, 0.5], ['Date', usDate(r.drugDate), 0.5]]);
    row([['Alcohol Test', r.alcohol, 0.5], ['Date', usDate(r.alcoholDate), 0.5]]);
  }
  block('Case #s and Names Related to this Incident (police reports, witnesses, WC claim #s, etc.):', r.cases);

  // signatures
  const sigLine = async (label, name, date, url) => {
    need(46);
    const img = await fetchImage(pdf, url, fetchImpl);
    page.drawText(`${label}:`, { x: M, y, size: 10, font, color: MUTED });
    page.drawText(clean(name || ''), { x: M + 120, y, size: 10, font: bold, color: INK });
    if (img) {
      const h = 30, w = Math.min(130, h * img.width / img.height);
      page.drawImage(img, { x: M + 280, y: y - 6, width: w, height: h });
    }
    page.drawLine({ start: { x: M + 115, y: y - 7 }, end: { x: W - M - 110, y: y - 7 }, thickness: 0.5, color: LINE });
    page.drawText('Date:', { x: W - M - 100, y, size: 10, font, color: MUTED });
    page.drawText(usDate(date), { x: W - M - 70, y, size: 10, font: bold, color: INK });
    y -= 40;
  };
  y -= 4;
  await sigLine(`Prepared By (${clean(r.preparedTitle)})`.slice(0, 40), r.preparedBy, r.preparedDate, r.preparedSignature);
  page.drawText('Reviewed By:', { x: M, y: y + 10, size: 10, font: bold, color: INK });
  y -= 6;
  for (const rv of r.reviews) await sigLine(rv.label, rv.name, rv.date, rv.signature);

  // photos, two per page
  if (r.photos.length) {
    let i = 0;
    for (const p of r.photos) {
      if (i % 2 === 0) {
        newPage();
        page.drawText(`Photos - Report #${r.number || ''} ${clean(r.injured)}`, { x: M, y, size: 11, font: bold, color: GREEN });
        y -= 20;
      }
      const img = await fetchImage(pdf, p.url, fetchImpl);
      const boxW = W - 2 * M, boxH = (H - 2 * M - 50) / 2;
      if (img) {
        const s = Math.min(boxW / img.width, (boxH - 16) / img.height);
        page.drawImage(img, { x: M + (boxW - img.width * s) / 2, y: y - img.height * s, width: img.width * s, height: img.height * s });
      } else {
        page.drawText('(photo could not be loaded)', { x: M, y: y - 20, size: 10, font, color: MUTED });
      }
      page.drawText(`Photo ${i + 1} of ${r.photos.length}`, { x: M, y: y - boxH + 4, size: 9, font, color: MUTED });
      y -= boxH + 10;
      i += 1;
    }
  }

  // footer on every page
  const pages = pdf.getPages();
  pages.forEach((pg, n) => {
    const t = `Lyons & Hohl - Incident Report #${r.number || ''} - page ${n + 1} of ${pages.length}`;
    pg.drawText(t, { x: W / 2 - font.widthOfTextAtSize(t, 8) / 2, y: 24, size: 8, font, color: MUTED });
  });
  return pdf.save();
}
