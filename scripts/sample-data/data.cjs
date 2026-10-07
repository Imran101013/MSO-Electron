// Dummy records for trying out every part of MSO (scripts/sample-data/seed.cjs loads them).
// Nothing here is real: names, phone numbers and amounts are made up.
//
// The story: MSO kept paper registers until 31/12/2024 (the cut-over). Its balances on that day come
// in through the opening-balances Excel import, with the 2024 profit still to be shared. From January
// 2025 every monthly meeting is recorded in the app, up to September 2026. The July 2025 AGM shares
// the 2024 profit (from the registers' figures); the 2025 profit is left for you to distribute.
//
// Members are referred to by a short key. Dates are yyyy-MM-dd.

const VILLAGE = 'Village Mogh, Tehsil & District Lower Chitral';

const CUTOVER = '2024-12-31';
/** When the opening balances are imported: the week before the first meeting kept in the app. */
const importedOn = '2025-01-05';

// ── Opening balances (the Excel import) ──────────────────────────────────────

/** Members in the paper registers at the cut-over. `absences2024`: meetings marked absent in 2024. */
const openingMembers = [
  { key: 'rehman', name: 'Abdul Rehman', fatherName: 'Ghulam Rasool', phone: '03001234501', address: VILLAGE, joinDate: '2008-03-16', savings: 245000, absences2024: 0 },
  { key: 'aliMajeed', name: 'Muhammad Ali', fatherName: 'Abdul Majeed', phone: '+923451234502', address: VILLAGE, joinDate: '2008-03-16', savings: 238500, absences2024: 1 },
  { key: 'aliNoor', name: 'Muhammad Ali', fatherName: 'Noor Ahmed', phone: '03151234503', address: 'Ayun, Tehsil & District Lower Chitral', joinDate: '2012-07-08', savings: 162000, absences2024: 0 },
  { key: 'khalid', name: 'Khalid Mehmood', fatherName: 'Bashir Ahmed', phone: '03331234504', address: VILLAGE, joinDate: '2008-03-16', savings: 251000, absences2024: 2 },
  { key: 'tariq', name: 'Tariq Mehmood', fatherName: 'Allah Ditta', phone: '03001234505', address: VILLAGE, joinDate: '2009-01-11', savings: 219000, absences2024: 0 },
  { key: 'usman', name: 'Usman Ghani', fatherName: 'Fazal Karim', phone: '03461234506', address: VILLAGE, joinDate: '2010-05-09', savings: 198500, absences2024: 3 },
  { key: 'imran', name: 'Imran Haider', fatherName: 'Mumtaz Hussain', phone: '03121234507', address: 'Chitral Town, District Lower Chitral', joinDate: '2011-02-13', savings: 176000, absences2024: 0 },
  { key: 'naveed', name: 'Naveed Akhtar', fatherName: 'Muhammad Akhtar', phone: '03011234508', address: VILLAGE, joinDate: '2011-09-11', savings: 184250, absences2024: 1 },
  { key: 'shahid', name: 'Shahid Iqbal', fatherName: 'Iqbal Hussain', phone: '03341234509', address: VILLAGE, joinDate: '2013-04-14', savings: 141000, absences2024: 0 },
  // No phone number: sharing to this member on WhatsApp has to fall back to picking the chat.
  { key: 'zafar', name: 'Zafar Iqbal', fatherName: 'Muhammad Iqbal', phone: '', address: VILLAGE, joinDate: '2014-01-12', savings: 133500, absences2024: 2 },
  { key: 'asif', name: 'Asif Nawaz', fatherName: 'Rab Nawaz', phone: '03051234511', address: VILLAGE, joinDate: '2015-06-14', savings: 117000, absences2024: 0 },
  { key: 'faisal', name: 'Faisal Shahzad', fatherName: 'Shahzad Ahmed', phone: '03211234512', address: 'Ayun, Tehsil & District Lower Chitral', joinDate: '2016-03-13', savings: 102000, absences2024: 1 },
  { key: 'kamran', name: 'Kamran Yousaf', fatherName: 'Muhammad Yousaf', phone: '03061234513', address: VILLAGE, joinDate: '2017-08-13', savings: 88500, absences2024: 0 },
  { key: 'bilal', name: 'Bilal Ahmed', fatherName: 'Mushtaq Ahmed', phone: '03141234514', address: VILLAGE, joinDate: '2018-02-11', savings: 76000, absences2024: 4 },
  { key: 'hamza', name: 'Hamza Rasheed', fatherName: 'Abdul Rasheed', phone: '03351234515', address: VILLAGE, joinDate: '2019-10-13', savings: 59000, absences2024: 0 },
  { key: 'waqas', name: 'Waqas Anwar', fatherName: 'Anwar ul Haq', phone: '03071234516', address: VILLAGE, joinDate: '2021-01-10', savings: 42000, absences2024: 1 },
  { key: 'junaid', name: 'Junaid Akram', fatherName: 'Muhammad Akram', phone: '03171234517', address: 'Chitral Town, District Lower Chitral', joinDate: '2022-05-08', savings: 27500, absences2024: 0 },
  { key: 'sohail', name: 'Sohail Abbas', fatherName: 'Ghulam Abbas', phone: '03081234518', address: VILLAGE, joinDate: '2024-11-10', savings: 3000, absences2024: 0 },
  // Nothing saved at the cut-over: gets no share of the 2024 profit, so pays no absence charge either.
  { key: 'adeel', name: 'Adeel Raza', fatherName: 'Raza Hussain', phone: '03181234519', address: VILLAGE, joinDate: '2024-12-08', savings: 0, absences2024: 1 },
];

