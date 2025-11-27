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

  // File system operations
  listLocalFiles: (path: string) => Promise<any>
  listRemoteFiles: (connectionId: string, path: string) => Promise<any>
  getHomeDirectory: () => Promise<string>
  deleteLocalFile: (path: string) => Promise<any>
  deleteRemoteFile: (connectionId: string, path: string) => Promise<any>

  // Bulk operations
  bulkDeleteRemote: (connectionId: string, files: any[]) => Promise<{
    success: boolean
    deletedCount: number
    failedCount: number
    failedFiles: Array<{ path: string; error: string }>
  }>
  bulkDeleteLocal: (files: any[]) => Promise<{
    success: boolean
    deletedCount: number
    failedCount: number
    failedFiles: Array<{ path: string; error: string }>
  }>
  onBulkDeleteProgress: (callback: (progress: { current: number; total: number; currentFile: string }) => void) => () => void


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

  // Utility functions
  showOpenDialog: (options: any) => Promise<any>
  showSaveDialog: (options: any) => Promise<any>

  // File history
  addFileHistory: (connectionId: string | null, path: string) => Promise<void>
  getFileHistory: (profileId?: string) => Promise<{ id: string, connectionId: string | null, path: string, lastOpenedAt: number }[]>
  clearFileHistory: () => Promise<void>
  removeFileHistoryItem: (id: string) => Promise<void>

  // App lifecycle
  appReady: () => void

  // Crontab operations
  readCrontab: (connectionId: string, crontabType?: 'user' | 'root') => Promise<string>
  writeCrontab: (connectionId: string, content: string, crontabType?: 'user' | 'root') => Promise<void>
  validateCrontab: (content: string) => Promise<{ valid: boolean; error?: string }>
  setCrontabSudoPassword: (connectionId: string, password: string) => Promise<void>

  // Remove all listeners
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}