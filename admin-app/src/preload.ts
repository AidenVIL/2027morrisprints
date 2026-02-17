import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  downloadFile: (url: string, dest: string) => ipcRenderer.invoke('download-file', { url, dest }),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: any) => ipcRenderer.invoke('store-set', { key, value }),
  storeGetAll: () => ipcRenderer.invoke('store-get-all'),
  spawnOpen: (exePath: string, filePath: string) => ipcRenderer.invoke('spawn-open', { exePath, filePath })
});
