const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'Mso-connect-secret-key-change-in-production';

// Return DATE/TIMESTAMP columns as the raw string Postgres sends instead of a JS Date.
// pg's default parsing converts them to local-time Date objects, which both breaks any
// code expecting a string (e.g. `.split('T')`) and silently shifts calendar dates by a
// day when reformatted through UTC (Date object at local midnight -> toISOString()).
types.setTypeParser(1082, (val) => val); // date
types.setTypeParser(1114, (val) => val); // timestamp without time zone
types.setTypeParser(1184, (val) => val); // timestamp with time zone

// pg returns NUMERIC/DECIMAL columns (every money amount in this schema) as strings by
// default, to avoid float precision loss on values too large for a JS number. This app
// treats amounts as plain JS numbers everywhere once fetched (Math.round(...*100)/100
// arithmetic, .toLocaleString() formatting, reduce() sums), so leaving them as strings
// makes `sum + row.amount`-style reductions silently do string concatenation instead of
// addition as soon as more than one row is summed. Amounts here stay well within safe
// float precision (PKR figures at 2 decimal places), so parsing eagerly is safe.
types.setTypeParser(1700, (val) => parseFloat(val)); // numeric/decimal

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mso-db',
  user: 'postgres',       // change to your pgAdmin username
  password: 'postgres',   // change to your pgAdmin password
});

pool.on('error', (err) => console.error('Idle pool client error:', err));

// Generic DB query handler
ipcMain.handle('db-query', async (_, { sql, params, actor }) => {
  const client = await pool.connect();
  try {
    // Pooled clients are reused across requests, so this session variable is set
    // unconditionally on every call (never skipped when actor is missing) — otherwise
    // a later request without an actor would inherit a previous caller's identity.
    await client.query("SELECT set_config('app.current_user', $1, false)", [actor || 'unknown']);
    const result = await client.query(sql, params);
    return { rows: result.rows };
  } catch (err) {
    return { error: err.message };
  } finally {
    client.release();
  }
});

// Tables that participate in JSON backup/restore, in FK-safe (parent-first) order.
const BACKUP_TABLES = [
  'users', 'user_roles', 'members', 'meetings', 'upcoming_meetings', 'bank_profits',
  'loans', 'loan_schedule', 'loan_installments', 'loan_penalties', 'monthly_contributions',
  'attendance', 'reserve_transactions', 'profit_distributions', 'profit_allocations',
  'audit_log', 'app_config',
];

// Backup: export every table to a single JSON file the user picks.
ipcMain.handle('db-backup', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Backup Database',
    defaultPath: `mso-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'MSO Backup', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { canceled: true };

  const client = await pool.connect();
  try {
    const tables = {};
    for (const table of BACKUP_TABLES) {
      const result = await client.query(`SELECT * FROM public.${table}`);
      tables[table] = result.rows;
    }
    const payload = { version: 1, exportedAt: new Date().toISOString(), tables };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return { success: true, path: filePath };
  } catch (err) {
    return { error: err.message };
  } finally {
    client.release();
  }
});

// Restore: truncate all known tables and re-insert rows from a chosen JSON backup file.
ipcMain.handle('db-restore', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Restore Database',
    properties: ['openFile'],
    filters: [{ name: 'MSO Backup', extensions: ['json'] }],
  });
  if (canceled || !filePaths[0]) return { canceled: true };

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
  } catch {
    return { error: 'Could not read or parse the selected backup file.' };
  }
  if (!payload || typeof payload.tables !== 'object') {
    return { error: 'Selected file is not a valid MSO backup.' };
  }
  const usersInBackup = payload.tables['users'];
  if (!Array.isArray(usersInBackup) || usersInBackup.length === 0) {
    return { error: 'Backup contains no users — restore aborted to prevent lockout.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');
    await client.query(`TRUNCATE TABLE ${BACKUP_TABLES.map((t) => `public.${t}`).join(', ')} CASCADE`);
    for (const table of BACKUP_TABLES) {
      let rows = payload.tables[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      // Backups made while members had a registration number: a member with one was brought in
      // by the opening-balances import, which is what is_opening records now.
      if (table === 'members' && 'register_no' in rows[0]) {
        rows = rows.map(({ register_no, ...m }) => ({ ...m, is_opening: m.is_opening ?? (register_no !== null && register_no !== undefined) }));
      }
      const columns = Object.keys(rows[0]);
      const columnList = columns.map((c) => `"${c}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const insertSql = `INSERT INTO public.${table} (${columnList}) VALUES (${placeholders})`;
      for (const row of rows) {
        await client.query(insertSql, columns.map((c) => row[c]));
      }
    }
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return { error: err.message };
  } finally {
    client.release();
  }
});

