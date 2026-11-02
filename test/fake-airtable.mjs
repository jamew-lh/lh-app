// A stand-in for the Airtable API, for tests and the local preview.
// Names and phone numbers here are made up.
import { EMPLOYEES as E, JOBS as J } from '../lib/config.mjs';

const emp = (id, name, pin, position, cell, status = 'Current Employee', location = 'SIte Contractors') => ({
  id, fields: { [E.f.name]: name, [E.f.pin]: pin, [E.f.position]: { name: position }, [E.f.status]: { name: status }, [E.f.location]: { name: location }, [E.f.cell]: cell },
});

export const EMPLOYEE_RECORDS = [
  emp('recEMP0000000001', 'Walker, James', '1234', 'Office', '(610) 555-0101'),
  emp('recEMP0000000002', 'Rivera, Tony', '4321', 'Operator', '(610) 555-0102'),
  emp('recEMP0000000003', 'Baker, Sam', '5555', 'Foreman', '(610) 555-0103'),
  emp('recEMP0000000004', 'Old, Former', '9999', 'Laborer', '(610) 555-0104', 'Past Employee'),
  emp('recEMP0000000005', 'Paver, Pat', '7777', 'Operator', '(610) 555-0105', 'Current Employee', 'Paving'),
  emp('recEMP0000000006', 'Chen, Lee', '2468', 'Superviser', '(484) 555-0106'),
  emp('recEMP0000000007', 'Adams, Nopin', '', 'Laborer', '(484) 555-0107'),
  emp('recEMP0000000009', 'Smoker, Gage', '1111', 'Laborer', '(610) 555-0109'),
  emp('recEMP0000000010', 'Smoker, Chad M.', '2222', 'Shop', '(610) 555-0110'),
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

export function fakeFetch({ fail = false } = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (fail) return new Response('{"error":"NOT_AUTHORIZED"}', { status: 403 });
    const u = new URL(url);
    const [, , base, table] = u.pathname.split('/');
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
  return fn;
}
