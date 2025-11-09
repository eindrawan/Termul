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

      // Send initial command to ensure we get a prompt
      shellStream.write('\r\n')

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
    } catch (error) {
      console.error('Failed to open terminal:', error)
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
      console.log('Sending terminal input:', data)
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

    shellStream.on('data', (data: Buffer) => {
      console.log('Terminal data received:', data.toString())
      this.emitTerminalOutput(connectionId, data.toString())
    })

    shellStream.on('close', () => {
      console.log('Terminal stream closed')
      const terminal = this.terminals.get(connectionId)
      if (terminal) {
        terminal.session.connected = false
        this.emitTerminalUpdate(connectionId, terminal.session)
      }
    })

    shellStream.on('error', (error: Error) => {
      console.error('Terminal stream error:', error)
      this.emitTerminalOutput(connectionId, `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`)
    })
  }

  private emitTerminalOutput(connectionId: string, data: string): void {
    const mainWindow = (global as any).mainWindow
    const terminal = this.terminals.get(connectionId)
    console.log('[TerminalService] Emitting output, mainWindow exists:', !!mainWindow, 'session connected:', terminal?.session.connected)
    if (mainWindow && terminal?.session.connected) {
      console.log('[TerminalService] Sending terminal-output event with data:', data)
      mainWindow.webContents.send('terminal-output', { connectionId, data })
    } else {
      console.log('[TerminalService] Cannot emit - mainWindow:', !!mainWindow, 'terminal:', !!terminal, 'connected:', terminal?.session.connected)
    }
  }

  private emitTerminalUpdate(connectionId: string, session: TerminalSession): void {
    if ((global as any).mainWindow) {
      (global as any).mainWindow.webContents.send('terminal-session-update', { connectionId, session })
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