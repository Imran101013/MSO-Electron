const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'hilal-connect-secret-key-change-in-production';

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
    icon: path.join(__dirname, '../public/MSO-Logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:8080');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  win.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
