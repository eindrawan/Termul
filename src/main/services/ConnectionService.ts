import { NodeSSH } from 'node-ssh'
import { ConnectionProfile, ConnectionStatus } from '../../renderer/types'
import { DatabaseService } from './DatabaseService'
import { CredentialService } from './CredentialService'
import { randomUUID } from 'crypto'

interface ConnectionInstance {
  id: string
  ssh: NodeSSH
  config: any
  status: ConnectionStatus
  profile: ConnectionProfile
}

export class ConnectionService {
  private connections: Map<string, ConnectionInstance> = new Map()
  private db: DatabaseService
  private credentials: CredentialService

  constructor() {
    this.db = new DatabaseService()
    this.credentials = new CredentialService()
  }

  async connect(profile: ConnectionProfile): Promise<{ connectionId: string; status: ConnectionStatus }> {
    const connectionId = randomUUID()

    try {
      const status: ConnectionStatus = {
        connected: false,
        connecting: true,
        host: profile.host,
        username: profile.username
      }

      this.emitStatusChange(connectionId, status)

      // Get credentials
      const auth = await this.credentials.getAuthCredentials(profile)

      // Create SSH connection
      const ssh = new NodeSSH()

      const config: any = {
        host: profile.host,
        port: profile.port,
        username: profile.username,
        password: auth.password,
        privateKey: auth.privateKey,
        passphrase: auth.passphrase,
        readyTimeout: 30000,
      }

      await ssh.connect(config)

      const connectedStatus: ConnectionStatus = {
        connected: true,
        connecting: false,
        host: profile.host,
        username: profile.username
      }

      this.connections.set(connectionId, {
        id: connectionId,
        ssh,
        config,
        status: connectedStatus,
        profile
      })

      this.emitStatusChange(connectionId, connectedStatus)

      return { connectionId, status: connectedStatus }
    } catch (error) {
      const errorStatus: ConnectionStatus = {
        connected: false,
        connecting: false,
        host: profile.host,
        username: profile.username,
        error: error instanceof Error ? error.message : String(error)
      }
      this.emitStatusChange(connectionId, errorStatus)
      throw error
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId)
      if (connection) {
        await connection.ssh.dispose()
        this.connections.delete(connectionId)

        const status: ConnectionStatus = { connected: false, connecting: false }
        this.emitStatusChange(connectionId, status)
      }
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }

  getStatus(connectionId: string): ConnectionStatus | null {
    const connection = this.connections.get(connectionId)
    return connection ? connection.status : null
  }

  getAllConnections(): Map<string, ConnectionInstance> {
    return this.connections
  }

  async saveProfile(profile: ConnectionProfile): Promise<ConnectionProfile> {
    return await this.db.saveProfile(profile)
  }

  async getProfiles(): Promise<ConnectionProfile[]> {
    return await this.db.getProfiles()
  }

  async deleteProfile(id: string): Promise<void> {
    await this.db.deleteProfile(id)
  }

  getSshClient(connectionId: string): NodeSSH | null {
    const connection = this.connections.get(connectionId)
    return connection ? connection.ssh : null
  }

  getConnectionConfig(connectionId: string): any {
    const connection = this.connections.get(connectionId)
    return connection ? connection.config : null
  }

  getConnectionProfile(connectionId: string): ConnectionProfile | null {
    const connection = this.connections.get(connectionId)
    return connection ? connection.profile : null
  }

  private emitStatusChange(connectionId: string, status: ConnectionStatus): void {
    // This would be emitted to the renderer process
    if ((global as any).mainWindow) {
      (global as any).mainWindow.webContents.send('connection-status-change', { connectionId, status })
    }
  }

  async storePassword(profile: any, password: string): Promise<string> {
    // Create a proper profile object for credential storage
    const profileForStorage: Partial<ConnectionProfile> = {
      id: profile.id,
      authType: 'password'
    }
    return await this.credentials.savePasswordCredentials(profileForStorage as ConnectionProfile, password)
  }

  async testConnection(profile: ConnectionProfile): Promise<boolean> {
    try {
      const auth = await this.credentials.getAuthCredentials(profile)
      const testSsh = new NodeSSH()
      
      console.log({
        host: profile.host,
        port: profile.port,
        username: profile.username,
        password: auth.password,
        privateKey: auth.privateKey,
        passphrase: auth.passphrase,
        readyTimeout: 10000,
      })
      await testSsh.connect({
        host: profile.host,
        port: profile.port,
        username: profile.username,
        password: auth.password,
        privateKey: auth.privateKey,
        passphrase: auth.passphrase,
        readyTimeout: 10000,
      })
      
      await testSsh.dispose()
      return true
    } catch (error) {
      return false
    }
  }
}