/**
 * Loans still owing at the cut-over (amounts in PKR, as written in the registers). Their interest is
 * worked out at the interest rate in the app's Settings, like the loans issued in the app.
 */
const openingLoans = [
  // Repaid in full in April 2025, before its due date: its interest counts in the 2025 profit.
  { key: 'OL-khalid', member: 'khalid', loanDate: '2024-05-12', amount: 100000, repaid: 40000, penalties: 0, defaulted: 'No', note: 'Register 3, page 41' },
  // Already late at the cut-over (3 penalties); the app adds one more, then it is cleared in Feb 2025.
  { key: 'OL-usman', member: 'usman', loanDate: '2023-09-10', amount: 50000, repaid: 30000, penalties: 1500, defaulted: 'No', note: 'Late since 10/09/2024' },
  // Written off by the committee before the cut-over: no penalties are added after it.
  { key: 'OL-faisal', member: 'faisal', loanDate: '2022-06-12', amount: 80000, repaid: 20000, penalties: 6000, defaulted: 'Yes', note: 'Written off at the Nov 2024 meeting' },
  // Large loan, partly repaid in the app, overdue since Nov 2025 with penalties still being added.
  { key: 'OL-tariq', member: 'tariq', loanDate: '2024-11-10', amount: 200000, repaid: 0, penalties: 0, defaulted: 'No', note: '' },
  // Cleared the day before its due date in Aug 2025.
  { key: 'OL-shahid', member: 'shahid', loanDate: '2024-08-11', amount: 40000, repaid: 15000, penalties: 0, defaulted: 'No', note: '' },
];

const openingReserve = 185000;

/**
 * The 2024 profit, still to be shared at the July 2025 AGM ("Profit not yet shared" sheet). The loan
 * interest collected in 2024 is worked out from the amount lent on the loans repaid in full that year,
 * at the app's interest rate.
 */
const openingProfit = { bankProfit: 128400, lentOnLoansRepaid: 145000, penalties: 1000 };

// ── Records kept in the app from January 2025 ────────────────────────────────