// Cut-over from the paper registers: opening-balances template, import, removal, and clearing
// all records (for test data).
require('./openingBalances.cjs').register({ ipcMain, dialog, pool });

// Longest raw message that is typed into WhatsApp via the URI. encodeURIComponent triples the
// size of backticks (used in monospace blocks) and other characters, so we check the raw length
// rather than the encoded length — the WhatsApp desktop app decodes the URI itself and handles
// much longer strings than the encoded form would suggest.
const MAX_LINK_TEXT = 2500;

// Share text through WhatsApp: the desktop app if one is registered for whatsapp:// links,
// otherwise WhatsApp Web. With a phone number the chat with that number opens; without one
// the user picks the recipient. The renderer supplies only the message and number; the URL
// is built here so this can't be used to open arbitrary links.
async function openWhatsApp(text, phone) {
  let number = '';
  if (phone) {
    // Accept 03001234567, +92 300 1234567 or 923001234567; WhatsApp wants 923001234567.
    const digits = String(phone).replace(/\D/g, '');
    number = digits.startsWith('0') && digits.length === 11 ? `92${digits.slice(1)}` : digits;
    if (number.length < 10 || number.length > 15) return { error: 'The phone number is not valid for WhatsApp.' };
  }
  // A long message (a meeting record with every member's figures) can be cut off or refused when
  // Windows hands the link to WhatsApp, so it goes on the clipboard instead and WhatsApp opens on
  // the chat, ready for Ctrl+V. Check raw length: backticks in monospace blocks encode to %60,
  // tripling their size and pushing encoded length over the limit even for short messages.
  const copied = text.length > MAX_LINK_TEXT;
  if (copied) clipboard.writeText(text);
  const encoded = copied ? '' : encodeURIComponent(text);
  const query = `${number ? `phone=${number}&` : ''}text=${encoded}`;
  try {
    if (app.getApplicationNameForProtocol('whatsapp://')) {
      await shell.openExternal(`whatsapp://send?${query}`);
      return { opened: 'app', copied };
    }
    await shell.openExternal(`https://web.whatsapp.com/send?${query}`);
    return { opened: 'web', copied };
  } catch (err) {
    return { error: err.message };
  }
}

ipcMain.handle('share-whatsapp', async (_, { text, phone }) => {
  if (typeof text !== 'string' || !text.trim()) return { error: 'There is nothing to share.' };
  return openWhatsApp(text, phone);
});

// Share a report on WhatsApp, as the PDF or as one picture per page. WhatsApp can't be handed
// files through a link, so they are saved to a temporary folder and put on the clipboard as files
// (as Explorer's Copy does), then WhatsApp opens with a caption typed in; the user picks the chat
// and pastes them (Ctrl+V). Several pictures paste as one album.
const sharedReportsDir = () => path.join(app.getPath('temp'), 'MSO Reports');
const MAX_SHARED_FILES = 100; // WhatsApp sends at most 100 media in one go

