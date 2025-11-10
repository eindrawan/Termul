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
  
  // Remove all listeners
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}