/** Monthly contribution each member usually brings (PKR). */
const monthly = {
  rehman: 10000, aliMajeed: 10000, aliNoor: 5000, khalid: 10000, tariq: 5000, usman: 5000, imran: 5000,
  naveed: 5000, shahid: 5000, zafar: 3000, asif: 5000, faisal: 3000, kamran: 3000, bilal: 3000, hamza: 3000,
  waqas: 2000, junaid: 2000, sohail: 2000, adeel: 2000, danish: 3000, rizwan: 1000, ehsan: 2000, noman: 2000,
};

/** Members who join in the app (added on the Members page the day they join). */
const newMembers = [
  { key: 'danish', name: 'Danish Kamal', father_name: 'Kamal ud Din', phone: '03191234520', email: 'danish.kamal@example.com', address: VILLAGE, dob: '1994-06-21', join_date: '2025-03-09', photo: true },
  // Joins late in 2025 with a small balance and misses two meetings: his absence charges at the
  // 2025 AGM are more than his share, so the rest is waived.
  { key: 'rizwan', name: 'Rizwan Saeed', father_name: 'Saeed Akhtar', phone: '03091234521', email: '', address: VILLAGE, dob: '2001-02-14', join_date: '2025-10-12', photo: false },
  { key: 'ehsan', name: 'Ehsan Ullah', father_name: 'Hafeez Ullah', phone: '+923361234522', email: 'ehsanullah@example.com', address: 'Ayun, Tehsil & District Lower Chitral', dob: '1988-11-03', join_date: '2026-02-08', photo: true },
  // Joined in 2026: no savings on 31/12/2025, so no share of the 2025 profit.
  { key: 'noman', name: 'Noman Tariq', father_name: 'Tariq Javed', phone: '03111234523', email: '', address: VILLAGE, dob: null, join_date: '2026-08-09', photo: false },
  // Joined this month, after the last meeting: no records yet (safe to try deleting a member with).
  { key: 'sajjad', name: 'Sajjad Hussain', father_name: 'Altaf Hussain', phone: '03241234524', email: '', address: VILLAGE, dob: '2003-05-30', join_date: '2026-10-04', photo: false },
];

/** Details filled in later for members brought in by the import (edited on the Members page). */
const memberUpdates = [
  { key: 'rehman', dob: '1961-04-02', email: 'abdulrehman.mogh@example.com', photo: true },
  { key: 'aliMajeed', dob: '1965-09-15', email: '', photo: true },
  { key: 'khalid', dob: '1968-01-27', email: 'khalid.mehmood@example.com', photo: false },
  { key: 'imran', dob: '1979-12-05', email: 'imran.haider@example.com', photo: true },
  { key: 'junaid', dob: '1997-07-19', email: '', photo: true },
];

const VENUES = {
  hall: 'Community hall, Village Mogh',
  masjid: 'Jamia Masjid committee room, Mogh',
  rehman: "Abdul Rehman's house, Mogh",
};

/**
 * One row per monthly meeting (second Sunday). `absent` / `leave` list member keys; everyone else
 * present. A member who misses a meeting brings that month's contribution at the next one they attend.
 */
