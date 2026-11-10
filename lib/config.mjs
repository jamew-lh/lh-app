// Settings for the Lyons & Hohl landing app.
// Airtable IDs (not names) are used, so renaming a field or table in Airtable
// will not break the app.

export const EMPLOYEES = {
  base: 'appVAkO25s9Jv6flF',           // "Emloyees" base
  table: 'tbl5dilVgttDcOmJx',          // Employee List
  f: {
    name: 'fld18uq7PLwW5dwcp',         // Full Name Backward ("Last, First")
    status: 'fld6ATlAN0uCiW9BM',       // Status
    location: 'fldgBBV3UZ8BBu76g',     // Location
    position: 'fld7Pj9nljxrWkD9c',     // Position
    pin: 'fld9jizbIZHfBACqx',          // Timecard Pin
    cell: 'fldNrbI1gF8SfDSW6',         // Cell Phone
    // Shown only to the detailPositions below (tap a name in the phone list)
    hireDate: 'fld1CfWTXZQ9SqQ59',     // Hire Date
    driving: 'fldWRUuR21gPB6DNn',      // Driving List (Yes / No)
    medical: 'fldCXTs3WY2YPzxeV',      // Medical Card (Yes / No)
    medExp: 'fldt1F7VrPveXrpyL',       // Med Exp
    endorsements: 'fldtvTBKv2pQGvYpK', // Endorsements
    address: 'fldptlwFA4x4GvEsI',      // Address
    cityStateZip: 'fldp2fNg7tJti0vHN', // City State Zip
    materialAccess: 'fldNgDFTNdbEcGfrQ', // MATERIAL ACCESS (checkbox): sees the Material Orders button
    scheduleEditor: 'fldA44KYULMzt3sUg', // Schedule Editor (checkbox): can open and change the Daily Schedule
  },
  // Who can sign in, and who is on the phone list.
  allowStatus: ['Current Employee'],
  allowLocation: ['SIte Contractors'],   // spelled as it is in Airtable
  // People allowed in even though their Location is not Site Contractors.
  // Airtable record IDs (they still have to be a Current Employee with a PIN).
  extraPeople: [
    'recbAiVcHKoqqVXYZ', // Enck, Tyler L. (Paving)
  ],
  // Positions that also see the Equipment Viewer button.
  // "Superviser" and "SUP" are both spellings used in Airtable.
  equipmentPositions: ['Management', 'Office', 'Superviser', 'Supervisor', 'SUP', 'Foreman', 'Shop'],
  // People who also see the Equipment Viewer button even though their position isn't listed above.
  equipmentPeople: [
    'recfbG45qMZzjBzT0', // Edwards, Jared (Driver)
  ],
  // Positions that see the Supervisors section (E&S report forms).
  supervisorPositions: ['Superviser', 'Supervisor', 'SUP', 'Foreman', 'Management'],
  // Positions that also see the PM Service button.
  pmPositions: ['Shop'],
  // Positions that get the Vacation Calendar link (link is set in Netlify as VACATION_CALENDAR_URL).
  calendarPositions: ['Management'],
  // Positions that can tap a name in the phone list to see start date,
  // driving list, medical card and home address.
  detailPositions: ['Management', 'Superviser', 'Supervisor', 'SUP'],
  // Left off the phone list (they can still sign in). Airtable record IDs.
  phoneListHide: [
    'recS0mYheeTAZmeXh', // McCarney, Patti
    'recX7mle94324fL0y', // Korth, Brittany
    'recVQhVWzAPSFHWbz', // Enck, Bekkah
    'recb761dYQ0WyxkaE', // Grafstrom, Lisamarie C.
    'rec0Kuyi1TQ7YAoIz', // Smoker, Heather N.
    'recQz6Of7E8JQBJ7T', // Cusamano, Alyssa
  ],
  // Company numbers pinned to the top of the phone list.
  phoneListCompany: [
    { name: 'Site Office', cell: '610-942-2400', text: false }, // landline: call only
    { name: 'L&H HR Cell', cell: '484-986-8153', text: true },
  ],
};

export const JOBS = {
  base: 'appmX8rxmEtdwrzSt',           // "Job Name List" base
  table: 'tblg1mCHhTJXdZHCW',          // Imported table
  f: {
    name: 'fldpFY6sbJRMUX9AL',         // Job Name
    number: 'fldMMtGQ1rVxfbWNL',       // Number
    active: 'fld73fknW9fBDSIvW',       // Active
    supervisor: 'fld9VhD55fIBJrO87',   // Supervisor
    location: 'fldTWflEHhh5O2OW6',     // Location (google)
    address: 'fldYjVDiLG5BQ1YuS',      // Nearest Physical Address
    codes: 'fldmExOMmGG10pPnN',        // Codes (attachments)
    hospital: 'fldALwnMcj8IPCo5J',     // Nearest Hospital
    police: 'fldI0pzAILIf5b9Tr',       // Nearest Police Dept
    fire: 'fldy6ue6UwREWjAO5',         // Nearest Fire Dept
    toilet: 'fldf8SYYMGM1Hs3rW',       // Portable Toilet
    township: 'fldvjDDHrTpFLmwnC',     // Township Information
    utilities: 'fldSzEXTULOlUe56r',    // Utility Emergency Contacts
  },
};

