// Fills an empty MSO database with dummy records for trying out every part of the app.
//
//   npm run seed:sample
//
// Run it only on an empty database (Settings -> Clear all records first); it refuses otherwise, so
// it can never mix dummy records into real ones. The records are in ./data.cjs.
//
// Nothing is written with hand-made SQL. This starts the app itself (electron/main.cjs, on its own
// Vite dev server, in a hidden window), signs in, and enters everything through the app's own code:
// the cut-over date, the opening-balances Excel import (the filled file is saved next to this script),
// the hooks behind the Members, Meetings, Loans and Reserve pages, and the year-end distribution as the
// Profit Distribution page works it out. Penalties, balances and the AGM figures are therefore exactly
// what the app produces. It follows the money rules saved in the app on this computer (Settings:
// interest rate, late penalty, absence charge, reserve share), read from a copy of the app's profile.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { app, dialog, protocol, BrowserWindow } = require('electron');

const REPO = path.resolve(__dirname, '..', '..');
const fromRepo = (m) => require(require.resolve(m, { paths: [REPO] }));
const jwt = fromRepo('jsonwebtoken');
const ExcelJS = fromRepo('exceljs');
const { writeTemplate } = require(path.join(REPO, 'electron', 'openingBalances.cjs'));
const data = require('./data.cjs');

const XLSX = path.join(__dirname, `opening-balances-${data.CUTOVER}.xlsx`);
const TOKEN_KEY = 'Mso_connect_token';
const SETTINGS_KEY = 'hc_settings_v1';

// A profile of its own, so nothing of the real app's is touched, holding a copy of the real app's local
// storage (where the app keeps its settings) when there is one. The app is run in development
// (npm run electron:dev), so its profile is named after package.json and its pages come from
// http://localhost:8080.
const APP_STORAGE = path.join(app.getPath('appData'), require(path.join(REPO, 'package.json')).name, 'Local Storage');
const APP_ORIGIN = 'http://localhost:8080';
const PROFILE = path.join(os.tmpdir(), 'mso-sample-seed');
fs.rmSync(PROFILE, { recursive: true, force: true });
const haveAppStorage = fs.existsSync(APP_STORAGE);
if (haveAppStorage) {
  fs.cpSync(APP_STORAGE, path.join(PROFILE, 'Local Storage'), { recursive: true, filter: (src) => path.basename(src) !== 'LOCK' });
}
app.setPath('userData', PROFILE);

// The import's "choose the filled file" dialog picks the file made below.
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [XLSX] });

let viteServer = null;
let appUrl = null;

const say = (msg) => console.log(msg);
async function finish(code, msg) {
  if (msg) (code ? console.error : console.log)(`\n${msg}\n`);
  try { await viteServer?.close(); } catch { /* closing anyway */ }
  app.exit(code);
}

// The app's own Vite dev server on a free port, with its own dependency cache, so a dev server you
// already have running is left alone.
async function startVite() {
  // Vite's ES module build (its CommonJS build is deprecated).
  const viteDir = path.dirname(require.resolve('vite/package.json', { paths: [REPO] }));
  const { createServer } = await import(pathToFileURL(path.join(viteDir, 'dist', 'node', 'index.js')).href);
  viteServer = await createServer({
    root: REPO,
    configFile: path.join(REPO, 'vite.config.ts'),
    cacheDir: path.join(os.tmpdir(), 'mso-sample-seed-vite'),
    server: { host: '127.0.0.1', port: 8095, strictPort: false },
    logLevel: 'warn',
    clearScreen: false,
  });
  await viteServer.listen();
  const { port } = viteServer.httpServer.address();
  appUrl = `http://127.0.0.1:${port}`;
}

