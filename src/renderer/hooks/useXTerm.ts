import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'

interface UseXTermProps {
    isActive: boolean
    isConnected: boolean
    theme: string
    output: string[]
    onInput: (data: string) => void
    onResize: (cols: number, rows: number) => void
    onContextMenu: (event: MouseEvent) => void
}

export function useXTerm({
    isActive,
    isConnected,
    theme,
    output,
    onInput,
    onResize,
    onContextMenu
}: UseXTermProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const webLinksAddonRef = useRef<WebLinksAddon | null>(null)
    const lastProcessedIndexRef = useRef<number>(-1)

    // Initialize xterm
    useEffect(() => {
        if (!terminalRef.current || xtermRef.current) return

        console.log('[useXTerm] Initializing xterm instance')

        const term = new XTerm({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'JetBrains Mono, monospace',
            theme: {
                background: theme === 'dark' ? '#000000' : '#ffffff',
                foreground: theme === 'dark' ? '#ffffff' : '#000000',
                cursor: theme === 'dark' ? '#ffffff' : '#000000',
            },
            allowProposedApi: true,
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        const webLinksAddon = new WebLinksAddon()
        term.loadAddon(webLinksAddon)

        term.open(terminalRef.current)

        term.onData((data) => {
            onInput(data)
        })

        term.onResize(({ cols, rows }) => {
            onResize(cols, rows)
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

        // Context menu handler
        term.element?.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            onContextMenu(e)
        })

        xtermRef.current = term
        fitAddonRef.current = fitAddon
        webLinksAddonRef.current = webLinksAddon

        // Handle window resize
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current && terminalRef.current) {
                if (terminalRef.current.offsetParent === null) return
                try {
                    fitAddonRef.current.fit()
                } catch (error) {
                    console.error('[useXTerm] Error during resize:', error)
                }
            }
        }

        const resizeObserver = new ResizeObserver(() => handleResize())
        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current)
        }
        window.addEventListener('resize', handleResize)

        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('resize', handleResize)
            term.dispose()
            xtermRef.current = null
            fitAddonRef.current = null
            webLinksAddonRef.current = null
        }
    }, []) // Empty dependency array as we only want to init once

    // Update theme
    useEffect(() => {
        if (xtermRef.current) {
            const isDark = theme === 'dark'
            xtermRef.current.options.theme = {
                background: isDark ? '#000000' : '#ffffff',
                foreground: isDark ? '#ffffff' : '#000000',
                cursor: isDark ? '#ffffff' : '#000000',
                black: isDark ? '#000000' : '#000000',
                red: isDark ? '#cd3131' : '#cd3131',
                green: isDark ? '#0dbc79' : '#0dbc79',
                yellow: isDark ? '#e5e510' : '#e5e510',
                blue: isDark ? '#2472c8' : '#2472c8',
                magenta: isDark ? '#bc3fbc' : '#bc3fbc',
                cyan: isDark ? '#11a8cd' : '#11a8cd',
                white: isDark ? '#e5e5e5' : '#e5e5e5',
                brightBlack: isDark ? '#666666' : '#666666',
                brightRed: isDark ? '#f14c4c' : '#f14c4c',
                brightGreen: isDark ? '#23d18b' : '#23d18b',
                brightYellow: isDark ? '#f5f543' : '#f5f543',
                brightBlue: isDark ? '#3b8eea' : '#3b8eea',
                brightMagenta: isDark ? '#d670d6' : '#d670d6',
                brightCyan: isDark ? '#29b8db' : '#29b8db',
                brightWhite: isDark ? '#e5e5e5' : '#e5e5e5',
            }
        }
    }, [theme])

    // Handle active state change
    useEffect(() => {
        if (isActive && fitAddonRef.current && xtermRef.current && terminalRef.current) {
            requestAnimationFrame(() => {
                if (fitAddonRef.current && xtermRef.current && terminalRef.current?.offsetParent) {
                    try {
                        fitAddonRef.current.fit()
                    } catch (error) {
                        console.error('[useXTerm] Error during fit after becoming active:', error)
                    }
                }
            })
        }
    }, [isActive])

    // Handle terminal output
    useEffect(() => {
        if (!xtermRef.current) return

        const term = xtermRef.current
        const startIndex = lastProcessedIndexRef.current + 1

        if (startIndex < output.length) {
            for (let i = startIndex; i < output.length; i++) {
                try {
                    term.write(output[i])
                } catch (error) {
                    console.error('[useXTerm] Error writing output:', error)
                }
            }
            lastProcessedIndexRef.current = output.length - 1
        }
    }, [output])

    // Handle connection state changes (clear/fit)
    useEffect(() => {
        if (isConnected && xtermRef.current && fitAddonRef.current) {
            lastProcessedIndexRef.current = -1
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (fitAddonRef.current && xtermRef.current) {
                        try {
                            fitAddonRef.current.fit()
                        } catch (error) {
                            console.error('[useXTerm] Error during fit after connection:', error)
                        }
                    }
                })
            })
        } else if (!isConnected && xtermRef.current) {
            xtermRef.current.clear()
            lastProcessedIndexRef.current = -1
        }
    }, [isConnected])

    return { terminalRef, xtermRef }
}
