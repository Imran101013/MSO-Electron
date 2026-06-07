const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'hilal-connect-secret-key-change-in-production';

// Utility function to generate a random password
function generateRandomPassword(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mso-db',
  user: 'postgres',       // change to your pgAdmin username
  password: 'postgres',   // change to your pgAdmin password
});

// Generic DB query handler
ipcMain.handle('db-query', async (_, { sql, params }) => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return { rows: result.rows };
  } catch (err) {
    return { error: err.message };
  } finally {
    client.release();
  }
});

// Auth: Login
ipcMain.handle('auth-login', async (_, { identifier, password }) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT u.id, u.email, u.password_hash, u.full_name, m.is_approved, r.role FROM public.users u LEFT JOIN public.members m ON m.user_id = u.id LEFT JOIN public.user_roles r ON r.user_id = u.id WHERE u.email = $1 OR m.phone = $1 LIMIT 1',
      [identifier]
    );

    const user = result.rows[0];
    if (!user) return { error: 'Invalid email or password' };

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return { error: 'Invalid email or password' };

    if (!user.is_approved) return { error: 'Your account is pending approval. Please wait for an admin to approve your account.' };

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

// Auth: Signup
ipcMain.handle('auth-signup', async (_, { email, password, fullName }) => {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return { error: 'Email already registered' };

    const password_hash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    const userResult = await client.query(
      'INSERT INTO public.users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
      [email, password_hash, fullName]
    );
    const userId = userResult.rows[0].id;

    await client.query(
      'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)',
      [userId, 'member']
    );

    await client.query(
      'INSERT INTO public.members (user_id, name, father_name, email, join_date, is_approved, login_password) VALUES ($1, $2, $3, $4, CURRENT_DATE, false, $5)',
      [userId, fullName || 'New Member', '', email, password]
    );

    await client.query(
      'INSERT INTO public.profiles (user_id, email, full_name) VALUES ($1, $2, $3)',
      [userId, email, fullName]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
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

// Auth: Create member (admin creates a new member with auto-generated password)
ipcMain.handle('auth-create-member', async (_, { email, name, fatherName, phone, address, dob, joinDate }) => {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return { error: 'Email already registered' };

    const generatedPassword = generateRandomPassword();
    const password_hash = await bcrypt.hash(generatedPassword, 10);

    await client.query('BEGIN');

    const userResult = await client.query(
      'INSERT INTO public.users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
      [email, password_hash, name]
    );
    const userId = userResult.rows[0].id;

    await client.query(
      'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)',
      [userId, 'member']
    );

    await client.query(
      'INSERT INTO public.members (user_id, name, father_name, email, phone, address, dob, join_date, is_approved, login_password) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)',
      [userId, name, fatherName || '', email, phone || null, address || null, dob || null, joinDate, generatedPassword]
    );

    await client.query(
      'INSERT INTO public.profiles (user_id, email, full_name) VALUES ($1, $2, $3)',
      [userId, email, name]
    );

    await client.query('COMMIT');
    return { success: true, generatedPassword };
  } catch (err) {
    await client.query('ROLLBACK');
    return { error: err.message };
  } finally {
    client.release();
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:8080');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