// The settings saved in the copied profile, read from a blank page at the app's address (served here,
// so nothing reaches a dev server you may have running). The copied sign-in is dropped. Null when the
// app has saved none on this computer.
async function readAppSettings() {
  if (!haveAppStorage) return null;
  app.on('window-all-closed', () => {}); // closing this window must not end the run
  protocol.handle('http', () => new Response('<!doctype html><title>MSO settings</title>', { headers: { 'content-type': 'text/html' } }));
  const win = new BrowserWindow({ show: false });
  try {
    await win.loadURL(`${APP_ORIGIN}/`);
    return await win.webContents.executeJavaScript(
      `(() => { const s = localStorage.getItem(${JSON.stringify(SETTINGS_KEY)}); localStorage.removeItem(${JSON.stringify(TOKEN_KEY)}); return s; })()`,
    );
  } finally {
    protocol.unhandle('http');
    win.destroy();
  }
}

// The opening-balances template, made by the app as Settings does, filled in as the committee would.
// The registers' loans carry interest at the app's rate, like the loans issued in the app.
async function writeOpeningFile(settings) {
  const rate = settings.applyLoanInterest ? Number(settings.loanInterestRate) || 0 : 0;
  const interest = (amount) => Math.round(amount * rate) / 100;
  await writeTemplate(XLSX, { cutoverDate: data.CUTOVER, currency: settings.currency || 'PKR', absenceFine: settings.absencePenaltyPerMeeting });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const day = (key) => new Date(`${key}T00:00:00Z`);
  const byKey = Object.fromEntries(data.openingMembers.map((m) => [m.key, m]));

  const members = wb.getWorksheet('Members');
  data.openingMembers.forEach((m, i) => {
    const row = members.getRow(i + 2);
    row.getCell(1).value = m.name;
    row.getCell(2).value = m.fatherName;
    row.getCell(3).value = m.phone || null;
    row.getCell(4).value = m.address;
    row.getCell(5).value = day(m.joinDate);
    row.getCell(6).value = m.savings;
    row.getCell(7).value = m.absences2024;
    row.commit();
  });

  const loans = wb.getWorksheet('Open loans');
  data.openingLoans.forEach((l, i) => {
    const row = loans.getRow(i + 2);
    row.getCell(1).value = byKey[l.member].name;
    row.getCell(2).value = byKey[l.member].fatherName;
    row.getCell(3).value = day(l.loanDate);
    row.getCell(4).value = l.amount;
    row.getCell(5).value = interest(l.amount) || null;
    row.getCell(6).value = l.repaid || null;
    row.getCell(7).value = l.penalties || null;
    row.getCell(9).value = l.defaulted;
    row.getCell(10).value = l.note || null;
    row.commit();
  });

  wb.getWorksheet('Reserve').getCell('B2').value = data.openingReserve;
  const profit = wb.getWorksheet('Profit not yet shared');
  profit.getCell('B2').value = data.openingProfit.bankProfit;
  profit.getCell('B3').value = interest(data.openingProfit.lentOnLoansRepaid) || null;
  profit.getCell('B4').value = data.openingProfit.penalties;
  await wb.xlsx.writeFile(XLSX);
}

