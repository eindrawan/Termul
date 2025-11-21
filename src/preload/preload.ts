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

const TerminalBookmarkSchema = z.object({
  profileId: z.string(),
  name: z.string(),
  command: z.string(),
  description: z.string().optional(),
})


// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
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

  // Bulk operations
  bulkDeleteRemote: (connectionId: string, files: any[]) =>
    ipcRenderer.invoke('bulk-delete-remote', connectionId, files),

  bulkDeleteLocal: (files: any[]) =>
    ipcRenderer.invoke('bulk-delete-local', files),

  onBulkDeleteProgress: (callback: (progress: { current: number; total: number; currentFile: string }) => void) => {
    const listener = (_: any, progress: any) => callback(progress)
    ipcRenderer.on('bulk-delete-progress', listener)
    return () => ipcRenderer.removeListener('bulk-delete-progress', listener)
  },

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

  clearTransferHistory: () =>
    ipcRenderer.invoke('clear-transfer-history'),

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

  onTerminalError: (callback: (data: { connectionId: string; error: string }) => void) => {
    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('terminal-error')

    const listener = (_: any, data: { connectionId: string; error: string }) => {
      callback(data)
    }
    ipcRenderer.on('terminal-error', listener)
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

  // Terminal bookmark management
  saveTerminalBookmark: (bookmark: z.infer<typeof TerminalBookmarkSchema>) =>
    ipcRenderer.invoke('save-terminal-bookmark', bookmark),

  getTerminalBookmarks: (profileId: string) =>
    ipcRenderer.invoke('get-terminal-bookmarks', profileId),

  deleteTerminalBookmark: (id: string) =>
    ipcRenderer.invoke('delete-terminal-bookmark', id),

  getTerminalBookmark: (id: string) =>
    ipcRenderer.invoke('get-terminal-bookmark', id),

  // File history
  addFileHistory: (connectionId: string | null, path: string) =>
    ipcRenderer.invoke('add-file-history', connectionId, path),

  getFileHistory: () =>
    ipcRenderer.invoke('get-file-history'),

  clearFileHistory: () =>
    ipcRenderer.invoke('clear-file-history'),

  removeFileHistoryItem: (id: string) =>
    ipcRenderer.invoke('remove-file-history-item', id),
})

// Define the ElectronAPI type
export interface ElectronAPI {
  // Connection management
  connectToHost: (profile: any) => Promise<any>
  disconnectFromHost: (connectionId: string) => Promise<any>
  getConnectionStatus: (connectionId: string) => Promise<any>
  onConnectionStatusChange: (callback: (status: any) => void) => void

  // Profile management
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

  // File system operations
  listLocalFiles: (path: string) => Promise<any>
  listRemoteFiles: (connectionId: string, path: string) => Promise<any>
  getHomeDirectory: () => Promise<string>
  deleteLocalFile: (path: string) => Promise<any>
  deleteRemoteFile: (connectionId: string, path: string) => Promise<any>

  // Bulk operations
  bulkDeleteRemote: (connectionId: string, files: any[]) => Promise<any>
  bulkDeleteLocal: (files: any[]) => Promise<any>
  onBulkDeleteProgress: (callback: (progress: { current: number; total: number; currentFile: string }) => void) => void

  readLocalFile: (path: string) => Promise<string>
  writeLocalFile: (path: string, content: string) => Promise<any>
  readRemoteFile: (connectionId: string, path: string) => Promise<string>
  writeRemoteFile: (connectionId: string, path: string, content: string) => Promise<any>

  // File creation operations
  createLocalDirectory: (path: string) => Promise<any>
  createRemoteDirectory: (connectionId: string, path: string) => Promise<any>
  createLocalFile: (path: string, content?: string) => Promise<any>
  createRemoteFile: (connectionId: string, path: string, content?: string) => Promise<any>

  // File rename operations
  renameLocalFile: (oldPath: string, newPath: string) => Promise<any>
  renameRemoteFile: (connectionId: string, oldPath: string, newPath: string) => Promise<any>

  // Transfer operations
  enqueueTransfers: (transfers: any[]) => Promise<any>
  getTransferQueue: () => Promise<any>
  pauseTransfer: (id: string) => Promise<any>
  resumeTransfer: (id: string) => Promise<any>
  cancelTransfer: (id: string) => Promise<any>
  clearTransferHistory: () => Promise<any>
  onTransferProgress: (callback: (progress: any) => void) => void
  onTransferComplete: (callback: (result: any) => void) => void

  // Terminal operations
  openTerminal: (connectionId: string) => Promise<any>
  closeTerminal: (connectionId: string) => Promise<any>
  sendTerminalInput: (connectionId: string, data: string) => Promise<any>
  resizeTerminal: (connectionId: string, cols: number, rows: number) => Promise<any>
  onTerminalOutput: (callback: (data: { connectionId: string; data: string }) => void) => void
  onTerminalSessionUpdate: (callback: (data: { connectionId: string; session: any }) => void) => void
  onTerminalError: (callback: (data: { connectionId: string; error: string }) => void) => void

  // Utility functions
  showOpenDialog: (options: any) => Promise<any>
  showSaveDialog: (options: any) => Promise<any>

  // Remove all listeners
  removeAllListeners: (channel: string) => void

  // Bookmark management
  saveBookmark: (bookmark: any) => Promise<any>
  getBookmarks: (profileId: string) => Promise<any>
  deleteBookmark: (id: string) => Promise<any>
  getBookmark: (id: string) => Promise<any>

  // Terminal bookmark management
  saveTerminalBookmark: (bookmark: any) => Promise<any>
  getTerminalBookmarks: (profileId: string) => Promise<any>
  deleteTerminalBookmark: (id: string) => Promise<any>
  getTerminalBookmark: (id: string) => Promise<any>

  // File history
  addFileHistory: (connectionId: string | null, path: string) => Promise<void>
  getFileHistory: () => Promise<{ id: string, connectionId: string | null, path: string, lastOpenedAt: number }[]>
  clearFileHistory: () => Promise<void>
  removeFileHistoryItem: (id: string) => Promise<void>
}
