// Moving from the paper registers to the app: the cut-over date, the opening-balances Excel
// template, reading a filled template, and loading (or removing) the opening balances.
//
// Everything that writes runs in one database transaction, so an import either lands in full
// or not at all. The renderer checks the file first and shows a preview (utils/openingBalances.ts);
// the checks here repeat only what protects the books.
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const TEMPLATE_VERSION = 3;
const OPENING_NOTE = 'Opening balance brought forward from the paper registers';
const MEMBER_ROWS = 400;
const LOAN_ROWS = 300;
const EPS = 0.005;

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const displayDay = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;

/** How a member is told apart: name and father's name together, ignoring capitals and extra spaces
 * (the same rule as utils/openingBalances.ts personKey). */
const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const personKey = (name, fatherName) => `${norm(name)}|${norm(fatherName)}`;
const who = (name, fatherName) => (String(fatherName ?? '').trim() ? `${name} (father's name ${String(fatherName).trim()})` : name);

/** The year whose profit is still to be shared at the July AGM after a 31 December cut-over (else null). */
const openingProfitYear = (cutoverDate) => (String(cutoverDate).slice(5, 10) === '12-31' ? Number(String(cutoverDate).slice(0, 4)) : null);

async function getConfig(client) {
  const { rows } = await client.query('SELECT key, value FROM public.app_config');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function setConfig(client, key, value) {
  await client.query(
    `INSERT INTO public.app_config (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value],
  );
}

// ───────────────────────── Template ─────────────────────────

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A45' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const MONEY = '#,##0.00';

function styleHeader(sheet) {
  const row = sheet.getRow(1);
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 32;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

async function writeTemplate(filePath, { cutoverDate, currency, absenceFine = 0 }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MSO';
  wb.created = new Date();
  const asAt = displayDay(cutoverDate);
  const cutoverCellDate = new Date(`${cutoverDate}T00:00:00Z`);
  const Y = openingProfitYear(cutoverDate);

  // Instructions
  const info = wb.addWorksheet('Instructions', { properties: { tabColor: { argb: 'FF99702A' } } });
  info.columns = [{ width: 30 }, { width: 100 }];
  const lines = [
    ['MSO opening balances', ''],
    ['Balances as at', asAt],
    ['', ''],
    ['What this file is for', `Type in each member's savings, every loan still unpaid, and the reserve fund exactly as they stand in the paper registers at the end of ${asAt}. The app starts its books from these figures; everything after ${asAt} is recorded in the app.`],
    ['', ''],
    ['Members sheet', 'One row per member, including members with a zero balance. No two members may have the same name and father\'s name: loans are matched to members by the two together. Join date is the date the member joined (it can be years before the cut-over). Savings balance is everything the member has saved up to the cut-over date: all contributions plus any profit shares added to their account.'],
    ['Open loans sheet', 'One row per loan that still had money owing at the cut-over date. Leave out loans already repaid in full. The member name and father\'s name must be written as on the Members sheet (capital letters and extra spaces don\'t matter). Interest is the interest charged on the loan as written in the register. Repaid so far is every repayment made up to the cut-over date. Penalties added so far are the late penalties already added to the loan. Outstanding is worked out for you: check it against the register. Write Yes under Defaulted for loans the committee has written off as defaulted; no late penalties are added to those after the cut-over date.'],
    ['Reserve sheet', `The reserve fund balance at the cut-over date, in ${currency}.`],
    Y
      ? ['Profit not yet shared', `The ${Y} profit is shared at the July ${Y + 1} AGM, which is recorded in the app. On the "Profit not yet shared" sheet enter, from the registers, the bank's profit for ${Y} and the loan interest and late penalties collected in ${Y} on loans repaid in full that year. On the Members sheet, enter each member's number of meetings marked absent in ${Y}. The absence charges and the total profit for ${Y} are worked out on the sheet for checking. Leave them blank if the ${Y} profit was already shared on paper.`]
      : ['Profit not yet shared', `The cut-over date isn't 31 December, so a year's profit not yet shared can't be brought in from the registers. To bring it in, use 31 December as the cut-over date.`],
    ['', ''],
    ['Dates', 'Use real dates (for example 15/03/2012). Text like "March 2012" cannot be read.'],
    ['Amounts', 'Numbers only, without the currency code. Leave a cell blank for zero.'],
    ['Checking', 'When you import, the app checks every row and shows the totals (members, total savings, total owed on loans, reserve) before anything is saved. Compare them with the register totals.'],
    ['Corrections', 'Fix this file and import it again. The new import replaces the opening balances and leaves later records alone. Keep every member and loan in the file when you re-import.'],
    ['Do not change', 'Sheet names, column order and the hidden settings sheet.'],
  ];
  lines.forEach((l, i) => {
    const row = info.getRow(i + 1);
    row.values = l;
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(1).alignment = { vertical: 'top' };
  });
  info.getRow(1).getCell(1).font = { bold: true, size: 16 };
  info.getRow(2).getCell(2).font = { bold: true, size: 12, color: { argb: 'FF99702A' } };

  // Members
  const members = wb.addWorksheet('Members');
  members.columns = [
    { header: 'Name', width: 28 },
    { header: "Father's name", width: 28 },
    { header: 'Phone', width: 18 },
    { header: 'Address', width: 36 },
    { header: 'Join date', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: `Savings balance (${currency})`, width: 22, style: { numFmt: MONEY } },
    ...(Y ? [{ header: `Absences in ${Y}`, width: 14 }] : []),
  ];
  styleHeader(members);
  for (let r = 2; r <= MEMBER_ROWS + 1; r++) {
    members.getCell(`E${r}`).dataValidation = {
      type: 'date', operator: 'lessThanOrEqual', allowBlank: true, formulae: [cutoverCellDate],
      showErrorMessage: true, errorTitle: 'Join date', error: `A real date on or before ${asAt}, e.g. 15/03/2012.`,
    };
    members.getCell(`F${r}`).dataValidation = {
      type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0],
      showErrorMessage: true, errorTitle: 'Savings balance', error: 'A number of 0 or more, without the currency code.',
    };
    if (Y) {
      members.getCell(`G${r}`).dataValidation = {
        type: 'whole', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0],
        showErrorMessage: true, errorTitle: `Absences in ${Y}`, error: `The number of meetings in ${Y} the member was marked absent at: a whole number of 0 or more.`,
      };
    }
  }

  // Open loans
  const loans = wb.addWorksheet('Open loans');
  loans.columns = [
    { header: 'Member name', width: 28 },
    { header: "Member's father's name", width: 28 },
    { header: 'Loan date', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: `Amount lent (${currency})`, width: 18, style: { numFmt: MONEY } },
    { header: `Interest (${currency})`, width: 16, style: { numFmt: MONEY } },
    { header: `Repaid so far (${currency})`, width: 18, style: { numFmt: MONEY } },
    { header: `Penalties added so far (${currency})`, width: 20, style: { numFmt: MONEY } },
    { header: `Outstanding (${currency}), worked out`, width: 22, style: { numFmt: MONEY } },
    { header: 'Defaulted? (Yes/No)', width: 14 },
    { header: 'Note', width: 30 },
  ];
  styleHeader(loans);
  for (let r = 2; r <= LOAN_ROWS + 1; r++) {
    loans.getCell(`C${r}`).dataValidation = {
      type: 'date', operator: 'lessThanOrEqual', allowBlank: true, formulae: [cutoverCellDate],
      showErrorMessage: true, errorTitle: 'Loan date', error: `A real date on or before ${asAt}.`,
    };
    for (const col of ['D', 'E', 'F', 'G']) {
      loans.getCell(`${col}${r}`).dataValidation = {
        type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0],
        showErrorMessage: true, errorTitle: 'Amount', error: 'A number of 0 or more.',
      };
    }
    loans.getCell(`I${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
    const h = loans.getCell(`H${r}`);
    h.value = { formula: `IF(D${r}="","",D${r}+E${r}+G${r}-F${r})` };
    h.font = { color: { argb: 'FF555555' } };
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  }

  // Reserve
  const reserve = wb.addWorksheet('Reserve');
  reserve.columns = [{ header: 'Item', width: 40 }, { header: `Amount (${currency})`, width: 20, style: { numFmt: MONEY } }];
  styleHeader(reserve);
  reserve.getRow(2).values = [`Reserve fund balance at ${asAt}`, null];
  reserve.getCell('B2').dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0] };

  // The year's profit not yet shared (31 December cut-over only)
  if (Y) {
    const profit = wb.addWorksheet('Profit not yet shared');
    profit.columns = [{ header: `Profit for ${Y}, shared at the July ${Y + 1} AGM`, width: 64 }, { header: `Amount (${currency})`, width: 20, style: { numFmt: MONEY } }];
    styleHeader(profit);
    profit.getRow(2).values = [`Bank profit for ${Y} (credited by the bank)`, null];
    profit.getRow(3).values = [`Loan interest collected in ${Y} (loans repaid in full in ${Y})`, null];
    profit.getRow(4).values = [`Late penalties collected in ${Y} (loans repaid in full in ${Y})`, null];
    for (const c of ['B2', 'B3', 'B4']) profit.getCell(c).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0] };
    // Worked out for checking only: the import reads B2:B4 and the absences on the Members sheet,
    // never these two cells. Members with no savings get no share at the AGM, so pay no charges.
    const fine = Math.max(0, Number(absenceFine) || 0);
    const last = MEMBER_ROWS + 1;
    profit.getRow(5).values = [`Absence charges for ${Y}, worked out (absences on the Members sheet × ${currency} ${fine.toLocaleString('en-US')})`, null];
    profit.getCell('B5').value = { formula: `SUMIFS(Members!G2:G${last},Members!F2:F${last},">0")*${fine}` };
    profit.getRow(6).values = [`Total profit for ${Y}, worked out`, null];
    profit.getCell('B6').value = { formula: 'SUM(B2:B5)' };
    profit.getRow(6).font = { bold: true };
    for (const c of ['B5', 'B6']) profit.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    profit.getCell('B5').font = { color: { argb: 'FF555555' } };
    profit.getRow(8).values = [`Each member's absences in ${Y} go in the last column of the Members sheet. The two grey rows are worked out for checking; don't type over them. At the AGM a member's absence charges are never more than their share, so the total there can be a little lower. Leave everything blank if the ${Y} profit was already shared on paper.`];
    profit.getRow(8).getCell(1).alignment = { wrapText: true };
    profit.getRow(8).height = 64;
  }

  // Settings the import reads back; hidden so it is not edited by accident.
  const meta = wb.addWorksheet('_settings', { state: 'veryHidden' });
  meta.getRow(1).values = ['template_version', TEMPLATE_VERSION];
  meta.getRow(2).values = ['cutover_date', cutoverDate];
  meta.getRow(3).values = ['currency', currency];
  meta.getRow(4).values = ['profit_year', Y];

  await wb.xlsx.writeFile(filePath);
}