const once = (emitter, event) => new Promise((resolve) => emitter.once(event, resolve));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(win) {
  const wc = win.webContents;
  const js = (code) => wc.executeJavaScript(code, true);
  const reload = async () => {
    const loaded = once(wc, 'did-finish-load');
    wc.reload();
    await loaded;
  };
  wc.on('console-message', (e, _level, message) => {
    const text = typeof e?.message === 'string' ? e.message : message;
    if (typeof text === 'string' && text.startsWith('[seed]')) say(`  ${text.slice(7)}`);
  });

  // main.cjs starts loading the page as soon as it makes the window.
  await new Promise((r) => setImmediate(r));
  if (!redirected) await wc.loadURL(appUrl);
  else if (wc.isLoading()) await once(wc, 'did-finish-load');

  // Refuse unless the database holds no records (the login and settings may stay).
  const [state] = (await js(`window.electronAPI.dbQuery(\`SELECT
      (SELECT COUNT(*) FROM public.members) + (SELECT COUNT(*) FROM public.meetings) + (SELECT COUNT(*) FROM public.upcoming_meetings)
      + (SELECT COUNT(*) FROM public.loans) + (SELECT COUNT(*) FROM public.monthly_contributions)
      + (SELECT COUNT(*) FROM public.reserve_transactions) + (SELECT COUNT(*) FROM public.profit_distributions)
      + (SELECT COUNT(*) FROM public.bank_profits) AS records,
      (SELECT row_to_json(u) FROM (SELECT id, email, full_name FROM public.users ORDER BY created_at LIMIT 1) u) AS login\`, [], null)`)).rows ?? [];
  if (!state) return finish(1, 'Could not read the database. Is PostgreSQL running?');
  if (Number(state.records) > 0) {
    return finish(1, `The database already has ${state.records} records, so nothing was added.\nClear them first (Settings -> Clear all records), then run this again.`);
  }
  if (!state.login) return finish(1, 'There is no login in the database to enter the records with.');

  // Sign in as the app's login, as if the password had been typed.
  const secret = /const JWT_SECRET = '([^']+)'/.exec(fs.readFileSync(path.join(REPO, 'electron', 'main.cjs'), 'utf8'))?.[1];
  if (!secret) return finish(1, 'Could not find the sign-in secret in electron/main.cjs.');
  const session = { id: state.login.id, email: state.login.email, fullName: state.login.full_name };
  const token = jwt.sign(session, secret, { expiresIn: '1h' });
  await js(`localStorage.setItem(${JSON.stringify(TOKEN_KEY)}, ${JSON.stringify(token)});
    ${appSettings ? `localStorage.setItem(${JSON.stringify(SETTINGS_KEY)}, ${JSON.stringify(appSettings)});` : ''} true`);
  await reload();
  for (let i = 0; i < 100; i++) {
    const actor = await js(`import('/src/lib/db.ts').then((m) => m.getDbActor())`).catch(() => null);
    if (actor) break;
    if (i === 99) return finish(1, 'The app did not sign in.');
    await sleep(200);
  }
  await sleep(1500); // let the first screen finish loading

  // The settings in effect, as the app merges the saved ones over its defaults.
  const settings = await js(`import('/src/contexts/SettingsContext.tsx').then((m) =>
    ({ ...m.DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)}) || '{}') }))`);
  say(appSettings ? 'Using the settings saved in the app on this computer.' : 'The app has no saved settings on this computer, so its defaults are used.');
  await writeOpeningFile(settings);

  say(`Entering the dummy records as ${session.email}…`);
  const summary = await js(`(${seedInApp.toString()})(${JSON.stringify(data)})`);
  await js(`localStorage.removeItem(${JSON.stringify(TOKEN_KEY)}); true`);
  say('\nDone. In the app now (dummy figures):');
  for (const [label, value] of summary) say(`  ${label.padEnd(36)} ${value}`);
  say(`\nThe filled opening-balances file is ${path.relative(REPO, XLSX)} (Settings -> Import again reads it).`);
  // An open window still holds the members and records from before the database was cleared, so
  // anything it saves (a distribution, a payment) would refer to records that are gone.
  say('If MSO is open, reload it now (Ctrl+R) before entering anything.');
  return finish(0);
}

