const { parentPort, workerData } = require('worker_threads')
const { createWriteStream, promises: fs } = require('fs')
const SFTPClient = require('ssh2-sftp-client')
const { join, basename, dirname, posix } = require('path')

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Worker uncaught exception:', error)
  if (parentPort) {
    parentPort.postMessage({
      type: 'error',
      transferId: workerData?.transfer?.id || 'unknown',
      error: error.message
    })
  }
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Worker unhandled rejection at:', promise, 'reason:', reason)
  if (parentPort) {
    parentPort.postMessage({
      type: 'error',
      transferId: workerData?.transfer?.id || 'unknown',
      error: String(reason)
    })
  }
  process.exit(1)
})

let totalBytes = 0
let transferredBytes = 0
let startTime = null

async function getTransferStats(sourcePath) {
  try {
    const stats = await fs.stat(sourcePath)
    return {
      size: stats.size,
      isDirectory: stats.isDirectory()
    }
  } catch (error) {
    throw new Error(`Failed to get stats for ${sourcePath}: ${error.message}`)
  }
}

async function transferFile(sftp, sourcePath, destinationPath, direction) {
  try {
    console.log('Worker: transferFile - Getting stats for:', sourcePath)
    
    // Check if source exists before proceeding
    let stats
    try {
      stats = direction === 'upload'
        ? await getTransferStats(sourcePath)
        : await sftp.stat(sourcePath)
      console.log('Worker: transferFile - Stats:', stats)
    } catch (statError) {
      throw new Error(`Source file/directory not found or inaccessible: ${sourcePath}. Error: ${statError.message}`)
    }

    // For downloads, ensure parent directory exists
    if (direction === 'download') {
      const parentDir = dirname(destinationPath)
      try {
        await fs.mkdir(parentDir, { recursive: true })
      } catch (mkdirError) {
        console.warn(`Worker: Warning - Could not create parent directory ${parentDir}:`, mkdirError.message)
      }
    }

    if (stats.isDirectory) {
      console.log('Worker: transferFile - Is directory, transferring recursively')

      // Create the root directory first
      if (direction === 'upload') {
        console.log(`Worker: Creating root directory: ${destinationPath}`)
        await sftp.mkdir(destinationPath, true)
      } else {
        console.log(`Worker: Creating local directory: ${destinationPath}`)
        await fs.mkdir(destinationPath, { recursive: true })
      }

      // Handle directory transfer recursively
      await transferDirectory(sftp, sourcePath, destinationPath, direction)
    } else {
      console.log('Worker: transferFile - Is file, transferring single file')
      await transferSingleFile(sftp, sourcePath, destinationPath, stats.size, direction)
    }
    console.log('Worker: transferFile - Transfer complete')
  } catch (error) {
    console.error('Worker: transferFile - Error:', error)
    parentPort.postMessage({
      type: 'error',
      transferId: workerData.transfer.id,
      error: error.message,
    })
  }
}

async function transferSingleFile(sftp, sourcePath, destinationPath, fileSize, direction) {
  const options = {
    step: (total_transferred, chunk, total) => {
      transferredBytes = total_transferred
      updateProgress()
    },
  }

  if (direction === 'upload') {
    await sftp.put(sourcePath, destinationPath, options)
  } else {
    // For downloads, ensure the destination directory exists
    const destDir = dirname(destinationPath)
    try {
      await fs.mkdir(destDir, { recursive: true })
    } catch (mkdirError) {
      console.warn(`Worker: Warning - Could not create destination directory ${destDir}:`, mkdirError.message)
    }
    
    // Use a more robust approach for downloads
    try {
      const writeStream = createWriteStream(destinationPath)
      
      // Handle stream errors
      writeStream.on('error', (streamError) => {
        console.error(`Worker: Write stream error for ${destinationPath}:`, streamError)
        throw new Error(`Failed to write to destination file: ${streamError.message}`)
      })
      
      await sftp.get(sourcePath, writeStream, options)
    } catch (sftpError) {
      // Clean up partial file on error
      try {
        await fs.unlink(destinationPath)
      } catch (unlinkError) {
        // Ignore cleanup errors
      }
      throw sftpError
    }
  }
}

async function transferDirectory(sftp, sourcePath, destinationPath, direction) {
  try {
    const entries = await fs.readdir(sourcePath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sourceDirPath = join(sourcePath, entry.name)
        // For downloads, destination is local, so use OS-specific path separators
        const destDirPath = direction === 'download'
          ? join(destinationPath, entry.name)
          : posix.join(destinationPath, entry.name)

        // Create destination directory
        if (direction === 'upload') {
          await sftp.mkdir(destDirPath, true)
        } else {
          // Ensure parent directory exists before creating subdirectory
          await fs.mkdir(destDirPath, { recursive: true })
        }

        // Recursively transfer directory contents
        await transferDirectory(sftp, sourceDirPath, destDirPath, direction)
      } else {
        const sourceFilePath = join(sourcePath, entry.name)
        // For downloads, destination is local, so use OS-specific path separators
        const destFilePath = direction === 'download'
          ? join(destinationPath, entry.name)
          : posix.join(destinationPath, entry.name)
        const stats = await getTransferStats(sourceFilePath)
        await transferSingleFile(sftp, sourceFilePath, destFilePath, stats.size, direction)
      }
    }
  } catch (error) {
    throw new Error(`Failed to transfer directory ${sourcePath}: ${error.message}`)
  }
}

