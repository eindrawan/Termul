import { FileSystemEntry } from './index'

// Type definitions for the Electron API exposed to the renderer process
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

  // Connection path management
  saveConnectionPath: (profileId: string, pathType: 'local' | 'remote', path: string) => Promise<void>
  getConnectionPath: (profileId: string, pathType: 'local' | 'remote') => Promise<string | null>
  getAllConnectionPaths: (profileId: string) => Promise<{ local?: string; remote?: string }>
  saveConnectionPlugin: (profileId: string, pluginId: string) => Promise<void>
  getConnectionPlugin: (profileId: string) => Promise<string | null>
  saveSetting: (key: string, value: string) => Promise<void>
  getSetting: (key: string) => Promise<string | null>

  // File system operations
  listLocalFiles: (path: string) => Promise<any>
  listRemoteFiles: (connectionId: string, path: string) => Promise<any>
  getHomeDirectory: () => Promise<string>
  deleteLocalFile: (path: string) => Promise<any>
  deleteRemoteFile: (connectionId: string, path: string) => Promise<any>
  readLocalFile: (path: string) => Promise<string>
  writeLocalFile: (path: string, content: string) => Promise<any>
  readRemoteFile: (connectionId: string, path: string) => Promise<string>
  writeRemoteFile: (connectionId: string, path: string, content: string) => Promise<any>
  readLocalFileBase64: (path: string) => Promise<string>
  readRemoteFileBase64: (connectionId: string, path: string) => Promise<string>

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

  // Utility functions
  showOpenDialog: (options: any) => Promise<any>
  showSaveDialog: (options: any) => Promise<any>

  // File History
  addFileHistory: (connectionId: string | null, path: string) => Promise<void>
  getFileHistory: () => Promise<any[]>
  clearFileHistory: () => Promise<void>
  removeFileHistoryItem: (id: string) => Promise<void>

  // Bulk Operations
  onBulkDeleteProgress: (callback: (progress: { current: number; total: number; currentFile: string }) => void) => () => void
  bulkDeleteLocal: (files: FileSystemEntry[]) => Promise<{ successCount: number; failedCount: number; failedFiles: { file: FileSystemEntry; error: string }[] }>
  bulkDeleteRemote: (connectionId: string, files: FileSystemEntry[]) => Promise<{ successCount: number; failedCount: number; failedFiles: { file: FileSystemEntry; error: string }[] }>

  // Docker operations
  listDockerContainers: (connectionId: string) => Promise<any[]>
  getDockerContainerLogs: (connectionId: string, containerId: string) => Promise<string>
  setDockerSudoPassword: (connectionId: string, password: string) => Promise<void>
  restartDockerContainer: (connectionId: string, containerId: string) => Promise<void>
  startDockerShell: (connectionId: string, containerId: string, cols: number, rows: number) => Promise<string>
  sendDockerShellInput: (shellId: string, data: string) => Promise<void>
  resizeDockerShell: (shellId: string, cols: number, rows: number) => Promise<void>
  closeDockerShell: (shellId: string) => Promise<void>
  onDockerShellOutput: (callback: (data: { shellId: string; data: string }) => void) => void
  onDockerShellClosed: (callback: (data: { shellId: string }) => void) => void

  // Remove all listeners
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export { }