// ───────────────────────── Runs inside the app's window ─────────────────────────
// Stringified and run in the page, so it must not use anything from this file.
async function seedInApp(D) {
  const log = (msg) => console.log(`[seed] ${msg}`);
  const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
  const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const money = (n) => `PKR ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  // The same React the app's modules use (a second copy would break their hooks).
  const main = await (await fetch('/src/main.tsx')).text();
  const dep = /["']([^"']*\/)react-dom_client\.js\?v=(\w+)["']/.exec(main);
  if (!dep) throw new Error('Could not find React on the dev server.');
  const depModule = async (name) => { const m = await import(`${dep[1]}${name}.js?v=${dep[2]}`); return m.default ?? m; };
  const React = await depModule('react');
  const { createRoot } = await depModule('react-dom_client');

  const S = await import('/src/contexts/SettingsContext.tsx');
  const O = await import('/src/contexts/OrganizationContext.tsx');
  const useMembers = (await import('/src/hooks/useMembers.ts')).useMembers;
  const useMeetings = (await import('/src/hooks/useMeetings.ts')).useMeetings;
  const { useAttendance, saveMeetingAttendance } = await import('/src/hooks/useAttendance.ts');
  const useContributions = (await import('/src/hooks/useContributions.ts')).useContributions;
  const { useLoans, syncLoanPenalties } = await import('/src/hooks/useLoans.ts');
  const useReserveTransactions = (await import('/src/hooks/useReserveTransactions.ts')).useReserveTransactions;
  const { addBankProfit, bankProfitProblem, removeBankProfit } = await import('/src/hooks/useBankProfits.ts');
  const { useToast } = await import('/src/hooks/use-toast.ts');
  const books = await import('/src/lib/books.ts');
  const { dbQuery } = await import('/src/lib/db.ts');
  const { checkOpeningFile } = await import('/src/utils/openingBalances.ts');
  const { buildBooks, todayKey } = await import('/src/utils/accounting.ts');
  const { planYearEnd } = await import('/src/utils/yearEndProfit.ts');
  const { ORGANIZATION_CONFIG } = await import('/src/config/organization.ts');

  // The pages' hooks, mounted off-screen. `live` always holds their latest render.
  let live = null;
  function Probe() {
    live = {
      settings: S.useSettings().settings,
      toasts: useToast().toasts,
      members: useMembers(),
      meetings: useMeetings(),
      attendance: useAttendance(),
      contributions: useContributions(),
      loans: useLoans(),
      reserve: useReserveTransactions(),
      org: O.useOrganization(),
    };
    return null;
  }
  const h = React.createElement;
  const root = createRoot(document.createElement('div'));
  root.render(h(S.SettingsProvider, null, h(O.OrganizationProvider, null, h(Probe))));
  const loaded = () => live && !['members', 'meetings', 'attendance', 'contributions', 'loans', 'reserve'].some((k) => live[k].isLoading);
  for (let i = 0; !loaded(); i++) {
    if (i > 400) throw new Error('The app did not load its records.');
    await tick(50);
  }

  // The app's clock reads each meeting's day while that meeting is entered, as if the records were
  // made on the day. Otherwise late penalties would be charged up to today on loans whose later
  // repayments aren't entered yet, then taken off again, cluttering the Audit Log.
  const RealDate = Date;
  let clock = null;
  class MeetingDayDate extends RealDate {
    constructor(...args) {
      if (args.length === 0 && clock !== null) super(clock);
      else super(...args);
    }
    static now() {
      return clock ?? RealDate.now();
    }
  }
  const setClock = (key) => {
    clock = key ? new RealDate(`${key}T18:00:00`).getTime() : null;
    window.Date = key ? MeetingDayDate : RealDate;
  };

  // Calls a hook action as its page does; a failure shows a toast, which is passed on.
  const act = async (what, fn) => {
    const before = live.toasts[0]?.id;
    const result = await fn(live);
    await tick();
    if (result === null || result === false || result === undefined) {
      const t = live.toasts[0];
      throw new Error(`${what} failed${t && t.id !== before ? `: ${t.title} - ${t.description}` : ''}`);
    }
    return result;
  };

  try {
    const S0 = live.settings;
    log(`Settings: interest ${S0.loanInterestRate}%, late penalty ${money(S0.latePenaltyPerMonth)}/month, absence charge ${money(S0.absencePenaltyPerMeeting)}, reserve share ${S0.reservePercent}%, bank charge above ${money(S0.bankChargeThreshold)}`);

    // ── Cut-over and opening balances (Settings -> Moving from the paper registers), the week
    // before the first meeting kept in the app
    setClock(D.importedOn);
    const cut = await books.setCutoverDate(D.CUTOVER);
    if (cut.error) throw new Error(`Cut-over date: ${cut.error}`);
    const raw = await books.readOpeningFile();
    if (raw.error || raw.canceled) throw new Error(`Reading the opening-balances file: ${raw.error || 'canceled'}`);
    const check = checkOpeningFile(raw, D.CUTOVER, S0.dateFormat);
    if (check.problems.length) throw new Error(`The opening-balances file has problems: ${check.problems.map((p) => p.message).join(' | ')}`);
    for (const w of check.warnings ?? []) log(`Import note: ${w.message}`);
    const imported = await books.importOpeningBalances({
      cutoverDate: check.cutoverDate,
      fileName: check.fileName,
      termMonths: ORGANIZATION_CONFIG.LOAN_PERIOD_MONTHS,
      penaltyPerMonth: S0.latePenaltyPerMonth,
      members: check.members.map(({ name, fatherName, phone, address, joinDate, savings, absences }) => ({ name, fatherName, phone, address, joinDate, savings, absences })),
      loans: check.loans.map(({ memberName, fatherName, loanDate, amount, interest, repaid, penalties, defaulted }) => ({ memberName, fatherName, loanDate, amount, interest, repaid, penalties, defaulted })),
      reserve: check.reserve,
      profit: check.profit,
    });
    if (imported.error) throw new Error(`Import: ${imported.error}`);
    log(`Cut-over ${D.CUTOVER}; imported ${check.members.length} members, ${check.loans.length} open loans and the reserve fund`);
    await Promise.all([live.members.fetchMembers(), live.loans.fetchLoans(), live.reserve.fetchTransactions(), live.contributions.fetchContributions()]);
    await live.org.refreshData(); // picks up the profit not yet shared, for the AGM
    await tick();

    // ── Who is who
    const memberId = {};
    const joined = {};
    const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    for (const m of D.openingMembers) {
      const row = live.members.members.find((x) => norm(x.name) === norm(m.name) && norm(x.father_name) === norm(m.fatherName));
      if (!row) throw new Error(`Imported member not found: ${m.name}`);
      memberId[m.key] = row.id;
      joined[m.key] = m.joinDate;
    }
    const loanId = {};
    const openingLoanRows = await dbQuery('SELECT id, member_id FROM public.loans WHERE opening_as_at IS NOT NULL');
    for (const l of D.openingLoans) loanId[l.key] = openingLoanRows.find((r) => r.member_id === memberId[l.member]).id;

    // A head-and-shoulders placeholder picture, kept as the app keeps photos (256 px JPEG data URL).
    const photo = (seed) => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      const hue = (seed * 47) % 360;
      const bg = g.createLinearGradient(0, 0, 256, 256);
      bg.addColorStop(0, `hsl(${hue} 35% 62%)`);
      bg.addColorStop(1, `hsl(${(hue + 30) % 360} 40% 42%)`);
      g.fillStyle = bg;
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = `hsl(${hue} 25% 92%)`;
      g.beginPath(); g.arc(128, 104, 50, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(128, 262, 98, 92, 0, Math.PI, 0); g.fill();
      return c.toDataURL('image/jpeg', 0.85);
    };

    // Details added later to imported members (Members -> Edit).
    for (const [i, u] of D.memberUpdates.entries()) {
      const m = live.members.members.find((x) => x.id === memberId[u.key]);
      await act(`Editing ${m.name}`, (L) => L.members.updateMember(m.id, {
        name: m.name, father_name: m.father_name, email: u.email || '', phone: m.phone || '', address: m.address || '',
        dob: u.dob, join_date: m.join_date, profile_picture: u.photo ? photo(i + 3) : m.profile_picture,
      }));
    }

    // Owed on a loan on `date`: the balance less any penalty charged after that day.
    const owedOn = async (id, date) => {
      await syncLoanPenalties(id);
      const [row] = await dbQuery(
        `SELECT l.remaining_amount - COALESCE((SELECT SUM(p.amount) FROM public.loan_penalties p WHERE p.loan_id = l.id AND p.charge_date > $2), 0) AS owed
         FROM public.loans l WHERE l.id = $1`, [id, date]);
      return r2(Number(row.owed));
    };

    // ── Everything after the cut-over, meeting by meeting
    const arrears = {};
    const payments = [
      ...Object.entries(D.openingLoanPayments).flatMap(([key, list]) => list.map(([date, amount]) => ({ key, date, amount }))),
      ...D.appLoans.flatMap((l) => l.pay.map(([date, amount]) => ({ key: l.key, date, amount }))),
    ];
    const meetingId = {};
    let photoSeed = 20;
    const addNewMember = async (n) => {
      const created = await act(`Adding ${n.name}`, (L) => L.members.addMember({
        name: n.name, father_name: n.father_name, email: n.email, phone: n.phone, address: n.address,
        dob: n.dob, join_date: n.join_date, profile_picture: n.photo ? photo(photoSeed++) : undefined,
      }));
      memberId[n.key] = created.id;
      joined[n.key] = n.join_date;
    };

    for (const mt of D.meetings) {
      setClock(mt.date);
      const venue = D.VENUES[mt.venue];
      // Scheduled beforehand (Meetings -> Schedule Meeting).
      await act(`Scheduling ${mt.date}`, (L) => L.meetings.addUpcomingMeeting({ meeting_date: mt.date, meeting_time: mt.time, venue }));

      // New members, added on the Members page the day they join.
      for (const n of D.newMembers.filter((x) => x.join_date === mt.date)) await addNewMember(n);

      // The meeting (Meetings -> Add New Meeting): attendance, contributions and any bank profit.
      const keys = Object.keys(memberId).filter((k) => joined[k] <= mt.date);
      const corr = D.corrections.attendance;
      const rows = keys.map((k) => {
        let status = mt.absent.includes(k) ? 'absent' : mt.leave.includes(k) ? 'leave' : 'present';
        let amount = 0;
        if (status === 'absent') arrears[k] = (arrears[k] || 0) + 1;
        else { amount = D.monthly[k] * (1 + (arrears[k] || 0)); arrears[k] = 0; }
        if (corr.meeting === mt.date && corr.member === k) status = corr.recordedAs; // the slip, put right below
        return { memberId: memberId[k], status, amount };
      });
      const bankInput = mt.bankProfit
        ? { amount: mt.bankProfit.amount, creditedOn: mt.bankProfit.creditedOn, profitYear: mt.bankProfit.profitYear, meetingDate: mt.date }
        : null;
      if (bankInput) {
        const problem = await bankProfitProblem(bankInput, S0.dateFormat);
        if (problem) throw new Error(`Bank profit at ${mt.date}: ${problem}`);
      }
      const meeting = await act(`Meeting ${mt.date}`, (L) => L.meetings.addMeeting({ meeting_date: mt.date, venue, agenda: mt.agenda, decisions: mt.decisions }));
      meetingId[mt.date] = meeting.id;
      await act(`Attendance ${mt.date}`, (L) => L.attendance.bulkRecordAttendance(meeting.id, rows.map((r) => ({ memberId: r.memberId, status: r.status }))));
      await act(`Contributions ${mt.date}`, (L) => L.contributions.bulkAddContributions(meeting.id, rows.map((r) => ({ memberId: r.memberId, amount: r.amount })), mt.date));
      if (bankInput && !(await addBankProfit(meeting.id, bankInput))) throw new Error(`Bank profit at ${mt.date} was refused`);

      // Loans page: repayments, new loans, bank charges from the statement, defaults.
      for (const p of payments.filter((x) => x.date === mt.date)) {
        const id = loanId[p.key];
        const amount = p.amount === 'rest' ? await owedOn(id, p.date) : p.amount;
        await act(`Repayment on ${p.key} (${p.date})`, (L) => L.loans.recordPayment({ loan_id: id, amount, payment_date: p.date }));
      }
      for (const l of D.appLoans.filter((x) => x.date === mt.date)) {
        const loan = await act(`Loan ${l.key}`, (L) => L.loans.issueLoan({ member_id: memberId[l.member], amount: l.amount, loan_date: l.date, bank_charge: l.bankCharge || 0 }));
        loanId[l.key] = loan.id;
      }
      for (const l of D.appLoans.filter((x) => x.bankChargeLater?.on === mt.date)) {
        await act(`Bank charge on ${l.key}`, (L) => L.loans.setBankCharge(loanId[l.key], l.bankChargeLater.amount));
      }
      for (const l of D.appLoans.filter((x) => x.defaultedOn === mt.date)) {
        await act(`Marking ${l.key} defaulted`, (L) => L.loans.markDefaulted(loanId[l.key], l.defaultedOn));
      }

      // Reserve page.
      for (const t of D.reserve.filter((x) => x.date === mt.date)) {
        await live.reserve.fetchTransactions();
        await tick();
        await act(`Reserve ${t.transaction_type} ${t.date}`, (L) => L.reserve.addTransaction({
          transaction_type: t.transaction_type, amount: t.amount, donor_name: t.donor_name, notes: t.notes, transaction_date: t.date, bank_charge: t.bank_charge,
        }));
      }

      // The AGM in July shares out the previous year's profit, when it came from the registers
      // (the year after is left for you to distribute on the Profit Distribution page).
      const op = live.org.openingProfit;
      if (op && mt.date.startsWith(`${op.year + 1}-07`)) {
        await live.org.refreshData();
        await tick(100);
        const o = live.org;
        const bk = buildBooks({ members: o.members, meetings: o.meetings, reserveTransactions: o.reserveTransactions, profitDistributions: o.profitDistributions, bankProfits: o.bankProfits, openingProfit: o.openingProfit });
        const plan = planYearEnd(bk, {
          year: op.year,
          bankProfit: r2(o.bankProfits.filter((b) => b.profitYear === op.year).reduce((s, b) => s + b.amount, 0)),
          reservePercent: live.settings.reservePercent,
          absenceFine: live.settings.absencePenaltyPerMeeting,
          registers: { interest: op.interest, penalties: op.penalties, absences: op.absences },
        });
        if (plan.problems.length) throw new Error(`${op.year} profit: ${plan.problems.join(' ')}`);
        await act(`Distributing the ${op.year} profit`, (L) => L.org.distributeYearEnd(plan, mt.date));
        log(`${mt.date} AGM: ${op.year} profit ${money(plan.totalProfit)} shared - ${money(plan.reserve)} to the reserve, ${money(plan.dividends)} to ${plan.rows.length} members`);
      }

      if (mt.date.endsWith('-12-14') || mt.date.endsWith('-06-14') || mt.date === D.meetings[D.meetings.length - 1].date) log(`Recorded meetings up to ${mt.date}`);
    }

    // ── Corrections, so the Audit Log shows changes and removals too (back on today's clock)
    setClock(null);
    const corr = D.corrections.attendance;
    const fixed = await saveMeetingAttendance(meetingId[corr.meeting], [{ memberId: memberId[corr.member], status: 'leave' }]);
    if (!fixed.saved || fixed.changed !== 1) throw new Error('The attendance correction was not saved');
    const dup = D.corrections.duplicateBankProfit;
    if (!(await addBankProfit(meetingId[dup.meeting], { amount: dup.amount, creditedOn: dup.creditedOn, profitYear: dup.profitYear, meetingDate: dup.meeting }))) {
      throw new Error('The duplicate bank profit was refused');
    }
    const [dupRow] = await dbQuery('SELECT id FROM public.bank_profits WHERE meeting_id = $1', [meetingId[dup.meeting]]);
    if (!(await removeBankProfit(dupRow.id))) throw new Error('The duplicate bank profit could not be removed');

    // ── Joined since the last meeting, and meetings still to come
    const lastMeeting = D.meetings[D.meetings.length - 1].date;
    for (const n of D.newMembers.filter((x) => x.join_date > lastMeeting)) await addNewMember(n);
    for (const u of D.upcoming) {
      await act(`Scheduling ${u.date}`, (L) => L.meetings.addUpcomingMeeting({ meeting_date: u.date, meeting_time: u.time, venue: u.venue }));
    }

    // ── Where it all stands today
    await syncLoanPenalties();
    await live.org.refreshData();
    await tick(100);
    const o = live.org;
    const bk = buildBooks({ members: o.members, meetings: o.meetings, reserveTransactions: o.reserveTransactions, profitDistributions: o.profitDistributions, bankProfits: o.bankProfits, openingProfit: o.openingProfit });
    const today = todayKey();
    const [counts] = await dbQuery(`SELECT
      (SELECT COUNT(*) FROM public.members)::int AS members, (SELECT COUNT(*) FROM public.meetings)::int AS meetings,
      (SELECT COUNT(*) FROM public.upcoming_meetings WHERE meeting_date >= CURRENT_DATE)::int AS upcoming,
      (SELECT COUNT(*) FROM public.monthly_contributions WHERE NOT is_opening)::int AS contributions,
      (SELECT COUNT(*) FROM public.loans)::int AS loans, (SELECT COUNT(*) FROM public.loans WHERE status = 'active')::int AS active,
      (SELECT COUNT(*) FROM public.loans WHERE status = 'paid')::int AS paid, (SELECT COUNT(*) FROM public.loans WHERE status = 'defaulted')::int AS defaulted,
      (SELECT COUNT(*) FROM public.loan_installments)::int AS repayments, (SELECT COUNT(*) FROM public.loan_penalties)::int AS penalties,
      (SELECT COUNT(*) FROM public.reserve_transactions)::int AS reserve, (SELECT COUNT(*) FROM public.audit_log)::int AS audit,
      (SELECT COALESCE(SUM(total_budget), 0) FROM public.members) AS savings`);
    await live.loans.fetchLoans();
    await tick();
    const stats = live.loans.getLoanStats();
    const lastYear = Number(today.slice(0, 4)) - 1;
    const pending = planYearEnd(bk, {
      year: lastYear,
      bankProfit: r2(o.bankProfits.filter((b) => b.profitYear === lastYear).reduce((s, b) => s + b.amount, 0)),
      reservePercent: live.settings.reservePercent,
      absenceFine: live.settings.absencePenaltyPerMeeting,
      registers: null,
    });
    root.unmount();
    return [
      ['Members', counts.members],
      ['Meetings recorded / scheduled ahead', `${counts.meetings} / ${counts.upcoming}`],
      ['Contributions (after the cut-over)', counts.contributions],
      ['Loans (active / repaid / defaulted)', `${counts.loans} (${counts.active} / ${counts.paid} / ${counts.defaulted})`],
      ['Overdue loans', `${stats.overdueCount}, owing ${money(stats.overdueAmount)}`],
      ['Repayments / late penalties charged', `${counts.repayments} / ${counts.penalties}`],
      ['Reserve fund entries', counts.reserve],
      ['Audit log entries', counts.audit],
      ['Total Budget (bank) today', money(bk.balancesAt(today).cash)],
      ["Members' savings", money(counts.savings)],
      [`${lastYear} profit waiting to be distributed`, `${money(pending.totalProfit)} (${money(pending.reserve)} reserve, ${money(pending.dividends)} to ${pending.rows.length} members)`],
    ];
  } catch (err) {
    root.unmount();
    throw err;
  } finally {
    setClock(null);
  }
}

// ───────────────────────── Start ─────────────────────────

let redirected = false;
let appSettings = null;
const onAppWindow = (_, win) => {
  // A hidden window, no developer tools, and full speed while hidden.
  win.hide();
  win.webContents.openDevTools = () => {};
  win.webContents.setBackgroundThrottling(false);
  // The app loads the usual dev server address; load it from this script's server instead.
  const loadURL = win.loadURL.bind(win);
  win.loadURL = (url, ...rest) => {
    redirected = true;
    return loadURL(String(url).replace(/^http:\/\/localhost:8080/, appUrl), ...rest);
  };
  run(win).catch((err) => finish(1, `Stopped: ${err?.message ?? err}`));
};

(async () => {
  try {
    say('Starting the app…');
    await startVite();
    await app.whenReady();
    appSettings = await readAppSettings();
    // main.cjs makes its window once the app is ready (straight away now).
    app.once('browser-window-created', onAppWindow);
    require(path.join(REPO, 'electron', 'main.cjs'));
  } catch (err) {
    await finish(1, `Stopped: ${err?.message ?? err}`);
  }
})();
