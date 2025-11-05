import { spawn } from 'child_process'
import { ConnectionService } from './ConnectionService'
import { TerminalSession } from '../../renderer/types'

export class TerminalService {
  private connectionService: ConnectionService
  private terminalSession: TerminalSession | null = null
  private shellProcess: any = null

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  async openTerminal(): Promise<TerminalSession> {
    const ssh = this.connectionService.getSshClient()
    if (!ssh) {
      throw new Error('Not connected to remote host')
    }

    try {
      // Create a new shell session through SSH
      const config = (ssh as any).getConfig ? (ssh as any).getConfig() : { username: '', host: '', port: 22 }
      const shellProcess = spawn('ssh', [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=QUIET',
        `${config.username}@${config.host}`,
        '-p', config.port.toString(),
        '-t', 'dumb'
      ], {
        env: { TERM: 'xterm-256color' }
      })

      this.shellProcess = shellProcess

      const sessionId = this.generateSessionId()
      
      this.terminalSession = {
        id: sessionId,
        connected: true,
        host: config.host,
        rows: 24,
        cols: 80,
      }

      this.setupShellProcess()
      
      return this.terminalSession
    } catch (error) {
      console.error('Failed to open terminal:', error)
      throw error
    }
  }

  async closeTerminal(): Promise<void> {
    if (this.shellProcess) {
      this.shellProcess.kill('SIGTERM')
      this.shellProcess = null
    }

    if (this.terminalSession) {
      this.terminalSession.connected = false
      this.emitTerminalUpdate()
      this.terminalSession = null
    }
  }

  async sendInput(data: string): Promise<void> {
    if (!this.shellProcess || !this.terminalSession?.connected) {
      throw new Error('Terminal not connected')
    }

    try {
      this.shellProcess.stdin.write(data)
    } catch (error) {
      console.error('Failed to send terminal input:', error)
      throw error
    }
  }

  resizeTerminal(cols: number, rows: number): void {
    if (!this.shellProcess || !this.terminalSession?.connected) {
      return
    }

    try {
      // Send SIGWINCH signal to resize the terminal
      this.shellProcess.kill('SIGWINCH')
      
      if (this.terminalSession) {
        this.terminalSession.cols = cols
        this.terminalSession.rows = rows
        this.emitTerminalUpdate()
      }
    } catch (error) {
      console.error('Failed to resize terminal:', error)
    }
  }

  private setupShellProcess(): void {
    if (!this.shellProcess || !this.terminalSession) return

    this.shellProcess.stdout.on('data', (data: Buffer) => {
      this.emitTerminalOutput(data.toString())
    })

    this.shellProcess.stderr.on('data', (data: Buffer) => {
      this.emitTerminalOutput(data.toString())
    })

    this.shellProcess.on('close', (code: number) => {
      console.log(`Terminal process closed with code ${code}`)
      if (this.terminalSession) {
        this.terminalSession.connected = false
        this.emitTerminalUpdate()
      }
    })

    this.shellProcess.on('error', (error: Error) => {
      console.error('Terminal process error:', error)
      this.emitTerminalOutput(`\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`)
    })
  }

  private emitTerminalOutput(data: string): void {
    if ((global as any).mainWindow && this.terminalSession?.connected) {
      (global as any).mainWindow.webContents.send('terminal-output', data)
    }
  }

  private emitTerminalUpdate(): void {
    if ((global as any).mainWindow && this.terminalSession) {
      (global as any).mainWindow.webContents.send('terminal-session-update', this.terminalSession)
    }
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  getSession(): TerminalSession | null {
    return this.terminalSession
  }

  isConnected(): boolean {
    return this.terminalSession?.connected || false
  }
}