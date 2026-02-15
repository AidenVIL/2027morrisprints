import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  downloadFile: (url: string, dest: string) => ipcRenderer.invoke('download-file', { url, dest }),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path)
});