// ───────────────────────── Reading a filled template ─────────────────────────

/** A cell as a plain value: string, number, yyyy-MM-dd for dates, or null when blank. */
function cellValue(cell) {
  let v = cell ? cell.value : null;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) v = v.result; // formula
    else if ('formula' in v || 'sharedFormula' in v) return null; // formula never calculated
    else if ('richText' in v) v = v.richText.map((t) => t.text).join('');
    else if ('text' in v) v = v.text; // hyperlink
    else if ('error' in v) return null;
  }
  if (v instanceof Date) return isoDay(v);
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' ? null : s;
  }
  return v;
}

function readRows(sheet, cols, firstRow = 2) {
  const out = [];
  if (!sheet) return out;
  const last = sheet.actualRowCount ? sheet.lastRow?.number ?? 1 : 1;
  for (let r = firstRow; r <= last; r++) {
    const row = sheet.getRow(r);
    const values = cols.map((_, i) => cellValue(row.getCell(i + 1)));
    // The worked-out Outstanding column holds a formula on every row; ignore it when deciding
    // whether a row is empty.
    const typed = values.filter((v, i) => v !== null && cols[i] !== 'check');
    if (typed.length === 0) continue;
    out.push({ row: r, ...Object.fromEntries(cols.map((c, i) => [c, values[i]])) });
  }
  return out;
}

