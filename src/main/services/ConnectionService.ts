import { NodeSSH } from 'node-ssh'
import { ConnectionProfile, ConnectionStatus } from '../../renderer/types'
import { DatabaseService } from './DatabaseService'
import { CredentialService } from './CredentialService'
import { randomUUID } from 'crypto'
import { detectKeyType } from '../utils/keyConverter'
import { FileService } from './FileService'

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
  private fileService: FileService | null = null

  constructor() {
    this.db = new DatabaseService()
    this.credentials = new CredentialService()
  }

  setFileService(fileService: FileService): void {
    this.fileService = fileService
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

      // Use provided passphrase first, then fall back to credentials
      // But only if the key actually needs a passphrase
      const passphrase = auth.needsPassphrase ? (profile.passphrase || auth.passphrase) : undefined

      const config: any = {
        host: profile.host,
        port: profile.port,
        username: profile.username,
        password: auth.password,
        privateKey: auth.privateKey,
        passphrase: passphrase,
        readyTimeout: 30000,
      }

      try {
        await ssh.connect(config)
      } catch (error: any) {
        // Check if this is a key format error
        if (error.message?.includes('Cannot parse privateKey: Unsupported key format')) {
          // Provide specific guidance for key format issues
          const keyType = profile.keyPath ? detectKeyType(profile.keyPath) : 'unknown';
          let errorMessage = `Unsupported private key format: ${keyType}. `;

          if (keyType.includes('PuTTY')) {
            errorMessage += 'Convert your .ppk key to OpenSSH format using PuTTYgen: "Conversions" -> "Export OpenSSH key".';
          } else if (keyType.includes('SSH2')) {
            errorMessage += 'Convert your key to OpenSSH format using PuTTYgen or ssh-keygen.';
          } else {
            errorMessage += 'Make sure your private key is in OpenSSH format (starts with "-----BEGIN").';
          }

          throw new Error(errorMessage);
        }
        // If using SSH key/private key and connection fails, it might need a passphrase
        else if ((profile.authType === 'ssh-key' || profile.authType === 'private-key') && !passphrase &&
          (error.message?.includes('passphrase') || error.message?.includes('decrypt'))) {

          // Prompt for passphrase
          const promptedPassphrase = await this.promptForPassphrase(profile.keyPath || '')
          if (promptedPassphrase) {
            // Cache the passphrase for future use
            await this.credentials.cachePassphrase(profile.keyPath || '', promptedPassphrase)

            // Update config with passphrase and retry
            config.passphrase = promptedPassphrase
            await ssh.connect(config)
          } else {
            throw new Error('Passphrase is required for this SSH key')
          }
        } else {
          throw error
        }
      }

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
        // Clear the SFTP cache before disposing of the connection
        if (this.fileService) {
          await this.fileService.clearSftpCache(connectionId)
        }

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

      // Use provided passphrase first, then fall back to credentials
      const passphrase = profile.passphrase || auth.passphrase

      console.log({
        host: profile.host,
        port: profile.port,
        username: profile.username,
        password: auth.password,
        privateKey: auth.privateKey,
        passphrase: passphrase,
        readyTimeout: 10000,
      })

      try {
        await testSsh.connect({
          host: profile.host,
          port: profile.port,
          username: profile.username,
          password: auth.password,
          privateKey: auth.privateKey,
          passphrase: passphrase,
          readyTimeout: 10000,
        })
      } catch (error: any) {
        // Check if this is a key format error
        if (error.message?.includes('Cannot parse privateKey: Unsupported key format')) {
          // Provide specific guidance for key format issues
          const keyType = profile.keyPath ? detectKeyType(profile.keyPath) : 'unknown';
          console.error(`Key format error: ${keyType}. ${error.message}`);
          return false;
        }
        // If using SSH key/private key and connection fails, it might need a passphrase
        else if ((profile.authType === 'ssh-key' || profile.authType === 'private-key') && !passphrase &&
          (error.message?.includes('passphrase') || error.message?.includes('decrypt'))) {

          // For testing, we'll return false since we can't prompt during a test
          // The actual connection will prompt when needed
          return false
        } else {
          throw error
        }
      }

      await testSsh.dispose()
      return true
    } catch (error) {
      return false
    }
  }

  async saveConnectionPath(profileId: string, pathType: 'local' | 'remote', path: string): Promise<void> {
    await this.db.saveConnectionPath(profileId, pathType, path)
  }

  async getConnectionPath(profileId: string, pathType: 'local' | 'remote'): Promise<string | null> {
    return await this.db.getConnectionPath(profileId, pathType)
  }

  async getAllConnectionPaths(profileId: string): Promise<{ local?: string; remote?: string }> {
    return await this.db.getAllConnectionPaths(profileId)
  }

  async saveConnectionPlugin(profileId: string, pluginId: string): Promise<void> {
    await this.db.saveConnectionPlugin(profileId, pluginId)
  }

  async getConnectionPlugin(profileId: string): Promise<string | null> {
    return await this.db.getConnectionPlugin(profileId)
  }

  private async promptForPassphrase(keyPath: string): Promise<string | null> {
    // This will be implemented with IPC to prompt the user
    // For now, we'll return null to indicate no passphrase was provided
    if ((global as any).pendingPassphrasePrompt) {
      return await new Promise<string | null>((resolve) => {
        // Store the resolve function globally so it can be called from the renderer
        ; (global as any).pendingPassphrasePrompt = { keyPath, resolve }

        // Send an event to the renderer to show the passphrase dialog
        if ((global as any).mainWindow) {
          (global as any).mainWindow.webContents.send('show-passphrase-prompt', { keyPath })
        }
      })
    }
    return null
  }
}