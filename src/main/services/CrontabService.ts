import { ConnectionService } from './ConnectionService'
import { CredentialService } from './CredentialService'

export class CrontabService {
  private connectionService: ConnectionService
  private credentialService: CredentialService
  private sudoPasswords = new Map<string, string>()

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
    this.credentialService = new CredentialService()
  }

  setSudoPassword(connectionId: string, password: string) {
    this.sudoPasswords.set(connectionId, password)
  }

  private async execCrontabCommand(client: any, command: string, connectionId: string, useSudo: boolean = false) {
    // If sudo is required, prepend sudo to the command
    const fullCommand = useSudo ? `sudo ${command}` : command
    let result = await client.execCommand(fullCommand)

    // If sudo was explicitly requested and failed, try with password
    if (useSudo && result.code !== 0 && (result.stderr.includes('no tty present') || result.stderr.includes('permission denied'))) {
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
              // Cache connection password as sudo password for future use
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

      // If we are here, we need a password or cached one failed
      throw new Error('SUDO_PASSWORD_REQUIRED')
    }

    // Check for permission denied error only if sudo wasn't explicitly requested
    if (!useSudo && result.code !== 0 && (result.stderr.includes('permission denied') || result.stderr.includes('connect: permission denied'))) {
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
              // Cache connection password as sudo password for future use
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

      // If we are here, we need a password or cached one failed
      throw new Error('SUDO_PASSWORD_REQUIRED')
    }

    return result
  }

  async readCrontab(connectionId: string, crontabType: 'user' | 'root' = 'user'): Promise<string> {
    const sshClient = this.connectionService.getSshClient(connectionId)
    if (!sshClient) {
      throw new Error('SSH connection not available')
    }

    try {
      const command = crontabType === 'root' ? 'crontab -l -u root' : 'crontab -l'
      const result = await this.execCrontabCommand(sshClient, command, connectionId, crontabType === 'root')
      
      if (result.code === 0) {
        return result.stdout
      } else {
        // If crontab is empty, crontab -l returns "no crontab for username"
        // This is normal, so we return empty string
        if (result.stderr.includes('no crontab')) {
          return ''
        } else {
          throw new Error(result.stderr || `Command failed with code ${result.code}`)
        }
      }
    } catch (error: any) {
      if (error.message === 'SUDO_PASSWORD_REQUIRED') {
        throw new Error(`Sudo password required to access ${crontabType} crontab`)
      }
      throw error
    }
  }

  async writeCrontab(connectionId: string, content: string, crontabType: 'user' | 'root' = 'user'): Promise<void> {
    const sshClient = this.connectionService.getSshClient(connectionId)
    if (!sshClient) {
      throw new Error('SSH connection not available')
    }

    try {
      // Create a temporary file with crontab content
      const tempFile = `/tmp/crontab_${Date.now()}`
      const escapedContent = content.replace(/'/g, "'\"'\"'")
      
      const commands = [
        `echo '${escapedContent}' > ${tempFile}`,
        crontabType === 'root' ? `crontab -u root ${tempFile}` : `crontab ${tempFile}`,
        `rm -f ${tempFile}`
      ].join(' && ')

      const result = await this.execCrontabCommand(sshClient, commands, connectionId, crontabType === 'root')
      
      if (result.code !== 0) {
        throw new Error(result.stderr || `Command failed with code ${result.code}`)
      }
    } catch (error: any) {
      if (error.message === 'SUDO_PASSWORD_REQUIRED') {
        throw new Error(`Sudo password required to modify ${crontabType} crontab`)
      }
      throw error
    }
  }

  async validateCrontab(content: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Basic crontab validation
      const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'))
      
      for (const line of lines) {
        // Skip environment variable lines (KEY=VALUE)
        if (line.includes('=')) {
          continue
        }

        // Validate cron schedule format
        const parts = line.trim().split(/\s+/)
        if (parts.length < 6) {
          return { valid: false, error: `Invalid cron format: "${line}". Expected at least 6 fields (minute hour day month weekday command).` }
        }

        const [minute, hour, day, month, weekday] = parts.slice(0, 5)
        
        // Validate time fields (basic validation)
        const timeFields = [
          { name: 'minute', value: minute, min: 0, max: 59 },
          { name: 'hour', value: hour, min: 0, max: 23 },
          { name: 'day', value: day, min: 1, max: 31 },
          { name: 'month', value: month, min: 1, max: 12 },
          { name: 'weekday', value: weekday, min: 0, max: 7 }
        ]

        for (const field of timeFields) {
          if (!this.isValidCronField(field.value, field.min, field.max)) {
            return { valid: false, error: `Invalid ${field.name} value "${field.value}" in line: "${line}"` }
          }
        }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error: `Validation error: ${error}` }
    }
  }

  private isValidCronField(value: string, min: number, max: number): boolean {
    // Accept wildcards, ranges, lists, and step values
    if (value === '*') return true
    
    // Handle step values (*/n)
    if (value.startsWith('*/')) {
      const step = parseInt(value.substring(2))
      return !isNaN(step) && step > 0
    }
    
    // Handle ranges (n-m)
    if (value.includes('-')) {
      const [start, end] = value.split('-').map(v => v.split('/')[0]) // Handle ranges with steps
      const startNum = parseInt(start)
      const endNum = parseInt(end)
      return !isNaN(startNum) && !isNaN(endNum) && startNum >= min && endNum <= max && startNum <= endNum
    }
    
    // Handle lists (n,m,o)
    if (value.includes(',')) {
      const values = value.split(',')
      return values.every(v => {
        const num = parseInt(v.split('/')[0]) // Handle step values in lists
        return !isNaN(num) && num >= min && num <= max
      })
    }
    
    // Handle single values with optional step
    const [base, step] = value.split('/')
    const baseNum = parseInt(base)
    if (isNaN(baseNum) || baseNum < min || baseNum > max) return false
    
    if (step) {
      const stepNum = parseInt(step)
      return !isNaN(stepNum) && stepNum > 0
    }
    
    return true
  }
}