import { promises as fs } from 'fs'
import { join, basename } from 'path'
import SFTPClient from 'ssh2-sftp-client'
import { FileSystemEntry } from '../../renderer/types'
import { ConnectionService } from './ConnectionService'

export class FileService {
  private connectionService: ConnectionService
  private sftpCache: Map<string, SFTPClient> = new Map()

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  public async clearSftpCache(connectionId: string): Promise<void> {
    const sftp = this.sftpCache.get(connectionId)
    if (sftp) {
      try {
        await sftp.end()
      } catch (error) {
        console.warn(`Error closing SFTP connection for cache cleanup:`, error)
      }
      this.sftpCache.delete(connectionId)
    }
  }

  public async getSftpClient(connectionId: string): Promise<SFTPClient> {
    const cachedSftp = this.sftpCache.get(connectionId)
    if (cachedSftp) {
      return cachedSftp
    }

    const connectionConfig = this.connectionService.getConnectionConfig(connectionId)
    if (!connectionConfig) {
      throw new Error('Connection configuration not available')
    }

    const sftp = new SFTPClient()
    await sftp.connect({
      host: connectionConfig.host,
      port: connectionConfig.port,
      username: connectionConfig.username,
      password: connectionConfig.password,
      privateKey: connectionConfig.privateKey,
      passphrase: connectionConfig.passphrase,
      readyTimeout: 30000,
    })

    this.sftpCache.set(connectionId, sftp)
    return sftp
  }

  public getSshClient(connectionId: string) {
    return this.connectionService.getSshClient(connectionId)
  }

  async listLocalFiles(path: string): Promise<FileSystemEntry[]> {
    try {

      const entries = await fs.readdir(path, { withFileTypes: true })
      const files: FileSystemEntry[] = []

      for (const entry of entries) {

        const fullPath = join(path, entry.name)
        try {
          const stats = await fs.stat(fullPath)

          files.push({
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: entry.isFile() ? stats.size : undefined,
            modified: stats.mtimeMs,
            permissions: this.formatPermissions(stats.mode),
          })
        } catch (error) {
          // Skip files/directories we can't access
          console.warn(`Skipping ${entry.name}:`, error)
        }
      }

      // Sort: directories first, then files alphabetically
      return files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      console.error(`Failed to list local files at ${path}:`, error)
      throw error
    }
  }

  async listRemoteFiles(connectionId: string, path: string): Promise<FileSystemEntry[]> {
    console.log(`FileService: Attempting to list remote files for path: ${path}`)

    try {
      const sftp = await this.getSftpClient(connectionId)
      const entries = await sftp.list(path)

      const files: FileSystemEntry[] = entries.map((entry) => ({
        name: entry.name,
        path: `${path.replace(/\/$/, '')}/${entry.name}`,
        type: entry.type === 'd' ? 'directory' : 'file',
        size: entry.type === 'd' ? undefined : entry.size,
        modified: entry.modifyTime,
        permissions: entry.rights ? this.formatSftpPermissions(entry.rights) : '-',
      }))

      // Sort: directories first, then files alphabetically
      return files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      console.error(`Failed to list remote files at ${path}:`, error)
      // If there's an error, it might be due to a stale connection.
      // Clear the cache for this connection to force a reconnect on the next attempt.
      await this.clearSftpCache(connectionId)
      throw error
    }
  }

  async createLocalDirectory(path: string): Promise<void> {
    try {
      await fs.mkdir(path, { recursive: true })
    } catch (error) {
      console.error(`Failed to create local directory ${path}:`, error)
      throw error
    }
  }

  async createRemoteDirectory(connectionId: string, path: string): Promise<void> {
    try {
      const sftp = await this.getSftpClient(connectionId)
      await sftp.mkdir(path)
    } catch (error) {
      console.error(`Failed to create remote directory ${path}:`, error)
      await this.clearSftpCache(connectionId)
      throw error
    }
  }

  async deleteLocalFile(path: string): Promise<void> {
    try {
      const stats = await fs.stat(path)
      if (stats.isDirectory()) {
        await fs.rmdir(path, { recursive: true })
      } else {
        await fs.unlink(path)
      }
    } catch (error) {
      console.error(`Failed to delete local file ${path}:`, error)
      throw error
    }
  }

