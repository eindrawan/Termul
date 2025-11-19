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
    const stats = await getTransferStats(sourcePath)
    console.log('Worker: transferFile - Stats:', stats)

    if (stats.isDirectory) {
      console.log('Worker: transferFile - Is directory, transferring recursively')

      // If uploading a directory, we must create the root directory first
      if (direction === 'upload') {
        console.log(`Worker: Creating root directory: ${destinationPath}`)
        await sftp.mkdir(destinationPath, true)
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
    await sftp.get(sourcePath, createWriteStream(destinationPath), options)
  }
}

async function transferDirectory(sftp, sourcePath, destinationPath, direction) {
  try {
    const entries = await fs.readdir(sourcePath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sourceDirPath = join(sourcePath, entry.name)
        const destDirPath = posix.join(destinationPath, entry.name)

        // Create destination directory
        if (direction === 'upload') {
          await sftp.mkdir(destDirPath, true)
        } else {
          await fs.mkdir(destDirPath, { recursive: true })
        }

        // Recursively transfer directory contents
        await transferDirectory(sftp, sourceDirPath, destDirPath, direction)
      } else {
        const sourceFilePath = join(sourcePath, entry.name)
        const destFilePath = posix.join(destinationPath, entry.name)
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
  try {
    console.log('Worker: Starting main function')
    console.log('Worker: SSH Config:', workerData.sshConfig)
    console.log('Worker: Transfer:', workerData.transfer)

    await sftp.connect(workerData.sshConfig)
    console.log('Worker: SFTP connected')

    const { sourcePath, destinationPath, direction } = workerData.transfer
    console.log('Worker: Getting file stats for:', sourcePath)

    // Get total file size for progress calculation
    if (direction === 'upload') {
      console.log('Worker: Upload mode - getting local file stats')
      const stats = await getTransferStats(sourcePath)
      console.log('Worker: File stats:', stats)
      totalBytes = stats.isDirectory ? await calculateDirectorySize(sourcePath) : stats.size
      console.log('Worker: Total bytes to transfer:', totalBytes)
    } else {
      console.log('Worker: Download mode - getting remote file stats')
      // For downloads, we need to get remote file size
      const stats = await sftp.stat(sourcePath)
      totalBytes = stats.isDirectory ? await calculateRemoteDirectorySize(sftp, sourcePath) : stats.size
      console.log('Worker: Total bytes to transfer:', totalBytes)
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
    parentPort.postMessage({
      type: 'error',
      transferId: workerData.transfer.id,
      error: error.message,
    })
  } finally {
    await sftp.end()
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