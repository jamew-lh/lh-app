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
