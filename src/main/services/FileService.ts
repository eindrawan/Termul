import { promises as fs } from 'fs'
import { join, basename } from 'path'
import SFTPClient from 'ssh2-sftp-client'
import { FileSystemEntry } from '../../renderer/types'
import { ConnectionService } from './ConnectionService'

export class FileService {
  private connectionService: ConnectionService

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  async listLocalFiles(path: string): Promise<FileSystemEntry[]> {
    try {
      // Handle root directory specially
      if (path === 'C:\\' || path === 'C:/') {
        // Always fall back to common directories for root to avoid permission issues
        console.log(`Listing root directory, using common directories fallback`)
        
        const userDirs = [
          { name: 'Users', path: 'C:\\Users', type: 'directory' as const },
          { name: 'Program Files', path: 'C:\\Program Files', type: 'directory' as const },
          { name: 'Program Files (x86)', path: 'C:\\Program Files (x86)', type: 'directory' as const },
          { name: 'Windows', path: 'C:\\Windows', type: 'directory' as const },
        ]
        
        const files: FileSystemEntry[] = []
        for (const dir of userDirs) {
          try {
            const stats = await fs.stat(dir.path)
            files.push({
              ...dir,
              size: undefined,
              modified: stats.mtimeMs,
              permissions: this.formatPermissions(stats.mode),
            })
          } catch (error) {
            // Skip directories we can't access
            console.warn(`Skipping ${dir.name}:`, error)
          }
        }
        
        // If we still don't have any files, try to get the user's home directory
        if (files.length === 0) {
          const homeDir = require('os').homedir()
          try {
            const stats = await fs.stat(homeDir)
            files.push({
              name: 'Home',
              path: homeDir,
              type: 'directory' as const,
              size: undefined,
              modified: stats.mtimeMs,
              permissions: this.formatPermissions(stats.mode),
            })
          } catch (error) {
            console.error(`Cannot access home directory:`, error)
          }
        }
        
        return files
      }

      const entries = await fs.readdir(path, { withFileTypes: true })
      const files: FileSystemEntry[] = []

      for (const entry of entries) {
        // Skip system directories and hidden files
        if (entry.name.startsWith('$') || entry.name.startsWith('.')) {
          continue
        }

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

  async listRemoteFiles(path: string): Promise<FileSystemEntry[]> {
    console.log(`FileService: Attempting to list remote files for path: ${path}`)
    
    const ssh = this.connectionService.getSshClient()
    if (!ssh) {
      console.error('FileService: SSH client is null')
      throw new Error('Not connected to remote host')
    }

    // Get the connection details from the SSH client
    const connectionConfig = this.connectionService.getConnectionConfig()
    if (!connectionConfig) {
      console.error('FileService: Connection config is null')
      throw new Error('Connection configuration not available')
    }

    console.log('FileService: Connection config:', {
      host: connectionConfig.host,
      port: connectionConfig.port,
      username: connectionConfig.username,
      hasPassword: !!connectionConfig.password,
      hasKey: !!connectionConfig.privateKey
    })

    const sftp = new SFTPClient()
    
    try {
      // Connect SFTP client using the same connection details
      console.log('FileService: Connecting SFTP client...')
      await sftp.connect({
        host: connectionConfig.host,
        port: connectionConfig.port,
        username: connectionConfig.username,
        password: connectionConfig.password,
        privateKey: connectionConfig.privateKey,
        passphrase: connectionConfig.passphrase,
        readyTimeout: 30000
      })
      
      console.log('FileService: SFTP connection successful, listing files...')
      const entries = await sftp.list(path)
      console.log('FileService: Retrieved entries:', entries.length)
      
      const files: FileSystemEntry[] = []

      for (const entry of entries) {
        files.push({
          name: entry.name,
          path: `${path.replace(/\/$/, '')}/${entry.name}`,
          type: entry.type === 'd' ? 'directory' : 'file',
          size: entry.type === 'd' ? undefined : entry.size,
          modified: entry.modifyTime,
          permissions: entry.rights ? this.formatSftpPermissions(entry.rights) : '-',
        })
      }

      console.log(`FileService: Successfully listed ${files.length} files`)
      
      // Sort: directories first, then files alphabetically
      return files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      console.error(`Failed to list remote files at ${path}:`, error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    } finally {
      try {
        await sftp.end()
        console.log('FileService: SFTP connection closed')
      } catch (endError) {
        console.warn('Error closing SFTP connection:', endError)
      }
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

  async createRemoteDirectory(path: string): Promise<void> {
    const ssh = this.connectionService.getSshClient()
    if (!ssh) {
      throw new Error('Not connected to remote host')
    }

    const connectionConfig = this.connectionService.getConnectionConfig()
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
      await sftp.mkdir(path)
    } catch (error) {
      console.error(`Failed to create remote directory ${path}:`, error)
      throw error
    } finally {
      await sftp.end()
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

  async deleteRemoteFile(path: string): Promise<void> {
    const ssh = this.connectionService.getSshClient()
    if (!ssh) {
      throw new Error('Not connected to remote host')
    }

    const connectionConfig = this.connectionService.getConnectionConfig()
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
      throw error
    } finally {
      await sftp.end()
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

  async getRemoteFileInfo(path: string): Promise<FileSystemEntry | null> {
    const ssh = this.connectionService.getSshClient()
    if (!ssh) {
      throw new Error('Not connected to remote host')
    }

    const connectionConfig = this.connectionService.getConnectionConfig()
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
      return null
    } finally {
      await sftp.end()
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

  async resolveRemotePath(path: string): Promise<string> {
    // Normalize remote path (handle ~, ., ..)
    if (path.startsWith('~')) {
      // Expand to user home directory
      const ssh = this.connectionService.getSshClient()
      if (ssh) {
        // For now, just replace ~ with /home/username
        // In a real implementation, you'd get the actual home directory
        return path.replace('~', '/home')
      }
    }
    
    // Handle root directory specially - keep the trailing slash for root "/"
    if (path === '/') {
      return '/'
    }
    
    // Normalize path separators and remove redundant slashes for non-root paths
    return path.replace(/\/+/g, '/').replace(/\/$/, '')
  }
}