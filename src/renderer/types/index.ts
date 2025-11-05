export interface ConnectionProfile {
  id?: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  keyPath?: string
  passwordId?: string
}

export interface FileSystemEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: number
  permissions?: string
}

export interface TransferDescriptor {
  id?: string
  sourcePath: string
  destinationPath: string
  direction: 'upload' | 'download'
  size?: number
  overwritePolicy: 'prompt' | 'overwrite' | 'skip'
  priority: number
}

export interface TransferItem extends TransferDescriptor {
  id: string
  status: 'pending' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
  progress: number
  speed?: number
  eta?: number
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export interface ConnectionStatus {
  connected: boolean
  connecting: boolean
  host?: string
  username?: string
  error?: string
  latency?: number
}

export interface TerminalSession {
  id: string
  connected: boolean
  host?: string
  rows: number
  cols: number
}

export type TabType = 'file-manager' | 'transfer-queue' | 'terminal'

export interface AppState {
  activeTab: TabType
  connectionStatus: ConnectionStatus
  profiles: ConnectionProfile[]
  currentProfile?: ConnectionProfile
  localPath: string
  remotePath: string
  localFiles: FileSystemEntry[]
  remoteFiles: FileSystemEntry[]
  transferQueue: TransferItem[]
  terminalSession?: TerminalSession
}