async function readTemplate(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const meta = wb.getWorksheet('_settings');
  const metaMap = {};
  if (meta) meta.eachRow((row) => { metaMap[String(cellValue(row.getCell(1)))] = cellValue(row.getCell(2)); });
  if (!wb.getWorksheet('Members') || !wb.getWorksheet('Open loans')) {
    return { error: 'This is not an MSO opening-balances file: the Members and Open loans sheets are missing. Download the template from Settings and fill that in.' };
  }
  // Templates before version 3 had a registration-number column first, so every column is one out.
  const version = Number(metaMap.template_version);
  if (version && version < TEMPLATE_VERSION) {
    return { error: 'This file was made from an older template that still has a Reg. no. column. Download the template again from Settings and copy the figures into it.' };
  }
  const members = readRows(wb.getWorksheet('Members'), ['name', 'fatherName', 'phone', 'address', 'joinDate', 'savings', 'absences']);
  const loans = readRows(wb.getWorksheet('Open loans'), ['memberName', 'fatherName', 'loanDate', 'amount', 'interest', 'repaid', 'penalties', 'check', 'defaulted', 'note']);
  const reserveSheet = wb.getWorksheet('Reserve');
  const reserve = reserveSheet ? cellValue(reserveSheet.getCell('B2')) : null;
  const profitSheet = wb.getWorksheet('Profit not yet shared');
  const profit = profitSheet
    ? { year: metaMap.profit_year ?? null, bankProfit: cellValue(profitSheet.getCell('B2')), interest: cellValue(profitSheet.getCell('B3')), penalties: cellValue(profitSheet.getCell('B4')) }
    : null;
  return {
    fileName: path.basename(filePath),
    meta: { version: metaMap.template_version ?? null, cutoverDate: metaMap.cutover_date ?? null, currency: metaMap.currency ?? null },
    members,
    loans,
    reserve,
    profit,
  };
}