function copyFilesToClipboard(files) {
  if (process.platform !== 'win32') return Promise.resolve(false);
  return new Promise((resolve) => {
    // The paths go in through the environment, never into the command text. "|" can't be in a path.
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', "Set-Clipboard -LiteralPath ($env:MSO_SHARE_FILES -split '\\|')"],
      { env: { ...process.env, MSO_SHARE_FILES: files.join('|') }, windowsHide: true, timeout: 20000 },
      (err) => resolve(!err),
    );
  });
}

const toBuffer = (data) =>
  data instanceof ArrayBuffer ? Buffer.from(data) : ArrayBuffer.isView(data) ? Buffer.from(data.buffer, data.byteOffset, data.byteLength) : null;

// Shared files are only needed until they are pasted: anything older than a day is cleared out.
async function pruneSharedFiles() {
  const dir = sharedReportsDir();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const name of await fs.promises.readdir(dir).catch(() => [])) {
    const file = path.join(dir, name);
    const stat = await fs.promises.stat(file).catch(() => null);
    if (stat?.isFile() && stat.mtimeMs < cutoff) await fs.promises.unlink(file).catch(() => {});
  }
}

async function shareFiles(items, text, phone) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_SHARED_FILES) return { error: 'The report could not be prepared for sharing.' };
  const files = [];
  try {
    await fs.promises.mkdir(sharedReportsDir(), { recursive: true });
    await pruneSharedFiles();
    for (const item of items) {
      const name = path.basename(String(item?.name || ''));
      if (!/^[\w.-]+\.(pdf|png)$/i.test(name)) return { error: 'The report has no valid file name.' };
      const bytes = toBuffer(item.data);
      if (!bytes || bytes.length === 0 || bytes.length > 50 * 1024 * 1024) return { error: 'The report could not be prepared for sharing.' };
      const file = path.join(sharedReportsDir(), name);
      await fs.promises.writeFile(file, bytes);
      files.push(file);
    }
  } catch (err) {
    return { error: `The report could not be saved for sharing: ${err.message}` };
  }
  const copied = await copyFilesToClipboard(files);
  const res = await openWhatsApp(typeof text === 'string' ? text : '', phone);
  return { ...res, copied, file: files[0], count: files.length };
}

ipcMain.handle('share-file-whatsapp', (_, { filename, data, text, phone }) => shareFiles([{ name: filename, data }], text, phone));
ipcMain.handle('share-files-whatsapp', (_, { files, text, phone }) => shareFiles(files, text, phone));

// Shows a shared report in Explorer (only files this app saved for sharing).
ipcMain.handle('show-shared-file', async (_, { file }) => {
  const resolved = path.resolve(String(file || ''));
  if (path.dirname(resolved) !== path.resolve(sharedReportsDir()) || !fs.existsSync(resolved)) return { error: 'The file is no longer there.' };
  shell.showItemInFolder(resolved);
  return {};
});

