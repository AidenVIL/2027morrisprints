import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';

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
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }
}

app.whenReady().then(createWindow);

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
