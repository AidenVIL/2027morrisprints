import { app, BrowserWindow, ipcMain, shell } from 'electron';
let autoUpdater: any = null;
try {
  // @ts-ignore
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  autoUpdater = null;
}
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';
import { spawn } from 'child_process';
import isDev from 'electron-is-dev';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const devUrl = 'http://localhost:5173';
  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }
}

app.whenReady().then(createWindow);

// Auto-updater: check for updates and notify renderer (only if available)
if (autoUpdater) {
  app.whenReady().then(() => {
    try {
      autoUpdater.autoDownload = true;
      autoUpdater.on('update-available', (info: any) => {
        if (mainWindow) mainWindow.webContents.send('update-available', info);
      });
      autoUpdater.on('update-downloaded', (info: any) => {
        if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
      });
      autoUpdater.on('error', (err: any) => {
        if (mainWindow) mainWindow.webContents.send('update-error', String(err));
      });
      // check on startup
      setTimeout(() => {
        (autoUpdater as any).checkForUpdatesAndNotify().catch(() => {});
      }, 5 * 1000);
    } catch (e) {
      // ignore if electron-updater misconfigured
    }
  });

  ipcMain.handle('check-for-updates', async () => {
    try {
      const res = await autoUpdater.checkForUpdates();
      return { ok: true, info: res }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  });
}

ipcMain.handle('download-file', async (event, args) => {
  const { url, dest } = args;
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  return { ok: true, path: dest };
});

ipcMain.handle('open-path', async (event, filePath) => {
  const r = await shell.openPath(filePath);
  return r;
});

// electron-store
const store = new Store({ name: 'admin-settings' });
ipcMain.handle('store-get', async (event, key: string) => {
  return store.get(key);
});
ipcMain.handle('store-set', async (event, args: { key: string; value: any }) => {
  store.set(args.key, args.value);
  return { ok: true };
});
ipcMain.handle('store-get-all', async () => ({ ...store.store }));

ipcMain.handle('spawn-open', async (event, args: { exePath?: string; filePath: string }) => {
  try {
    if (args.exePath) {
      spawn(args.exePath, [args.filePath], { detached: true, stdio: 'ignore' }).unref();
      return { ok: true };
    }
    const r = await shell.openPath(args.filePath);
    return { ok: true, path: r };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
