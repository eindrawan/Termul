import { ConnectionService } from './ConnectionService'
import { TerminalSession } from '../../renderer/types'

export class TerminalService {
  private connectionService: ConnectionService
  private terminalSession: TerminalSession | null = null
  private shellStream: any = null

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  async openTerminal(): Promise<TerminalSession> {
    const ssh = this.connectionService.getSshClient()
    if (!ssh) {
      throw new Error('Not connected to remote host')
    }

    try {
      // Create a new shell session through the existing SSH connection
      const config = this.connectionService.getConnectionConfig()
      if (!config) {
        throw new Error('No connection configuration available')
      }

      // Request a pseudo-terminal and start a shell using node-ssh method
      this.shellStream = await ssh.requestShell({
        term: 'xterm-256color',
        cols: 80,
        rows: 24,
      })
      
      // Send initial command to ensure we get a prompt
      this.shellStream.write('\r\n')

      const sessionId = this.generateSessionId()
      
      this.terminalSession = {
        id: sessionId,
        connected: true,
        host: config.host,
        username: config.username,
        rows: 24,
        cols: 80,
      }

      this.setupShellStream()
      
      return this.terminalSession
    } catch (error) {
      console.error('Failed to open terminal:', error)
      throw error
    }
  }

  async closeTerminal(): Promise<void> {
    if (this.shellStream) {
      this.shellStream.close()
      this.shellStream = null
    }

    if (this.terminalSession) {
      this.terminalSession.connected = false
      this.emitTerminalUpdate()
      this.terminalSession = null
    }
  }

  async sendInput(data: string): Promise<void> {
    if (!this.shellStream || !this.terminalSession?.connected) {
      throw new Error('Terminal not connected')
    }

    try {
      console.log('Sending terminal input:', data)
      this.shellStream.write(data)
    } catch (error) {
      console.error('Failed to send terminal input:', error)
      throw error
    }
  }

  resizeTerminal(cols: number, rows: number): void {
    if (!this.shellStream || !this.terminalSession?.connected) {
      return
    }

    try {
      // For SSH2, we need to set the window size
      this.shellStream.setWindow(rows, cols, 0, 0)
      
      if (this.terminalSession) {
        this.terminalSession.cols = cols
        this.terminalSession.rows = rows
        this.emitTerminalUpdate()
      }
    } catch (error) {
      console.error('Failed to resize terminal:', error)
    }
  }

  private setupShellStream(): void {
    if (!this.shellStream || !this.terminalSession) return

    this.shellStream.on('data', (data: Buffer) => {
      console.log('Terminal data received:', data.toString())
      this.emitTerminalOutput(data.toString())
    })

    this.shellStream.on('close', () => {
      console.log('Terminal stream closed')
      if (this.terminalSession) {
        this.terminalSession.connected = false
        this.emitTerminalUpdate()
      }
    })

    this.shellStream.on('error', (error: Error) => {
      console.error('Terminal stream error:', error)
      this.emitTerminalOutput(`\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`)
    })
  }

  private emitTerminalOutput(data: string): void {
    const mainWindow = (global as any).mainWindow
    console.log('[TerminalService] Emitting output, mainWindow exists:', !!mainWindow, 'session connected:', this.terminalSession?.connected)
    if (mainWindow && this.terminalSession?.connected) {
      console.log('[TerminalService] Sending terminal-output event with data:', data)
      mainWindow.webContents.send('terminal-output', data)
    } else {
      console.log('[TerminalService] Cannot emit - mainWindow:', !!mainWindow, 'session:', !!this.terminalSession, 'connected:', this.terminalSession?.connected)
    }
  }

  private emitTerminalUpdate(): void {
    if ((global as any).mainWindow && this.terminalSession) {
      (global as any).mainWindow.webContents.send('terminal-session-update', this.terminalSession)
    }
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  getSession(): TerminalSession | null {
    return this.terminalSession
  }

  isConnected(): boolean {
    return this.terminalSession?.connected || false
  }
}