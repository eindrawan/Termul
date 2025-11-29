import React, { useEffect, useState } from 'react'
import { useConnection } from '../contexts/ConnectionContext'
import { useTerminal } from '../contexts/TerminalContext'
import { useTheme } from '../contexts/ThemeContext'
import AlertDialog from './AlertDialog'
import TerminalBookmarkDialog from './TerminalBookmarkDialog'
import TerminalBookmarkList from './TerminalBookmarkList'
import TerminalContextMenu from './TerminalContextMenu'
import { useXTerm } from '../hooks/useXTerm'
import { TerminalBookmark } from '../types'
import { BookmarkIcon, BookOpenIcon } from '@heroicons/react/24/outline'
import { Tooltip } from './Tooltip'

interface TerminalProps {
    connectionId: string
    isActive: boolean
}

export default function Terminal({ connectionId, isActive }: TerminalProps) {
    const { state: connectionState } = useConnection()
    const { getSessionState, openMutation, closeMutation, sendInputMutation, clearError } = useTerminal()
    const { theme } = useTheme()

    const connection = connectionState.activeConnections.get(connectionId)
    const isConnected = connection?.status.connected || false
    const terminalState = getSessionState(connectionId)

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

    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean
        x: number
        y: number
    }>({ isOpen: false, x: 0, y: 0 })

    const [terminalBookmarks, setTerminalBookmarks] = useState<TerminalBookmark[]>([])

    const handleInput = (data: string) => {
        console.log('[Terminal] User input:', data)
        sendInputMutation.mutate({ connectionId, data })
    }

    const handleResize = (cols: number, rows: number) => {
        console.log('[Terminal] Terminal resized - cols:', cols, 'rows:', rows)
        window.electronAPI.resizeTerminal(connectionId, cols, rows)
            .catch(error => console.error('[Terminal] Failed to notify backend of resize:', error))
    }

    const handleContextMenu = (event: MouseEvent) => {
        setContextMenu({
            isOpen: true,
            x: event.clientX,
            y: event.clientY
        })
    }

    const { terminalRef, xtermRef } = useXTerm({
        isActive,
        isConnected: terminalState.isConnected,
        theme,
        output: terminalState.output,
        onInput: handleInput,
        onResize: handleResize,
        onContextMenu: handleContextMenu
    })

    // Handle terminal errors
    useEffect(() => {
        if (terminalState.error) {
            setAlertDialog({
                isOpen: true,
                message: terminalState.error,
                variant: 'error'
            })

            if (terminalState.isConnected) {
                closeMutation.mutate(connectionId)
            }

            clearError(connectionId)
        }
    }, [terminalState.error, terminalState.isConnected, connectionId, closeMutation, clearError])

    // Auto-open terminal when connected and active
    useEffect(() => {
        if (isConnected && !terminalState.isConnected && !openMutation.isPending && isActive) {
            openMutation.mutate(connectionId)
        }
    }, [isConnected, terminalState.isConnected, connectionId, isActive])

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
        setBookmarkDialog({
            isOpen: true,
            initialCommand: selection || '',
            initialName: ''
        })
    }

    const handleSaveBookmark = async (bookmark: Omit<TerminalBookmark, 'id' | 'createdAt'>) => {
        try {
            await window.electronAPI.saveTerminalBookmark(bookmark)

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
        sendInputMutation.mutate({ connectionId, data: bookmark.command + '\n' })
    }

    const handleDeleteBookmark = async (id: string) => {
        try {
            await window.electronAPI.deleteTerminalBookmark(id)

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

    const handleCopy = async () => {
        xtermRef.current?.focus()
        try {
            const selection = xtermRef.current?.getSelection()
            if (selection) {
                await navigator.clipboard.writeText(selection)
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error)
        }
    }

    const handlePaste = async () => {
        xtermRef.current?.focus()
        try {
            const text = await navigator.clipboard.readText()
            if (text && xtermRef.current) {
                xtermRef.current.paste(text)
            }
        } catch (error) {
            console.error('Failed to paste from clipboard:', error)
        }
    }

    return (
        <>
            <AlertDialog
                isOpen={alertDialog.isOpen}
                message={alertDialog.message}
                variant={alertDialog.variant}
                onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
            />

            <div className="flex flex-col h-full bg-white dark:bg-gray-900">
                {/* Terminal Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-600">
                    <div className="flex items-center space-x-4">
                        <h3 className="text-gray-900 font-medium dark:text-gray-100">Terminal</h3>
                        {terminalState.session?.host && (
                            <span className="text-gray-500 text-sm dark:text-gray-300">
                                {terminalState.session.username || connection?.profile.username}@{terminalState.session.host}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        {!terminalState.isConnected ? (
                            <button
                                onClick={handleOpenTerminal}
                                disabled={openMutation.isPending}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-sm font-medium transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
                            >
                                {openMutation.isPending ? 'Opening...' : 'Open Terminal'}
                            </button>
                        ) : (
                            <>
                                <Tooltip content="Bookmark Command">
                                    <button
                                        onClick={handleBookmarkCommand}
                                        className="p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
                                    >
                                        <BookmarkIcon className="h-4 w-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip content="Show Bookmarks">
                                    <button
                                        onClick={handleShowBookmarks}
                                        className="p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
                                    >
                                        <BookOpenIcon className="h-4 w-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip content="Clear Terminal">
                                    <button
                                        onClick={handleClearTerminal}
                                        className="p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </Tooltip>
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
                                        ? 'Please connect to a host first'
                                        : 'Click "Open Terminal" to start a session'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <TerminalBookmarkDialog
                isOpen={bookmarkDialog.isOpen}
                initialCommand={bookmarkDialog.initialCommand}
                initialName={bookmarkDialog.initialName}
                profileId={connection?.profile.id || ''}
                onSave={handleSaveBookmark}
                onClose={() => setBookmarkDialog({ ...bookmarkDialog, isOpen: false })}
            />

            {bookmarkList.isOpen && (
                <TerminalBookmarkList
                    x={bookmarkList.x}
                    y={bookmarkList.y}
                    bookmarks={terminalBookmarks}
                    onSelectBookmark={handleSelectBookmark}
                    onDeleteBookmark={handleDeleteBookmark}
                    onClose={() => setBookmarkList({ ...bookmarkList, isOpen: false })}
                />
            )}

            {contextMenu.isOpen && (
                <TerminalContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
                    onCopy={handleCopy}
                    onPaste={handlePaste}
                    onBookmark={handleBookmarkCommand}
                />
            )}
        </>
    )
}