// ───────────────────────── Loading opening balances ─────────────────────────

async function importOpening(client, p) {
  const cfg = await getConfig(client);
  if (!cfg.cutover_date) return { error: 'Set the cut-over date in Settings before importing opening balances.' };
  if (cfg.cutover_date !== p.cutoverDate) {
    return { error: `This file is for balances as at ${displayDay(p.cutoverDate)}, but the cut-over date in Settings is ${displayDay(cfg.cutover_date)}. Download a new template for that date.` };
  }
  const C = cfg.cutover_date;
  const termMonths = Math.max(1, Number(p.termMonths) || 12);
  const penaltyPerMonth = Math.max(0, Number(p.penaltyPerMonth) || 0);

  // Members: matched by name and father's name together (no two in the file share both). A member
  // already in the app with the same two is updated rather than added twice, and from then on
  // counts as brought in by the import.
  const inApp = (await client.query('SELECT id, name, father_name, is_opening FROM public.members')).rows;
  const appByKey = new Map();
  for (const m of inApp) {
    const k = personKey(m.name, m.father_name);
    appByKey.set(k, [...(appByKey.get(k) || []), m]);
  }
  const prevImported = inApp.filter((m) => m.is_opening);
  const idByKey = new Map();
  for (const m of p.members) {
    const k = personKey(m.name, m.fatherName);
    if (idByKey.has(k)) {
      throw Object.assign(new Error('member-twice'), { userMessage: `${who(m.name, m.fatherName)} is on the Members sheet twice. No two members can have the same name and father's name.` });
    }
    const matches = appByKey.get(k) || [];
    if (matches.length > 1) {
      throw Object.assign(new Error('member-ambiguous'), { userMessage: `The app already has ${matches.length} members called ${who(m.name, m.fatherName)}, so this row can't be matched to one of them. Change one of their names on the Members page first.` });
    }
    let row = matches[0];
    if (row) {
      await client.query(
        `UPDATE public.members SET is_opening = true, name = $1, father_name = $2, phone = COALESCE($3, phone),
           address = COALESCE($4, address), join_date = $5, total_budget = COALESCE(total_budget, 0) WHERE id = $6`,
        [m.name, m.fatherName || '', m.phone, m.address, m.joinDate, row.id],
      );
    } else {
      row = (await client.query(
        `INSERT INTO public.members (name, father_name, phone, address, join_date, total_budget, is_approved, is_opening)
         VALUES ($1,$2,$3,$4,$5,0,true,true) RETURNING id`,
        [m.name, m.fatherName || '', m.phone, m.address, m.joinDate],
      )).rows[0];
    }
    idByKey.set(k, row.id);

    // Opening savings: one flagged contribution row dated the cut-over; the member's running
    // balance moves by the change, so later contributions are left untouched.
    const savings = r2(m.savings || 0);
    const existing = (await client.query(
      'SELECT id, amount FROM public.monthly_contributions WHERE member_id = $1 AND is_opening = true',
      [row.id],
    )).rows;
    const before = r2(existing.reduce((s, x) => s + Number(x.amount), 0));
    if (existing.length > 1) {
      await client.query('DELETE FROM public.monthly_contributions WHERE id = ANY($1::uuid[])', [existing.slice(1).map((x) => x.id)]);
    }
    if (savings > EPS) {
      if (existing[0]) {
        await client.query('UPDATE public.monthly_contributions SET amount = $1, contribution_date = $2, notes = $3 WHERE id = $4', [savings, C, OPENING_NOTE, existing[0].id]);
      } else {
        await client.query(
          'INSERT INTO public.monthly_contributions (member_id, meeting_id, amount, contribution_date, notes, is_opening) VALUES ($1, NULL, $2, $3, $4, true)',
          [row.id, savings, C, OPENING_NOTE],
        );
      }
    } else if (existing[0]) {
      await client.query('DELETE FROM public.monthly_contributions WHERE id = $1', [existing[0].id]);
    }
    const delta = r2(savings - before);
    if (Math.abs(delta) > EPS) await client.query('UPDATE public.members SET total_budget = COALESCE(total_budget, 0) + $1 WHERE id = $2', [delta, row.id]);
  }
  const matched = new Set(idByKey.values());
  const missing = prevImported.filter((m) => !matched.has(m.id));
  if (missing.length > 0) {
    throw Object.assign(new Error('missing-members'), {
      userMessage: `These members were in the earlier import but are missing from this file: ${missing.slice(0, 8).map((m) => who(m.name, m.father_name)).join(', ')}${missing.length > 8 ? ` and ${missing.length - 8} more` : ''}. Keep every member in the file (a zero balance is fine), with the name and father's name as they are now in the app.`,
    });
  }

  // Open loans: matched to earlier opening loans by member and loan date.
  const prevLoans = (await client.query(
    `SELECT l.id, l.member_id, l.loan_date::text AS loan_date, l.penalty_per_month,
       COALESCE((SELECT SUM(amount) FROM public.loan_installments i WHERE i.loan_id = l.id), 0) AS paid_after,
       COALESCE((SELECT SUM(amount) FROM public.loan_penalties x WHERE x.loan_id = l.id AND x.penalty_month <> 0), 0) AS penalties_after
     FROM public.loans l WHERE l.opening_as_at IS NOT NULL`,
  )).rows;
  const prevByKey = new Map(prevLoans.map((l) => [`${l.member_id}|${l.loan_date.slice(0, 10)}`, l]));
  const kept = new Set();
  let loanCount = 0;
  for (const ln of p.loans) {
    const memberId = idByKey.get(personKey(ln.memberName, ln.fatherName));
    if (!memberId) throw Object.assign(new Error('loan-member'), { userMessage: `A loan is for ${who(ln.memberName, ln.fatherName)}, who is not on the Members sheet.` });
    const amount = r2(ln.amount);
    const interest = r2(ln.interest || 0);
    const repaid = r2(ln.repaid || 0);
    const openingPenalty = r2(ln.penalties || 0);
    const totalPayable = r2(amount + interest);
    const rate = amount > 0 ? r2((interest / amount) * 100) : 0;
    const key = `${memberId}|${ln.loanDate}`;
    const prev = prevByKey.get(key);
    const paidAfter = prev ? r2(prev.paid_after) : 0;
    const penaltiesAfter = prev ? r2(prev.penalties_after) : 0;
    const remaining = r2(totalPayable + openingPenalty + penaltiesAfter - repaid - paidAfter);
    if (remaining < -EPS) {
      throw Object.assign(new Error('overpaid'), { userMessage: `The loan of ${amount.toLocaleString()} on ${displayDay(ln.loanDate)} to ${who(ln.memberName, ln.fatherName)} would be repaid more than it owes once payments recorded after the cut-over are included.` });
    }
    const status = ln.defaulted ? 'defaulted' : remaining <= EPS ? 'paid' : 'active';
    let loanId;
    if (prev) {
      loanId = prev.id;
      kept.add(prev.id);
      // A loan written off in the registers counts as marked defaulted on the cut-over date.
      await client.query(
        `UPDATE public.loans SET amount = $1, total_payable = $2, interest_rate = $3, remaining_amount = $4, status = $5,
           term_months = $6, opening_as_at = $7, defaulted_on = CASE WHEN $5 = 'defaulted' THEN $7::date END WHERE id = $8`,
        [amount, totalPayable, rate, remaining, status, termMonths, C, loanId],
      );
    } else {
      loanId = (await client.query(
        `INSERT INTO public.loans (member_id, amount, remaining_amount, loan_date, status, term_months, interest_rate, total_payable, penalty_per_month, opening_as_at, defaulted_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $5 = 'defaulted' THEN $10::date END) RETURNING id`,
        [memberId, amount, remaining, ln.loanDate, status, termMonths, rate, totalPayable, penaltyPerMonth, C],
      )).rows[0].id;
    }
    // Penalties already added in the registers: one "brought forward" row (month 0). Penalties for
    // months after the cut-over are worked out by the app as usual.
    await client.query('DELETE FROM public.loan_penalties WHERE loan_id = $1 AND penalty_month = 0', [loanId]);
    if (openingPenalty > EPS) {
      await client.query(
        'INSERT INTO public.loan_penalties (loan_id, penalty_month, charge_date, amount) VALUES ($1, 0, $2, $3)',
        [loanId, C, openingPenalty],
      );
    }
    loanCount++;
  }
  for (const prev of prevLoans) {
    if (kept.has(prev.id)) continue;
    if (Number(prev.paid_after) > EPS) {
      throw Object.assign(new Error('loan-has-payments'), { userMessage: `An opening loan dated ${displayDay(prev.loan_date.slice(0, 10))} is missing from this file, but repayments have been recorded on it since the cut-over. Keep it in the file.` });
    }
    await client.query('DELETE FROM public.loans WHERE id = $1', [prev.id]);
  }

  // Reserve fund
  const reserve = r2(p.reserve || 0);
  const prevReserve = (await client.query("SELECT id FROM public.reserve_transactions WHERE transaction_type = 'opening'")).rows;
  if (prevReserve.length > 1) await client.query('DELETE FROM public.reserve_transactions WHERE id = ANY($1::uuid[])', [prevReserve.slice(1).map((x) => x.id)]);
  if (reserve > EPS) {
    if (prevReserve[0]) {
      await client.query('UPDATE public.reserve_transactions SET amount = $1, transaction_date = $2, notes = $3 WHERE id = $4', [reserve, C, OPENING_NOTE, prevReserve[0].id]);
    } else {
      await client.query(
        "INSERT INTO public.reserve_transactions (transaction_type, amount, donor_name, notes, transaction_date) VALUES ('opening', $1, NULL, $2, $3)",
        [reserve, OPENING_NOTE, C],
      );
    }
  } else if (prevReserve[0]) {
    await client.query('DELETE FROM public.reserve_transactions WHERE id = $1', [prevReserve[0].id]);
  }

  // The year's profit not yet shared at the cut-over (31 December cut-over only): the bank profit
  // goes in as a bank_profits row dated the cut-over day; the interest, penalties and each member's
  // absences are kept for that year's AGM (books.ts, yearEndProfit.ts).
  const Y = openingProfitYear(C);
  const pr = p.profit || {};
  const profitIn = { bankProfit: r2(pr.bankProfit || 0), interest: r2(pr.interest || 0), penalties: r2(pr.penalties || 0) };
  const absenceList = [];
  for (const m of p.members) {
    const n = Math.max(0, Math.floor(Number(m.absences) || 0));
    if (n > 0) absenceList.push([idByKey.get(personKey(m.name, m.fatherName)), n]);
  }
  // In a fixed order, so a re-import can be compared with what was saved.
  const absences = Object.fromEntries(absenceList.sort(([a], [b]) => String(a).localeCompare(String(b))));
  const hasProfit = profitIn.bankProfit > EPS || profitIn.interest > EPS || profitIn.penalties > EPS || Object.keys(absences).length > 0;
  if (hasProfit && !Y) {
    return { error: `A year's profit not yet shared can only be brought in with a 31 December cut-over date; the cut-over date is ${displayDay(C)}.` };
  }
  const prevProfit = cfg.opening_profit ? JSON.parse(cfg.opening_profit) : null;
  if (Y) {
    const distributed = (await client.query('SELECT 1 FROM public.profit_distributions WHERE profit_year = $1', [Y])).rowCount > 0;
    const same = JSON.stringify(prevProfit ? { ...prevProfit, asAt: undefined } : null) === JSON.stringify(hasProfit ? { year: Y, ...profitIn, absences, asAt: undefined } : null);
    if (distributed && !same) {
      return { error: `The ${Y} profit has already been distributed, so the profit not yet shared and the ${Y} absences can't change. Import the file with those figures as they were.` };
    }
  }
  await client.query('DELETE FROM public.bank_profits WHERE is_opening = true');
  if (Y && profitIn.bankProfit > EPS) {
    await client.query(
      'INSERT INTO public.bank_profits (meeting_id, amount, credited_on, profit_year, is_opening) VALUES (NULL, $1, $2, $3, true)',
      [profitIn.bankProfit, C, Y],
    );
  }
  if (hasProfit) await setConfig(client, 'opening_profit', JSON.stringify({ year: Y, asAt: C, ...profitIn, absences }));
  else await client.query("DELETE FROM public.app_config WHERE key = 'opening_profit'");

  const summary = {
    importedAt: new Date().toISOString(),
    fileName: p.fileName || null,
    members: p.members.length,
    savings: r2(p.members.reduce((s, m) => s + (Number(m.savings) || 0), 0)),
    loans: loanCount,
    reserve,
    profit: hasProfit ? { year: Y, ...profitIn, absences: Object.values(absences).reduce((s, n) => s + n, 0) } : null,
  };
  await setConfig(client, 'opening_summary', JSON.stringify(summary));
  return { success: true, summary };
}

