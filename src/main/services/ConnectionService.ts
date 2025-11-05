import { NodeSSH } from 'node-ssh'
import { ConnectionProfile, ConnectionStatus } from '../../renderer/types'
import { DatabaseService } from './DatabaseService'
import { CredentialService } from './CredentialService'

export class ConnectionService {
  private ssh: NodeSSH | null = null
  private status: ConnectionStatus = { connected: false, connecting: false }
  private db: DatabaseService
  private credentials: CredentialService
  private connectionConfig: any = null

  constructor() {
    this.db = new DatabaseService()
    this.credentials = new CredentialService()
  }

  async connect(profile: ConnectionProfile): Promise<ConnectionStatus> {
    try {
      this.status = { connected: false, connecting: true, host: profile.host, username: profile.username }
      this.emitStatusChange()

      // Get credentials
      const auth = await this.credentials.getAuthCredentials(profile)

      // Create SSH connection
      this.ssh = new NodeSSH()
      
      const config: any = {
        host: profile.host,
        port: profile.port,
        username: profile.username,
        password: auth.password,
        privateKey: auth.privateKey,
        passphrase: auth.passphrase,
        readyTimeout: 30000,
      }
      
      this.connectionConfig = config
      await this.ssh.connect(config)

      this.status = {
        connected: true,
        connecting: false,
        host: profile.host,
        username: profile.username
      }
      this.emitStatusChange()

      return this.status
    } catch (error) {
      this.status = {
        connected: false,
        connecting: false,
        host: profile.host,
        username: profile.username,
        error: error instanceof Error ? error.message : String(error)
      }
      this.emitStatusChange()
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.ssh) {
        await this.ssh.dispose()
        this.ssh = null
      }
      this.connectionConfig = null
      this.status = { connected: false, connecting: false }
      this.emitStatusChange()
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }

  getStatus(): ConnectionStatus {
    return this.status
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

  getSshClient(): NodeSSH | null {
    return this.ssh
  }

  getConnectionConfig(): any {
    return this.connectionConfig
  }


  private emitStatusChange(): void {
    // This would be emitted to the renderer process
    if ((global as any).mainWindow) {
      (global as any).mainWindow.webContents.send('connection-status-change', this.status)
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