  async deleteRemoteFile(connectionId: string, path: string): Promise<void> {
    try {
      const sftp = await this.getSftpClient(connectionId)
      const stats = await sftp.stat(path)

      if (stats.isSymbolicLink) {
        await sftp.delete(path)
      } else if (stats.isDirectory) {
        await sftp.rmdir(path, true)
      } else {
        await sftp.delete(path)
      }
    } catch (error) {
      console.error(`Failed to delete remote file ${path}:`, error)
      await this.clearSftpCache(connectionId)
      throw error
    }
  }

  async getLocalFileInfo(path: string): Promise<FileSystemEntry | null> {
    try {
      const stats = await fs.stat(path)
      return {
        name: basename(path),
        path,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.isFile() ? stats.size : undefined,
        modified: stats.mtimeMs,
        permissions: this.formatPermissions(stats.mode),
      }
    } catch (error) {
      return null
    }
  }

  async getRemoteFileInfo(connectionId: string, path: string): Promise<FileSystemEntry | null> {
    try {
      const sftp = await this.getSftpClient(connectionId)
      const stats = await sftp.stat(path)

      return {
        name: basename(path),
        path,
        type: stats.isDirectory ? 'directory' : 'file',
        size: stats.isFile ? stats.size : undefined,
        modified: stats.modifyTime,
        permissions: stats.mode ? this.formatPermissions(stats.mode) : undefined,
      }
    } catch (error) {
      // Don't clear cache here, as this is often used for existence checks
      return null
    }
  }

  private formatPermissions(mode: number): string {
    const permissions = []

    if (mode & 0o400) permissions.push('r')
    else permissions.push('-')

    if (mode & 0o200) permissions.push('w')
    else permissions.push('-')

    if (mode & 0o100) permissions.push('x')
    else permissions.push('-')

    // Group permissions
    if (mode & 0o040) permissions.push('r')
    else permissions.push('-')

    if (mode & 0o020) permissions.push('w')
    else permissions.push('-')

    if (mode & 0o010) permissions.push('x')
    else permissions.push('-')

    // Other permissions
    if (mode & 0o004) permissions.push('r')
    else permissions.push('-')

    if (mode & 0o002) permissions.push('w')
    else permissions.push('-')

    if (mode & 0o001) permissions.push('x')
    else permissions.push('-')

    return permissions.join('')
  }

  private formatSftpPermissions(rights: any): string {
    if (!rights) return '-'

    const permissions = []

    // User permissions
    permissions.push(rights.user & 4 ? 'r' : '-')
    permissions.push(rights.user & 2 ? 'w' : '-')
    permissions.push(rights.user & 1 ? 'x' : '-')

    // Group permissions
    permissions.push(rights.group & 4 ? 'r' : '-')
    permissions.push(rights.group & 2 ? 'w' : '-')
    permissions.push(rights.group & 1 ? 'x' : '-')

    // Other permissions
    permissions.push(rights.other & 4 ? 'r' : '-')
    permissions.push(rights.other & 2 ? 'w' : '-')
    permissions.push(rights.other & 1 ? 'x' : '-')

    return permissions.join('')
  }

  async resolveLocalPath(path: string): Promise<string> {
    // Resolve any relative paths and normalize
    return join(path)
  }

  async resolveRemotePath(path: string, _connectionId?: string): Promise<string> {
    // Normalize remote path (handle ~, ., ..)
    if (path.startsWith('~')) {
      // Expand to user home directory
      // For now, just replace ~ with /home/username
      // In a real implementation, you'd get the actual home directory from the SSH connection
      return path.replace('~', '/home')
    }

    // Handle root directory specially - keep the trailing slash for root "/"
    if (path === '/') {
      return '/'
    }

    // Normalize path separators and remove redundant slashes for non-root paths
    return path.replace(/\/+/g, '/').replace(/\/$/, '')
  }

  async readLocalFile(path: string): Promise<string> {
    try {
      return await fs.readFile(path, 'utf-8')
    } catch (error) {
      console.error(`Failed to read local file ${path}:`, error)
      throw error
    }
  }

