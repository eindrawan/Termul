import React, { useEffect, useRef, useState } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { useTerminal } from '../contexts/TerminalContext'

export default function Terminal() {
    const terminalRef = useRef<HTMLDivElement>(null)
    const [terminalInstance, setTerminalInstance] = useState<any>(null)
    const { state: connectionState } = useConnection()
    const { state: terminalState, openMutation, closeMutation, sendInputMutation } = useTerminal()

    useEffect(() => {
        if (!terminalRef.current || terminalInstance) return

        // Dynamically import xterm to avoid SSR issues
        import('@xterm/xterm').then(({ Terminal }) => {
            import('@xterm/addon-fit').then(({ FitAddon }) => {
                const term = new Terminal({
                    cursorBlink: true,
                    fontSize: 14,
                    fontFamily: 'JetBrains Mono, monospace',
                    theme: {
                        background: '#1e1e1e',
                        foreground: '#d4d4d4',
                        cursor: '#ffffff',
                        selection: '#264f78',
                    },
                })

                const fitAddon = new FitAddon()
                term.loadAddon(fitAddon)

                term.open(terminalRef.current)
                fitAddon.fit()

                term.onData((data: string) => {
                    sendInputMutation.mutate(data)
                })

                term.onResize(({ cols, rows }) => {
                    // Handle terminal resize if needed
                })

                setTerminalInstance(term)

                // Focus terminal
                term.focus()

                // Handle window resize
                const handleResize = () => {
                    fitAddon.fit()
                }
                window.addEventListener('resize', handleResize)

                return () => {
                    window.removeEventListener('resize', handleResize)
                    term.dispose()
                }
            })
        })
    }, [terminalRef.current, terminalInstance, sendInputMutation])

    useEffect(() => {
        if (!terminalInstance) return

        // Write terminal output to the terminal
        terminalState.output.forEach((data) => {
            terminalInstance.write(data)
        })
    }, [terminalInstance, terminalState.output])

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
        if (terminalInstance) {
            terminalInstance.clear()
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
                            {terminalState.session.username}@{terminalState.session.host}
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
            <div className="flex-1 p-2">
                {!terminalState.isConnected ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <div className="text-lg mb-2">Terminal not connected</div>
                            <div className="text-sm">
                                {!connectionState.status.connected
                                    ? 'Connect to a host to open a terminal session'
                                    : 'Click "Open Terminal" to start a session'}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        ref={terminalRef}
                        className="h-full w-full"
                        style={{ height: '100%', width: '100%' }}
                    />
                )}
            </div>
        </div>
    )
}