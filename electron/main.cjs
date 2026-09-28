const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
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
  'users', 'user_roles', 'members', 'meetings', 'upcoming_meetings',
  'loans', 'loan_schedule', 'loan_installments', 'loan_penalties', 'monthly_contributions',
  'attendance', 'reserve_transactions', 'profit_distributions', 'profit_allocations',
  'audit_log',
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
      const rows = payload.tables[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
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

// Share text through WhatsApp: the desktop app if one is registered for whatsapp:// links,
// otherwise WhatsApp Web. With a phone number the chat with that number opens; without one
// the user picks the recipient. The renderer supplies only the message and number; the URL
// is built here so this can't be used to open arbitrary links.
ipcMain.handle('share-whatsapp', async (_, { text, phone }) => {
  if (typeof text !== 'string' || !text.trim()) return { error: 'There is nothing to share.' };
  let number = '';
  if (phone) {
    // Accept 03001234567, +92 300 1234567 or 923001234567; WhatsApp wants 923001234567.
    const digits = String(phone).replace(/\D/g, '');
    number = digits.startsWith('0') && digits.length === 11 ? `92${digits.slice(1)}` : digits;
    if (number.length < 10 || number.length > 15) return { error: 'The phone number is not valid for WhatsApp.' };
  }
  const query = `${number ? `phone=${number}&` : ''}text=${encodeURIComponent(text)}`;
  try {
    if (app.getApplicationNameForProtocol('whatsapp://')) {
      await shell.openExternal(`whatsapp://send?${query}`);
      return { opened: 'app' };
    }
    await shell.openExternal(`https://web.whatsapp.com/send?${query}`);
    return { opened: 'web' };
  } catch (err) {
    return { error: err.message };
  }
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

    // Backfill a single schedule row for pre-existing loans that predate this feature,
    // so they still show up in overdue tracking without requiring re-entry. What has been paid is
    // measured against the total payable (principal + interest fixed at issue), not the principal,
    // and excludes penalties, which remaining_amount also carries.
    await client.query(`
      INSERT INTO public.loan_schedule (loan_id, installment_number, due_date, due_amount, paid_amount, status)
      SELECT id, 1, loan_date, total_payable, paid,
             CASE WHEN paid >= total_payable - 0.005 THEN 'paid' ELSE 'pending' END
      FROM (
        SELECT l.id, l.loan_date, l.total_payable,
               LEAST(l.total_payable, GREATEST(0, l.total_payable
                 + COALESCE((SELECT SUM(p.amount) FROM public.loan_penalties p WHERE p.loan_id = l.id), 0)
                 - l.remaining_amount)) AS paid
        FROM public.loans l
        WHERE NOT EXISTS (SELECT 1 FROM public.loan_schedule s WHERE s.loan_id = l.id)
      ) t;
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
      'profit_distributions', 'profit_allocations',
    ];
    for (const table of auditedTables) {
      await client.query(`DROP TRIGGER IF EXISTS audit_${table} ON public.${table};`);
      await client.query(`
        CREATE TRIGGER audit_${table}
        AFTER INSERT OR UPDATE OR DELETE ON public.${table}
        FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
      `);
    }
  } finally {
    client.release();
  }
}

// Auth: Login (Admin only)
ipcMain.handle('auth-login', async (_, { email, password }) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT u.id, u.email, u.password_hash, u.full_name, r.role FROM public.users u LEFT JOIN public.user_roles r ON r.user_id = u.id WHERE u.email = $1 AND r.role = $2',
      [email, 'admin']
    );

    const user = result.rows[0];
    if (!user) return { error: 'Invalid admin credentials' };

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return { error: 'Invalid admin credentials' };

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { token, user: { id: user.id, email: user.email, role: user.role, fullName: user.full_name } };
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