// Idempotently create/alter tables this app owns on its local Postgres instance.
// There is no separate migration runner wired to this database, so schema changes
// for newer app versions are applied here on every startup.
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS term_months INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0;
      ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS total_payable DECIMAL(12,2);
      UPDATE public.loans SET total_payable = amount WHERE total_payable IS NULL;
      ALTER TABLE public.loans ALTER COLUMN total_payable SET NOT NULL;
      ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS penalty_per_month DECIMAL(12,2) NOT NULL DEFAULT 500;

      -- A member not at a meeting is either absent or on leave (excused: their contribution was
      -- sent, and the absence charge and attendance figures don't count it). present stays false.
      ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS on_leave BOOLEAN NOT NULL DEFAULT false;

      -- Late penalties charged after a loan's one-year period ends; remaining_amount includes them.
      CREATE TABLE IF NOT EXISTS public.loan_penalties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
        penalty_month INTEGER NOT NULL,
        charge_date DATE NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        UNIQUE (loan_id, penalty_month)
      );

      ALTER TABLE public.monthly_contributions ADD COLUMN IF NOT EXISTS notes TEXT;

      -- Where a meeting was held, recorded with it and shared in the WhatsApp meeting record.
      -- Meetings recorded before this have none; the record falls back to the venue it was
      -- scheduled with, if that is still there.
      ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS venue TEXT;

      -- Settings that belong to the books rather than to one computer (e.g. the cut-over date
      -- from the paper registers), so backups and restores carry them.
      CREATE TABLE IF NOT EXISTS public.app_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
      -- Opening balances brought forward from the paper registers at the cut-over date
      -- (electron/openingBalances.cjs): members flagged as brought in by the import, a flagged
      -- opening savings row, and loans that were already open at the cut-over.
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_opening BOOLEAN NOT NULL DEFAULT false;
      -- Members no longer have a registration number. Those that had one were brought in by the
      -- import, so they keep that as the flag before the column goes.
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'register_no') THEN
          UPDATE public.members SET is_opening = true WHERE register_no IS NOT NULL AND NOT is_opening;
          DROP INDEX IF EXISTS public.members_register_no_key;
          ALTER TABLE public.members DROP COLUMN register_no;
        END IF;
      END $$;
      ALTER TABLE public.monthly_contributions ADD COLUMN IF NOT EXISTS is_opening BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS opening_as_at DATE;
      -- The day the committee marked a loan defaulted: late penalties stop then (utils/loanPenalty.ts)
      -- and the accounts provide for it from then. Loans marked before the date was kept get the
      -- cut-over date if they came from the registers, otherwise the day this first runs, so no
      -- penalty already charged is removed and none is added.
      ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS defaulted_on DATE;
      -- The bank's charge on the cheque withdrawal for a loan above the limit in Settings: taken from
      -- the account on the loan date and repaid by the member with the loan (no interest on it).
      ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS bank_charge DECIMAL(12,2) NOT NULL DEFAULT 0;
      UPDATE public.loans SET defaulted_on = COALESCE(opening_as_at, CURRENT_DATE) WHERE status = 'defaulted' AND defaulted_on IS NULL;
      -- Year-end profit distribution (utils/yearEndProfit.ts): the year it is for and how its
      -- total is made up; per member, the savings it was shared on and the absence penalty taken.
      -- Rows without profit_year are earlier bank-profit-only distributions.
      ALTER TABLE public.profit_distributions ADD COLUMN IF NOT EXISTS profit_year INTEGER;
      ALTER TABLE public.profit_distributions ADD COLUMN IF NOT EXISTS bank_profit DECIMAL(12,2);
      ALTER TABLE public.profit_distributions ADD COLUMN IF NOT EXISTS loan_interest DECIMAL(12,2) NOT NULL DEFAULT 0;
      ALTER TABLE public.profit_distributions ADD COLUMN IF NOT EXISTS loan_penalties DECIMAL(12,2) NOT NULL DEFAULT 0;
      ALTER TABLE public.profit_distributions ADD COLUMN IF NOT EXISTS absence_penalties DECIMAL(12,2) NOT NULL DEFAULT 0;
      ALTER TABLE public.profit_distributions ADD COLUMN IF NOT EXISTS absence_fine DECIMAL(12,2);
      ALTER TABLE public.profit_allocations ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(12,2);
      ALTER TABLE public.profit_allocations ADD COLUMN IF NOT EXISTS absences INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE public.profit_allocations ADD COLUMN IF NOT EXISTS absence_penalty DECIMAL(12,2) NOT NULL DEFAULT 0;
      ALTER TABLE public.profit_allocations ADD COLUMN IF NOT EXISTS savings_basis DECIMAL(12,2);
      CREATE UNIQUE INDEX IF NOT EXISTS profit_distributions_year_key ON public.profit_distributions (profit_year) WHERE profit_year IS NOT NULL;

      -- The bank's profit on the account, recorded with the meeting at which it is reported, dated
      -- the day the bank credited it, and shared out at the next July AGM (profit_year). An opening
      -- row (is_opening) is the paper registers' bank profit for the year not yet shared at the
      -- cut-over. A distribution whose bank profit came from these rows has bank_profit_recorded set,
      -- so the books don't count that money a second time on the AGM date.
      CREATE TABLE IF NOT EXISTS public.bank_profits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
        amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
        credited_on DATE NOT NULL,
        profit_year INTEGER NOT NULL,
        is_opening BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS bank_profits_year_idx ON public.bank_profits (profit_year);
      ALTER TABLE public.profit_distributions ADD COLUMN IF NOT EXISTS bank_profit_recorded BOOLEAN NOT NULL DEFAULT false;

      ALTER TABLE public.reserve_transactions DROP CONSTRAINT IF EXISTS reserve_transactions_transaction_type_check;
      ALTER TABLE public.reserve_transactions ADD CONSTRAINT reserve_transactions_transaction_type_check
        CHECK (transaction_type IN ('donation', 'expense', 'profit_allocation', 'opening'));

      -- Loans have no instalment plan any more (the whole balance is due by the due date, repaid in
      -- any amounts). The table is kept, unused, so backups made before that still restore.
      CREATE TABLE IF NOT EXISTS public.loan_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
        installment_number INTEGER NOT NULL,
        due_date DATE NOT NULL,
        due_amount DECIMAL(12,2) NOT NULL,
        paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        UNIQUE (loan_id, installment_number)
      );

      CREATE TABLE IF NOT EXISTS public.audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name TEXT NOT NULL,
        record_id UUID,
        action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
        changed_by TEXT,
        changed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        old_data JSONB,
        new_data JSONB
      );
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        actor TEXT;
      BEGIN
        actor := current_setting('app.current_user', true);
        IF TG_OP = 'DELETE' THEN
          INSERT INTO public.audit_log(table_name, record_id, action, changed_by, old_data)
          VALUES (TG_TABLE_NAME, OLD.id, 'delete', actor, row_to_json(OLD)::jsonb);
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
          INSERT INTO public.audit_log(table_name, record_id, action, changed_by, old_data, new_data)
          VALUES (TG_TABLE_NAME, NEW.id, 'update', actor, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
          RETURN NEW;
        ELSE
          INSERT INTO public.audit_log(table_name, record_id, action, changed_by, new_data)
          VALUES (TG_TABLE_NAME, NEW.id, 'insert', actor, row_to_json(NEW)::jsonb);
          RETURN NEW;
        END IF;
      END;
      $$;
    `);

    const auditedTables = [
      'loans', 'loan_installments', 'loan_schedule', 'loan_penalties',
      'monthly_contributions', 'reserve_transactions',
      'profit_distributions', 'profit_allocations', 'bank_profits',
      // Attendance decides each member's absence charge, so changes to it are kept too.
      'attendance',
    ];
    for (const table of auditedTables) {
      await client.query(`DROP TRIGGER IF EXISTS audit_${table} ON public.${table};`);
      await client.query(`
        CREATE TRIGGER audit_${table}
        AFTER INSERT OR UPDATE OR DELETE ON public.${table}
        FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
      `);
    }

    // When any record that a backup holds last changed, for the "After every change" backup
    // reminder (src/lib/backup.ts). An update counts only if it changes the row (updated_at aside).
    // Restoring runs with triggers off, so a restore is not a change. The row starts at the first
    // run, so an install that already has records is reminded once.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.data_last_changed (
        id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
        changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO public.data_last_changed (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
      CREATE OR REPLACE FUNCTION public.note_data_change_fn()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        UPDATE public.data_last_changed SET changed_at = clock_timestamp() WHERE id;
        RETURN NULL;
      END;
      $$;
    `);
    for (const table of BACKUP_TABLES) {
      const [{ exists }] = (await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${table}`])).rows;
      if (!exists) continue;
      await client.query(`
        DROP TRIGGER IF EXISTS note_change_${table} ON public.${table};
        CREATE TRIGGER note_change_${table}
        AFTER INSERT OR DELETE ON public.${table}
        FOR EACH ROW EXECUTE FUNCTION public.note_data_change_fn();
        DROP TRIGGER IF EXISTS note_update_${table} ON public.${table};
        CREATE TRIGGER note_update_${table}
        AFTER UPDATE ON public.${table}
        FOR EACH ROW WHEN ((to_jsonb(OLD) - 'updated_at') IS DISTINCT FROM (to_jsonb(NEW) - 'updated_at'))
        EXECUTE FUNCTION public.note_data_change_fn();
        DROP TRIGGER IF EXISTS note_truncate_${table} ON public.${table};
        CREATE TRIGGER note_truncate_${table}
        AFTER TRUNCATE ON public.${table}
        FOR EACH STATEMENT EXECUTE FUNCTION public.note_data_change_fn();
      `);
    }
  } finally {
    client.release();
  }
}

// Auth. MSO has one shared login and no roles: anyone with the username and password signs in
// with full access. The username is kept in users.email (it may be an email address or not)
// and is matched without regard to case.
const signIn = (user) => {
  const session = { id: user.id, email: user.email, fullName: user.full_name };
  return { token: jwt.sign(session, JWT_SECRET, { expiresIn: '7d' }), user: session };
};

ipcMain.handle('auth-login', async (_, { email, password }) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, email, password_hash, full_name FROM public.users WHERE lower(email) = lower($1)',
      [String(email || '').trim()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
      return { error: 'Incorrect username or password.' };
    }
    return signIn(user);
  } catch (err) {
    return { error: err.message };
  } finally {
    client.release();
  }
});

// Auth: change the login details (name shown in the app, username, password). The current
// password is required for any change; a new session token is returned with the new details.
ipcMain.handle('auth-update-account', async (_, { userId, currentPassword, username, fullName, newPassword }) => {
  const name = String(username || '').trim();
  const displayName = String(fullName || '').trim();
  const password = newPassword ? String(newPassword) : '';
  if (name.length < 3 || name.length > 64 || /\s/.test(name)) return { error: 'The username must be 3 to 64 characters, with no spaces.' };
  if (displayName.length > 60) return { error: 'Keep the name to 60 characters or fewer.' };
  if (password && password.length < 6) return { error: 'The new password must be at least 6 characters.' };
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, password_hash FROM public.users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) return { error: 'This login no longer exists. Sign in again.' };
    if (!(await bcrypt.compare(String(currentPassword || ''), user.password_hash))) return { error: 'The current password is incorrect.' };
    const taken = await client.query('SELECT 1 FROM public.users WHERE lower(email) = lower($1) AND id <> $2', [name, userId]);
    if (taken.rows.length) return { error: 'That username is already in use.' };
    const hash = password ? await bcrypt.hash(password, 10) : null;
    const updated = await client.query(
      'UPDATE public.users SET email = $1, full_name = $2, password_hash = COALESCE($3, password_hash) WHERE id = $4 RETURNING id, email, full_name',
      [name, displayName || null, hash, userId]
    );
    return { success: true, ...signIn(updated.rows[0]) };
  } catch (err) {
    return { error: err.message };
  } finally {
    client.release();
  }
});


// Auth: Verify token
ipcMain.handle('auth-verify', async (_, { token }) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { user: decoded };
  } catch {
    return { error: 'Invalid or expired session' };
  }
});

// Auth: Change password
ipcMain.handle('auth-change-password', async (_, { userId, currentPassword, newPassword }) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT password_hash FROM public.users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) return { error: 'User not found' };

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return { error: 'Current password is incorrect' };

    const newHash = await bcrypt.hash(newPassword, 10);
    await client.query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  } finally {
    client.release();
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Enables Chromium's built-in PDF viewer, used by the in-app report viewer.
      plugins: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:8080');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  if (!app.isPackaged) win.webContents.openDevTools();
}

app.whenReady().then(async () => {
  try {
    await ensureSchema();
  } catch (err) {
    console.error('Failed to apply schema updates:', err);
  }
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
