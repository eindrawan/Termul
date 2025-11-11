import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useConnection } from '../contexts/ConnectionContext'
import { useTerminal } from '../contexts/TerminalContext'
import AlertDialog from './AlertDialog'
import TerminalBookmarkDialog from './TerminalBookmarkDialog'
import TerminalBookmarkList from './TerminalBookmarkList'
import { TerminalBookmark } from '../types'
import { DocumentDuplicateIcon, ClipboardIcon, BookmarkIcon, BookOpenIcon } from '@heroicons/react/24/outline'

interface TerminalProps {
    connectionId: string
}

export default function Terminal({ connectionId }: TerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const webLinksAddonRef = useRef<WebLinksAddon | null>(null)
    const { state: connectionState } = useConnection()
    const { state: terminalState, openMutation, closeMutation, sendInputMutation, clearError } = useTerminal()

    const connection = connectionState.activeConnections.get(connectionId)
    const isConnected = connection?.status.connected || false

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean
        message: string
        variant: 'success' | 'error' | 'warning' | 'info'
    }>({ isOpen: false, message: '', variant: 'info' })

    const [bookmarkDialog, setBookmarkDialog] = useState<{
        isOpen: boolean
        initialCommand: string
        initialName: string
    }>({ isOpen: false, initialCommand: '', initialName: '' })

    const [bookmarkList, setBookmarkList] = useState<{
        isOpen: boolean
        x: number
        y: number
    }>({ isOpen: false, x: 0, y: 0 })

    const [terminalBookmarks, setTerminalBookmarks] = useState<TerminalBookmark[]>([])

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

        // Don't fit immediately - wait for the terminal to be visible
        // The fit will happen when terminalState.isConnected becomes true

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

        // Handle terminal resize - notify backend when terminal dimensions change
        term.onResize(({ cols, rows }) => {
            console.log('[Terminal] Terminal resized - cols:', cols, 'rows:', rows)
            // Notify backend about the new terminal size
            window.electronAPI.resizeTerminal(connectionId, cols, rows)
                .catch(error => console.error('[Terminal] Failed to notify backend of resize:', error))
        })

        // Handle window resize
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current) {
                try {
                    fitAddonRef.current.fit()
                    // The onResize event will be triggered automatically by xterm
                    // console.log('[Terminal] Resized - cols:', xtermRef.current.cols, 'rows:', xtermRef.current.rows)
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
            // console.log('[Terminal] Cleaning up xterm instance')
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
        // console.log('[Terminal] Output effect triggered')
        // console.log('[Terminal] xtermRef.current:', xtermRef.current)
        // console.log('[Terminal] terminalState.output:', terminalState.output)

        if (!xtermRef.current) {
            // console.log('[Terminal] No xterm instance, skipping output')
            return
        }

        const term = xtermRef.current
        const outputArray = terminalState.output

        // console.log('[Terminal] Output changed, total items:', outputArray.length)

        // Write the latest output
        if (outputArray.length > 0) {
            const latestOutput = outputArray[outputArray.length - 1]
            // console.log('[Terminal] Writing output:', JSON.stringify(latestOutput))
            try {
                term.write(latestOutput)
                // console.log('[Terminal] Output written successfully')
            } catch (error) {
                console.error('[Terminal] Error writing output:', error)
            }
        } else {
            // console.log('[Terminal] No output to write')
        }
    }, [terminalState.output])

    // Handle terminal errors
    useEffect(() => {
        if (terminalState.error) {
            setAlertDialog({
                isOpen: true,
                message: terminalState.error,
                variant: 'error'
            })

            // Disconnect the terminal when an error occurs
            if (terminalState.isConnected) {
                closeMutation.mutate(connectionId)
            }

            // Clear the error after showing the dialog
            clearError()
        }
    }, [terminalState.error, terminalState.isConnected, connectionId, closeMutation, clearError])

    // Auto-open terminal when connected
    useEffect(() => {
        if (isConnected && !terminalState.isConnected && !openMutation.isPending) {
            // console.log('[Terminal] Auto-opening terminal for connection:', connectionId)
            openMutation.mutate(connectionId)
        }
    }, [isConnected, terminalState.isConnected, connectionId])

    // Handle terminal visibility changes
    useEffect(() => {
        if (terminalState.isConnected && xtermRef.current && fitAddonRef.current) {
            // console.log('[Terminal] Session opened, fitting terminal')
            // Use requestAnimationFrame to ensure the DOM has updated and the element is visible
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (fitAddonRef.current && xtermRef.current) {
                        try {
                            fitAddonRef.current.fit()
                            console.log('[Terminal] Fitted after connection - cols:', xtermRef.current.cols, 'rows:', xtermRef.current.rows)
                            // The onResize event handler will automatically notify the backend
                        } catch (error) {
                            console.error('[Terminal] Error during fit after connection:', error)
                        }
                    }
                })
            })
        } else if (!terminalState.isConnected && xtermRef.current) {
            // console.log('[Terminal] Session closed, clearing terminal')
            xtermRef.current.clear()
        }
    }, [terminalState.isConnected])

    // Load terminal bookmarks when connection changes
    useEffect(() => {
        const loadBookmarks = async () => {
            if (connection?.profile.id) {
                try {
                    const bookmarks = await window.electronAPI.getTerminalBookmarks(connection.profile.id)
                    setTerminalBookmarks(bookmarks)
                } catch (error) {
                    console.error('Failed to load terminal bookmarks:', error)
                }
            }
        }

        loadBookmarks()
    }, [connection?.profile.id])

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

    const handleClearTerminal = () => {
        if (xtermRef.current) {
            xtermRef.current.clear()
        }
    }

    const handleBookmarkCommand = () => {
        const selection = xtermRef.current?.getSelection()
        if (selection) {
            setBookmarkDialog({
                isOpen: true,
                initialCommand: selection,
                initialName: ''
            })
        } else {
            setBookmarkDialog({
                isOpen: true,
                initialCommand: '',
                initialName: ''
            })
        }
    }

    const handleSaveBookmark = async (bookmark: Omit<TerminalBookmark, 'id' | 'createdAt'>) => {
        try {
            await window.electronAPI.saveTerminalBookmark(bookmark)

            // Reload bookmarks
            if (connection?.profile.id) {
                const bookmarks = await window.electronAPI.getTerminalBookmarks(connection.profile.id)
                setTerminalBookmarks(bookmarks)
            }

            setAlertDialog({
                isOpen: true,
                message: 'Terminal bookmark saved successfully',
                variant: 'success'
            })
        } catch (error) {
            console.error('Failed to save terminal bookmark:', error)
            setAlertDialog({
                isOpen: true,
                message: 'Failed to save terminal bookmark',
                variant: 'error'
            })
        }
    }

    const handleShowBookmarks = (e: React.MouseEvent) => {
        setBookmarkList({
            isOpen: true,
            x: e.clientX,
            y: e.clientY
        })
    }

    const handleSelectBookmark = (bookmark: TerminalBookmark) => {
        if (xtermRef.current) {
            // Send the command to the terminal
            sendInputMutation.mutate({ connectionId, data: bookmark.command + '\n' })
        }
    }

    const handleDeleteBookmark = async (id: string) => {
        try {
            await window.electronAPI.deleteTerminalBookmark(id)

            // Reload bookmarks
            if (connection?.profile.id) {
                const bookmarks = await window.electronAPI.getTerminalBookmarks(connection.profile.id)
                setTerminalBookmarks(bookmarks)
            }

            setAlertDialog({
                isOpen: true,
                message: 'Terminal bookmark deleted successfully',
                variant: 'success'
            })
        } catch (error) {
            console.error('Failed to delete terminal bookmark:', error)
            setAlertDialog({
                isOpen: true,
                message: 'Failed to delete terminal bookmark',
                variant: 'error'
            })
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
        copyItem.innerHTML = '<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy'

        const pasteItem = document.createElement('button')
        pasteItem.className = 'w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 flex items-center'
        pasteItem.innerHTML = '<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>Paste'

        const bookmarkItem = document.createElement('button')
        bookmarkItem.className = 'w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 flex items-center'
        bookmarkItem.innerHTML = '<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>Bookmark Command'

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

        bookmarkItem.addEventListener('click', async (e) => {
            e.stopPropagation()
            const selection = term.getSelection()
            setBookmarkDialog({
                isOpen: true,
                initialCommand: selection || '',
                initialName: ''
            })
            document.body.removeChild(contextMenu)
        })

        // Add items to menu
        contextMenu.appendChild(copyItem)
        contextMenu.appendChild(pasteItem)
        contextMenu.appendChild(bookmarkItem)

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
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-sm font-medium transition-colors"
                            >
                                {openMutation.isLoading ? 'Opening...' : 'Open Terminal'}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleBookmarkCommand}
                                    className="p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                                    title="Bookmark Command"
                                >
                                    <BookmarkIcon className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={handleShowBookmarks}
                                    className="p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                                    title="Show Bookmarks"
                                >
                                    <BookOpenIcon className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={handleClearTerminal}
                                    className="p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                                    title="Clear Terminal"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Terminal Body */}
                <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
                    {/* Terminal container - always rendered and sized, but hidden when not connected */}
                    <div
                        ref={terminalRef}
                        className="w-full h-full absolute inset-0"
                        style={{
                            visibility: terminalState.isConnected ? 'visible' : 'hidden',
                            zIndex: terminalState.isConnected ? 1 : 0
                        }}
                    />

                    {/* Not connected message */}
                    {!terminalState.isConnected && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500" style={{ zIndex: 2 }}>
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

            {/* Terminal Bookmark Dialog */}
            <TerminalBookmarkDialog
                isOpen={bookmarkDialog.isOpen}
                onClose={() => setBookmarkDialog({ ...bookmarkDialog, isOpen: false })}
                onSave={handleSaveBookmark}
                profileId={connection?.profile.id || ''}
                initialCommand={bookmarkDialog.initialCommand}
                initialName={bookmarkDialog.initialName}
            />

            {/* Terminal Bookmark List */}
            {bookmarkList.isOpen && (
                <TerminalBookmarkList
                    bookmarks={terminalBookmarks}
                    onSelectBookmark={handleSelectBookmark}
                    onDeleteBookmark={handleDeleteBookmark}
                    onClose={() => setBookmarkList({ ...bookmarkList, isOpen: false })}
                    x={bookmarkList.x}
                    y={bookmarkList.y}
                />
            )}
        </>
    )
}