async function removeOpening(client) {
  const withPayments = (await client.query(
    'SELECT COUNT(*)::int AS n FROM public.loans l WHERE l.opening_as_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.loan_installments i WHERE i.loan_id = l.id)',
  )).rows[0].n;
  if (withPayments > 0) {
    return { error: `Repayments have been recorded since the cut-over on ${withPayments} opening loan${withPayments === 1 ? '' : 's'}, so the opening balances can't be removed. Correct them by importing a fixed file instead.` };
  }
  const cfg = await getConfig(client);
  const openingProfit = cfg.opening_profit ? JSON.parse(cfg.opening_profit) : null;
  if (openingProfit && (await client.query('SELECT 1 FROM public.profit_distributions WHERE profit_year = $1', [openingProfit.year])).rowCount > 0) {
    return { error: `The ${openingProfit.year} profit brought in from the registers has already been distributed, so the opening balances can't be removed. Correct them by importing a fixed file instead.` };
  }
  const opening = (await client.query('SELECT member_id, amount FROM public.monthly_contributions WHERE is_opening = true')).rows;
  for (const o of opening) {
    await client.query('UPDATE public.members SET total_budget = COALESCE(total_budget, 0) - $1 WHERE id = $2', [Number(o.amount), o.member_id]);
  }
  await client.query('DELETE FROM public.monthly_contributions WHERE is_opening = true');
  await client.query('DELETE FROM public.loans WHERE opening_as_at IS NOT NULL');
  await client.query("DELETE FROM public.reserve_transactions WHERE transaction_type = 'opening'");
  await client.query('DELETE FROM public.bank_profits WHERE is_opening = true');
  // Members the import added and that have nothing else recorded go too; the rest stay.
  const removed = (await client.query(
    `DELETE FROM public.members m WHERE m.is_opening
       AND NOT EXISTS (SELECT 1 FROM public.monthly_contributions c WHERE c.member_id = m.id)
       AND NOT EXISTS (SELECT 1 FROM public.loans l WHERE l.member_id = m.id)
       AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.member_id = m.id)
       AND NOT EXISTS (SELECT 1 FROM public.profit_allocations p WHERE p.member_id = m.id)
     RETURNING id`,
  )).rowCount;
  await client.query("DELETE FROM public.app_config WHERE key IN ('opening_summary', 'opening_profit')");
  return { success: true, removedMembers: removed };
}