export const VENDORS = {
  base: 'appRHYAMfmjaaajei',           // "Vendors" base
  table: 'tblmaPwHsaJrJSsyX',          // Table 1
  f: {
    name: 'fldFZqKAkXMlkh09O',         // Name
    address: 'fldrUwxT95JllvDJq',      // Address
    phone: 'fld4iHVAADZQPo65z',        // Phone Number
    type: 'fldF6OMawDAqP1RK8',         // Type
  },
};

export const TIME_ZONE = 'America/New_York';

// Sign-in
export const SESSION_DAYS = 90;
export const LOCKOUT = { maxFailures: 6, windowMinutes: 15, lockMinutes: 15 };

// How long Airtable data is reused before it is read again.
export const CACHE_MINUTES = 5;

// ---------------------------------------------------------------------------
// Safety → Incident Report (Lyons Hohl Loss Incident Investigation Report)
// Saved in the "Safety" base → Incident Reports table.
// ---------------------------------------------------------------------------
export const SAFETY = {
  base: 'apps6XaJewmWwJYLH',           // "Safety" base
  table: 'tbl9ZaVNJfjMIvvJZ',          // Incident Reports
  f: {
    report: 'fldOXlLxVCEF6MJPL',       // Report (title)
    number: 'fldsekJzKv9gbADWy',       // Report # (auto number)
    status: 'fld4tnZShCnMKG1hf',       // Status: Uploading / Submitted / In Review / Closed
    date: 'fldeteXWj1CEJYkiu',         // Date of Incident
    time: 'fldUQUDtjZ3DgiFVp',         // Time of Incident
    day: 'fldTQbVaPcVTxeRF2',          // Day
    shift: 'fld8Co4DXBG1tb6Av',        // Shift
    began: 'fldgIvJAEIFQxYxfe',        // Time Began Work
    job: 'fldAUvONGnsondUqE',          // Job
    jobNumber: 'fldu9rVjoU5ulPMOV',    // Job Number
    injured: 'fldYVppU9jnYt1hno',      // Injured Employee
    jobTitle: 'fld5VpAqKXy4Y1pNU',     // Job Title
    injuryClass: 'fldAqmGlCH3YcJzrI',  // Injury Class (multiple)
    location: 'fldqWiCBY45vJQhAp',     // Location of Incident
    locationOther: 'fldH7vz1Q0lqd63lS',// Location Details
    working: 'fldxbzihIVNXSfpj3',      // Employee Was Working
    workingOther: 'flddRzZIBDTE97mQH', // Working Details
    witnesses: 'fld9jOZm596k4wwcR',    // Witnesses
    task: 'fldOZLIpdRtRFGQY3',         // Task/Activity
    nature: 'fld3THhIIsbcKqKno',       // Nature of Injury/Illness
    how: 'fldknpzk2axWKadGJ',          // How Incident Occurred
    causes: 'fldmMg8lNbmWGxQXh',       // Causal Factors
    corrective: 'fldt4pnbVwoc5PuqA',   // Corrective Actions
    drug: 'fldTly451WjhGOnWm',         // Drug Test
    drugDate: 'fldO7NP9H0WfvQnP8',     // Drug Test Date
    alcohol: 'fldyztuspA6SgkK3m',      // Alcohol Test
    alcoholDate: 'fldPoD8xGYQIEhoT1',  // Alcohol Test Date
    cases: 'fldDo6i5WUxv6A5Rq',        // Case Numbers and Names
    photos: 'fldqbS81glpMd9HsN',       // Photos
    preparedBy: 'fldb1JdzobHanfAb7',   // Prepared By
    preparedTitle: 'fldJfx4fK5nQcgkgD',// Prepared By Title
    preparedDate: 'fldzryNayclRGrfJO', // Prepared Date
    preparedSig: 'fld87xe8UsuUJgf4c',  // Prepared Signature
    preparedById: 'fld474mZ5mBtkigGO', // Prepared By ID
    supName: 'fldAuzjfKf3YdZXwb', supDate: 'fldQfWdboLCNtW7OF', supSig: 'fldkmRYMZ7OKXdYo9',          // Supervisor review
    coordName: 'fldrVbRXV6rkVKNfT', coordDate: 'fldTCt3wMmtFqVzF3', coordSig: 'fldfG7Nzil29VhMWo',    // Safety Coordinator review
    commName: 'fld2WktvbV9laDhbr', commDate: 'fldvA1RHrs1L3ZlDQ', commSig: 'fldVMSUR791yzyggJ',       // Safety Committee review
    submittedAt: 'fldPcPhNmxXExRywO',  // Submitted At
    gps: 'fldMVJBwSgiJERnns',          // GPS
    officeNotes: 'fldkXDPZWgtadxsG2',  // Office Notes
    textsSent: 'fld3b9fo3VRmNZjvf',    // Texts Sent
    appLink: 'fld4WdHhDtxnkOFGC',      // App Link (used by the email automation)
  },
  injuryClasses: ['Fatality', 'Medical', 'First Aid', 'Automobile', 'Property Damage', 'Near Miss'],
  // Who can fill out a report
  filePositions: ['Superviser', 'Supervisor', 'SUP', 'Foreman', 'Management'],
  // Who sees every report (Foremen see only the ones they filed). Supervisors see all
  // so they can do the Supervisor sign-off.
  viewAllPositions: ['Management', 'Superviser', 'Supervisor', 'SUP'],
  viewAllPeople: ['recu5oe4hLAB7KXLJ', 'recb761dYQ0WyxkaE'], // James Woodard, Lisamarie Grafstrom
  // The office: sees and fills in Drug / Alcohol test and Office Notes.
  officePositions: ['Management'],
  officePeople: ['recu5oe4hLAB7KXLJ', 'recb761dYQ0WyxkaE'],
  // Sign-off steps, in order
  reviews: [
    { key: 'supervisor', label: 'Supervisor', positions: ['Superviser', 'Supervisor', 'SUP', 'Management'], people: [] },
    { key: 'coordinator', label: 'Safety Coordinator', positions: [], people: ['recu5oe4hLAB7KXLJ'] }, // James Woodard
    { key: 'committee', label: 'Safety Committee', positions: [], people: ['recb761dYQ0WyxkaE'] },    // Lisamarie Grafstrom
  ],
  // Texted (with a link) when a report is submitted. Uses TextMagic, like the timecard app.
  // Employee IDs use the Cell Phone in the Employee List, so a number change there is picked up.
  textPeople: ['recIwytS3JrkBVb12', 'recu5oe4hLAB7KXLJ'], // Bob Arment, James Woodard
  textNumbers: [{ name: 'L&H HR Cell', cell: '484-986-8153' }],
  maxPhotos: 12,
};

