import SFTPClient from 'ssh2-sftp-client'
import { FileService } from './FileService'
import { FileSystemEntry } from '../../renderer/types'

interface BulkDeleteResult {
  success: boolean
  deletedCount: number
  failedCount: number
  failedFiles: Array<{ path: string; error: string }>
}

interface BulkDeleteProgress {
  current: number
  total: number
  currentFile: string
}

export class BulkOperationService {
  private fileService: FileService

  constructor(fileService: FileService) {
    this.fileService = fileService
  }

  /**
   * Delete multiple remote files/directories efficiently using a single SFTP connection
   */
  async bulkDeleteRemote(
    connectionId: string,
    files: FileSystemEntry[],
    onProgress?: (progress: BulkDeleteProgress) => void
  ): Promise<BulkDeleteResult> {
    if (files.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        failedCount: 0,
        failedFiles: []
      }
    }

    // Try to detect OS and use shell commands if possible (faster)
    try {
      const isUnix = await this.detectRemoteOS(connectionId)
      if (isUnix) {
        return await this.deleteViaShell(connectionId, files, onProgress)
      }
    } catch (error) {
      console.warn('Failed to detect remote OS, falling back to SFTP deletion:', error)
    }

    // Fallback to sequential SFTP deletion
    // Access the SFTP client directly from the file service
    const sftp = await this.fileService.getSftpClient(connectionId)

    const result: BulkDeleteResult = {
      success: true,
      deletedCount: 0,
      failedCount: 0,
      failedFiles: []
    }

    try {
      // Process files sequentially to avoid "Parallel operations" error from ssh2-sftp-client
      // The library does not support concurrent operations on a single connection
      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        try {
          await this.deleteSingleFile(sftp, file.path)
          result.deletedCount++

          // Report progress
          if (onProgress) {
            onProgress({
              current: result.deletedCount + result.failedCount,
              total: files.length,
              currentFile: file.name
            })
          }
        } catch (error) {
          result.failedCount++
          result.failedFiles.push({
            path: file.path,
            error: error instanceof Error ? error.message : String(error)
          })

          // Still report progress for failed files
          if (onProgress) {
            onProgress({
              current: result.deletedCount + result.failedCount,
              total: files.length,
              currentFile: file.name
            })
          }
        }
      }

      result.success = result.failedCount === 0

    } catch (error) {
      result.success = false
      // If the main loop crashes (e.g. connection lost), re-throw
      throw error
    }

    return result
  }

  private async detectRemoteOS(connectionId: string): Promise<boolean> {
    const ssh = this.fileService.getSshClient(connectionId)
    if (!ssh) return false

    try {
      const result = await ssh.execCommand('uname')
      const output = result.stdout.trim().toLowerCase()
      return output === 'linux' || output === 'darwin'
    } catch (error) {
      console.warn('Error executing uname:', error)
      return false
    }
  }

  private async deleteViaShell(
    connectionId: string,
    files: FileSystemEntry[],
    onProgress?: (progress: BulkDeleteProgress) => void
  ): Promise<BulkDeleteResult> {
    const ssh = this.fileService.getSshClient(connectionId)
    if (!ssh) throw new Error('SSH client not available')

    const result: BulkDeleteResult = {
      success: true,
      deletedCount: 0,
      failedCount: 0,
      failedFiles: []
    }

    // Process in batches to avoid command line length limits
    const batchSize = 50
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)

      // Escape filenames for shell
      // 1. Replace ' with '\'' (close quote, escaped quote, open quote)
      // 2. Wrap in '...'
      const escapedPaths = batch.map(f => `'${f.path.replace(/'/g, "'\\''")}'`).join(' ')
      const command = `rm -rf ${escapedPaths}`

      try {
        const execResult = await ssh.execCommand(command)

        if (execResult.code === 0) {
          result.deletedCount += batch.length

          // Update progress for the whole batch
          if (onProgress) {
            batch.forEach((file, index) => {
              onProgress({
                current: result.deletedCount - batch.length + index + 1,
                total: files.length,
                currentFile: file.name
              })
            })
          }
        } else {
          // If batch fails, we don't know which specific files failed easily without parsing stderr
          // For simplicity, mark all in batch as failed with the stderr message
          result.failedCount += batch.length
          batch.forEach(file => {
            result.failedFiles.push({
              path: file.path,
              error: execResult.stderr || 'Unknown shell error'
            })
          })
        }
      } catch (error) {
        result.failedCount += batch.length
        batch.forEach(file => {
          result.failedFiles.push({
            path: file.path,
            error: error instanceof Error ? error.message : String(error)
          })
        })
      }
    }

    result.success = result.failedCount === 0
    return result
  }

  /**
   * Delete a single file or directory using the provided SFTP client
   */
  private async deleteSingleFile(sftp: SFTPClient, path: string): Promise<void> {
    try {
      const stats = await sftp.stat(path)

      if (stats.isSymbolicLink) {
        await sftp.delete(path)
      } else if (stats.isDirectory) {
        await sftp.rmdir(path, true)
      } else {
        await sftp.delete(path)
      }
    } catch (error) {
      throw new Error(`Failed to delete ${path}: ${error}`)
    }
  }

  /**
   * Delete multiple local files/directories efficiently
   */
  async bulkDeleteLocal(
    files: FileSystemEntry[],
    onProgress?: (progress: BulkDeleteProgress) => void
  ): Promise<BulkDeleteResult> {
    if (files.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        failedCount: 0,
        failedFiles: []
      }
    }

    const result: BulkDeleteResult = {
      success: true,
      deletedCount: 0,
      failedCount: 0,
      failedFiles: []
    }

    // Process files in batches to avoid overwhelming the filesystem
    const batchSize = 20
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)

      // Process batch in parallel
      const batchPromises = batch.map(async (file) => {
        try {
          await this.deleteSingleLocalFile(file.path)
          result.deletedCount++

          // Report progress
          if (onProgress) {
            onProgress({
              current: result.deletedCount + result.failedCount,
              total: files.length,
              currentFile: file.name
            })
          }
        } catch (error) {
          result.failedCount++
          result.failedFiles.push({
            path: file.path,
            error: error instanceof Error ? error.message : String(error)
          })

          // Still report progress for failed files
          if (onProgress) {
            onProgress({
              current: result.deletedCount + result.failedCount,
              total: files.length,
              currentFile: file.name
            })
          }
        }
      })

      // Wait for the entire batch to complete
      await Promise.all(batchPromises)
    }

    result.success = result.failedCount === 0
    return result
  }

  /**
   * Delete a single local file or directory
   */
  private async deleteSingleLocalFile(path: string): Promise<void> {
    const { promises: fs } = require('fs')

    try {
      const stats = await fs.stat(path)
      if (stats.isDirectory()) {
        await fs.rmdir(path, { recursive: true })
      } else {
        await fs.unlink(path)
      }
    } catch (error) {
      throw new Error(`Failed to delete ${path}: ${error}`)
    }
  }

  /**
   * Clean up resources when the service is no longer needed
   */
  async dispose(): Promise<void> {
    // No-op, as connection management is now handled by FileService
  }
}
