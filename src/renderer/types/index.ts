export interface ConnectionProfile {
  id?: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'ssh-key' | 'private-key'
  keyPath?: string
  passwordId?: string
  passphrase?: string
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
  connectionId: string
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
  reconnecting?: boolean
  host?: string
  username?: string
  error?: string
  latency?: number
}

export interface ActiveConnection {
  id: string
  profile: ConnectionProfile
  status: ConnectionStatus
  remotePath: string
  localPath?: string
  terminalSession?: TerminalSession
  activePluginId?: string
}

export interface TerminalSession {
  id: string
  connectionId: string
  connected: boolean
  host?: string
  username?: string
  rows: number
  cols: number
}

export type TabType = 'file-manager' | 'terminal'

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

export interface Bookmark {
  id?: string
  profileId: string
  name: string
  localPath: string
  remotePath: string
  createdAt?: number
}

export interface TerminalBookmark {
  id?: string
  profileId: string
  name: string
  command: string
  description?: string
  createdAt?: number
}