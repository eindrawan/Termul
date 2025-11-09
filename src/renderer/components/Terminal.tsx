import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useConnection } from '../contexts/ConnectionContext'
import { useTerminal } from '../contexts/TerminalContext'

export default function Terminal() {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const { state: connectionState } = useConnection()
    const { state: terminalState, openMutation, closeMutation, sendInputMutation } = useTerminal()

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
            sendInputMutation.mutate(data)
        })

        // Store references
        xtermRef.current = term
        fitAddonRef.current = fitAddon

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
        if (connectionState.status.connected && !terminalState.isConnected && !openMutation.isPending) {
            console.log('[Terminal] Auto-opening terminal')
            openMutation.mutate()
        }
    }, [connectionState.status.connected, terminalState.isConnected])

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
        if (!connectionState.status.connected) {
            alert('Please connect to a host first')
            return
        }
        openMutation.mutate()
    }

    const handleCloseTerminal = () => {
        closeMutation.mutate()
    }

    const handleClearTerminal = () => {
        if (xtermRef.current) {
            xtermRef.current.clear()
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center space-x-4">
                    <h3 className="text-white font-medium">Terminal</h3>
                    {terminalState.session?.host && (
                        <span className="text-gray-400 text-sm">
                            {terminalState.session.username || connectionState.status.username}@{terminalState.session.host}
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
                                {!connectionState.status.connected
                                    ? 'Connect to a host to open a terminal session'
                                    : 'Click "Open Terminal" to start a session'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}