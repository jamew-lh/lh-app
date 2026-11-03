// A stand-in for the Airtable API, for tests and the local preview.
// Names and phone numbers here are made up.
import { EMPLOYEES as E, JOBS as J, SAFETY as S } from '../lib/config.mjs';

const emp = (id, name, pin, position, cell, status = 'Current Employee', location = 'SIte Contractors', more = {}) => ({
  id, fields: { [E.f.name]: name, [E.f.pin]: pin, [E.f.position]: { name: position }, [E.f.status]: { name: status }, [E.f.location]: { name: location }, [E.f.cell]: cell, ...more },
});

export const EMPLOYEE_RECORDS = [
  emp('recEMP0000000001', 'Walker, James', '1234', 'Office', '(610) 555-0101'),
  emp('recEMP0000000002', 'Rivera, Tony', '4321', 'Operator', '(610) 555-0102', 'Current Employee', 'SIte Contractors', {
    [E.f.hireDate]: '2016-04-11', [E.f.driving]: { name: 'Yes' }, [E.f.medical]: { name: 'Yes' }, [E.f.medExp]: '2026-11-20',
    [E.f.endorsements]: [{ name: 'CDL A' }, { name: 'Tanker' }], [E.f.address]: '12 Main St', [E.f.cityStateZip]: 'Downingtown, PA 19335',
  }),
  emp('recEMP0000000003', 'Baker, Sam', '5555', 'Foreman', '(610) 555-0103'),
  emp('recEMP0000000004', 'Old, Former', '9999', 'Laborer', '(610) 555-0104', 'Past Employee'),
  emp('recEMP0000000005', 'Paver, Pat', '7777', 'Operator', '(610) 555-0105', 'Current Employee', 'Paving'),
  emp('recEMP0000000006', 'Chen, Lee', '2468', 'Superviser', '(484) 555-0106'),
  emp('recEMP0000000007', 'Adams, Nopin', '', 'Laborer', '(484) 555-0107'),
  emp('recEMP0000000009', 'Smoker, Gage', '1111', 'Laborer', '(610) 555-0109'),
  emp('recEMP0000000010', 'Smoker, Chad M.', '2222', 'Shop', '(610) 555-0110'),
  emp('recEMP0000000011', 'Boss, Morgan', '3333', 'Management', '(610) 555-0111'),
  emp('recX7mle94324fL0y', 'Korth, Brittany', '4444', 'Office', '(610) 555-0112'),
  emp('recu5oe4hLAB7KXLJ', 'Woodard, James L.', '6060', 'Management', '(610) 858-4549'),
  emp('recb761dYQ0WyxkaE', 'Grafstrom, Lisamarie C.', '7070', 'Office', '(610) 574-0348'),
  emp('recIwytS3JrkBVb12', 'Arment, Leon R.', '8080', 'Management', '(610) 636-7289'),
  emp('recbAiVcHKoqqVXYZ', 'Enck, Tyler L.', '8642', 'Shop', '(610) 555-0108', 'Current Employee', 'Paving'),
];

const job = (id, name, number, extra = {}) => ({ id, fields: { [J.f.name]: name, [J.f.number]: number, [J.f.active]: true, ...extra } });

