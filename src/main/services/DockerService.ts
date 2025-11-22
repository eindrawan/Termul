import { ConnectionService } from './ConnectionService'

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

    constructor(private connectionService: ConnectionService) { }

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
