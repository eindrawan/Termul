const { parentPort, workerData } = require('worker_threads')
const { createReadStream, createWriteStream, promises: fs } = require('fs')
const { Client } = require('ssh2')
const { SFTPClient } = require('ssh2-sftp-client')
const { join, basename, dirname } = require('path')

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

let sftpClient = null
let totalBytes = 0
let transferredBytes = 0
let startTime = null

async function initializeSftp() {
  return new Promise((resolve, reject) => {
    const client = new Client()
    
    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err)
        } else {
          sftpClient = sftp
          resolve(sftp)
        }
      })
    })
    
    client.connect(workerData.sshConfig)
  })
}

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

async function transferFile(sourcePath, destinationPath, direction) {
  try {
    console.log('Worker: transferFile - Getting stats for:', sourcePath)
    const stats = await getTransferStats(sourcePath)
    console.log('Worker: transferFile - Stats:', stats)

    if (stats.isDirectory) {
      console.log('Worker: transferFile - Is directory, transferring recursively')
      // Handle directory transfer recursively
      await transferDirectory(sourcePath, destinationPath, direction)
    } else {
      console.log('Worker: transferFile - Is file, transferring single file')
      await transferSingleFile(sourcePath, destinationPath, stats.size, direction)
    }
    console.log('Worker: transferFile - Transfer complete')
  } catch (error) {
    console.error('Worker: transferFile - Error:', error)
    parentPort.postMessage({
      type: 'error',
      transferId: workerData.transfer.id,
      error: error.message
    })
  }
}

async function transferSingleFile(sourcePath, destinationPath, fileSize, direction) {
  console.log('Worker: transferSingleFile - Starting transfer')
  console.log('Worker: transferSingleFile - Source:', sourcePath)
  console.log('Worker: transferSingleFile - Destination:', destinationPath)
  console.log('Worker: transferSingleFile - Direction:', direction)

  return new Promise((resolve, reject) => {
    let readStream, writeStream

    try {
      if (direction === 'upload') {
        console.log('Worker: transferSingleFile - Creating read stream from local file')
        readStream = createReadStream(sourcePath)
        console.log('Worker: transferSingleFile - Creating write stream to remote file')
        writeStream = sftpClient.createWriteStream(destinationPath)
      } else {
        console.log('Worker: transferSingleFile - Creating read stream from remote file')
        readStream = sftpClient.createReadStream(sourcePath)
        console.log('Worker: transferSingleFile - Creating write stream to local file')
        writeStream = createWriteStream(destinationPath)
      }

      console.log('Worker: transferSingleFile - Streams created, setting up event handlers')

      readStream.on('data', (chunk) => {
        console.log('Worker: transferSingleFile - Data chunk received:', chunk.length, 'bytes')
        transferredBytes += chunk.length
        updateProgress()
      })

      readStream.on('end', () => {
        console.log('Worker: transferSingleFile - Read stream ended')
      })

      readStream.on('close', () => {
        console.log('Worker: transferSingleFile - Read stream closed')
      })

      writeStream.on('error', (error) => {
        console.error('Worker: transferSingleFile - Write stream error:', error)
        reject(error)
      })

      readStream.on('error', (error) => {
        console.error('Worker: transferSingleFile - Read stream error:', error)
        reject(error)
      })

      writeStream.on('finish', () => {
        console.log('Worker: transferSingleFile - Write stream finished')
        resolve()
      })

      writeStream.on('close', () => {
        console.log('Worker: transferSingleFile - Write stream closed')
        // For SFTP streams, 'close' might be the completion event
        resolve()
      })

      console.log('Worker: transferSingleFile - Piping streams')
      // Pipe the read stream to the write stream
      readStream.pipe(writeStream)
    } catch (error) {
      console.error('Worker: transferSingleFile - Error setting up streams:', error)
      reject(error)
    }
  })
}

async function transferDirectory(sourcePath, destinationPath, direction) {
  try {
    const entries = await fs.readdir(sourcePath, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sourceDirPath = join(sourcePath, entry.name)
        const destDirPath = join(destinationPath, entry.name)
        
        // Create destination directory
        if (direction === 'upload') {
          await sftpClient.mkdir(destDirPath, {})
        } else {
          await fs.mkdir(destDirPath, { recursive: true })
        }
        
        // Recursively transfer directory contents
        await transferDirectory(sourceDirPath, destDirPath, direction)
      } else {
        const sourceFilePath = join(sourcePath, entry.name)
        const destFilePath = join(destinationPath, entry.name)
        const stats = await getTransferStats(sourceFilePath)
        await transferSingleFile(sourceFilePath, destFilePath, stats.size, direction)
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
  try {
    console.log('Worker: Starting main function')
    console.log('Worker: SSH Config:', workerData.sshConfig)
    console.log('Worker: Transfer:', workerData.transfer)

    await initializeSftp()
    console.log('Worker: SFTP initialized')

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
      const stats = await new Promise((resolve, reject) => {
        sftpClient.stat(sourcePath, (err, stats) => {
          if (err) reject(err)
          else resolve(stats)
        })
      })
      totalBytes = stats.isFile ? stats.size : await calculateRemoteDirectorySize(sourcePath)
      console.log('Worker: Total bytes to transfer:', totalBytes)
    }

    console.log('Worker: Starting file transfer')
    await transferFile(sourcePath, destinationPath, direction)
    console.log('Worker: File transfer complete')
    
    parentPort.postMessage({
      type: 'complete',
      transferId: workerData.transfer.id
    })
  } catch (error) {
    console.error('Worker: Error in main function:', error)
    console.error('Worker: Error stack:', error.stack)
    parentPort.postMessage({
      type: 'error',
      transferId: workerData.transfer.id,
      error: error.message
    })
  } finally {
    if (sftpClient) {
      sftpClient.end()
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

async function calculateRemoteDirectorySize(dirPath) {
  let totalSize = 0
  
  async function calculateSize(path) {
    return new Promise((resolve, reject) => {
      sftpClient.list(path, async (err, entries) => {
        if (err) {
          reject(err)
          return
        }
        
        for (const entry of entries) {
          const fullPath = `${path.replace(/\/$/, '')}/${entry.name}`
          
          if (entry.type === 'd') {
            await calculateSize(fullPath)
          } else {
            totalSize += entry.size || 0
          }
        }
        
        resolve()
      })
    })
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