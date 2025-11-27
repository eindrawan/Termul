import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useTheme } from '../contexts/ThemeContext'
import '@xterm/xterm/css/xterm.css'

interface DockerShellViewerProps {
    connectionId: string
    containerId: string
}

export default function DockerShellViewer({ connectionId, containerId }: DockerShellViewerProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const shellIdRef = useRef<string | null>(null)
    const { theme } = useTheme()
    const [error, setError] = useState<string | null>(null)

    // Initialize xterm
    useEffect(() => {
        if (!terminalRef.current || xtermRef.current) return

        const term = new XTerm({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'JetBrains Mono, monospace',
            theme: {
                background: theme === 'dark' ? '#000000' : '#ffffff',
                foreground: theme === 'dark' ? '#ffffff' : '#000000',
                cursor: theme === 'dark' ? '#ffffff' : '#000000',
            },
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.loadAddon(new WebLinksAddon())

        term.open(terminalRef.current)

        // Wait for terminal to be rendered before fitting
        setTimeout(() => {
            fitAddon.fit()
        }, 100)

        xtermRef.current = term
        fitAddonRef.current = fitAddon

        // Handle input
        term.onData((data) => {
            if (shellIdRef.current) {
                window.electronAPI.sendDockerShellInput(shellIdRef.current, data)
            }
        })

        // Handle resize
        term.onResize(({ cols, rows }) => {
            if (shellIdRef.current) {
                window.electronAPI.resizeDockerShell(shellIdRef.current, cols, rows)
            }
        })

        // Auto-copy on selection
        term.onSelectionChange(() => {
            const selection = term.getSelection()
            if (selection && selection.length > 0) {
                navigator.clipboard.writeText(selection).catch(err => {
                    console.error('Failed to auto-copy selection:', err)
                })
            }
        })

        // Right-click to paste
        term.element?.addEventListener('contextmenu', async (e) => {
            e.preventDefault()
            try {
                const text = await navigator.clipboard.readText()
                if (text) {
                    term.paste(text)
                }
            } catch (err) {
                console.error('Failed to paste from clipboard:', err)
            }
        })

        // Start shell
        const startShell = async () => {
            try {
                const shellId = await window.electronAPI.startDockerShell(connectionId, containerId, term.cols, term.rows)
                shellIdRef.current = shellId
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
                term.write(`\r\n\x1b[31mFailed to start shell: ${err instanceof Error ? err.message : String(err)}\x1b[0m\r\n`)
            }
        }

        startShell()

        // Handle window resize
        const handleResize = () => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit()
            }
        }
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            if (shellIdRef.current) {
                window.electronAPI.closeDockerShell(shellIdRef.current)
            }
            term.dispose()
            xtermRef.current = null
        }
    }, [])

    // Handle theme changes
    useEffect(() => {
        if (xtermRef.current) {
            const isDark = theme === 'dark'
            xtermRef.current.options.theme = {
                background: isDark ? '#000000' : '#ffffff',
                foreground: isDark ? '#ffffff' : '#000000',
                cursor: isDark ? '#ffffff' : '#000000',
            }
        }
    }, [theme])

    // Listen for output
    useEffect(() => {
        const handleOutput = (data: { shellId: string; data: string }) => {
            if (shellIdRef.current === data.shellId && xtermRef.current) {
                xtermRef.current.write(data.data)
            }
        }

        const handleClosed = (data: { shellId: string }) => {
            if (shellIdRef.current === data.shellId && xtermRef.current) {
                xtermRef.current.write('\r\n\x1b[33mShell closed.\x1b[0m\r\n')
                shellIdRef.current = null
            }
        }

        window.electronAPI.onDockerShellOutput(handleOutput)
        window.electronAPI.onDockerShellClosed(handleClosed)

        return () => {
            window.electronAPI.removeAllListeners('docker-shell-output')
            window.electronAPI.removeAllListeners('docker-shell-closed')
        }
    }, [])

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
            {error && (
                <div className="p-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-sm border-b border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}
            <div className="flex-1 relative">
                <div ref={terminalRef} className="absolute inset-0 p-2" />
            </div>
        </div>
    )
}