export const JOB_RECORDS = [
  job('recJOB0000000001', 'VACATION', 'VACATION'),
  job('recJOB0000000002', 'SHOP TIME', 'SHOP TIME'),
  job('recJOB0000000003', 'OTHER', 'PUT IN COMMENTS'),
  job('recJOB0000000004', 'Twin Valley FD', '426000 X10'),
  job('recJOB0000000005', 'LH Daycare', '426000 X4'),
  job('recJOB0000000006', 'Sadsbury', '425224', {
    [J.f.supervisor]: { name: 'Seth Mast' },
    [J.f.location]: 'https://www.google.com/maps/place/The+Shoppes+at+Sadsbury/@39.980092,-75.9281301',
    [J.f.address]: '506 Nova Way, Parksburg, PA 19365',
    [J.f.hospital]: 'Chester County \nPenn Medicine\n701 E Marshall St\nWest Chester, PA 19380\n610-431-5000\n',
    [J.f.police]: 'Sadsbury PD\n2920 Lincoln HWY\nSadsburyville, PA 19369\n610-383-7000\n',
    [J.f.fire]: 'Sadsbury Fire Co\n24 1st Ave\nCoatesville, PA 19320\n610-857-9332\n',
    [J.f.township]: 'Sadsbury Township\n2920 Lincoln HWY\nSadsburyville, PA 19369\n610-857-9503\n',
    [J.f.toilet]: 'Port A Bowl',
    [J.f.utilities]: 'PECO Gas Emergency: 800-841-4141\nPECO Electric: 800-841-4141\nAqua Water - 877-987-2782',
    [J.f.codes]: [{ id: 'att1', url: 'https://example.com/codes.pdf', filename: 'Sadsbury codes.pdf' }],
  }),
  job('recJOB0000000007', '416 Ridge Pike Car Wash', '425225', { [J.f.supervisor]: { name: 'Other' } }),
  job('recJOB0000000008', 'Marsh Creek Basin 2', '425000 X11', { [J.f.supervisor]: { name: 'Jon Dale' } }),
  job('recJOB0000000009', 'Gary McEwen', '425000 x', { [J.f.active]: false }),
  job('recJOB0000000010', 'Maple Springs', '425000 x6', { [J.f.active]: false }),
  job('recJOB0000000011', 'Southern Berks', '424213', { [J.f.supervisor]: { name: 'Seth Mast' } }),
  job('recJOB0000000012', 'Whitford WAWA', '423208', {
    [J.f.supervisor]: { name: 'Seth Mast' },
    [J.f.police]: 'West Whiteland PD, 101 Commerce Drive, Exton, PA 610-363-0200',
  }),
  job('recJOB0000000013', 'Paving job', '325230'),
  job('recJOB0000000014', 'Odd number', '12345'),
];

// Safety base: an in-memory table so reports can be created, read, updated and given files.
const TINY_JPG = 'https://fake.airtableusercontent.com/photo.jpg';
export function fakeFetch({ fail = false } = {}) {
  const calls = [];
  const texts = [];
  const safety = new Map();
  let nextNum = 1;
  let nextId = 1;
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const fn = async (url, opts = {}) => {
    calls.push(url);
    const method = opts.method || 'GET';
    if (url.startsWith('https://rest.textmagic.com/')) { texts.push(JSON.parse(opts.body)); return json({ id: 1 }); }
    if (url === TINY_JPG) return new Response(Buffer.from(TINY_JPG_BYTES, 'base64'), { status: 200 });
    if (fail) return new Response('{"error":"NOT_AUTHORIZED"}', { status: 403 });
    const u = new URL(url);
    if (u.host === 'content.airtable.com') {
      const [, , base, rec, field] = u.pathname.split('/');
      const r = safety.get(rec);
      if (base !== S.base || !r) return json({}, 404);
      const b = JSON.parse(opts.body);
      r.fields[field] = [...(r.fields[field] || []), { id: `att${nextId++}`, url: TINY_JPG, filename: b.filename, type: b.contentType, thumbnails: { large: { url: TINY_JPG } } }];
      return json({ id: rec, fields: r.fields });
    }
    const [, , base, table, rec] = u.pathname.split('/');
    if (base === S.base && table === S.table) {
      if (method === 'POST') {
        const b = JSON.parse(opts.body);
        const id = `recINC${String(nextId++).padStart(11, '0')}`;
        const fields = { ...b.fields, [S.f.number]: nextNum++ };
        for (const [k, v] of Object.entries(fields)) if (v == null || v === '') delete fields[k];
        safety.set(id, { id, fields });
        return json({ id, fields });
      }
      if (method === 'PATCH') {
        const r = safety.get(rec); if (!r) return json({}, 404);
        const b = JSON.parse(opts.body);
        for (const [k, v] of Object.entries(b.fields)) { if (v == null || v === '') delete r.fields[k]; else r.fields[k] = v; }
        return json({ id: rec, fields: r.fields });
      }
      if (rec) { const r = safety.get(rec); return r ? json(r) : json({}, 404); }
      // selects come back as names in this fake; the app handles both
      return json({ records: [...safety.values()] });
    }
    const records = base === E.base && table === E.table ? EMPLOYEE_RECORDS
      : base === J.base && table === J.table ? JOB_RECORDS : null;
    if (!records) return new Response('{}', { status: 404 });
    // two pages to exercise paging
    const offset = Number(u.searchParams.get('offset') || 0);
    const page = records.slice(offset, offset + 5);
    const next = offset + 5 < records.length ? String(offset + 5) : undefined;
    return new Response(JSON.stringify({ records: page, offset: next }), { status: 200 });
  };
  fn.calls = calls;
  fn.texts = texts;
  fn.safety = safety;
  return fn;
}

// 1x1 white JPEG
export const TINY_JPG_BYTES = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAeACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDeooorxj0wooooAKKKKACiiigAooooAKKKKAP/2Q==';