function updateProgress() {
  if (!startTime) startTime = Date.now()

  const progress = totalBytes > 0 ? (transferredBytes / totalBytes) * 100 : 0
  const elapsed = (Date.now() - startTime) / 1000
  const speed = elapsed > 0 ? transferredBytes / elapsed : 0
  const remaining = totalBytes > 0 ? totalBytes - transferredBytes : 0
  const eta = speed > 0 ? remaining / speed : 0

  parentPort.postMessage({
    type: 'progress',
    transferId: workerData.transfer.id,
    progress,
    speed,
    eta
  })
}

async function main() {
  const sftp = new SFTPClient()
  let connected = false
  
  try {
    console.log('Worker: Starting main function')
    console.log('Worker: SSH Config:', workerData.sshConfig)
    console.log('Worker: Transfer:', workerData.transfer)

    // Validate transfer data
    if (!workerData.sshConfig || !workerData.transfer) {
      throw new Error('Missing SSH configuration or transfer data')
    }

    const { sourcePath, destinationPath, direction } = workerData.transfer
    
    // Validate paths
    if (!sourcePath || !destinationPath) {
      throw new Error('Source and destination paths are required')
    }

    // Connect with timeout and retry logic
    console.log('Worker: Connecting to SFTP server...')
    try {
      await sftp.connect({
        ...workerData.sshConfig,
        readyTimeout: 30000, // 30 seconds timeout
        retries: 2, // Retry twice
        retry_factor: 2 // Exponential backoff
      })
      connected = true
      console.log('Worker: SFTP connected successfully')
    } catch (connectError) {
      throw new Error(`Failed to connect to SFTP server: ${connectError.message}`)
    }

    // Verify source exists before proceeding
    console.log('Worker: Verifying source exists:', sourcePath)
    let sourceStats
    try {
      if (direction === 'upload') {
        sourceStats = await getTransferStats(sourcePath)
      } else {
        sourceStats = await sftp.stat(sourcePath)
      }
    } catch (statError) {
      throw new Error(`Source file/directory not found or inaccessible: ${sourcePath}. Error: ${statError.message}`)
    }

    // Get total file size for progress calculation
    if (direction === 'upload') {
      console.log('Worker: Upload mode - calculating local file size')
      totalBytes = sourceStats.isDirectory ? await calculateDirectorySize(sourcePath) : sourceStats.size
    } else {
      console.log('Worker: Download mode - calculating remote file size')
      totalBytes = sourceStats.isDirectory ? await calculateRemoteDirectorySize(sftp, sourcePath) : sourceStats.size
    }
    console.log('Worker: Total bytes to transfer:', totalBytes)

    // For downloads, ensure destination directory exists
    if (direction === 'download') {
      const destDir = dirname(destinationPath)
      console.log('Worker: Ensuring destination directory exists:', destDir)
      try {
        await fs.mkdir(destDir, { recursive: true })
      } catch (mkdirError) {
        console.warn(`Worker: Warning - Could not create destination directory ${destDir}:`, mkdirError.message)
      }
    }

    console.log('Worker: Starting file transfer')
    await transferFile(sftp, sourcePath, destinationPath, direction)
    console.log('Worker: File transfer complete')

    parentPort.postMessage({
      type: 'complete',
      transferId: workerData.transfer.id,
    })
  } catch (error) {
    console.error('Worker: Error in main function:', error)
    console.error('Worker: Error stack:', error.stack)
    
    // Provide more specific error messages
    let errorMessage = error.message
    if (error.code === 'ENOTFOUND') {
      errorMessage = `Host not found: ${workerData.sshConfig.host}`
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `Connection refused by server ${workerData.sshConfig.host}:${workerData.sshConfig.port}`
    } else if (error.code === 'EACCES' || error.message.includes('Permission denied')) {
      errorMessage = `Permission denied accessing ${workerData.transfer.sourcePath}`
    }
    
    parentPort.postMessage({
      type: 'error',
      transferId: workerData.transfer.id,
      error: errorMessage,
    })
  } finally {
    if (connected) {
      try {
        await sftp.end()
        console.log('Worker: SFTP connection closed')
      } catch (closeError) {
        console.warn('Worker: Error closing SFTP connection:', closeError.message)
      }
    }
  }
}

async function calculateDirectorySize(dirPath) {
  let totalSize = 0

  async function calculateSize(path) {
    const entries = await fs.readdir(path, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(path, entry.name)

      if (entry.isDirectory()) {
        await calculateSize(fullPath)
      } else {
        const stats = await fs.stat(fullPath)
        totalSize += stats.size
      }
    }
  }

  await calculateSize(dirPath)
  return totalSize
}

async function calculateRemoteDirectorySize(sftp, dirPath) {
  let totalSize = 0

  async function calculateSize(path) {
    const entries = await sftp.list(path)

    for (const entry of entries) {
      const fullPath = `${path.replace(/\/$/, '')}/${entry.name}`

      if (entry.type === 'd') {
        await calculateSize(fullPath)
      } else {
        totalSize += entry.size || 0
      }
    }
  }

  await calculateSize(dirPath)
  return totalSize
}

// Handle worker messages
parentPort.on('message', async (message) => {
  console.log('Worker: Received message:', message)
  if (message.type === 'start') {
    console.log('Worker: Starting transfer')
    await main()
  }
})