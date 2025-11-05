const { parentPort, workerData } = require('worker_threads')
const { createReadStream, createWriteStream, promises: fs } = require('fs')
const { Client } = require('ssh2')
const { SFTPClient } = require('ssh2-sftp-client')
const { join, basename, dirname } = require('path')

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
    const stats = await getTransferStats(sourcePath)
    
    if (stats.isDirectory) {
      // Handle directory transfer recursively
      await transferDirectory(sourcePath, destinationPath, direction)
    } else {
      // Handle single file transfer
      await transferSingleFile(sourcePath, destinationPath, stats.size, direction)
    }
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      transferId: workerData.transfer.id,
      error: error.message
    })
  }
}

async function transferSingleFile(sourcePath, destinationPath, fileSize, direction) {
  return new Promise((resolve, reject) => {
    let readStream, writeStream
    
    if (direction === 'upload') {
      readStream = createReadStream(sourcePath)
      writeStream = sftpClient.createWriteStream(destinationPath)
    } else {
      readStream = sftpClient.createReadStream(sourcePath)
      writeStream = createWriteStream(destinationPath)
    }
    
    readStream.on('data', (chunk) => {
      transferredBytes += chunk.length
      updateProgress()
    })
    
    writeStream.on('error', (error) => {
      reject(error)
    })
    
    readStream.on('error', (error) => {
      reject(error)
    })
    
    writeStream.on('finish', () => {
      resolve()
    })
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
    await initializeSftp()
    
    const { sourcePath, destinationPath, direction } = workerData.transfer
    
    // Get total file size for progress calculation
    if (direction === 'upload') {
      const stats = await getTransferStats(sourcePath)
      totalBytes = stats.isDirectory() ? await calculateDirectorySize(sourcePath) : stats.size
    } else {
      // For downloads, we need to get remote file size
      const stats = await new Promise((resolve, reject) => {
        sftpClient.stat(sourcePath, (err, stats) => {
          if (err) reject(err)
          else resolve(stats)
        })
      })
      totalBytes = stats.isFile ? stats.size : await calculateRemoteDirectorySize(sourcePath)
    }
    
    await transferFile(sourcePath, destinationPath, direction)
    
    parentPort.postMessage({
      type: 'complete',
      transferId: workerData.transfer.id
    })
  } catch (error) {
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
  if (message.type === 'start') {
    await main()
  }
})