const meetings = [
  { date: '2025-01-12', time: '15:00', venue: 'hall', absent: ['zafar'], leave: [],
    agenda: 'First meeting kept in the app; monthly contributions; loan repayments',
    decisions: 'Opening balances from the paper registers (31/12/2024) were read out and accepted. From today every meeting is recorded in the app.' },
  { date: '2025-02-09', time: '15:00', venue: 'hall', absent: ['bilal'], leave: ['waqas'],
    agenda: 'Monthly contributions; loan application of Asif Nawaz',
    decisions: 'Loan of PKR 60,000 approved for Asif Nawaz. Usman Ghani cleared his overdue loan in full.' },
  { date: '2025-03-09', time: '15:00', venue: 'hall', absent: [], leave: ['hamza'],
    agenda: 'Monthly contributions; new member; small loan for Kamran Yousaf',
    decisions: 'Danish Kamal (s/o Kamal ud Din) admitted as a member. Loan of PKR 15,000 approved for Kamran Yousaf. Donation of PKR 25,000 from Haji Abdul Ghafoor received for the reserve fund.' },
  { date: '2025-04-13', time: '15:00', venue: 'masjid', absent: ['faisal', 'junaid'], leave: [],
    agenda: 'Monthly contributions; loan for Danish Kamal',
    decisions: 'Loan of PKR 30,000 approved for Danish Kamal. Khalid Mehmood repaid his loan in full.' },
  { date: '2025-05-11', time: '15:00', venue: 'hall', absent: ['bilal'], leave: ['zafar'],
    agenda: 'Monthly contributions; request for medical help from the reserve fund',
    decisions: "PKR 30,000 paid from the reserve fund towards the treatment of Zafar Iqbal's mother." },
  { date: '2025-06-08', time: '15:00', venue: 'hall', absent: [], leave: ['sohail'],
    agenda: 'Monthly contributions; loan application of Imran Haider',
    decisions: 'Loan of PKR 100,000 approved for Imran Haider (cheque withdrawal; bank charge to be checked on the statement).' },
  { date: '2025-07-13', time: '10:30', venue: 'rehman', absent: [], leave: ['sohail'],
    agenda: 'Annual General Meeting: accounts for 2024 and sharing of the 2024 profit',
    decisions: 'The 2024 profit was shared: 30% to the reserve fund and the rest by savings on 31/12/2024, less absence charges. Bank profit for January-June 2025 noted. Bank charge of PKR 250 on Imran Haider\'s loan cheque entered from the statement.',
    bankProfit: { amount: 58750, creditedOn: '2025-06-30', profitYear: 2025 } },
  { date: '2025-08-10', time: '15:00', venue: 'hall', absent: ['usman'], leave: [],
    agenda: 'Monthly contributions; loan for Hamza Rasheed',
    decisions: 'Loan of PKR 40,000 approved for Hamza Rasheed. Shahid Iqbal cleared his loan from the registers.' },
  { date: '2025-09-14', time: '15:00', venue: 'hall', absent: ['bilal', 'adeel'], leave: ['imran'],
    agenda: 'Monthly contributions; attendance',
    decisions: 'Members reminded that each absence without leave is charged PKR 50 from the year-end profit share. Kamran Yousaf repaid his loan in full.' },
  { date: '2025-10-12', time: '15:00', venue: 'masjid', absent: [], leave: ['naveed'],
    agenda: 'Monthly contributions; new member; flood relief',
    decisions: 'Rizwan Saeed (s/o Saeed Akhtar) admitted as a member. Loan of PKR 25,000 approved for Junaid Akram. PKR 75,000 given from the reserve fund for flood relief in the valley (cheque; bank charge PKR 200).' },
  { date: '2025-11-09', time: '15:00', venue: 'hall', absent: ['bilal', 'rizwan'], leave: [],
    agenda: 'Monthly contributions; loan repayments',
    decisions: 'Asif Nawaz repaid his loan in full, with the bank charge.' },
  { date: '2025-12-14', time: '15:00', venue: 'hall', absent: ['rizwan', 'waqas'], leave: ['kamran'],
    agenda: 'Monthly contributions; overdue loans',
    decisions: "Tariq Mehmood's loan is past its due date (10/11/2025); PKR 500 is added for each full month until it is cleared." },
  { date: '2026-01-11', time: '15:00', venue: 'hall', absent: [], leave: ['danish'],
    agenda: 'Monthly contributions; bank profit for 2025; loan for Muhammad Ali (s/o Noor Ahmed)',
    decisions: 'The bank credited the July-December 2025 profit on 05/01/2026; it is counted with the 2025 profit. Loan of PKR 75,000 approved for Muhammad Ali (s/o Noor Ahmed), bank charge PKR 200.',
    bankProfit: { amount: 63400, creditedOn: '2026-01-05', profitYear: 2025 } },
  { date: '2026-02-08', time: '15:00', venue: 'hall', absent: ['tariq'], leave: [],
    agenda: 'Monthly contributions; new member; donation',
    decisions: 'Ehsan Ullah (s/o Hafeez Ullah) admitted as a member. Donation of PKR 10,000 received for the reserve fund.' },
  { date: '2026-03-08', time: '15:00', venue: 'masjid', absent: ['bilal'], leave: ['asif'],
    agenda: 'Monthly contributions; loan repayments',
    decisions: 'Danish Kamal repaid his loan in full.' },
  { date: '2026-04-12', time: '15:00', venue: 'hall', absent: ['hamza'], leave: [],
    agenda: 'Monthly contributions; help from the reserve fund',
    decisions: "PKR 12,000 paid from the reserve fund for funeral arrangements. Naveed Akhtar cleared his late loan with two months' penalties." },
  { date: '2026-05-10', time: '15:00', venue: 'hall', absent: [], leave: ['shahid'],
    agenda: 'Monthly contributions; loan for Kamran Yousaf',
    decisions: 'Second loan of PKR 20,000 approved for Kamran Yousaf.' },
  { date: '2026-06-14', time: '15:00', venue: 'hall', absent: ['hamza'], leave: ['zafar'],
    agenda: 'Monthly contributions; loan for Muhammad Ali (s/o Abdul Majeed)',
    decisions: 'Loan of PKR 50,000 approved for Muhammad Ali (s/o Abdul Majeed); at the limit, so no bank charge.' },
  { date: '2026-07-12', time: '10:30', venue: 'rehman', absent: [], leave: ['ehsan'],
    agenda: 'Annual General Meeting: accounts for 2025 and sharing of the 2025 profit',
    decisions: 'Accounts for 2025 presented. Bank profit for January-June 2026 noted.',
    bankProfit: { amount: 71200, creditedOn: '2026-06-30', profitYear: 2026 } },
  { date: '2026-08-09', time: '15:00', venue: 'hall', absent: ['hamza'], leave: [],
    agenda: 'Monthly contributions; new member',
    decisions: 'Noman Tariq (s/o Tariq Javed) admitted as a member.' },
  { date: '2026-09-13', time: '15:00', venue: 'masjid', absent: ['hamza'], leave: ['faisal'],
    agenda: "Monthly contributions; Hamza Rasheed's unpaid loan; loan for Abdul Rehman",
    decisions: "Hamza Rasheed's loan marked defaulted by the committee; no more penalties after today. Loan of PKR 150,000 approved for Abdul Rehman (bank charge to be entered from the statement). Abdul Rehman gave PKR 5,000 to the reserve fund." },
];

