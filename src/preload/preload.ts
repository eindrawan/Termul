import { contextBridge, ipcRenderer } from 'electron'
import { z } from 'zod'

// Define schemas for IPC validation
const ConnectionProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  host: z.string(),
  port: z.number().default(22),
  username: z.string(),
  authType: z.enum(['password', 'key']),
  keyPath: z.string().optional(),
  passwordId: z.string().optional(),
})

const TransferDescriptorSchema = z.object({
  id: z.string().optional(),
  sourcePath: z.string(),
  destinationPath: z.string(),
  direction: z.enum(['upload', 'download']),
  size: z.number().optional(),
  overwritePolicy: z.enum(['prompt', 'overwrite', 'skip']).default('prompt'),
  priority: z.number().default(0),
})


// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Connection management
  connectToHost: (profile: z.infer<typeof ConnectionProfileSchema>) =>
    ipcRenderer.invoke('connect-to-host', profile),
  
  disconnectFromHost: () =>
    ipcRenderer.invoke('disconnect-from-host'),
  
  getConnectionStatus: () =>
    ipcRenderer.invoke('get-connection-status'),
  
  onConnectionStatusChange: (callback: (status: any) => void) =>
    ipcRenderer.on('connection-status-change', (_: any, status: any) => callback(status)),
  
  // Profile management
  saveProfile: (profile: z.infer<typeof ConnectionProfileSchema>) =>
    ipcRenderer.invoke('save-profile', profile),
  
  getProfiles: () =>
    ipcRenderer.invoke('get-profiles'),
  
  deleteProfile: (id: string) =>
    ipcRenderer.invoke('delete-profile', id),
  
  testConnection: (profile: z.infer<typeof ConnectionProfileSchema>) =>
    ipcRenderer.invoke('test-connection', profile),
  
  storePassword: (profile: z.infer<typeof ConnectionProfileSchema>, password: string) =>
    ipcRenderer.invoke('store-password', profile, password),
  
  // File system operations
  listLocalFiles: (path: string) =>
    ipcRenderer.invoke('list-local-files', path),
  
  listRemoteFiles: (path: string) =>
    ipcRenderer.invoke('list-remote-files', path),
  
  getHomeDirectory: () =>
    ipcRenderer.invoke('get-home-directory'),
  
  // Transfer operations
  enqueueTransfers: (transfers: z.infer<typeof TransferDescriptorSchema>[]) =>
    ipcRenderer.invoke('enqueue-transfers', transfers),
  
  getTransferQueue: () =>
    ipcRenderer.invoke('get-transfer-queue'),
  
  pauseTransfer: (id: string) =>
    ipcRenderer.invoke('pause-transfer', id),
  
  resumeTransfer: (id: string) =>
    ipcRenderer.invoke('resume-transfer', id),
  
  cancelTransfer: (id: string) =>
    ipcRenderer.invoke('cancel-transfer', id),
  
  onTransferProgress: (callback: (progress: any) => void) =>
    ipcRenderer.on('transfer-progress', (_: any, progress: any) => callback(progress)),
  
  onTransferComplete: (callback: (result: any) => void) =>
    ipcRenderer.on('transfer-complete', (_: any, result: any) => callback(result)),
  
  // Terminal operations
  openTerminal: () =>
    ipcRenderer.invoke('open-terminal'),
  
  closeTerminal: () =>
    ipcRenderer.invoke('close-terminal'),
  
  sendTerminalInput: (data: string) =>
    ipcRenderer.invoke('send-terminal-input', data),
  
  onTerminalOutput: (callback: (data: string) => void) =>
    ipcRenderer.on('terminal-output', (_: any, data: string) => callback(data)),
  
  // Utility functions
  showOpenDialog: (options: any) =>
    ipcRenderer.invoke('show-open-dialog', options),
  
  showSaveDialog: (options: any) =>
    ipcRenderer.invoke('show-save-dialog', options),
  
  // Remove all listeners
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
})

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      connectToHost: (profile: any) => Promise<any>
      disconnectFromHost: () => Promise<any>
      getConnectionStatus: () => Promise<any>
      onConnectionStatusChange: (callback: (status: any) => void) => void
      saveProfile: (profile: any) => Promise<any>
      getProfiles: () => Promise<any>
      deleteProfile: (id: string) => Promise<any>
      testConnection: (profile: any) => Promise<boolean>
      storePassword: (profile: any, password: string) => Promise<string>
      listLocalFiles: (path: string) => Promise<any>
      listRemoteFiles: (path: string) => Promise<any>
      getHomeDirectory: () => Promise<string>
      enqueueTransfers: (transfers: any[]) => Promise<any>
      getTransferQueue: () => Promise<any>
      pauseTransfer: (id: string) => Promise<any>
      resumeTransfer: (id: string) => Promise<any>
      cancelTransfer: (id: string) => Promise<any>
      onTransferProgress: (callback: (progress: any) => void) => void
      onTransferComplete: (callback: (result: any) => void) => void
      openTerminal: () => Promise<any>
      closeTerminal: () => Promise<any>
      sendTerminalInput: (data: string) => Promise<any>
      onTerminalOutput: (callback: (data: string) => void) => void
      showOpenDialog: (options: any) => Promise<any>
      showSaveDialog: (options: any) => Promise<any>
      removeAllListeners: (channel: string) => void
    }
  }
}

export type ElectronAPI = Window['electronAPI']