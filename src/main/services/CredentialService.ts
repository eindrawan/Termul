import keytar from 'keytar'
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { ConnectionProfile } from '../../renderer/types'
import { validateAndFormatPrivateKey, validateAndFormatPrivateKeyWithMetadata } from '../utils/keyConverter'

interface AuthCredentials {
  password?: string
  privateKey?: string
  passphrase?: string
  needsPassphrase?: boolean
}

export class CredentialService {
  private readonly serviceName = 'termul-ssh-client'
  private readonly masterKeyFile = 'master.key'

  constructor() {
    this.ensureMasterKey()
  }

  async getAuthCredentials(profile: ConnectionProfile): Promise<AuthCredentials> {
    if (profile.authType === 'password') {
      const passwordId = profile.passwordId || profile.id
      if (!passwordId) {
        throw new Error('No password ID available')
      }
      const password = await keytar.getPassword(this.serviceName, passwordId)
      return { password: password || undefined }
    } else if ((profile.authType === 'ssh-key' || profile.authType === 'private-key') && profile.keyPath) {
      // Use provided passphrase first, then check for cached passphrase
      let passphrase = profile.passphrase;
      if (!passphrase) {
        const cachedPassphrase = await this.getCachedPassphrase(profile.keyPath);
        passphrase = cachedPassphrase || undefined;
      }

      // Use the new function that returns both the key and whether it needs a passphrase
      const { privateKey, needsPassphrase } = await validateAndFormatPrivateKeyWithMetadata(
        profile.keyPath,
        passphrase
      );

      // Only include passphrase if the key actually needs it
      return {
        privateKey,
        passphrase: needsPassphrase ? passphrase : undefined,
        needsPassphrase
      }
    }

    throw new Error('Invalid authentication type')
  }

  async savePasswordCredentials(profile: ConnectionProfile, password: string): Promise<string> {
    const passwordId = profile.id || this.generateId()
    await keytar.setPassword(this.serviceName, passwordId, password)
    return passwordId
  }

  async getPrivateKey(keyPath: string, passphrase?: string): Promise<string> {
    try {
      // Use the key converter to validate and format the key
      return await validateAndFormatPrivateKey(keyPath, passphrase)
    } catch (error) {
      throw new Error(`Failed to read private key: ${error}`)
    }
  }

  async cachePassphrase(keyPath: string, passphrase: string, ttlMinutes: number = 15): Promise<void> {
    const encrypted = this.encrypt(passphrase)
    const cacheData = {
      keyPath,
      encrypted,
      expiresAt: Date.now() + (ttlMinutes * 60 * 1000)
    }
    
    const cacheFile = join(app.getPath('userData'), 'passphrase-cache.json')
    writeFileSync(cacheFile, JSON.stringify(cacheData))
  }

  async getCachedPassphrase(keyPath: string): Promise<string | null> {
    try {
      const cacheFile = join(app.getPath('userData'), 'passphrase-cache.json')
      const cacheData = JSON.parse(readFileSync(cacheFile, 'utf8'))
      
      if (cacheData.keyPath === keyPath && cacheData.expiresAt > Date.now()) {
        return this.decrypt(cacheData.encrypted)
      }
      
      return null
    } catch (error) {
      return null
    }
  }

  clearPassphraseCache(): void {
    try {
      const cacheFile = join(app.getPath('userData'), 'passphrase-cache.json')
      writeFileSync(cacheFile, '{}')
    } catch (error) {
      console.error('Failed to clear passphrase cache:', error)
    }
  }

  async deletePasswordCredentials(passwordId: string): Promise<void> {
    await keytar.deletePassword(this.serviceName, passwordId)
  }

  private ensureMasterKey(): void {
    const keyFile = join(app.getPath('userData'), this.masterKeyFile)
    
    try {
      readFileSync(keyFile, 'utf8')
    } catch (error) {
      // Generate a new master key if it doesn't exist
      const masterKey = randomBytes(32).toString('hex')
      writeFileSync(keyFile, masterKey, 'utf8')
    }
  }

  private getMasterKey(): string {
    const keyFile = join(app.getPath('userData'), this.masterKeyFile)
    return readFileSync(keyFile, 'utf8')
  }

  private encrypt(text: string): string {
    const masterKey = this.getMasterKey()
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', masterKey, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted
    })
  }

  private decrypt(encryptedData: string): string {
    const masterKey = this.getMasterKey()
    const data = JSON.parse(encryptedData)
    
    const decipher = createDecipheriv('aes-256-gcm', masterKey, Buffer.from(data.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'))
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}