/** Meetings scheduled but not yet held. */
const upcoming = [
  { date: '2026-10-11', time: '15:00', venue: VENUES.hall },
  { date: '2026-11-08', time: '15:00', venue: VENUES.masjid },
];

/**
 * Loans issued in the app, on the Loans page. `pay`: repayments as [date, amount]; amount 'rest'
 * clears whatever is owed that day (penalties included). `bankChargeLater` is entered afterwards
 * from the bank statement (Loans -> View -> Bank charge).
 */
const appLoans = [
  { key: 'A-naveed', member: 'naveed', date: '2025-01-12', amount: 45000, pay: [['2025-06-08', 15000], ['2025-10-12', 15000], ['2026-04-12', 'rest']] },
  { key: 'A-asif', member: 'asif', date: '2025-02-09', amount: 60000, bankCharge: 150, pay: [['2025-05-11', 20000], ['2025-08-10', 20000], ['2025-11-09', 'rest']] },
  { key: 'A-kamran1', member: 'kamran', date: '2025-03-09', amount: 15000, pay: [['2025-06-08', 5000], ['2025-09-14', 'rest']] },
  { key: 'A-danish', member: 'danish', date: '2025-04-13', amount: 30000, pay: [['2025-07-13', 10000], ['2025-12-14', 10000], ['2026-03-08', 'rest']] },
  { key: 'A-imran', member: 'imran', date: '2025-06-08', amount: 100000, bankChargeLater: { on: '2025-07-13', amount: 250 },
    pay: [['2025-09-14', 25000], ['2025-12-14', 25000], ['2026-03-08', 20000], ['2026-06-14', 10000], ['2026-08-09', 5000], ['2026-09-13', 5000]] },
  { key: 'A-hamza', member: 'hamza', date: '2025-08-10', amount: 40000, pay: [['2025-11-09', 5000], ['2026-02-08', 5000]], defaultedOn: '2026-09-13' },
  { key: 'A-junaid', member: 'junaid', date: '2025-10-12', amount: 25000, pay: [['2026-01-11', 5000], ['2026-04-12', 5000], ['2026-07-12', 5000], ['2026-09-13', 5000]] },
  { key: 'A-aliNoor', member: 'aliNoor', date: '2026-01-11', amount: 75000, bankCharge: 200, pay: [['2026-04-12', 15000], ['2026-07-12', 15000], ['2026-09-13', 10000]] },
  { key: 'A-kamran2', member: 'kamran', date: '2026-05-10', amount: 20000, pay: [['2026-08-09', 5000]] },
  { key: 'A-aliMajeed', member: 'aliMajeed', date: '2026-06-14', amount: 50000, pay: [] },
  { key: 'A-rehman', member: 'rehman', date: '2026-09-13', amount: 150000, pay: [] },
];