// ---------------------------------------------------------------------------
// Daily Schedule (crew scheduler). Editors only; see README → Daily Schedule.
// ---------------------------------------------------------------------------
export const SCHEDULE = {
  // Who can open and change the schedule: the "Schedule Editor" checkbox in the Employee List (EMPLOYEES.f.scheduleEditor).
  // Extra Employee List fields the schedule uses.
  people: {
    scheduleName: 'fldVeHK5I9jXX0wKa', // Schedule Name ("Spud S.")
    include: 'fldEpxWhElRCiFB4y',      // Include on Schedule (checkbox)
    getsLink: 'fldQSnpTOD0ffnUkx',     // Daily Schedule (checkbox): gets the published link by text
    linkPhone: 'fldstoyzYfJpMVfhM',    // Schedule Link Phone: when filled in, the link text goes here instead
    textMagicId: 'fldNatah7G0Z3sAsr',  // TextMagic Contact ID (filled by the timecard app)
  },
  // Where schedules are saved.
  days: {
    base: 'appehzc9Hjt88dJ2o',         // "Daily Schedules" base
    table: 'tblwP6R3eA12y0lSh',        // Schedule Days
    f: {
      date: 'fldtiNCotg1GM7xpR',       // Date (YYYY-MM-DD)
      board: 'fldeWD2lRbivaCwlg',      // Board (JSON)
      version: 'fldbZvxsRH5Jt26G3',    // Version
      updatedAt: 'fldCZ6r0EHIGrhrbs',  // Updated At
      updatedBy: 'fldMivx7MOAo2iEOD',  // Updated By
      publishedAt: 'fld9bgRo2pHaXfM39',// Published At
      token: 'flduhvsJhtUjl0nOh',      // Share Token
      expires: 'fld8xJ5x7HKdozalu',    // Share Expires
      textedAt: 'fldB5tYFRb8LjtlDR',   // Link Texted At
    },
  },
  log: {
    base: 'appehzc9Hjt88dJ2o',
    table: 'tblaOPxOuB5aCP65E',        // Schedule Log
    f: { title: 'fldYdGtoLvKMYH4Mm', day: 'fldpcO21y8rCbCkvk', when: 'fldcKghMepjdEzqlm', who: 'fld8cWFcADA9cJYyL', change: 'fld3VovCu37t0jrb5' },
  },
  equipment: {
    base: 'appmhefV6jugAxROJ',         // "LH Equipment" base
    table: 'tblHqR9T4pGezce4B',        // Equipment Info
    f: {
      id: 'fldCK3EBHrOrlrqfU',         // EquipmentID ("336-06")
      location: 'flduZshwr22R9gIjX',   // Location
      tracking: 'fldkPYyhbkHJl2Uoq',   // TRACKING (checkbox): only these show in the Yard
      status: 'fldd4ONpETk0OYN2J',     // Status
      type: 'fld3bxJBs8vzWDzeb',       // Type
      make: 'fldsPSU1dU3k71uC1',
      model: 'fldffYif52GzuGrPn',
    },
    downStatus: ['Down for Maintenance'], // shown in Repair
    hideStatus: ['Sold/Trade', 'Out of Service'],
  },
  moves: {
    base: 'appmhefV6jugAxROJ',
    table: 'tblSSILxWVOVyA7x8',        // Moves (from the equipment app)
    f: {
      equipment: 'fldB3iVYkWTTqdBGW', type: 'flddYHzVGV12nQxHV', status: 'fldzBUAUV2RiqmZ2l', date: 'fldwdYVmJ17nkMtaX',
      from: 'fldC8rfGuW9zKimMg', to: 'fld5sBF2dIP6v6j3T', truck: 'fldROaNKqoZWfvXnA', driver: 'fldMpx7GiYjf72Wr6',
      order: 'fldMoUURn4Jr1c0eI',   // set by "Arrange order" in the equipment app (TV order)
    },
  },
  // The equipment app's Change Log: every "Location" change (a move marked done, or a location edited in the app).
  // The board picks these up for today and later days, so a machine moved in the equipment app shows up there.
  changes: {
    base: 'appmhefV6jugAxROJ',
    table: 'tbl00wX3WN9nMjgZQ',        // Change Log
    f: { equipment: 'fldV0eMurA390mECO', when: 'fldIMtvF8gY9okxaE', change: 'fldWYpOM7dkRjmdVU', to: 'fldU18dW5HwnLXl3n' },
    days: 30,                          // how far back to look
  },
  timeOff: {
    base: 'appYAh8IPmhjOzDVn',         // "Timecards" base
    table: 'tblNUuflBFhvO2V4k',        // Scheduled Time Off (from the timecard app)
    f: {
      employee: 'fldw5bwiRBmWUgb6g',   // Employee ID (Employee List record ID)
      from: 'fld401M66ApbJlnpJ', to: 'fldSuML3zUhzm6vCD', hours: 'fld7rhLQjfKCdrXvn', status: 'fldOJrTtCZhr6LKeg', type: 'fld6SXEu04HLzfrY1',
    },
    fullDayHours: 8,                   // less than this per day = partial day (e.g. off at noon)
  },
  haulers: {
    base: 'appRHYAMfmjaaajei',         // "Vendors" base
    table: 'tblVlEIypfE6dQxmo',        // Hired Trucks
    f: { name: 'fldjLlt2ehJR2krKv', contact: 'fld1rCnQ0WTHkfBSZ', phone: 'fldpyzAPzViD5hKp6' },
  },
  subs: {
    base: 'appRHYAMfmjaaajei',         // "Vendors" base
    table: 'tbl7gk9SqcoSwMKxo',        // Sub-Contractors
    f: { name: 'fldWu4FmgFwqtmj2U' },
  },
  // Equipment app Location names that don't match a job name. Location → Job Name List record ID.
  // Names that match a job exactly (Valley Creek, Gray Farm, Sadsbury, …) don't need to be here.
  // Locations not found (HB Shop, LHP, …) count as the Yard.
  locationToJob: {
    'TOA 3': 'recVqDWLMpvG8kpt7',
    '1201 Colllegeville': 'recjLtncWLMWoxogg',
    'Mill Run': 'rec5WaCGII5Np25ph',
    'Little Ducklings WB': 'recbNanNBQpsWbFRV',
    'Morgantown LD': 'recDsPyWlusKAm5Fh',
    'Chestnut Ridge': 'recSymzWpCsz4wEJE',
    'Harvest Run': 'recfdZA67LFjUsEKy',
    'Swinehart': 'recfdZA67LFjUsEKy',
    'Knickerbocker': 'recsJgy2RgLfkYhBm',
    'Sycamore': 'rec0POuanaaG7Gg5I',
    'Marsh Creek': 'recAtnNVv5xcI3LaT',
    '416 Ridge Pike': 'recBS0fWu3LydMHUF',
    'TVFD': 'reccGT0wU8ni0mcwG',
    'Kimberton': 'rec3IwpI8Ji1p8Dm8',
    'Southern berks': 'rec2HfDa8BAvJUcqL',
  },
  shareDays: 4,                        // published link works this many days after the first publish
};
