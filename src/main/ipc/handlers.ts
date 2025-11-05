import { ipcMain } from 'electron'
import { z } from 'zod'
import { ConnectionService } from '../services/ConnectionService'
import { FileService } from '../services/FileService'
import { TransferService } from '../services/TransferService'
import { TerminalService } from '../services/TerminalService'
import { DatabaseService } from '../services/DatabaseService'

// Initialize services
const connectionService = new ConnectionService()
const db = new DatabaseService()
const fileService = new FileService(connectionService)
const transferService = new TransferService(db, connectionService)
const terminalService = new TerminalService(connectionService)

// Schema validation
const ConnectionProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  host: z.string(),
  port: z.number().default(22),
  username: z.string(),
  authType: z.enum(['password', 'key']),
  keyPath: z.string().nullable().optional().transform(val => val || undefined),
  passwordId: z.string().nullable().optional().transform(val => val || undefined),
})

const TransferDescriptorSchema = z.object({
  id: z.string().optional(),
  sourcePath: z.string(),
  destinationPath: z.string(),
  direction: z.enum(['upload', 'download']),
  size: z.number().optional(),
  overwritePolicy: z.enum(['prompt', 'overwrite', 'skip']).default('prompt'),
  priority: z.number().default(0),
})

export function setupIpcHandlers() {
  // Connection handlers
  ipcMain.handle('connect-to-host', async (_, profile) => {
    try {
      const validatedProfile = ConnectionProfileSchema.parse(profile)
      return await connectionService.connect(validatedProfile)
    } catch (error) {
      console.error('Connection error:', error)
      throw error
    }
  })

  ipcMain.handle('disconnect-from-host', async () => {
    try {
      return await connectionService.disconnect()
    } catch (error) {
      console.error('Disconnect error:', error)
      throw error
    }
  })

  ipcMain.handle('get-connection-status', async () => {
    return connectionService.getStatus()
  })

  // Profile handlers
  ipcMain.handle('save-profile', async (_, profile) => {
    try {
      const validatedProfile = ConnectionProfileSchema.parse(profile)
      return await connectionService.saveProfile(validatedProfile)
    } catch (error) {
      console.error('Save profile error:', error)
      throw error
    }
  })

  ipcMain.handle('get-profiles', async () => {
    try {
      return await connectionService.getProfiles()
    } catch (error) {
      console.error('Get profiles error:', error)
      throw error
    }
  })

  ipcMain.handle('delete-profile', async (_, id) => {
    try {
      return await connectionService.deleteProfile(id)
    } catch (error) {
      console.error('Delete profile error:', error)
      throw error
    }
  })

  ipcMain.handle('test-connection', async (_, profile) => {
    try {
      const validatedProfile = ConnectionProfileSchema.parse(profile)
      return await connectionService.testConnection(validatedProfile)
    } catch (error) {
      console.error('Test connection error:', error)
      throw error
    }
  })

  ipcMain.handle('store-password', async (_, profile, password) => {
    try {
      // For store-password, we don't want to validate passwordId since it might not exist yet
      // and we don't want the transform to interfere with the password storage process
      const { passwordId, ...profileWithoutPasswordId } = profile
      const validatedProfile = ConnectionProfileSchema.parse(profileWithoutPasswordId)
      return await connectionService.storePassword(validatedProfile, password)
    } catch (error) {
      console.error('Store password error:', error)
      throw error
    }
  })

  // File system handlers
  ipcMain.handle('list-local-files', async (_, path) => {
    try {
      return await fileService.listLocalFiles(path)
    } catch (error) {
      console.error('List local files error:', error)
      throw error
    }
  })

  ipcMain.handle('list-remote-files', async (_, path) => {
    try {
      return await fileService.listRemoteFiles(path)
    } catch (error) {
      console.error('List remote files error:', error)
      throw error
    }
  })

  ipcMain.handle('get-home-directory', async () => {
    try {
      const os = require('os')
      return os.homedir()
    } catch (error) {
      console.error('Get home directory error:', error)
      throw error
    }
  })

  // Transfer handlers
  ipcMain.handle('enqueue-transfers', async (_, transfers) => {
    try {
      const validatedTransfers = z.array(TransferDescriptorSchema).parse(transfers)
      return await transferService.enqueueTransfers(validatedTransfers)
    } catch (error) {
      console.error('Enqueue transfers error:', error)
      throw error
    }
  })

  ipcMain.handle('get-transfer-queue', async () => {
    try {
      return await transferService.getQueue()
    } catch (error) {
      console.error('Get transfer queue error:', error)
      throw error
    }
  })

  ipcMain.handle('pause-transfer', async (_, id) => {
    try {
      return await transferService.pauseTransfer(id)
    } catch (error) {
      console.error('Pause transfer error:', error)
      throw error
    }
  })

  ipcMain.handle('resume-transfer', async (_, id) => {
    try {
      return await transferService.resumeTransfer(id)
    } catch (error) {
      console.error('Resume transfer error:', error)
      throw error
    }
  })

  ipcMain.handle('cancel-transfer', async (_, id) => {
    try {
      return await transferService.cancelTransfer(id)
    } catch (error) {
      console.error('Cancel transfer error:', error)
      throw error
    }
  })

  // Terminal handlers
  ipcMain.handle('open-terminal', async () => {
    try {
      return await terminalService.openTerminal()
    } catch (error) {
      console.error('Open terminal error:', error)
      throw error
    }
  })

  ipcMain.handle('close-terminal', async () => {
    try {
      return await terminalService.closeTerminal()
    } catch (error) {
      console.error('Close terminal error:', error)
      throw error
    }
  })

  ipcMain.handle('send-terminal-input', async (_, data) => {
    try {
      return await terminalService.sendInput(data)
    } catch (error) {
      console.error('Send terminal input error:', error)
      throw error
    }
  })

  // Utility handlers
  ipcMain.handle('show-open-dialog', async (_, _options) => {
    // Implementation for file open dialog
    return { canceled: true, filePaths: [] }
  })

  ipcMain.handle('show-save-dialog', async (_, _options) => {
    // Implementation for file save dialog
    return { canceled: true, filePath: '' }
  })
}