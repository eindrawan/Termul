import { contextBridge, ipcRenderer } from 'electron'
import { z } from 'zod'

// Define schemas for IPC validation
const ConnectionProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  host: z.string(),
  port: z.number().default(22),
  username: z.string(),
  authType: z.enum(['password', 'ssh-key', 'private-key']),
  keyPath: z.string().optional(),
  passwordId: z.string().optional(),
})

const TransferDescriptorSchema = z.object({
  id: z.string().optional(),
  connectionId: z.string(),
  sourcePath: z.string(),
  destinationPath: z.string(),
  direction: z.enum(['upload', 'download']),
  size: z.number().optional(),
  overwritePolicy: z.enum(['prompt', 'overwrite', 'skip']).default('prompt'),
  priority: z.number().default(0),
})

const BookmarkSchema = z.object({
  profileId: z.string(),
  name: z.string(),
  localPath: z.string(),
  remotePath: z.string(),
})


// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Connection management
  connectToHost: (profile: z.infer<typeof ConnectionProfileSchema>) =>
    ipcRenderer.invoke('connect-to-host', profile),
  
  disconnectFromHost: (connectionId: string) =>
    ipcRenderer.invoke('disconnect-from-host', connectionId),

  getConnectionStatus: (connectionId: string) =>
    ipcRenderer.invoke('get-connection-status', connectionId),
  
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
  
  promptForPassphrase: (keyPath: string) =>
    ipcRenderer.invoke('prompt-for-passphrase', keyPath),
  
  onShowPassphrasePrompt: (callback: (data: { keyPath: string }) => void) =>
    ipcRenderer.on('show-passphrase-prompt', (_: any, data: { keyPath: string }) => callback(data)),
  
  submitPassphrase: (passphrase: string) =>
    ipcRenderer.send('passphrase-submitted', passphrase),
  
  cancelPassphrasePrompt: () =>
    ipcRenderer.send('passphrase-cancelled'),
  
  // Connection path management
  saveConnectionPath: (profileId: string, pathType: 'local' | 'remote', path: string) =>
    ipcRenderer.invoke('save-connection-path', profileId, pathType, path),
  
  getConnectionPath: (profileId: string, pathType: 'local' | 'remote') =>
    ipcRenderer.invoke('get-connection-path', profileId, pathType),
  
  getAllConnectionPaths: (profileId: string) =>
    ipcRenderer.invoke('get-all-connection-paths', profileId),
  
  // File system operations
  listLocalFiles: (path: string) =>
    ipcRenderer.invoke('list-local-files', path),
  
  listRemoteFiles: (connectionId: string, path: string) =>
    ipcRenderer.invoke('list-remote-files', connectionId, path),
  
  getHomeDirectory: () =>
    ipcRenderer.invoke('get-home-directory'),
  
  deleteLocalFile: (path: string) =>
    ipcRenderer.invoke('delete-local-file', path),
  
  deleteRemoteFile: (connectionId: string, path: string) =>
    ipcRenderer.invoke('delete-remote-file', connectionId, path),
  
  readLocalFile: (path: string) =>
    ipcRenderer.invoke('read-local-file', path),
  
  writeLocalFile: (path: string, content: string) =>
    ipcRenderer.invoke('write-local-file', path, content),
  
  readRemoteFile: (connectionId: string, path: string) =>
    ipcRenderer.invoke('read-remote-file', connectionId, path),
  
  writeRemoteFile: (connectionId: string, path: string, content: string) =>
    ipcRenderer.invoke('write-remote-file', connectionId, path, content),
  
  // File creation operations
  createLocalDirectory: (path: string) =>
    ipcRenderer.invoke('create-local-directory', path),
  
  createRemoteDirectory: (connectionId: string, path: string) =>
    ipcRenderer.invoke('create-remote-directory', connectionId, path),
  
  createLocalFile: (path: string, content?: string) =>
    ipcRenderer.invoke('create-local-file', path, content),
  
  createRemoteFile: (connectionId: string, path: string, content?: string) =>
    ipcRenderer.invoke('create-remote-file', connectionId, path, content),
  
  // File rename operations
  renameLocalFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('rename-local-file', oldPath, newPath),
  
  renameRemoteFile: (connectionId: string, oldPath: string, newPath: string) =>
    ipcRenderer.invoke('rename-remote-file', connectionId, oldPath, newPath),
  
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
  openTerminal: (connectionId: string) =>
    ipcRenderer.invoke('open-terminal', connectionId),

  closeTerminal: (connectionId: string) =>
    ipcRenderer.invoke('close-terminal', connectionId),

  sendTerminalInput: (connectionId: string, data: string) =>
    ipcRenderer.invoke('send-terminal-input', connectionId, data),

  resizeTerminal: (connectionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('resize-terminal', connectionId, cols, rows),

  onTerminalOutput: (callback: (data: { connectionId: string; data: string }) => void) => {
    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('terminal-output')
    
    const listener = (_: any, data: { connectionId: string; data: string }) => {
      console.log('[Preload] Terminal output received:', data)
      callback(data)
    }
    ipcRenderer.on('terminal-output', listener)
    return listener
  },

  onTerminalSessionUpdate: (callback: (data: { connectionId: string; session: any }) => void) => {
    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('terminal-session-update')
    
    const listener = (_: any, data: { connectionId: string; session: any }) => {
      callback(data)
    }
    ipcRenderer.on('terminal-session-update', listener)
    return listener
  },
  
  // Utility functions
  showOpenDialog: (options: any) =>
    ipcRenderer.invoke('show-open-dialog', options),
  
  showSaveDialog: (options: any) =>
    ipcRenderer.invoke('show-save-dialog', options),
  
  // Remove all listeners
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
  
  // Bookmark management
  saveBookmark: (bookmark: z.infer<typeof BookmarkSchema>) =>
    ipcRenderer.invoke('save-bookmark', bookmark),
  
  getBookmarks: (profileId: string) =>
    ipcRenderer.invoke('get-bookmarks', profileId),
  
  deleteBookmark: (id: string) =>
    ipcRenderer.invoke('delete-bookmark', id),
  
  getBookmark: (id: string) =>
    ipcRenderer.invoke('get-bookmark', id),
})

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      connectToHost: (profile: any) => Promise<any>
      disconnectFromHost: (connectionId: string) => Promise<any>
      getConnectionStatus: (connectionId: string) => Promise<any>
      onConnectionStatusChange: (callback: (status: any) => void) => void
      saveProfile: (profile: any) => Promise<any>
      getProfiles: () => Promise<any>
      deleteProfile: (id: string) => Promise<any>
      testConnection: (profile: any) => Promise<boolean>
      storePassword: (profile: any, password: string) => Promise<string>
      promptForPassphrase: (keyPath: string) => Promise<string | null>
      onShowPassphrasePrompt: (callback: (data: { keyPath: string }) => void) => void
      submitPassphrase: (passphrase: string) => void
      cancelPassphrasePrompt: () => void
      saveConnectionPath: (connectionId: string, pathType: 'local' | 'remote', path: string) => Promise<void>
      getConnectionPath: (connectionId: string, pathType: 'local' | 'remote') => Promise<string | null>
      getAllConnectionPaths: (connectionId: string) => Promise<{ local?: string; remote?: string }>
      listLocalFiles: (path: string) => Promise<any>
      listRemoteFiles: (connectionId: string, path: string) => Promise<any>
      getHomeDirectory: () => Promise<string>
      deleteLocalFile: (path: string) => Promise<any>
      deleteRemoteFile: (connectionId: string, path: string) => Promise<any>
      readLocalFile: (path: string) => Promise<string>
      writeLocalFile: (path: string, content: string) => Promise<any>
      readRemoteFile: (connectionId: string, path: string) => Promise<string>
      writeRemoteFile: (connectionId: string, path: string, content: string) => Promise<any>
      createLocalDirectory: (path: string) => Promise<any>
      createRemoteDirectory: (connectionId: string, path: string) => Promise<any>
      createLocalFile: (path: string, content?: string) => Promise<any>
      createRemoteFile: (connectionId: string, path: string, content?: string) => Promise<any>
      renameLocalFile: (oldPath: string, newPath: string) => Promise<any>
      renameRemoteFile: (connectionId: string, oldPath: string, newPath: string) => Promise<any>
      enqueueTransfers: (transfers: any[]) => Promise<any>
      getTransferQueue: () => Promise<any>
      pauseTransfer: (id: string) => Promise<any>
      resumeTransfer: (id: string) => Promise<any>
      cancelTransfer: (id: string) => Promise<any>
      onTransferProgress: (callback: (progress: any) => void) => void
      onTransferComplete: (callback: (result: any) => void) => void
      openTerminal: (connectionId: string) => Promise<any>
      closeTerminal: (connectionId: string) => Promise<any>
      sendTerminalInput: (connectionId: string, data: string) => Promise<any>
      resizeTerminal: (connectionId: string, cols: number, rows: number) => Promise<any>
      onTerminalOutput: (callback: (data: { connectionId: string; data: string }) => void) => void
      onTerminalSessionUpdate: (callback: (data: { connectionId: string; session: any }) => void) => void
      showOpenDialog: (options: any) => Promise<any>
      showSaveDialog: (options: any) => Promise<any>
      removeAllListeners: (channel: string) => void
      saveBookmark: (bookmark: any) => Promise<any>
      getBookmarks: (profileId: string) => Promise<any>
      deleteBookmark: (id: string) => Promise<any>
      getBookmark: (id: string) => Promise<any>
    }
  }
}

export type ElectronAPI = Window['electronAPI']