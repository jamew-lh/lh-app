// Job list rules.
//
// Job numbers look like 425224: first digit = company, next two = year (25),
// last three = job (224). "426000 X10" is an extra job for 2026.
//
// Order: newest year first. Inside a year, regular jobs by their last three
// digits (highest first), then that year's "000 X__" jobs (highest X first).
// Rows whose Number is not a number (VACATION, SHOP TIME, ABSENT, ...) are hidden.

export function parseNumber(raw) {
  const s = String(raw ?? '').trim();
  if (!/^\d/.test(s)) return null;                       // not a job: hide
  const m = s.match(/^\d(\d{2})(\d{3})(?:\s*x\s*(\d*))?/i);
  if (!m) return { year: -1, seq: Number(s.match(/^\d+/)[0]), extra: false, x: -1 };
  const extra = m[2] === '000';
  return { year: Number(m[1]), seq: Number(m[2]), extra, x: extra ? (m[3] ? Number(m[3]) : 0) : -1 };
}

export function compareJobs(a, b) {
  const p = a.sortKey, q = b.sortKey;
  if (p.year !== q.year) return q.year - p.year;          // newest year first
  if (p.extra !== q.extra) return p.extra ? 1 : -1;       // X jobs at the end of their year
  if (p.extra) { if (p.x !== q.x) return q.x - p.x; }
  else if (p.seq !== q.seq) return q.seq - p.seq;
  return String(a.name).localeCompare(String(b.name));
}

// ---- GPS base points (BASE CORD field) ----
// Each base is a block like:
//   B-1 (Post)
//   LAT – N40° 02'27.42000"
//   LON- W75° 52'04.87571"
//   HGT- 249.96'
// Blocks are separated by a blank line. Returns [{ name, lat, lon, height }] with lat/lon in decimal
// degrees (null when a line can't be read, e.g. a typo like N90°).
export function dmsToDecimal(s) {
  const m = String(s || '').replace(/[’‘]/g, "'").replace(/[”“]/g, '"')
    .match(/([NSEW])\s*(\d{1,3})\s*°\s*(\d{1,3})\s*'\s*(\d{1,2}(?:\.\d+)?)/i);
  if (!m) return null;
  const [, hemi, d, mi, se] = m;
  if (Number(mi) >= 60 || Number(se) >= 60) return null;
  let v = Number(d) + Number(mi) / 60 + Number(se) / 3600;
  if (/[SW]/i.test(hemi)) v = -v;
  const isLat = /[NS]/i.test(hemi);
  if (Math.abs(v) > (isLat ? 90 : 180) || (isLat && Math.abs(v) >= 90)) return null;
  return Math.round(v * 1e7) / 1e7;
}
export function parseBases(raw) {
  const out = [];
  for (const block of String(raw || '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const find = (re) => lines.find((l) => re.test(l)) || '';
    const latLine = find(/^LAT/i); const lonLine = find(/^LON/i); const hgtLine = find(/^(HGT|HT|ELEV)/i);
    const name = lines.find((l) => !/^(LAT|LON|HGT|HT|ELEV)/i.test(l)) || 'Base';
    out.push({
      name,
      lat: latLine ? dmsToDecimal(latLine) : null,
      lon: lonLine ? dmsToDecimal(lonLine) : null,
      height: hgtLine.replace(/^(HGT|HT|ELEV)\s*[-–:]?\s*/i, '').trim(),
    });
  }
  return out;
}

const text = (v) => (v == null ? '' : String(v)).trim();

export function shapeJobs(records, F) {
  const jobs = [];
  for (const r of records) {
    const f = r.fields || {};
    const number = text(f[F.number]);
    const sortKey = parseNumber(number);
    if (!sortKey) continue;
    const name = text(f[F.name]);
    if (!name) continue;
    jobs.push({
      id: r.id,
      name,
      number,
      year: sortKey.year >= 0 ? 2000 + sortKey.year : null,
      active: !!f[F.active],
      supervisor: text(f[F.supervisor]?.name ?? f[F.supervisor]),
      location: /^https?:\/\//i.test(text(f[F.location])) ? text(f[F.location]) : '',
      address: text(f[F.address]),
      hospital: text(f[F.hospital]),
      police: text(f[F.police]),
      fire: text(f[F.fire]),
      toilet: text(f[F.toilet]),
      township: text(f[F.township]),
      utilities: text(f[F.utilities]),
      baseCoords: text(f[F.baseCoords]),
      bases: parseBases(text(f[F.baseCoords])),
      files: (f[F.codes] || []).filter((a) => a && a.url).map((a) => ({ name: a.filename || 'File', url: a.url })),
      sortKey,
    });
  }
  jobs.sort(compareJobs);
  return jobs.map(({ sortKey, ...j }) => j);
}
