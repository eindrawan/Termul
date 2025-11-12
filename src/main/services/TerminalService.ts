import { ConnectionService } from './ConnectionService'
import { TerminalSession } from '../../renderer/types'

interface TerminalInstance {
  session: TerminalSession
  shellStream: any
}

export class TerminalService {
  private connectionService: ConnectionService
  private terminals: Map<string, TerminalInstance> = new Map()

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  async openTerminal(connectionId: string): Promise<TerminalSession> {
    const ssh = this.connectionService.getSshClient(connectionId)
    if (!ssh) {
      throw new Error('Not connected to remote host')
    }

    try {
      // Create a new shell session through the existing SSH connection
      const config = this.connectionService.getConnectionConfig(connectionId)
      if (!config) {
        throw new Error('No connection configuration available')
      }

      // Request a pseudo-terminal and start a shell using node-ssh method
      const shellStream = await ssh.requestShell({
        term: 'xterm-256color',
        cols: 80,
        rows: 24,
      })

      const sessionId = this.generateSessionId()

      const session: TerminalSession = {
        id: sessionId,
        connectionId,
        connected: true,
        host: config.host,
        username: config.username,
        rows: 24,
        cols: 80,
      }

      this.terminals.set(connectionId, { session, shellStream })
      this.setupShellStream(connectionId, shellStream, session)

      return session
    } catch (error: any) {
      console.error('Failed to open terminal:', error)
      
      // Handle specific SSH connection errors
      if (error.message?.includes('Not connected to server') ||
          error.message?.includes('Connection closed') ||
          error.message?.includes('Socket is closed')) {
        this.emitTerminalError(connectionId, 'Connection to server was lost. Please reconnect.')
        // Close the terminal to clean up
        await this.closeTerminal(connectionId)
      }
      
      throw error
    }
  }

  async closeTerminal(connectionId: string): Promise<void> {
    const terminal = this.terminals.get(connectionId)
    if (terminal) {
      if (terminal.shellStream) {
        terminal.shellStream.close()
      }
      terminal.session.connected = false
      this.emitTerminalUpdate(connectionId, terminal.session)
      this.terminals.delete(connectionId)
    }
  }

  async sendInput(connectionId: string, data: string): Promise<void> {
    const terminal = this.terminals.get(connectionId)
    if (!terminal || !terminal.session.connected) {
      throw new Error('Terminal not connected')
    }

    try {
      terminal.shellStream.write(data)
    } catch (error) {
      console.error('Failed to send terminal input:', error)
      throw error
    }
  }

  resizeTerminal(connectionId: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(connectionId)
    if (!terminal || !terminal.session.connected) {
      return
    }

    try {
      // For SSH2, we need to set the window size
      terminal.shellStream.setWindow(rows, cols, 0, 0)

      terminal.session.cols = cols
      terminal.session.rows = rows
      this.emitTerminalUpdate(connectionId, terminal.session)
    } catch (error) {
      console.error('Failed to resize terminal:', error)
    }
  }

  private setupShellStream(connectionId: string, shellStream: any, session: TerminalSession): void {
    if (!shellStream || !session) return

    // Buffer to accumulate data chunks
    let buffer = Buffer.alloc(0)
    
    shellStream.on('data', (data: Buffer) => {
      // Accumulate data in buffer
      buffer = Buffer.concat([buffer, data])
      
      // Process buffer when it reaches a reasonable size or after a timeout
      if (buffer.length > 1024 || buffer.includes('\n'.charCodeAt(0))) {
        this.emitTerminalOutput(connectionId, buffer.toString())
        buffer = Buffer.alloc(0)
      }
    })
    
    // Set up a timer to flush any remaining buffer data periodically
    const flushInterval = setInterval(() => {
      if (buffer.length > 0) {
        this.emitTerminalOutput(connectionId, buffer.toString())
        buffer = Buffer.alloc(0)
      }
    }, 100) // Flush every 100ms

    // Handle stream close - combine both close handlers
    shellStream.on('close', () => {
      console.log('Terminal stream closed')

      // Clear the flush interval
      clearInterval(flushInterval)

      // Flush any remaining data
      if (buffer.length > 0) {
        this.emitTerminalOutput(connectionId, buffer.toString())
        buffer = Buffer.alloc(0)
      }

      // Update terminal session state
      const terminal = this.terminals.get(connectionId)
      if (terminal) {
        terminal.session.connected = false
        this.emitTerminalUpdate(connectionId, terminal.session)
        // Emit error event to notify about connection loss
        this.emitTerminalError(connectionId, 'Terminal connection was closed')
      }
    })

    shellStream.on('error', (error: Error) => {
      console.error('Terminal stream error:', error)
      this.emitTerminalOutput(connectionId, `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`)
      
      // Handle specific SSH connection errors
      if (error.message?.includes('Not connected to server') ||
          error.message?.includes('Connection closed') ||
          error.message?.includes('Socket is closed')) {
        this.emitTerminalError(connectionId, 'Connection to server was lost. Please reconnect.')
        // Close the terminal to clean up
        this.closeTerminal(connectionId)
      }
    })
  }

  private emitTerminalOutput(connectionId: string, data: string): void {
    const mainWindow = (global as any).mainWindow
    const terminal = this.terminals.get(connectionId)
    if (mainWindow && terminal?.session.connected) {
      mainWindow.webContents.send('terminal-output', { connectionId, data })
    } else {
      console.error('[TerminalService] Cannot emit - mainWindow:', !!mainWindow, 'terminal:', !!terminal, 'connected:', terminal?.session.connected)
    }
  }

  private emitTerminalUpdate(connectionId: string, session: TerminalSession): void {
    if ((global as any).mainWindow) {
      (global as any).mainWindow.webContents.send('terminal-session-update', { connectionId, session })
    }
  }

  private emitTerminalError(connectionId: string, errorMessage: string): void {
    if ((global as any).mainWindow) {
      (global as any).mainWindow.webContents.send('terminal-error', { connectionId, error: errorMessage })
    }
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  getSession(connectionId: string): TerminalSession | null {
    const terminal = this.terminals.get(connectionId)
    return terminal ? terminal.session : null
  }

  isConnected(connectionId: string): boolean {
    const terminal = this.terminals.get(connectionId)
    return terminal?.session.connected || false
  }
}