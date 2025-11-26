import { ConnectionService } from './ConnectionService'
import { CredentialService } from './CredentialService'

export interface DockerContainer {
    ID: string
    Image: string
    Command: string
    CreatedAt: string
    RunningFor: string
    Ports: string
    Status: string
    Size: string
    Names: string
    Labels: string
    Mounts: string
    Networks: string
}

export class DockerService {
    private sudoPasswords = new Map<string, string>()
    private credentialService: CredentialService

    constructor(private connectionService: ConnectionService) {
        this.credentialService = new CredentialService()
    }

    setSudoPassword(connectionId: string, password: string) {
        this.sudoPasswords.set(connectionId, password)
    }

    private async execDockerCommand(client: any, command: string, connectionId: string) {
        const result = await client.execCommand(command)

        // Check for permission denied error
        if (result.code !== 0 && (result.stderr.includes('permission denied') || result.stderr.includes('connect: permission denied'))) {
            // Try with sudo -n (non-interactive)
            const sudoResult = await client.execCommand(`sudo -n ${command}`)
            if (sudoResult.code === 0) {
                return sudoResult
            }

            // Try with connection password first if available
            const connectionProfile = this.connectionService.getConnectionProfile(connectionId)
            if (connectionProfile && connectionProfile.authType === 'password') {
                try {
                    const authCredentials = await this.credentialService.getAuthCredentials(connectionProfile)
                    if (authCredentials.password) {
                        const connectionPasswordResult = await client.execCommand(`sudo -S ${command}`, {
                            stdin: `${authCredentials.password}\n`
                        })

                        if (connectionPasswordResult.code === 0) {
                            // Cache the connection password as sudo password for future use
                            this.sudoPasswords.set(connectionId, authCredentials.password)
                            return connectionPasswordResult
                        }
                    }
                } catch (error) {
                    console.error('Failed to use connection password for sudo:', error)
                }
            }

            // Try with cached sudo password if available
            const cachedPassword = this.sudoPasswords.get(connectionId)
            if (cachedPassword) {
                const sudoPasswordResult = await client.execCommand(`sudo -S ${command}`, {
                    stdin: `${cachedPassword}\n`
                })

                if (sudoPasswordResult.code === 0) {
                    return sudoPasswordResult
                }
            }

            // If we are here, we need a password or the cached one failed
            throw new Error('SUDO_PASSWORD_REQUIRED')
        }

        return result
    }

    async listContainers(connectionId: string): Promise<DockerContainer[]> {
        const client = this.connectionService.getSshClient(connectionId)
        if (!client) {
            throw new Error('Not connected to remote host')
        }

        try {
            // Use --no-trunc to get full output, and format as JSON
            const result = await this.execDockerCommand(client, 'docker ps -a --no-trunc --format "{{json .}}"', connectionId);

            if (result.code !== 0) {
                let errorMessage = result.stderr || 'Unknown error'
                if (errorMessage.includes('permission denied') || errorMessage.includes('connect: permission denied')) {
                    errorMessage += ' (Try adding your user to the "docker" group or configuring passwordless sudo for docker)'
                }
                throw new Error(`Docker command failed: ${errorMessage}`)
            }

            const containers = result.stdout
                .trim()
                .split('\n')
                .filter((line: string) => line.trim())
                .map((line: string) => JSON.parse(line))

            return containers
        } catch (error) {
            throw new Error(`Failed to list Docker containers: ${error instanceof Error ? error.message : error}`)
        }
    }

    async getContainerLogs(connectionId: string, containerId: string): Promise<string> {
        const client = this.connectionService.getSshClient(connectionId)
        if (!client) {
            throw new Error('Not connected to remote host')
        }

        try {
            // Get last 1000 lines of logs
            // Docker logs often output to stderr/stdout mixed, so we combine them or just take both
            const result = await this.execDockerCommand(client, `docker logs --tail 1000 ${containerId}`, connectionId);

            if (result.code !== 0 && !result.stdout && !result.stderr) {
                throw new Error(`Failed to get logs: code ${result.code}`)
            }

            if (result.code !== 0 && (result.stderr.includes('permission denied') || result.stderr.includes('connect: permission denied'))) {
                let errorMessage = result.stderr
                errorMessage += ' (Try adding your user to the "docker" group or configuring passwordless sudo for docker)'
                throw new Error(errorMessage)
            }

            // Combine stdout and stderr
            return result.stdout + (result.stderr ? '\n' + result.stderr : '')
        } catch (error) {
            throw new Error(`Failed to get container logs: ${error instanceof Error ? error.message : error}`)
        }
    }

