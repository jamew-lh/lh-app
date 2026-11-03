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
