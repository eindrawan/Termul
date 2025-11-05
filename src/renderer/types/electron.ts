// Type definitions for the Electron API exposed to the renderer process
export interface ElectronAPI {
  // Connection management
  connectToHost: (profile: any) => Promise<any>
  disconnectFromHost: () => Promise<any>
  getConnectionStatus: () => Promise<any>
  onConnectionStatusChange: (callback: (status: any) => void) => void
  
  // Profile management
  saveProfile: (profile: any) => Promise<any>
  getProfiles: () => Promise<any>
  deleteProfile: (id: string) => Promise<any>
  testConnection: (profile: any) => Promise<boolean>
  storePassword: (profile: any, password: string) => Promise<string>
  
  // File system operations
  listLocalFiles: (path: string) => Promise<any>
  listRemoteFiles: (path: string) => Promise<any>
  getHomeDirectory: () => Promise<string>
  
  // Transfer operations
  enqueueTransfers: (transfers: any[]) => Promise<any>
  getTransferQueue: () => Promise<any>
  pauseTransfer: (id: string) => Promise<any>
  resumeTransfer: (id: string) => Promise<any>
  cancelTransfer: (id: string) => Promise<any>
  onTransferProgress: (callback: (progress: any) => void) => void
  onTransferComplete: (callback: (result: any) => void) => void
  
  // Terminal operations
  openTerminal: () => Promise<any>
  closeTerminal: () => Promise<any>
  sendTerminalInput: (data: string) => Promise<any>
  onTerminalOutput: (callback: (data: string) => void) => void
  
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