  async writeLocalFile(path: string, content: string): Promise<void> {
    try {
      await fs.writeFile(path, content, 'utf-8')
    } catch (error) {
      console.error(`Failed to write local file ${path}:`, error)
      throw error
    }
  }

  async readRemoteFile(connectionId: string, path: string): Promise<string> {
    try {
      const sftp = await this.getSftpClient(connectionId)
      const result = await sftp.get(path)
      return Buffer.isBuffer(result) ? result.toString('utf-8') : (result as string)
    } catch (error) {
      console.error(`Failed to read remote file ${path}:`, error)
      await this.clearSftpCache(connectionId)
      throw error
    }
  }

  async writeRemoteFile(connectionId: string, path: string, content: string): Promise<void> {
    try {
      const sftp = await this.getSftpClient(connectionId)
      const buffer = Buffer.from(content, 'utf-8')
      await sftp.put(buffer, path)
    } catch (error) {
      console.error(`Failed to write remote file ${path}:`, error)
      await this.clearSftpCache(connectionId)
      throw error
    }
  }

  async readLocalFileBase64(path: string): Promise<string> {
    try {
      const buffer = await fs.readFile(path)
      return buffer.toString('base64')
    } catch (error) {
      console.error(`Failed to read local file base64 ${path}:`, error)
      throw error
    }
  }

  async readRemoteFileBase64(connectionId: string, path: string): Promise<string> {
    try {
      const sftp = await this.getSftpClient(connectionId)
      const result = await sftp.get(path)
      const buffer = Buffer.isBuffer(result) ? result : Buffer.from(result as string) // Should be buffer usually
      return buffer.toString('base64')
    } catch (error) {
      console.error(`Failed to read remote file base64 ${path}:`, error)
      await this.clearSftpCache(connectionId)
      throw error
    }
  }

  async createLocalFile(path: string, content: string = ''): Promise<void> {
    try {
      await fs.writeFile(path, content, 'utf-8')
    } catch (error) {
      console.error(`Failed to create local file ${path}:`, error)
      throw error
    }
  }

  async createRemoteFile(connectionId: string, path: string, content: string = ''): Promise<void> {
    const ssh = this.connectionService.getSshClient(connectionId)
    if (!ssh) {
      throw new Error('Not connected to remote host')
    }

    const connectionConfig = this.connectionService.getConnectionConfig(connectionId)
    if (!connectionConfig) {
      throw new Error('Connection configuration not available')
    }

    const sftp = new SFTPClient()

    try {
      await sftp.connect({
        host: connectionConfig.host,
        port: connectionConfig.port,
        username: connectionConfig.username,
        password: connectionConfig.password,
        privateKey: connectionConfig.privateKey,
        passphrase: connectionConfig.passphrase,
        readyTimeout: 30000
      })

      // Create a temporary buffer from the content
      const buffer = Buffer.from(content, 'utf-8')
      await sftp.put(buffer, path)
    } catch (error) {
      console.error(`Failed to create remote file ${path}:`, error)
      throw error
    } finally {
      await sftp.end()
    }
  }

  async renameLocalFile(oldPath: string, newPath: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath)
    } catch (error) {
      console.error(`Failed to rename local file ${oldPath} to ${newPath}:`, error)
      throw error
    }
  }

  async renameRemoteFile(connectionId: string, oldPath: string, newPath: string): Promise<void> {
    const ssh = this.connectionService.getSshClient(connectionId)
    if (!ssh) {
      throw new Error('Not connected to remote host')
    }

    const connectionConfig = this.connectionService.getConnectionConfig(connectionId)
    if (!connectionConfig) {
      throw new Error('Connection configuration not available')
    }

    const sftp = new SFTPClient()

    try {
      await sftp.connect({
        host: connectionConfig.host,
        port: connectionConfig.port,
        username: connectionConfig.username,
        password: connectionConfig.password,
        privateKey: connectionConfig.privateKey,
        passphrase: connectionConfig.passphrase,
        readyTimeout: 30000
      })

      await sftp.rename(oldPath, newPath)
    } catch (error) {
      console.error(`Failed to rename remote file ${oldPath} to ${newPath}:`, error)
      throw error
    } finally {
      await sftp.end()
    }
  }
}