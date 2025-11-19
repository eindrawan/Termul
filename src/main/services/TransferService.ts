import { Worker } from 'worker_threads'
import { join } from 'path'
import { TransferItem, TransferDescriptor } from '../../renderer/types'
import { DatabaseService } from './DatabaseService'
import { ConnectionService } from './ConnectionService'

interface TransferWorkerData {
  transfer: TransferItem
  sshConfig: any
}

interface TransferWorkerMessage {
  type: 'progress' | 'complete' | 'error'
  transferId: string
  progress?: number
  speed?: number
  eta?: number
  error?: string
}

export class TransferService {
  private db: DatabaseService
  private connectionService: ConnectionService
  private activeWorkers: Map<string, Worker> = new Map()

  constructor(db: DatabaseService, connectionService: ConnectionService) {
    this.db = db
    this.connectionService = connectionService
  }

  async enqueueTransfers(transfers: TransferDescriptor[]): Promise<TransferItem[]> {
    const enqueuedTransfers: TransferItem[] = []
    
    for (const transfer of transfers) {
      const transferItem = await this.db.enqueueTransfer({
        ...transfer,
        status: 'pending',
        progress: 0,
      })
      enqueuedTransfers.push(transferItem)
    }

    // Start processing transfers
    this.processQueue()
    
    return enqueuedTransfers
  }

  async getQueue(): Promise<TransferItem[]> {
    return await this.db.getQueue()
  }

  async pauseTransfer(id: string): Promise<void> {
    const worker = this.activeWorkers.get(id)
    if (worker) {
      worker.terminate()
      this.activeWorkers.delete(id)
      
      await this.db.updateTransfer(id, { status: 'paused' })
      this.emitTransferUpdate(id)
    }
  }

  async resumeTransfer(id: string): Promise<void> {
    const queue = await this.db.getQueue()
    const transfer = queue.find(t => t.id === id)
    
    if (transfer && transfer.status === 'paused') {
      await this.db.updateTransfer(id, { status: 'pending' })
      this.emitTransferUpdate(id)
      this.processQueue()
    }
  }

  async cancelTransfer(id: string): Promise<void> {
    const worker = this.activeWorkers.get(id)
    if (worker) {
      worker.terminate()
      this.activeWorkers.delete(id)
    }
    
    await this.db.updateTransfer(id, { status: 'cancelled' })
    this.emitTransferUpdate(id)
  }

  async clearAllTransfers(): Promise<void> {
    // Stop all active workers
    for (const [transferId, worker] of this.activeWorkers.entries()) {
      worker.terminate()
      this.activeWorkers.delete(transferId)
      
      // Update transfer status to cancelled in database
      await this.db.updateTransfer(transferId, {
        status: 'cancelled',
        completedAt: Math.floor(Date.now() / 1000)
      })
      this.emitTransferUpdate(transferId)
    }
  }

  private async processQueue(): Promise<void> {
    const queue = await this.db.getQueue()
    const pendingTransfers = queue.filter(t => t.status === 'pending')
    
    // Limit concurrent transfers (e.g., max 3 at a time)
    const maxConcurrent = 3
    const activeCount = Array.from(this.activeWorkers.values()).length
    
    if (activeCount >= maxConcurrent) return
    
    const transfersToStart = pendingTransfers.slice(0, maxConcurrent - activeCount)
    
    for (const transfer of transfersToStart) {
      this.startTransfer(transfer)
    }
  }