// Every record except the admin login and the app's settings.
const RECORD_TABLES = [
  'attendance', 'monthly_contributions', 'loan_installments', 'loan_penalties', 'loan_schedule', 'loans',
  'profit_allocations', 'profit_distributions', 'reserve_transactions', 'bank_profits', 'meetings', 'upcoming_meetings',
  'members', 'audit_log',
];

// ───────────────────────── IPC ─────────────────────────

function register({ ipcMain, dialog, pool }) {
  const inTransaction = async (actor, work) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_user', $1, true)", [actor || 'unknown']);
      const result = await work(client);
      if (result && result.error) await client.query('ROLLBACK');
      else await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      return { error: err.userMessage || err.message };
    } finally {
      client.release();
    }
  };

  ipcMain.handle('opening-template', async (_, { cutoverDate, currency, absenceFine }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cutoverDate || ''))) return { error: 'Set the cut-over date first.' };
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save opening-balances template',
      defaultPath: `MSO-opening-balances-${cutoverDate}.xlsx`,
      filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    try {
      await writeTemplate(filePath, { cutoverDate, currency: currency || 'PKR', absenceFine });
      return { success: true, path: filePath };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('opening-read', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choose the filled opening-balances file',
      properties: ['openFile'],
      filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
    });
    if (canceled || !filePaths[0]) return { canceled: true };
    try {
      return await readTemplate(filePaths[0]);
    } catch (err) {
      return { error: `The file could not be read as an Excel workbook (${err.message}). Save it as .xlsx and try again.` };
    }
  });

  ipcMain.handle('opening-import', async (_, payload) =>
    inTransaction(payload.actor, (client) => importOpening(client, payload)),
  );

  ipcMain.handle('opening-remove', async (_, { actor }) => inTransaction(actor, (client) => removeOpening(client)));

  ipcMain.handle('records-clear', async (_, { actor }) =>
    inTransaction(actor, async (client) => {
      await client.query(`TRUNCATE TABLE ${RECORD_TABLES.map((t) => `public.${t}`).join(', ')} CASCADE`);
      await client.query("DELETE FROM public.app_config WHERE key IN ('opening_summary', 'opening_profit')");
      await client.query(
        "INSERT INTO public.audit_log (table_name, action, changed_by, new_data) VALUES ('all_records', 'delete', $1, $2)",
        [actor || 'unknown', JSON.stringify({ note: 'All records cleared from Settings' })],
      );
      return { success: true };
    }),
  );
}

module.exports = { register, writeTemplate, readTemplate, TEMPLATE_VERSION };