    private activeShells = new Map<string, any>()

    async startContainerShell(connectionId: string, containerId: string, cols: number, rows: number): Promise<string> {
        const client = this.connectionService.getSshClient(connectionId)
        if (!client) {
            throw new Error('Not connected to remote host')
        }

        try {
            // Request a shell
            const shellStream = await client.requestShell({
                term: 'xterm-256color',
                cols,
                rows,
            })

            const shellId = `${connectionId}-${containerId}-${Date.now()}`

            // Store shell instance
            this.activeShells.set(shellId, {
                connectionId,
                containerId,
                stream: shellStream,
                connected: true
            })

            // Setup stream handling
            this.setupShellStream(shellId, shellStream)

            // Send docker exec command
            const cachedPassword = this.sudoPasswords.get(connectionId)

            if (cachedPassword) {
                // If we have a cached password, use sudo -S
                // We use -p '' to suppress the prompt since we're sending the password immediately
                const cmd = `sudo -S -p '' docker exec -it ${containerId} /bin/sh || sudo -S -p '' docker exec -it ${containerId} /bin/bash`
                shellStream.write(`${cmd}\n`)

                // Send password after a brief delay to ensure sudo is ready to read it
                setTimeout(() => {
                    shellStream.write(`${cachedPassword}\n`)
                }, 100)
            } else {
                const cmd = `docker exec -it ${containerId} /bin/sh || docker exec -it ${containerId} /bin/bash`
                shellStream.write(`${cmd}\n`)
            }

            return shellId
        } catch (error) {
            throw new Error(`Failed to start container shell: ${error instanceof Error ? error.message : error}`)
        }
    }

    async sendShellInput(shellId: string, data: string): Promise<void> {
        const shell = this.activeShells.get(shellId)
        if (!shell || !shell.connected) {
            throw new Error('Shell not connected')
        }
        shell.stream.write(data)
    }

    async resizeShell(shellId: string, cols: number, rows: number): Promise<void> {
        const shell = this.activeShells.get(shellId)
        if (!shell || !shell.connected) {
            return
        }
        shell.stream.setWindow(rows, cols, 0, 0)
    }

    async closeShell(shellId: string): Promise<void> {
        const shell = this.activeShells.get(shellId)
        if (shell) {
            shell.stream.close()
            shell.connected = false
            this.activeShells.delete(shellId)
        }
    }

    private setupShellStream(shellId: string, stream: any): void {
        let buffer = Buffer.alloc(0)

        const emitOutput = (data: string) => {
            if ((global as any).mainWindow) {
                (global as any).mainWindow.webContents.send('docker-shell-output', { shellId, data })
            }
        }

        stream.on('data', (data: Buffer) => {
            buffer = Buffer.concat([buffer, data])
            if (buffer.length > 1024 || buffer.includes('\n'.charCodeAt(0))) {
                emitOutput(buffer.toString())
                buffer = Buffer.alloc(0)
            }
        })

        const flushInterval = setInterval(() => {
            if (buffer.length > 0) {
                emitOutput(buffer.toString())
                buffer = Buffer.alloc(0)
            }
        }, 100)

        stream.on('close', () => {
            clearInterval(flushInterval)
            if (buffer.length > 0) {
                emitOutput(buffer.toString())
            }
            if ((global as any).mainWindow) {
                (global as any).mainWindow.webContents.send('docker-shell-closed', { shellId })
            }
            this.activeShells.delete(shellId)
        })

        stream.on('error', (error: Error) => {
            emitOutput(`\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`)
        })
    }

    async restartContainer(connectionId: string, containerId: string): Promise<void> {
        const client = this.connectionService.getSshClient(connectionId)
        if (!client) {
            throw new Error('Not connected to remote host')
        }

        try {
            const result = await this.execDockerCommand(client, `docker restart ${containerId}`, connectionId)

            if (result.code !== 0) {
                let errorMessage = result.stderr || 'Unknown error'
                if (errorMessage.includes('permission denied') || errorMessage.includes('connect: permission denied')) {
                    errorMessage += ' (Try adding your user to the "docker" group or configuring passwordless sudo for docker)'
                }
                throw new Error(errorMessage)
            }
        } catch (error) {
            throw new Error(`Failed to restart container: ${error instanceof Error ? error.message : error}`)
        }
    }
}
