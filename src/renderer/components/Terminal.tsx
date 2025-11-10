import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useConnection } from '../contexts/ConnectionContext'
import { useTerminal } from '../contexts/TerminalContext'
import AlertDialog from './AlertDialog'

interface TerminalProps {
    connectionId: string
}

export default function Terminal({ connectionId }: TerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const webLinksAddonRef = useRef<WebLinksAddon | null>(null)
    const { state: connectionState } = useConnection()
    const { state: terminalState, openMutation, closeMutation, sendInputMutation } = useTerminal()

    const connection = connectionState.activeConnections.get(connectionId)
    const isConnected = connection?.status.connected || false

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean
        message: string
        variant: 'success' | 'error' | 'warning' | 'info'
    }>({ isOpen: false, message: '', variant: 'info' })

    // Initialize xterm when component mounts
    useEffect(() => {
        if (!terminalRef.current || xtermRef.current) return

        console.log('[Terminal] Initializing xterm instance')

        // Create terminal instance
        const term = new XTerm({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'JetBrains Mono, monospace',
            theme: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#ffffff',
            },
        })

        // Create and load fit addon
        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        // Create and load web links addon
        const webLinksAddon = new WebLinksAddon()
        term.loadAddon(webLinksAddon)

        // Open terminal in DOM
        term.open(terminalRef.current)

        // Fit terminal to container size
        setTimeout(() => {
            fitAddon.fit()
            console.log('[Terminal] Initial fit - cols:', term.cols, 'rows:', term.rows)
        }, 0)

        // Handle user input
        term.onData((data: string) => {
            console.log('[Terminal] User input:', data)
            sendInputMutation.mutate({ connectionId, data })
        })

        // Store references
        xtermRef.current = term
        fitAddonRef.current = fitAddon
        webLinksAddonRef.current = webLinksAddon

        // Add right-click context menu handler
        term.element?.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            handleRightClick(e, term)
        })

        console.log('[Terminal] Xterm instance created and opened')

        // Handle window resize
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current) {
                try {
                    fitAddonRef.current.fit()
                    console.log('[Terminal] Resized - cols:', xtermRef.current.cols, 'rows:', xtermRef.current.rows)
                } catch (error) {
                    console.error('[Terminal] Error during resize:', error)
                }
            }
        }

        // Use ResizeObserver for better resize detection
        const resizeObserver = new ResizeObserver(() => {
            handleResize()
        })

        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current)
        }

        window.addEventListener('resize', handleResize)

        // Cleanup
        return () => {
            console.log('[Terminal] Cleaning up xterm instance')
            resizeObserver.disconnect()
            window.removeEventListener('resize', handleResize)
            term.dispose()
            xtermRef.current = null
            fitAddonRef.current = null
            webLinksAddonRef.current = null
        }
    }, [])

    // Handle terminal output
    useEffect(() => {
        console.log('[Terminal] Output effect triggered')
        console.log('[Terminal] xtermRef.current:', xtermRef.current)
        console.log('[Terminal] terminalState.output:', terminalState.output)

        if (!xtermRef.current) {
            console.log('[Terminal] No xterm instance, skipping output')
            return
        }

        const term = xtermRef.current
        const outputArray = terminalState.output

        console.log('[Terminal] Output changed, total items:', outputArray.length)

        // Write the latest output
        if (outputArray.length > 0) {
            const latestOutput = outputArray[outputArray.length - 1]
            console.log('[Terminal] Writing output:', JSON.stringify(latestOutput))
            try {
                term.write(latestOutput)
                console.log('[Terminal] Output written successfully')
            } catch (error) {
                console.error('[Terminal] Error writing output:', error)
            }
        } else {
            console.log('[Terminal] No output to write')
        }
    }, [terminalState.output])

    // Auto-open terminal when connected
    useEffect(() => {
        if (isConnected && !terminalState.isConnected && !openMutation.isPending) {
            console.log('[Terminal] Auto-opening terminal for connection:', connectionId)
            openMutation.mutate(connectionId)
        }
    }, [isConnected, terminalState.isConnected, connectionId])

    // Handle terminal visibility changes
    useEffect(() => {
        if (terminalState.isConnected && xtermRef.current && fitAddonRef.current) {
            console.log('[Terminal] Session opened, fitting terminal')
            // Small delay to ensure the div is visible and has proper dimensions
            setTimeout(() => {
                if (fitAddonRef.current && xtermRef.current) {
                    fitAddonRef.current.fit()
                    console.log('[Terminal] Fitted after connection - cols:', xtermRef.current.cols, 'rows:', xtermRef.current.rows)
                }
            }, 100)
        } else if (!terminalState.isConnected && xtermRef.current) {
            console.log('[Terminal] Session closed, clearing terminal')
            xtermRef.current.clear()
        }
    }, [terminalState.isConnected])

    const handleOpenTerminal = () => {
        if (!isConnected) {
            setAlertDialog({
                isOpen: true,
                message: 'Please connect to a host first',
                variant: 'warning'
            })
            return
        }
        openMutation.mutate(connectionId)
    }

    const handleCloseTerminal = () => {
        closeMutation.mutate(connectionId)
    }

    const handleClearTerminal = () => {
        if (xtermRef.current) {
            xtermRef.current.clear()
        }
    }

    const handleRightClick = (event: MouseEvent, term: XTerm) => {
        // Create context menu
        const contextMenu = document.createElement('div')
        contextMenu.className = 'fixed bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 z-50 min-w-[150px]'
        contextMenu.style.left = `${event.clientX}px`
        contextMenu.style.top = `${event.clientY}px`

        // Create menu items
        const copyItem = document.createElement('button')
        copyItem.className = 'w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 flex items-center'
        copyItem.innerHTML = '<span class="mr-2">📋</span>Copy'

        const pasteItem = document.createElement('button')
        pasteItem.className = 'w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 flex items-center'
        pasteItem.innerHTML = '<span class="mr-2">📥</span>Paste'

        // Add click handlers
        copyItem.addEventListener('click', async (e) => {
            e.stopPropagation()
            try {
                const selection = term.getSelection()
                if (selection) {
                    await navigator.clipboard.writeText(selection)
                }
                document.body.removeChild(contextMenu)
            } catch (error) {
                console.error('Failed to copy to clipboard:', error)
                document.body.removeChild(contextMenu)
            }
        })

        pasteItem.addEventListener('click', async (e) => {
            e.stopPropagation()
            try {
                const text = await navigator.clipboard.readText()
                if (text) {
                    sendInputMutation.mutate({ connectionId, data: text })
                }
                document.body.removeChild(contextMenu)
            } catch (error) {
                console.error('Failed to paste from clipboard:', error)
                document.body.removeChild(contextMenu)
            }
        })

        // Add items to menu
        contextMenu.appendChild(copyItem)
        contextMenu.appendChild(pasteItem)

        // Add menu to DOM
        document.body.appendChild(contextMenu)

        // Remove menu on click outside
        setTimeout(() => {
            const removeMenu = (e: Event) => {
                if (!contextMenu.contains(e.target as Node)) {
                    if (document.body.contains(contextMenu)) {
                        document.body.removeChild(contextMenu)
                    }
                    document.removeEventListener('click', removeMenu)
                }
            }
            document.addEventListener('click', removeMenu)
        }, 0)
    }

    return (
        <>
            <AlertDialog
                isOpen={alertDialog.isOpen}
                message={alertDialog.message}
                variant={alertDialog.variant}
                onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
            />

            <div className="flex flex-col h-full bg-gray-900">
                {/* Terminal Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center space-x-4">
                        <h3 className="text-white font-medium">Terminal</h3>
                        {terminalState.session?.host && (
                            <span className="text-gray-400 text-sm">
                                {terminalState.session.username || connection?.profile.username}@{terminalState.session.host}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        {!terminalState.isConnected ? (
                            <button
                                onClick={handleOpenTerminal}
                                disabled={openMutation.isLoading}
                                className="btn btn-primary text-sm"
                            >
                                {openMutation.isLoading ? 'Opening...' : 'Open Terminal'}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleClearTerminal}
                                    className="btn btn-secondary text-sm"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={handleCloseTerminal}
                                    disabled={closeMutation.isLoading}
                                    className="btn btn-secondary text-sm"
                                >
                                    {closeMutation.isLoading ? 'Closing...' : 'Close'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Terminal Body */}
                <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
                    {/* Terminal container - always rendered */}
                    <div
                        ref={terminalRef}
                        className="w-full h-full"
                        style={{
                            display: terminalState.isConnected ? 'block' : 'none'
                        }}
                    />

                    {/* Not connected message */}
                    {!terminalState.isConnected && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <div className="text-lg mb-2">Terminal not connected</div>
                                <div className="text-sm">
                                    {!isConnected
                                        ? 'Connect to a host to open a terminal session'
                                        : 'Click "Open Terminal" to start a session'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}