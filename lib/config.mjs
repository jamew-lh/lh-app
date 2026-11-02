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
  },
  // Who can sign in, and who is on the phone list.
  allowStatus: ['Current Employee'],
  allowLocation: ['SIte Contractors'],   // spelled as it is in Airtable
  // Positions that also see the Equipment Viewer button.
  // "Superviser" and "SUP" are both spellings used in Airtable.
  equipmentPositions: ['Management', 'Office', 'Superviser', 'Supervisor', 'SUP', 'Foreman'],
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
