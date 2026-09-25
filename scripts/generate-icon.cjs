/**
 * Generates the app icons from the MSO seal (src/assets/mso-logo.png — the same image the
 * app and PDFs use), resized with Electron's canvas:
 *   build/icon.ico     — Windows app, installer and taskbar icon (16–256 px)
 *   build/icon.icns    — macOS icon (up to 256 px, the size of the source image)
 *   public/favicon.ico — browser tab when running `npm run dev`
 * Run: npm run generate-icon
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'src/assets/mso-logo.png')).toString('base64')}`;

// Halve the image step by step before the final resize, which keeps small icons crisp.
async function renderPng(win, size) {
  const dataUrl = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let src = img, w = img.naturalWidth, h = img.naturalHeight;
      while (w / 2 >= ${size} * 2) {
        const step = document.createElement('canvas');
        step.width = w = Math.round(w / 2);
        step.height = h = Math.round(h / 2);
        const sctx = step.getContext('2d');
        sctx.imageSmoothingQuality = 'high';
        sctx.drawImage(src, 0, 0, w, h);
        src = step;
      }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = ${size};
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, ${size}, ${size});
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Logo image failed to load'));
    img.src = ${JSON.stringify(SOURCE)};
  })`);
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

// ICO with PNG-compressed images (supported since Windows Vista).
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

// ICNS container of PNG entries.
const ICNS_TYPES = { 16: 'icp4', 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' };
function buildIcns(images) {
  const chunks = images.map(({ size, png }) => {
    const head = Buffer.alloc(8);
    head.write(ICNS_TYPES[size], 0, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([head, png]);
  });
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(8 + chunks.reduce((s, c) => s + c.length, 0), 4);
  return Buffer.concat([header, ...chunks]);
}

function write(rel, buf) {
  const out = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`Written ${buf.length} bytes to ${rel}`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  try {
    await win.loadURL('about:blank');
    const cache = new Map();
    const render = async (sizes) => {
      const out = [];
      for (const size of sizes) {
        if (!cache.has(size)) cache.set(size, await renderPng(win, size));
        out.push({ size, png: cache.get(size) });
      }
      return out;
    };
    write('build/icon.ico', buildIco(await render([16, 20, 24, 32, 40, 48, 64, 128, 256])));
    write('build/icon.icns', buildIcns(await render([16, 32, 64, 128, 256])));
    write('public/favicon.ico', buildIco(await render([16, 32, 48])));
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