/** Repayments in the app on loans brought in from the registers. */
const openingLoanPayments = {
  'OL-khalid': [['2025-02-09', 20000], ['2025-04-13', 'rest']],
  'OL-usman': [['2025-01-12', 10000], ['2025-02-09', 'rest']],
  'OL-tariq': [['2025-03-09', 25000], ['2025-06-08', 25000], ['2025-09-14', 30000], ['2025-12-14', 20000], ['2026-02-08', 30000], ['2026-05-10', 20000], ['2026-08-09', 15000]],
  'OL-shahid': [['2025-05-11', 10000], ['2025-08-10', 'rest']],
};

/** Reserve fund entries made on the Reserve page. */
const reserve = [
  { date: '2025-03-09', transaction_type: 'donation', amount: 25000, donor_name: 'Haji Abdul Ghafoor', notes: 'Donation for the welfare fund' },
  { date: '2025-05-11', transaction_type: 'expense', amount: 30000, donor_name: 'Zafar Iqbal', notes: "Medical treatment of Zafar Iqbal's mother" },
  { date: '2025-10-12', transaction_type: 'expense', amount: 75000, bank_charge: 200, donor_name: 'Village flood relief committee', notes: 'Flood relief in the valley' },
  { date: '2026-02-08', transaction_type: 'donation', amount: 10000, donor_name: 'A well-wisher', notes: 'Did not want to be named' },
  { date: '2026-04-12', transaction_type: 'expense', amount: 12000, donor_name: 'Family of the late Sher Wali', notes: 'Funeral arrangements' },
  { date: '2026-09-13', transaction_type: 'donation', amount: 5000, donor_name: 'Abdul Rehman', notes: 'Member donation' },
];

/** Corrections made after the fact, so the Audit Log has updates and deletions, not only additions. */
const corrections = {
  // Zafar Iqbal sent his contribution and asked for leave on 14/06/2026, but was marked absent when
  // the meeting was entered; it is put right afterwards (Meeting details -> Edit).
  attendance: { meeting: '2026-06-14', member: 'zafar', recordedAs: 'absent' },
  // The July 2026 bank profit typed in again at the August meeting by mistake, then removed.
  duplicateBankProfit: { meeting: '2026-08-09', amount: 71200, creditedOn: '2026-06-30', profitYear: 2026 },
};

module.exports = {
  CUTOVER, importedOn, VENUES, openingMembers, openingLoans, openingReserve, openingProfit, monthly, newMembers,
  memberUpdates, meetings, upcoming, appLoans, openingLoanPayments, reserve, corrections,
};