  private async startTransfer(transfer: TransferItem): Promise<void> {
    console.log(`Starting transfer ${transfer.id}:`, transfer)

    const ssh = this.connectionService.getSshClient(transfer.connectionId)
    if (!ssh) {
      console.error(`Transfer ${transfer.id}: SSH client not available`)
      await this.db.updateTransfer(transfer.id, {
        status: 'failed',
        error: 'Not connected to remote host'
      })
      this.emitTransferUpdate(transfer.id)
      return
    }

    try {
      await this.db.updateTransfer(transfer.id, {
        status: 'active',
        startedAt: Math.floor(Date.now() / 1000)
      })

      console.log(`Transfer ${transfer.id}: Updated status to active`)
      this.emitTransferUpdate(transfer.id)

      // Create worker for the transfer
      const sshConfig = this.connectionService.getConnectionConfig(transfer.connectionId)
      if (!sshConfig) {
        await this.db.updateTransfer(transfer.id, {
          status: 'failed',
          error: 'Connection configuration not available'
        })
        this.emitTransferUpdate(transfer.id)
        return
      }

      const worker = new Worker(join(__dirname, '../../workers/transfer-worker.js'), {
        workerData: {
          transfer,
          sshConfig: {
            host: sshConfig.host,
            port: sshConfig.port,
            username: sshConfig.username,
            password: sshConfig.password,
            privateKey: sshConfig.privateKey,
            passphrase: sshConfig.passphrase,
          },
        } as TransferWorkerData,
        stdout: true,
        stderr: true,
      })

      // Capture worker stdout/stderr
      if (worker.stdout) {
        worker.stdout.on('data', (data) => {
          console.log(`Worker ${transfer.id} stdout:`, data.toString())
        })
      }

      if (worker.stderr) {
        worker.stderr.on('data', (data) => {
          console.error(`Worker ${transfer.id} stderr:`, data.toString())
        })
      }

      this.activeWorkers.set(transfer.id, worker)

      console.log(`Transfer ${transfer.id}: Worker created, sending start message`)

      // Start the worker
      worker.postMessage({ type: 'start' })

      worker.on('message', (message: TransferWorkerMessage) => {
        if (message.transferId !== transfer.id) return
        
        switch (message.type) {
          case 'progress':
            this.db.updateTransfer(transfer.id, { progress: message.progress })
            this.emitTransferProgress(transfer.id, {
              progress: message.progress,
              speed: message.speed,
              eta: message.eta,
            })
            break
            
          case 'complete':
            this.db.updateTransfer(transfer.id, {
              status: 'completed',
              progress: 100,
              completedAt: Math.floor(Date.now() / 1000)
            })
            this.emitTransferComplete(transfer.id, transfer.sourcePath, transfer.destinationPath, transfer.direction)
            this.cleanupTransfer(transfer.id)
            break
            
          case 'error':
            this.db.updateTransfer(transfer.id, { 
              status: 'failed', 
              error: message.error,
              completedAt: Math.floor(Date.now() / 1000) 
            })
            this.emitTransferUpdate(transfer.id)
            this.cleanupTransfer(transfer.id)
            break
        }
      })
      
      worker.on('error', (error) => {
        console.error(`Transfer worker error for ${transfer.id}:`, error)
        this.db.updateTransfer(transfer.id, {
          status: 'failed',
          error: error.message,
          completedAt: Math.floor(Date.now() / 1000)
        })
        this.emitTransferUpdate(transfer.id)
        this.cleanupTransfer(transfer.id)
      })

      worker.on('exit', (code) => {
        console.log(`Transfer worker ${transfer.id} exited with code ${code}`)
        if (code !== 0) {
          console.error(`Transfer worker ${transfer.id} stopped with exit code ${code}`)
        }
      })
      
    } catch (error) {
      console.error(`Failed to start transfer ${transfer.id}:`, error)
      await this.db.updateTransfer(transfer.id, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : String(error),
        completedAt: Math.floor(Date.now() / 1000) 
      })
      this.emitTransferUpdate(transfer.id)
    }
  }

  private cleanupTransfer(transferId: string): void {
    const worker = this.activeWorkers.get(transferId)
    if (worker) {
      worker.terminate()
      this.activeWorkers.delete(transferId)
    }
  }

  private emitTransferUpdate(transferId: string): void {
    if ((global as any).mainWindow) {
      const queue = this.db.getQueue()
      queue.then(queue => {
        const transfer = queue.find(t => t.id === transferId)
        if (transfer) {
          (global as any).mainWindow.webContents.send('transfer-progress', transfer)
        }
      })
    }
  }

  private emitTransferProgress(transferId: string, data: Partial<TransferItem>): void {
    if ((global as any).mainWindow) {
      (global as any).mainWindow.webContents.send('transfer-progress', {
        id: transferId,
        ...data
      })
    }
  }

  private emitTransferComplete(transferId: string, sourcePath: string, destinationPath: string, direction: 'upload' | 'download'): void {
    if ((global as any).mainWindow) {
      (global as any).mainWindow.webContents.send('transfer-complete', {
        id: transferId,
        status: 'completed',
        sourcePath,
        destinationPath,
        direction
      })
    }
    
    // Process next pending transfer
    setTimeout(() => this.processQueue(), 1000)
  }
}